import { randomUUID } from "node:crypto";
import type { PlayerResult, ScoreVerdict, SubmitScorePayload } from "@arcadeclash/shared";
import { eq, or, sql } from "drizzle-orm";
import { determineDisconnectOutcome, determineMatchOutcome, type SidedSubmission } from "../validation/matchOutcome";
import { validateScore } from "../validation/scoreValidator";
import { db } from "../db/client";
import { matchesHistory } from "../db/schema";
import { ensureMatchSettlementsTable, escrowStake, payoutWinner, refundMatchSettlement } from "../wallet/ledger";
import type { MatchmakingSocket } from "./socketAuth";
import { removeFromQueue, type QueueEntry } from "./queue";

let historyTableEnsured = false;
export async function ensureMatchesHistoryTable() {
  if (historyTableEnsured) return;
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS matches_history (
        id text PRIMARY KEY,
        game_id text NOT NULL,
        player1_id text NOT NULL,
        player2_id text NOT NULL,
        winner_id text,
        currency varchar(16) NOT NULL DEFAULT 'COINS',
        stake integer NOT NULL DEFAULT 0,
        seed bigint NOT NULL,
        input_log_p1 jsonb,
        input_log_p2 jsonb,
        score_p1 integer NOT NULL DEFAULT 0,
        score_p2 integer NOT NULL DEFAULT 0,
        status varchar(16) NOT NULL DEFAULT 'ACTIVE',
        status_reason text,
        created_at timestamp with time zone NOT NULL DEFAULT NOW(),
        started_at timestamp with time zone,
        ended_at timestamp with time zone
      );
      ALTER TABLE matches_history ALTER COLUMN seed TYPE bigint;
      ALTER TABLE matches_history ADD COLUMN IF NOT EXISTS started_at timestamp with time zone;
      ALTER TABLE matches_history ADD COLUMN IF NOT EXISTS ended_at timestamp with time zone;
      CREATE INDEX IF NOT EXISTS idx_matches_p1 ON matches_history (player1_id);
      CREATE INDEX IF NOT EXISTS idx_matches_p2 ON matches_history (player2_id);
      CREATE INDEX IF NOT EXISTS idx_matches_game ON matches_history (game_id);
      CREATE INDEX IF NOT EXISTS idx_matches_status ON matches_history (status);
      CREATE INDEX IF NOT EXISTS idx_matches_created ON matches_history (created_at);
    `);
    historyTableEnsured = true;
  } catch {
    // Table may already exist
  }
}

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
  currency: "COINS" | "DIAMONDS";
  stake: number;
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

function toPlayerResult(player: MatchPlayer, disconnectedPlayer?: MatchPlayer): PlayerResult {
  if (!player.result) {
    if (disconnectedPlayer && player.userId !== disconnectedPlayer.userId) {
      return { username: player.username, score: null, reason: null, status: "opponent_disconnected" };
    }
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
// for a normal both-submitted resolution, forfeit resolution, or disconnect resolution.
async function emitResolved(match: MatchState, disconnectedPlayer?: MatchPlayer): Promise<void> {
  const [p1, p2] = match.players;
  const r1 = toPlayerResult(p1, disconnectedPlayer);
  const r2 = toPlayerResult(p2, disconnectedPlayer);

  let outcome;
  if (disconnectedPlayer) {
    const isP1Disconnected = p1.userId === disconnectedPlayer.userId;
    const sidedOutcome = determineDisconnectOutcome(toSidedSubmission(isP1Disconnected ? p2 : p1));
    outcome = isP1Disconnected ? sidedOutcome : { a: sidedOutcome.b, b: sidedOutcome.a };
  } else {
    outcome = determineMatchOutcome(toSidedSubmission(p1), toSidedSubmission(p2));
  }

  if (p1.socket.connected) {
    p1.socket.emit("matchResolved", { matchId: match.id, outcome: outcome.a, you: r1, opponent: r2 });
  }
  if (p2.socket.connected) {
    p2.socket.emit("matchResolved", { matchId: match.id, outcome: outcome.b, you: r2, opponent: r1 });
  }

  const winnerId = outcome.a === "win" ? p1.userId : outcome.b === "win" ? p2.userId : null;
  const loserId = outcome.a === "win" ? p2.userId : outcome.b === "win" ? p1.userId : null;

  let finalStatus = "COMPLETED";
  if (disconnectedPlayer) {
    finalStatus = "DISCONNECTED";
  } else if (!p1.result || !p2.result) {
    finalStatus = "FORFEITED";
  } else if (outcome.a === "draw") {
    finalStatus = "DRAW";
  } else if (outcome.a === "void") {
    finalStatus = "VOIDED";
  }

  // FINANCIAL INVARIANT: Payout winner if match had stake > 0 and ended with a winner;
  // refund both players if match ended in a draw or void.
  if (match.stake > 0) {
    try {
      if (winnerId && loserId) {
        const { winnerBalances } = await payoutWinner(winnerId, loserId, match.currency, match.stake, match.id);
        const winnerPlayer = p1.userId === winnerId ? p1 : p2;
        if (winnerPlayer.socket.connected) {
          // @ts-expect-error custom event emission for live balance update
          winnerPlayer.socket.emit("balanceUpdate", { balances: winnerBalances });
        }
      } else {
        // Draw or void — refund escrowed stakes to both players
        const refundStatus = finalStatus === "DRAW" ? "DRAW" : "VOIDED";
        const { p1Balances, p2Balances } = await refundMatchSettlement(p1.userId, p2.userId, match.currency, match.stake, match.id, refundStatus);
        if (p1.socket.connected && p1Balances) {
          // @ts-expect-error custom event emission for live balance update
          p1.socket.emit("balanceUpdate", { balances: p1Balances });
        }
        if (p2.socket.connected && p2Balances) {
          // @ts-expect-error custom event emission for live balance update
          p2.socket.emit("balanceUpdate", { balances: p2Balances });
        }
      }
    } catch (err) {
      console.error(`[matches] Failed financial settlement for match ${match.id}:`, err);
    }
  }

  // Persist completed match record to database for Profile Match History & Replaying
  const now = new Date();
  try {
    await ensureMatchesHistoryTable();
    await db
      .insert(matchesHistory)
      .values({
        id: match.id,
        gameId: match.gameId,
        player1Id: p1.userId,
        player2Id: p2.userId,
        winnerId,
        currency: match.currency,
        stake: match.stake,
        seed: match.seed,
        inputLogP1: p1.result?.inputLog ?? null,
        inputLogP2: p2.result?.inputLog ?? null,
        scoreP1: p1.result?.score ?? 0,
        scoreP2: p2.result?.score ?? 0,
        status: finalStatus,
        statusReason: winnerId ? `Winner: ${winnerId}` : `Outcome: ${finalStatus}`,
        startedAt: now,
        endedAt: now,
      })
      .onConflictDoUpdate({
        target: matchesHistory.id,
        set: {
          winnerId,
          inputLogP1: p1.result?.inputLog ?? null,
          inputLogP2: p2.result?.inputLog ?? null,
          scoreP1: p1.result?.score ?? 0,
          scoreP2: p2.result?.score ?? 0,
          status: finalStatus,
          statusReason: winnerId ? `Winner: ${winnerId}` : `Outcome: ${finalStatus}`,
          endedAt: now,
        },
      });
  } catch (err) {
    console.error(`[matches] Failed to persist match history record ${match.id}:`, err);
  }
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
  const currency = isGuestMatch ? "COINS" : (a.currency ?? "COINS");
  const stake = isGuestMatch ? 0 : (a.stake ?? 0);

  console.log(
    `[matchmaking] DIAGNOSTIC createMatch: gameId=${gameId} seed=${seed} a=${a.username} b=${b.username} guestMatch=${isGuestMatch} currency=${currency} stake=${stake}`,
  );

  const matchId = randomUUID();
  const match: MatchState = {
    id: matchId,
    gameId,
    seed,
    currency,
    stake,
    players: [
      { socket: a.socket, userId: a.userId, username: a.username, result: null },
      { socket: b.socket, userId: b.userId, username: b.username, result: null },
    ],
    forfeitTimer: null,
  };

  matches.set(matchId, match);
  socketToMatch.set(a.socket, matchId);
  socketToMatch.set(b.socket, matchId);

  // DURABLE LIFECYCLE PERSISTENCE: Persist match record immediately in state ACTIVE
  void db
    .insert(matchesHistory)
    .values({
      id: matchId,
      gameId,
      player1Id: a.userId,
      player2Id: b.userId,
      currency,
      stake,
      seed,
      status: "ACTIVE",
      startedAt: new Date(),
    })
    .onConflictDoNothing()
    .catch((err) => {
      console.error(`[matches] Failed to persist initial match record ${matchId}:`, err);
    });

  // FINANCIAL INVARIANT: Escrow debits both players' ledger balances when match starts if stake > 0
  if (stake > 0 && !isGuestMatch) {
    void escrowStake(a.userId, currency, stake, matchId).catch((err) => {
      console.error(`[matches] Failed to escrow stake for ${a.userId} in match ${matchId}:`, err);
    });
    void escrowStake(b.userId, currency, stake, matchId).catch((err) => {
      console.error(`[matches] Failed to escrow stake for ${b.userId} in match ${matchId}:`, err);
    });
  }

  a.socket.emit("matched", { matchId, gameId, seed, opponentUsername: b.username });
  b.socket.emit("matched", { matchId, gameId, seed, opponentUsername: a.username });
}

export async function submitScore(socket: MatchmakingSocket, payload: SubmitScorePayload): Promise<void> {
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
    await emitResolved(match);
    return;
  }

  match.forfeitTimer = setTimeout(() => {
    const ended = endMatch(matchId);
    if (ended) void emitResolved(ended);
  }, FORFEIT_GRACE_MS);
}

async function executeDisconnectForfeit(match: MatchState, disconnected: MatchPlayer, opponent: MatchPlayer): Promise<void> {
  endMatch(match.id);
  await emitResolved(match, disconnected);
}

// Handles socket disconnect with a 10s grace period (RECONNECT_GRACE_MS).
// If reconnected before grace period expires, match state resumes seamlessly.
export async function handleDisconnect(socket: MatchmakingSocket, graceMs: number = RECONNECT_GRACE_MS): Promise<void> {
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
    await executeDisconnectForfeit(match, disconnected, opponent);
    return;
  }

  const timer = setTimeout(() => {
    disconnectTimers.delete(timerKey);
    void executeDisconnectForfeit(match, disconnected, opponent);
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

export function getActiveMatchesSummary() {
  return Array.from(matches.values()).map((m) => ({
    matchId: m.id,
    gameId: m.gameId,
    player1Id: m.players[0].userId,
    player1Username: m.players[0].username,
    player2Id: m.players[1].userId,
    player2Username: m.players[1].username,
    currency: m.currency,
    stake: m.stake,
    status: "ACTIVE",
  }));
}

export async function recoverOrphanMatches(): Promise<number> {
  try {
    await ensureMatchSettlementsTable();
    await ensureMatchesHistoryTable();
    const activeMatches = await db.query.matchesHistory.findMany({
      where: or(eq(matchesHistory.status, "ACTIVE"), eq(matchesHistory.status, "CREATED")),
    });

    if (!activeMatches || activeMatches.length === 0) return 0;

    console.log(`[matches] Found ${activeMatches.length} orphan active match(es) from previous server run. Recovering...`);

    const now = new Date();
    for (const m of activeMatches) {
      await db.transaction(async (tx) => {
        await tx
          .update(matchesHistory)
          .set({
            status: "INTERRUPTED",
            statusReason: "Server restarted during active gameplay",
            endedAt: now,
          })
          .where(eq(matchesHistory.id, m.id));

        if (m.stake > 0) {
          await refundMatchSettlement(m.player1Id, m.player2Id, m.currency as any, m.stake, m.id, "VOIDED");
        }
      });
    }
    return activeMatches.length;
  } catch (err) {
    console.error("[matches] Error recovering orphan matches:", err);
    return 0;
  }
}
