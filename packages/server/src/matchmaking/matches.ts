import { randomUUID } from "node:crypto";
import type { PlayerResult, ScoreVerdict, SubmitScorePayload } from "@arcadeclash/shared";
import { determineDisconnectOutcome, determineMatchOutcome, type SidedSubmission } from "../validation/matchOutcome";
import { validateScore } from "../validation/scoreValidator";
import { db } from "../db/client";
import { matchesHistory } from "../db/schema";
import type { MatchmakingSocket } from "./socketAuth";
import { removeFromQueue, type QueueEntry } from "./queue";

// Grace window a player gets to submit a score once their opponent already
// has, before the match is resolved as a forfeit against them. Anchored at
// first submission rather than match start: these games have no fixed round
// length (they end on collision/game-over, not a clock), so a flat timer
// from match creation would risk cutting off a legitimately long, skilled
// run. Starting the clock only once someone is actually waiting means it can
// never fire against a run that's still honestly in progress when the match
// began — it only ever protects whoever already finished.
//
// 120s is generous relative to this project's own 60-180s round-length
// target (see PROGRESS.md's project summary), so it shouldn't cut off a
// top-of-range legitimate run. Deliberately not a void on timeout: the
// submitted score wins outright. Voiding would let a losing player's
// dominant strategy (don't submit, avoid the loss) succeed anyway; forfeit
// closes that off — submit and you have a shot at winning or tying, don't
// submit and you lose outright.
export const FORFEIT_GRACE_MS = 120_000;
export const RECONNECT_GRACE_MS = 10_000;

type SubmittedResult = {
  score: number;
  reason: string;
  durationMs: number;
  verdict: ScoreVerdict;
  inputLog?: Array<{ tick: number; action: string }>;
};

type MatchPlayer = {
  socket: MatchmakingSocket;
  userId: string;
  username: string;
  result: SubmittedResult | null;
};

type MatchState = {
  id: string;
  gameId: string;
  seed: number;
  players: [MatchPlayer, MatchPlayer];
  forfeitTimer: ReturnType<typeof setTimeout> | null;
};

// In-memory only, same reasoning as queue.ts — see PROGRESS.md for what a
// server restart does to an in-progress match (state is simply gone; both
// sockets drop, each client shows "connection lost").
const matches = new Map<string, MatchState>();
// Reverse index so a disconnecting/submitting socket can find its match
// without scanning every match in the process.
const socketToMatch = new Map<MatchmakingSocket, string>();
// Map key `${matchId}:${userId}` -> disconnect grace period timer
const disconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();

function playerFor(match: MatchState, socket: MatchmakingSocket): MatchPlayer | null {
  if (match.players[0].socket === socket) return match.players[0];
  if (match.players[1].socket === socket) return match.players[1];
  return null;
}

function playerForUserId(match: MatchState, userId: string): MatchPlayer | null {
  if (match.players[0].userId === userId) return match.players[0];
  if (match.players[1].userId === userId) return match.players[1];
  return null;
}

function otherPlayer(match: MatchState, socket: MatchmakingSocket): MatchPlayer {
  return match.players[0].socket === socket ? match.players[1] : match.players[0];
}

function toPlayerResult(player: MatchPlayer): PlayerResult {
  if (!player.result) {
    return { username: player.username, score: null, reason: null, status: "forfeited" };
  }
  return {
    username: player.username,
    score: player.result.score,
    reason: player.result.reason,
    status: "completed",
    verdict: player.result.verdict,
  };
}

function toSidedSubmission(player: MatchPlayer): SidedSubmission {
  if (!player.result) return null;
  return { score: player.result.score, verdict: player.result.verdict };
}

