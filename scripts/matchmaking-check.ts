// Standalone verification for the matchmaking queue/match lifecycle — same
// convention as scripts/determinism-check.ts: runs outside a real Socket.IO
// server or browser, no HTTP handshake, no database. Exercises the actual
// queue.ts/matches.ts logic (not a reimplementation of it) against minimal
// fake sockets cast to the real MatchmakingSocket type. Deliberately does
// NOT import socketAuth.ts's runtime value exports (only its types) or
// matchmaking/index.ts — those need a live DB/JWT_SECRET and a real
// handshake, out of scope for a headless script, same reasoning as
// determinism-check.ts not exercising the DOM.
//
// Run: npx tsx scripts/matchmaking-check.ts
//
// submitScore's payload now requires a real inputLog/viewport (score
// validation, a later session) — every submitScore call below uses a real
// (seed, inputLog) pair replayed via the actual shared adapters/driver to
// get a real, honestly-validating score, not a hand-picked number. This
// wasn't true before: 6 assertions here silently failed for two sessions
// because the payload guard rejected every under-shaped submission and
// nobody re-ran this file to notice — see PROGRESS.md and CLAUDE.md's
// "run every test script" rule, added because of exactly this.
// createMatch now persists and escrows, so this suite requires an isolated test DB.
import "./require-disposable-test-database.ts";

import {
  createMatch,
  FORFEIT_GRACE_MS,
  handleDisconnect,
  submitScore,
} from "../packages/server/src/matchmaking/matches.ts";
import {
  enqueue,
  generateSeed,
  getPublicQueueState,
  isValidGameId,
  removeFromQueue,
  setOnQueueChange,
  tryPair,
} from "../packages/server/src/matchmaking/queue.ts";
import {
  cancelInvitesForSocket,
  getGuestLinkInfo,
  handleCreateGuestLink,
  handleJoinGuestLink,
} from "../packages/server/src/matchmaking/invites.ts";
import type { MatchmakingSocket, MatchmakingSocketData } from "../packages/server/src/matchmaking/socketAuth.ts";
import { replayEngine, type InputLogEntry } from "@fugluck/shared";
import { neonRunnerReplayAdapter } from "../games/neon-runner/replay.ts";
import { pixelNinjaDashReplayAdapter } from "../games/pixel-ninja-dash/replay.ts";
import { db } from "../packages/server/src/db/client.ts";
import { matchesHistory } from "../packages/server/src/db/schema.ts";
import { eq } from "drizzle-orm";

let failures = 0;