// Single cleanup path for every way a match can end (both submitted, forfeit
// timer fired, a player disconnected) — always clears the pending forfeit
// timer along with the match state, so a stale timer can never fire against
// a match that already ended some other way.
function endMatch(matchId: string): MatchState | undefined {
  const match = matches.get(matchId);
  if (!match) return undefined;
  if (match.forfeitTimer) clearTimeout(match.forfeitTimer);

  for (const player of match.players) {
    const timerKey = `${matchId}:${player.userId}`;
    const timer = disconnectTimers.get(timerKey);
    if (timer) {
      clearTimeout(timer);
      disconnectTimers.delete(timerKey);
    }
  }

  matches.delete(matchId);
  for (const player of match.players) socketToMatch.delete(player.socket);
  return match;
}

// Emits a personalized matchResolved to each still-connected player, built
// from whatever `result` is currently on each MatchPlayer — works unchanged
// for a normal both-submitted resolution and a forfeit resolution (one
// player's result is simply null, toPlayerResult reports it as forfeited).
function emitResolved(match: MatchState): void {
  const [p1, p2] = match.players;
  const r1 = toPlayerResult(p1);
  const r2 = toPlayerResult(p2);
  const outcome = determineMatchOutcome(toSidedSubmission(p1), toSidedSubmission(p2));
  if (p1.socket.connected) {
    p1.socket.emit("matchResolved", { matchId: match.id, outcome: outcome.a, you: r1, opponent: r2 });
  }
  if (p2.socket.connected) {
    p2.socket.emit("matchResolved", { matchId: match.id, outcome: outcome.b, you: r2, opponent: r1 });
  }

  // Persist completed match record to database for Profile Match History & Replaying
  void db
    .insert(matchesHistory)
    .values({
      id: match.id,
      gameId: match.gameId,
      player1Id: p1.userId,
      player2Id: p2.userId,
      winnerId: outcome.a === "win" ? p1.userId : outcome.b === "win" ? p2.userId : null,
      currency: "COINS",
      stake: 0,
      seed: match.seed,
      inputLogP1: p1.result?.inputLog ?? null,
      inputLogP2: p2.result?.inputLog ?? null,
      scoreP1: p1.result?.score ?? 0,
      scoreP2: p2.result?.score ?? 0,
    })
    .catch((err) => {
      console.error(`[matches] Failed to persist match history record ${match.id}:`, err);
    });
}

// Used by index.ts to validate a visibilityHidden report actually belongs
// to a match this socket is in, before logging it — a cheap defensive check
// against a bogus matchId, same spirit as submitScore's own matchId check.
export function isSocketInMatch(socket: MatchmakingSocket, matchId: string): boolean {
  return socketToMatch.get(socket) === matchId;
}

export function createMatch(gameId: string, a: QueueEntry, b: QueueEntry, seed: number): void {
  // SECURITY INVARIANT: Self-match guard is enforced by queue deduplication.
  // Both sides share the exact same server-issued match.seed.
  // GUEST INVARIANT: Matches involving an unauthenticated guest strictly enforce stake = 0 (Free Play).
  const isGuestMatch = Boolean(a.socket.data.isGuest || b.socket.data.isGuest);
  console.log(
    `[matchmaking] DIAGNOSTIC createMatch: gameId=${gameId} seed=${seed} a=${a.username} b=${b.username} guestMatch=${isGuestMatch}`,
  );

  const matchId = randomUUID();
  const match: MatchState = {
    id: matchId,
    gameId,
    seed,
    players: [
      { socket: a.socket, userId: a.userId, username: a.username, result: null },
      { socket: b.socket, userId: b.userId, username: b.username, result: null },
    ],
    forfeitTimer: null,
  };

  matches.set(matchId, match);
  socketToMatch.set(a.socket, matchId);
  socketToMatch.set(b.socket, matchId);

  a.socket.emit("matched", { matchId, gameId, seed, opponentUsername: b.username });
  b.socket.emit("matched", { matchId, gameId, seed, opponentUsername: a.username });
}