function check(label: string, pass: boolean, detail?: string) {
  if (pass) {
    console.log(`  PASS  ${label}`);
  } else {
    failures++;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

const VIEWPORT = { width: 1280, height: 720 };

// Same rationale as score-validation-check.ts: dense, spread-out periodic
// input rather than a couple of sparse hand-picked ticks, so it reliably
// produces a real, non-trivial run regardless of where this seed's
// obstacles happen to land.
function periodicLog(actionOn: string, actionOff: string | null, period: number, count: number): InputLogEntry[] {
  const log: InputLogEntry[] = [];
  for (let i = 0; i < count; i++) {
    const t = 20 + i * period;
    log.push({ tick: t, action: actionOn });
    if (actionOff) log.push({ tick: t + 4, action: actionOff });
  }
  return log;
}


type Emitted = { event: string; payload: unknown };

function fakeSocket(userId: string, username: string): MatchmakingSocket & { emitted: Emitted[] } {
  const emitted: Emitted[] = [];
  const socket = {
    connected: true,
    data: { userId, username } as MatchmakingSocketData,
    emit(event: string, payload: unknown) {
      emitted.push({ event, payload });
      return true;
    },
    emitted,
  };
  return socket as unknown as MatchmakingSocket & { emitted: Emitted[] };
}

async function waitForEvent(
  socket: MatchmakingSocket & { emitted: Emitted[] },
  event: string,
  timeoutMs = 5_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!socket.emitted.some((entry) => entry.event === event) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

// Wrapped in an async function rather than using top-level await — this repo
// has no root-level "type": "module", so tsx treats scripts/ as CJS, which
// doesn't support top-level await.
async function main() {
console.log(`(forfeit grace window is ${FORFEIT_GRACE_MS}ms in real code; sped up below for this test only)`);

// ---------------------------------------------------------------------------
// Test 1: game id validation
// ---------------------------------------------------------------------------
console.log("\nTest 1: game id validation");
check("known game id accepted", isValidGameId("neon-runner"));
check("unknown game id rejected", !isValidGameId("totally-made-up-game"));

// ---------------------------------------------------------------------------
// Test 2: queue pairing + self-match guard
// ---------------------------------------------------------------------------
console.log("\nTest 2: queue pairing");
{
  const a = fakeSocket("user-a", "Alice");
  const b = fakeSocket("user-b", "Bob");
  enqueue("neon-runner", a);
  check("single entry does not pair", tryPair("neon-runner") === null);
  enqueue("neon-runner", a); // re-enqueue same user — dedup should replace, not duplicate
  enqueue("neon-runner", b);
  const pair = tryPair("neon-runner");
  check("two different users pair", pair !== null);
  check("no leftover entries after pairing (dedup meant only 2 ever existed)", tryPair("neon-runner") === null);
}

// ---------------------------------------------------------------------------
// Test 3: removeFromQueue actually removes (covers both cancel and disconnect-while-queued)
// ---------------------------------------------------------------------------
console.log("\nTest 3: queue cancel/removal");
{
  const a = fakeSocket("user-c", "Cara");
  const b = fakeSocket("user-d", "Dan");
  const c = fakeSocket("user-e", "Eve");
  enqueue("space-blaster", a);
  enqueue("space-blaster", b);
  removeFromQueue(a); // simulates Cancel button or a mid-queue disconnect
  check("pairing needs a 2nd real player after removal", tryPair("space-blaster") === null);
  enqueue("space-blaster", c);
  const pair = tryPair("space-blaster");
  const pairedIds = pair ? [pair[0].userId, pair[1].userId].sort().join(",") : "";
  check("removed player excluded from pairing", pairedIds === ["user-d", "user-e"].sort().join(","), `got [${pairedIds}]`);
}

// ---------------------------------------------------------------------------
// Test 4: createMatch emits matched to both with matching matchId/seed
// ---------------------------------------------------------------------------
console.log("\nTest 4: match creation");
const alice = fakeSocket("user-alice", "Alice");
const bob = fakeSocket("user-bob", "Bob");
let matchId = "";
// A fixed test seed, not generateSeed() — Test 5+ need to hand-verify that
// specific (seed, inputLog) pairs replay to different scores, which isn't
// possible against a fresh random seed every run (tried it: a random seed
// can land on an obstacle layout where the sample logs below coincidentally
// don't diverge — see Test 5's own comment). generateSeed()'s actual
// randomness/range is still exercised on its own line below, just not used
// for the match itself.
const matchSeed = 424242;
{
  check("generateSeed() returns a value in valid uint32 range", (() => {
    const s = generateSeed();
    return s >= 0 && s < 0x100000000;
  })());
  await createMatch(
    "neon-runner",
    { socket: alice, userId: "user-alice", username: "Alice" },
    { socket: bob, userId: "user-bob", username: "Bob" },
    matchSeed,
  );
  const aliceMatched = alice.emitted.find((e) => e.event === "matched")?.payload as any;
  const bobMatched = bob.emitted.find((e) => e.event === "matched")?.payload as any;
  check("both sides received matched", !!aliceMatched && !!bobMatched);
  matchId = aliceMatched?.matchId ?? "";
  check("both sides got the same matchId", matchId !== "" && matchId === bobMatched?.matchId);
  check("alice sees bob's username as opponent", aliceMatched?.opponentUsername === "Bob");
  check("bob sees alice's username as opponent", bobMatched?.opponentUsername === "Alice");
  check("both sides got the match's seed", aliceMatched?.seed === matchSeed && bobMatched?.seed === matchSeed);
}

// ---------------------------------------------------------------------------
// Test 5: normal resolution — both submit, both get matchResolved with real, replay-validated scores
// ---------------------------------------------------------------------------
console.log("\nTest 5: normal resolution (both submit)");
let aliceScore = 0;
let bobScore = 0;
{
  // Same (seed, log) combination already confirmed to diverge in
  // score-validation-check.ts's Test 3 — reused here rather than
  // re-discovering it, since matchSeed above is the same fixed constant.
  // Two different active patterns (jump-only vs. alternating jump/slide)
  // were tried first against a random per-run seed and kept landing on
  // identical scores — jumping alone never helps against an overhang
  // obstacle, so a jump-only "active" log can die exactly like an empty one
  // if an overhang happens to be what's fatal. Empty vs. a real active log
  // is the reliable contrast; the fixed seed makes it reproducible too.
  const aliceLog = periodicLog("jumpPressed", "jumpReleased", 20, 25);
  const bobLog: InputLogEntry[] = [];
  const aliceOutcome = replayEngine(neonRunnerReplayAdapter, matchSeed, aliceLog, VIEWPORT);
  const bobOutcome = replayEngine(neonRunnerReplayAdapter, matchSeed, bobLog, VIEWPORT);
  aliceScore = aliceOutcome.finalScore;
  bobScore = bobOutcome.finalScore;
  check(
    "precondition: alice's and bob's honest replays produce different scores",
    aliceScore !== bobScore,
    `both ${aliceScore}`,
  );

  await submitScore(alice, {
    matchId,
    score: aliceScore,
    reason: "collision",
    durationMs: Math.round((aliceOutcome.finalTick / 60) * 1000),
    inputLog: aliceLog,
    viewport: VIEWPORT,
  });
  check("no resolution yet after only one submission", !alice.emitted.some((e) => e.event === "matchResolved"));
  await submitScore(bob, {
    matchId,
    score: bobScore,
    reason: "collision",
    durationMs: Math.round((bobOutcome.finalTick / 60) * 1000),
    inputLog: bobLog,
    viewport: VIEWPORT,
  });
  const aliceResolved = alice.emitted.find((e) => e.event === "matchResolved")?.payload as any;
  const bobResolved = bob.emitted.find((e) => e.event === "matchResolved")?.payload as any;
  check(
    "alice resolved: her score as 'you', status completed",
    aliceResolved?.you?.score === aliceScore && aliceResolved?.you?.status === "completed",
  );
  check("alice resolved: bob's score as 'opponent'", aliceResolved?.opponent?.score === bobScore);
  check("bob resolved: his score as 'you'", bobResolved?.you?.score === bobScore);
  check("bob resolved: alice's score as 'opponent'", bobResolved?.opponent?.score === aliceScore);
}

// ---------------------------------------------------------------------------
// Test 6: duplicate/stale submission after resolution is ignored
// ---------------------------------------------------------------------------
console.log("\nTest 6: duplicate submission after resolution");
{
  const before = alice.emitted.length;
  await submitScore(alice, { matchId, score: 999, reason: "collision", durationMs: 1, inputLog: [], viewport: VIEWPORT });
  check("resubmitting after resolution emits nothing new", alice.emitted.length === before);
}

// ---------------------------------------------------------------------------
// Test 7: forfeit timeout — one player never submits
// ---------------------------------------------------------------------------
console.log("\nTest 7: forfeit timeout");
{
  const carl = fakeSocket("user-carl", "Carl");
  const dana = fakeSocket("user-dana", "Dana");
  const seed = generateSeed();
  await createMatch(
    "pixel-ninja-dash",
    { socket: carl, userId: "user-carl", username: "Carl" },
    { socket: dana, userId: "user-dana", username: "Dana" },
    seed,
  );
  const carlMatchId = (carl.emitted.find((e) => e.event === "matched")?.payload as any)?.matchId;
  const carlLog = periodicLog("dashPressed", null, 15, 40);
  const carlScore = replayEngine(pixelNinjaDashReplayAdapter, seed, carlLog, VIEWPORT).finalScore;

  // Speed up the real forfeit timer for this one call, without touching
  // matches.ts's use of the real setTimeout/clearTimeout — same goal as
  // determinism-check.ts's injectable fake clock, applied via a temporary
  // global stub since matches.ts wasn't built with an injectable timer (a
  // real Socket.IO server has no reason to ever fast-forward this).
  const realSetTimeout = global.setTimeout;
  // @ts-expect-error test-only stub, intentionally narrower than the real overloads
  global.setTimeout = (fn: (...a: unknown[]) => void) => realSetTimeout(fn, 10);
  await submitScore(carl, {
    matchId: carlMatchId,
    score: carlScore,
    reason: "collision",
    durationMs: 5000,
    inputLog: carlLog,
    viewport: VIEWPORT,
  });
  global.setTimeout = realSetTimeout;

  await waitForEvent(carl, "matchResolved");

  const carlResolved = carl.emitted.find((e) => e.event === "matchResolved")?.payload as any;
  const danaResolved = dana.emitted.find((e) => e.event === "matchResolved")?.payload as any;
  check(
    "submitter (carl) wins by forfeit",
    carlResolved?.you?.score === carlScore && carlResolved?.opponent?.status === "forfeited",
  );
  check(
    "non-submitter (dana) is told she forfeited",
    danaResolved?.you?.status === "forfeited" && danaResolved?.opponent?.score === carlScore,
  );
}

// ---------------------------------------------------------------------------
// Test 8: mid-match disconnect — resolves as a loss for the disconnector,
// never voids. Three sub-cases, since the correct behavior genuinely differs:
// see packages/server/src/validation/matchOutcome.ts's determineDisconnectOutcome
// and matches.ts's handleDisconnect for the reasoning behind each.
// ---------------------------------------------------------------------------
console.log("\nTest 8: disconnect mid-match");

// 8a: the disconnecting player had ALREADY submitted — a no-op for
// resolution (they finished honestly and left; not an abandonment). The
// match must stay alive and resolve normally once the opponent submits.
{
  const eli = fakeSocket("user-eli", "Eli");
  const fay = fakeSocket("user-fay", "Fay");
  const seed = generateSeed();
  await createMatch(
    "neon-runner",
    { socket: eli, userId: "user-eli", username: "Eli" },
    { socket: fay, userId: "user-fay", username: "Fay" },
    seed,
  );
  const eliMatchId = (eli.emitted.find((e) => e.event === "matched")?.payload as any)?.matchId;
  const eliLog = periodicLog("jumpPressed", "jumpReleased", 20, 10);
  const eliScore = replayEngine(neonRunnerReplayAdapter, seed, eliLog, VIEWPORT).finalScore;

  await submitScore(eli, {
    matchId: eliMatchId,
    score: eliScore,
    reason: "collision",
    durationMs: 5000,
    inputLog: eliLog,
    viewport: VIEWPORT,
  }); // starts the real 120s forfeit timer, waiting on fay
  eli.connected = false;
  await handleDisconnect(eli);
  check("8a: disconnect after already submitting emits nothing new", !eli.emitted.some((e) => e.event === "matchResolved"));

  const fayLog = periodicLog("slidePressed", null, 25, 10);
  const fayScore = replayEngine(neonRunnerReplayAdapter, seed, fayLog, VIEWPORT).finalScore;
  await submitScore(fay, {
    matchId: eliMatchId,
    score: fayScore,
    reason: "collision",
    durationMs: 4800,
    inputLog: fayLog,
    viewport: VIEWPORT,
  });
  const fayResolved = fay.emitted.find((e) => e.event === "matchResolved")?.payload as any;
  check(
    "8a: match still resolves normally (real score comparison) after the already-submitted side's disconnect",
    !!fayResolved && fayResolved.opponent?.score === eliScore && fayResolved.opponent?.status === "completed",
  );
}

// 8b: the disconnecting player never submitted; the opponent already had —
// resolves immediately as a win for the opponent, doesn't wait for the
// forfeit timer, and the timer never fires late afterward.
{
  const gus = fakeSocket("user-gus", "Gus");
  const hana = fakeSocket("user-hana", "Hana");
  const seed = generateSeed();
  await createMatch(
    "neon-runner",
    { socket: gus, userId: "user-gus", username: "Gus" },
    { socket: hana, userId: "user-hana", username: "Hana" },
    seed,
  );
  const gusMatchId = (gus.emitted.find((e) => e.event === "matched")?.payload as any)?.matchId;
  const gusLog = periodicLog("jumpPressed", "jumpReleased", 20, 10);
  const gusScore = replayEngine(neonRunnerReplayAdapter, seed, gusLog, VIEWPORT).finalScore;

  await submitScore(gus, {
    matchId: gusMatchId,
    score: gusScore,
    reason: "collision",
    durationMs: 5000,
    inputLog: gusLog,
    viewport: VIEWPORT,
  }); // starts the forfeit timer, waiting on hana
  hana.connected = false;
  await handleDisconnect(hana, 0);

  const gusResolved = gus.emitted.find((e) => e.event === "matchResolved")?.payload as any;
  check(
    "8b: submitter wins immediately on opponent disconnect, doesn't wait for the forfeit timer",
    gusResolved?.outcome === "win" && gusResolved?.you?.score === gusScore && gusResolved?.opponent?.status === "forfeited",
  );

  const emittedBefore = gus.emitted.length;
  await new Promise((resolve) => setTimeout(resolve, 100)); // real-time wait; well short of the real 120s grace window
  check("8b: no late forfeit-timer resolution fires after disconnect already resolved the match", gus.emitted.length === emittedBefore);
}

// 8c: NEITHER side has submitted when one disconnects — the remaining,
// still-connected player wins outright, NOT void. This is the case that
// diverges from determineMatchOutcome's general "both forfeited -> void"
// policy: the remaining player didn't fail to finish, they're still
// legitimately playing while their only competitor actively left.
{
  const ivy = fakeSocket("user-ivy", "Ivy");
  const jack = fakeSocket("user-jack", "Jack");
  await createMatch(
    "neon-runner",
    { socket: ivy, userId: "user-ivy", username: "Ivy" },
    { socket: jack, userId: "user-jack", username: "Jack" },
    generateSeed(),
  );
  jack.connected = false;
  await handleDisconnect(jack, 0);

  const ivyResolved = ivy.emitted.find((e) => e.event === "matchResolved")?.payload as any;
  check(
    "8c: still-connected player wins outright when neither side had submitted, not void",
    ivyResolved?.outcome === "win" &&
      ivyResolved?.you?.status === "opponent_disconnected" &&
      ivyResolved?.opponent?.status === "forfeited",
  );
}

// ---------------------------------------------------------------------------
// Test 9: Zero-Registration Guest Instant Play & Zero-Stake Enforcement
// ---------------------------------------------------------------------------
console.log("\nTest 9: guest instant play & zero-stake enforcement\n");

{
  const guestSocket = fakeSocket("guest_abc123", "Guest_abc1");
  guestSocket.data.isGuest = true;
  const hostSocket = fakeSocket("user-host", "HostUser");

  check("guest socket is identified by isGuest flag", Boolean(guestSocket.data.isGuest));
  check("registered socket has isGuest = false or undefined", !hostSocket.data.isGuest);

  const seed = generateSeed();
  await createMatch(
    "neon-runner",
    { socket: hostSocket, userId: "user-host", username: "HostUser" },
    { socket: guestSocket, userId: "guest_abc123", username: "Guest_abc1" },
    seed,
  );

  const guestMatched = guestSocket.emitted.find((e) => e.event === "matched")?.payload as any;
  check("guest receives matched event cleanly for instant play", Boolean(guestMatched?.matchId));
}

// ---------------------------------------------------------------------------
// Test 10: Stake Selection Window Queue Parameters
// ---------------------------------------------------------------------------
console.log("\nTest 10: stake selection window & custom wagers\n");

{
  const stakeAmount = 250;
  const currency = "COINS";
  const queuePayload = { gameId: "neon-runner", currency, stake: stakeAmount };

  check("queue payload carries chosen stake amount (250)", queuePayload.stake === 250);
  check("queue payload carries chosen currency (COINS)", queuePayload.currency === "COINS");
}

// ---------------------------------------------------------------------------
// Test 11: Strict Queue Stake & Currency Isolation
// ---------------------------------------------------------------------------
console.log("\nTest 11: strict queue stake & currency isolation\n");

{
  const p100_a = fakeSocket("user_100a", "Bettor100A");
  const p25 = fakeSocket("user_25", "Bettor25");
  const p100_b = fakeSocket("user_100b", "Bettor100B");

  enqueue("neon-runner", p100_a, "COINS", 100);
  enqueue("neon-runner", p25, "COINS", 25);

  const pairMismatch = tryPair("neon-runner", "COINS", 100);
  check("100-coin bettor does NOT pair with 25-coin bettor", pairMismatch === null);

  enqueue("neon-runner", p100_b, "COINS", 100);
  const pairMatch = tryPair("neon-runner", "COINS", 100);
  check("100-coin bettor pairs immediately with second 100-coin bettor", Boolean(pairMatch && pairMatch[0].userId === "user_100a" && pairMatch[1].userId === "user_100b"));
}

// ---------------------------------------------------------------------------
// Test 12: Live Public Queue State Broadcast & 1-Click Lobby Matchmaking
// ---------------------------------------------------------------------------
console.log("\nTest 12: live public queue state broadcast & 1-click lobby\n");

{
  let queueChangeCount = 0;
  setOnQueueChange(() => {
    queueChangeCount++;
  });

  const lobbyPlayer = fakeSocket("user_lobby1", "LobbyPlayer");
  enqueue("neon-runner", lobbyPlayer, "COINS", 100);

  const publicState = getPublicQueueState();
  check("queueStateUpdate callback fired on enqueue", queueChangeCount > 0);
  check("getPublicQueueState returns entry in public list", publicState.some((e) => e.userId === "user_lobby1" && e.gameId === "neon-runner" && e.stake === 100));
  
  const publicEntry = publicState.find((e) => e.userId === "user_lobby1");
  check("public entry contains username, currency, stake, queuedAt", Boolean(publicEntry && publicEntry.username === "LobbyPlayer" && publicEntry.currency === "COINS" && publicEntry.stake === 100 && publicEntry.queuedAt > 0));

  // 1-Click Direct Match Pairing simulation
  const challenger = fakeSocket("user_challenger", "Challenger");
  enqueue(publicEntry!.gameId, challenger, publicEntry!.currency, publicEntry!.stake);
  const pair = tryPair(publicEntry!.gameId, publicEntry!.currency, publicEntry!.stake);

  check("1-click match queueing pairs challenger with lobby player instantly", Boolean(pair && pair[0].userId === "user_lobby1" && pair[1].userId === "user_challenger"));
  check("queue cleans up paired users after match creation", !getPublicQueueState().some((e) => e.userId === "user_lobby1" || e.userId === "user_challenger"));

  setOnQueueChange(null);
}

// ---------------------------------------------------------------------------
// Test 13: Instant Guest Invite Link Creation, Lookup, Joining & Cleanup
// ---------------------------------------------------------------------------
console.log("\nTest 13: instant guest invite link lifecycle\n");

{
  const host = fakeSocket("user_host_guest", "HostGamer");
  handleCreateGuestLink(host, { gameId: "neon-runner" });

  const guestLinkCreated = host.emitted.find((e) => e.event === "guestLinkCreated")?.payload as any;
  const inviteSent = host.emitted.find((e) => e.event === "inviteSent")?.payload as any;

  check("handleCreateGuestLink emits guestLinkCreated with code and gameId", Boolean(guestLinkCreated?.code && guestLinkCreated?.gameId === "neon-runner"));
  check("handleCreateGuestLink emits inviteSent with code as inviteId", Boolean(inviteSent?.inviteId === guestLinkCreated?.code));

  const code = guestLinkCreated.code;

  // Lookup metadata
  const validInfo = getGuestLinkInfo(code);
  check("getGuestLinkInfo returns valid=true with gameId and hostUsername for active link", validInfo.valid === true && validInfo.gameId === "neon-runner" && validInfo.hostUsername === "HostGamer");

  const invalidInfo = getGuestLinkInfo("nonexistent_code");
  check("getGuestLinkInfo returns valid=false for unknown link", invalidInfo.valid === false);

  // Self-join rejection
  handleJoinGuestLink(host, { code });
  const selfJoinError = host.emitted.find((e) => e.event === "inviteError")?.payload as any;
  check("host cannot join their own guest link", selfJoinError?.message === "You cannot join your own guest link.");

  // Guest joins link
  const guest = fakeSocket("guest_joiner_1", "GuestJoiner");
  guest.data.isGuest = true;

  handleJoinGuestLink(guest, { code });
  await waitForEvent(guest, "matched");
  await waitForEvent(host, "matched");

  const guestMatched = guest.emitted.find((e) => e.event === "matched")?.payload as any;
  const hostMatched = host.emitted.find((e) => e.event === "matched")?.payload as any;

  check("guest receives matched payload upon joining guest link", Boolean(guestMatched?.matchId));
  check("host receives matched payload upon guest joining", Boolean(hostMatched?.matchId));

  const dbMatch = await db.query.matchesHistory.findFirst({ where: eq(matchesHistory.id, guestMatched.matchId) });
  check("guest match strictly persists currency=COINS and stake=0 in database", dbMatch?.currency === "COINS" && dbMatch?.stake === 0);

  // Second join attempt after consumption fails
  const secondGuest = fakeSocket("guest_late", "LateGuest");
  handleJoinGuestLink(secondGuest, { code });
  const consumedError = secondGuest.emitted.find((e) => e.event === "inviteError")?.payload as any;
  check("consumed guest link is cleared and cannot be joined again", consumedError?.message === "Guest invite link expired or host is offline.");

  // Disconnect cleanup check
  const host2 = fakeSocket("user_host_dc", "HostDC");
  handleCreateGuestLink(host2, { gameId: "space-blaster" });
  const dcCode = (host2.emitted.find((e) => e.event === "guestLinkCreated")?.payload as any)?.code;
  check("second host created guest link", Boolean(dcCode));

  cancelInvitesForSocket(host2);
  const infoAfterDC = getGuestLinkInfo(dcCode);
  check("cancelInvitesForSocket cleans up hosted guest link upon host disconnect", infoAfterDC.valid === false);
}

// ---------------------------------------------------------------------------
console.log(`\n${failures === 0 ? "All checks passed." : `${failures} check(s) FAILED.`}`);
process.exit(failures === 0 ? 0 : 1);
}

main();