export function submitScore(socket: MatchmakingSocket, payload: SubmitScorePayload): void {
  const matchId = socketToMatch.get(socket);
  if (!matchId || matchId !== payload.matchId) return; // stale/bogus matchId — ignore

  const match = matches.get(matchId);
  if (!match) return;

  const player = playerFor(match, socket);
  if (!player || player.result) return; // not a participant, or a duplicate submission — ignore either way

  console.log(
    `[matchmaking] DIAGNOSTIC submitScore: matchId=${matchId} seed=${match.seed} user=${socket.data.username} ` +
      `viewport=${payload.viewport.width}x${payload.viewport.height} claimedScore=${payload.score}`,
  );

  // SECURITY INVARIANT: Score validation uses match.seed issued by the server at createMatch.
  // Never uses client-provided seed input.
  const validation = validateScore({
    gameId: match.gameId,
    seed: match.seed,
    inputLog: payload.inputLog,
    claimedScore: payload.score,
    durationMs: payload.durationMs,
    viewport: payload.viewport,
  });

  player.result = {
    score: payload.score,
    reason: payload.reason,
    durationMs: payload.durationMs,
    verdict: validation.verdict,
    inputLog: payload.inputLog,
  };

  const opponent = otherPlayer(match, socket);
  if (opponent.result) {
    endMatch(matchId);
    emitResolved(match);
    return;
  }

  match.forfeitTimer = setTimeout(() => {
    const ended = endMatch(matchId);
    if (ended) emitResolved(ended);
  }, FORFEIT_GRACE_MS);
}

function executeDisconnectForfeit(match: MatchState, disconnected: MatchPlayer, opponent: MatchPlayer): void {
  const outcome = determineDisconnectOutcome(toSidedSubmission(opponent));
  endMatch(match.id);

  if (!opponent.socket.connected) return;

  const opponentResult: PlayerResult = opponent.result
    ? toPlayerResult(opponent)
    : { username: opponent.username, score: null, reason: null, status: "opponent_disconnected" };
  const disconnectedResult: PlayerResult = { username: disconnected.username, score: null, reason: null, status: "forfeited" };

  opponent.socket.emit("matchResolved", {
    matchId: match.id,
    outcome: outcome.b,
    you: opponentResult,
    opponent: disconnectedResult,
  });
}

// Handles socket disconnect with a 10s grace period (RECONNECT_GRACE_MS).
// If reconnected before grace period expires, match state resumes seamlessly.
export function handleDisconnect(socket: MatchmakingSocket, graceMs: number = RECONNECT_GRACE_MS): void {
  removeFromQueue(socket);

  const matchId = socketToMatch.get(socket);
  if (!matchId) return;

  const match = matches.get(matchId);
  if (!match) return;

  const disconnected = playerFor(match, socket);
  if (!disconnected) return;

  if (disconnected.result) return;

  const timerKey = `${matchId}:${disconnected.userId}`;
  if (disconnectTimers.has(timerKey)) return;

  const opponent = otherPlayer(match, socket);

  if (graceMs <= 0) {
    executeDisconnectForfeit(match, disconnected, opponent);
    return;
  }

  const timer = setTimeout(() => {
    disconnectTimers.delete(timerKey);
    executeDisconnectForfeit(match, disconnected, opponent);
  }, graceMs);

  disconnectTimers.set(timerKey, timer);
}

// Re-attaches a reconnected socket to an active match if within the grace window.
export function handleReconnect(userId: string, newSocket: MatchmakingSocket): boolean {
  for (const [matchId, match] of matches) {
    const player = playerForUserId(match, userId);
    if (player && !player.result) {
      const timerKey = `${matchId}:${userId}`;
      const timer = disconnectTimers.get(timerKey);
      if (timer) {
        clearTimeout(timer);
        disconnectTimers.delete(timerKey);
      }
      socketToMatch.delete(player.socket);
      player.socket = newSocket;
      socketToMatch.set(newSocket, matchId);

      const opponent = otherPlayer(match, newSocket);
      newSocket.emit("matched", {
        matchId,
        gameId: match.gameId,
        seed: match.seed,
        opponentUsername: opponent.username,
      });
      return true;
    }
  }
  return false;
}
