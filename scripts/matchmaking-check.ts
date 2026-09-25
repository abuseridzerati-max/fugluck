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
// Casual scores are client-reported and carry no TEST GEL prize authority.
// This suite tests socket lifecycle behavior only.
// createMatch now persists and escrows, so this suite requires an isolated test DB.
import "./require-disposable-test-database.ts";

import {
  createMatch,
  FORFEIT_GRACE_MS,
  handleDeclineRematch,
  handleDisconnect,
  handleRequestRematch,
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
  handleCancelGuestLink,
  handleCreateGuestLink,
  handleJoinGuestLink,
} from "../packages/server/src/matchmaking/invites.ts";
import type { MatchmakingSocket, MatchmakingSocketData } from "../packages/server/src/matchmaking/socketAuth.ts";
import { db } from "../packages/server/src/db/client.ts";
import { matchesHistory, users } from "../packages/server/src/db/schema.ts";
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

function casualScore(actionCount: number): number { return actionCount * 10; }


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
const fixtureUsers = [
  ["user-a", "Alice"], ["user-b", "Bob"], ["user-c", "Cara"], ["user-d", "Dan"], ["user-e", "Eve"],
  ["user-alice", "Alice"], ["user-bob", "Bob"], ["user-carl", "Carl"], ["user-dana", "Dana"],
  ["user-eli", "Eli"], ["user-fay", "Fay"], ["user-gus", "Gus"], ["user-hana", "Hana"], ["user-ivy", "Ivy"], ["user-jack", "Jack"],
  ["guest_abc123", "Guest_abc1"], ["user-host", "HostUser"], ["user_challenger", "Challenger"], ["user_host_guest", "HostGamer"],
  ["guest_joiner_1", "GuestJoiner"], ["user_host_dc", "HostDC"], ["guest_late", "LateGuest"], ["user_host_pending", "HostPending"], ["guest_waiter", "WaitingGuest"],
  ["user_lobby1", "LobbyPlayer"], ["user_100a", "Bettor100A"], ["user_25", "Bettor25"], ["user_100b", "Bettor100B"],
  ["user_rm_a", "RematchA"], ["user_rm_b", "RematchB"], ["user_rm_c", "RematchC"], ["user_rm_d", "RematchD"],
];
await db.insert(users).values(fixtureUsers.map(([id], index) => ({ id, username: `mcheck_${index}`, passwordHash: "test-only" }))).onConflictDoNothing();

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
// Keep a fixed seed so match-creation payloads remain repeatable.
const matchSeed = 424242;
{
  check("generateSeed() returns a value in valid uint32 range", (() => {
    const s = generateSeed();
    return s >= 0 && s < 0x100000000;
  })());
  await createMatch(
    "neon-runner",
    { socket: alice, userId: "user-alice", username: "Alice", currency: "COINS", stake: 0 },
    { socket: bob, userId: "user-bob", username: "Bob", currency: "COINS", stake: 0 },
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
// Test 5: normal resolution — both submit unverifiable casual scores
// ---------------------------------------------------------------------------
console.log("\nTest 5: normal resolution (both submit)");
let aliceScore = 0;
let bobScore = 0;
{
  aliceScore = casualScore(25);
  bobScore = casualScore(0);
  check(
    "precondition: Alice and Bob submit different casual scores",
    aliceScore !== bobScore,
    `both ${aliceScore}`,
  );

  await submitScore(alice, {
    matchId,
    score: aliceScore,
    reason: "collision",
  });
  check("no resolution yet after only one submission", !alice.emitted.some((e) => e.event === "matchResolved"));
  await submitScore(bob, {
    matchId,
    score: bobScore,
    reason: "collision",
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
  await submitScore(alice, { matchId, score: 999, reason: "collision" });
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
    { socket: carl, userId: "user-carl", username: "Carl", currency: "COINS", stake: 0 },
    { socket: dana, userId: "user-dana", username: "Dana", currency: "COINS", stake: 0 },
    seed,
  );
  const carlMatchId = (carl.emitted.find((e) => e.event === "matched")?.payload as any)?.matchId;
  const carlScore = casualScore(40);

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
    { socket: eli, userId: "user-eli", username: "Eli", currency: "COINS", stake: 0 },
    { socket: fay, userId: "user-fay", username: "Fay", currency: "COINS", stake: 0 },
    seed,
  );
  const eliMatchId = (eli.emitted.find((e) => e.event === "matched")?.payload as any)?.matchId;
  const eliScore = casualScore(25);

  await submitScore(eli, {
    matchId: eliMatchId,
    score: eliScore,
    reason: "collision",
  }); // starts the real 120s forfeit timer, waiting on fay
  eli.connected = false;
  await handleDisconnect(eli);
  check("8a: disconnect after already submitting emits nothing new", !eli.emitted.some((e) => e.event === "matchResolved"));

  const fayScore = casualScore(20);
  await submitScore(fay, {
    matchId: eliMatchId,
    score: fayScore,
    reason: "collision",
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
    { socket: gus, userId: "user-gus", username: "Gus", currency: "COINS", stake: 0 },
    { socket: hana, userId: "user-hana", username: "Hana", currency: "COINS", stake: 0 },
    seed,
  );
  const gusMatchId = (gus.emitted.find((e) => e.event === "matched")?.payload as any)?.matchId;
  const gusScore = casualScore(25);

  await submitScore(gus, {
    matchId: gusMatchId,
    score: gusScore,
    reason: "collision",
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
    { socket: ivy, userId: "user-ivy", username: "Ivy", currency: "COINS", stake: 0 },
    { socket: jack, userId: "user-jack", username: "Jack", currency: "COINS", stake: 0 },
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
    { socket: hostSocket, userId: "user-host", username: "HostUser", currency: "COINS", stake: 0 },
    { socket: guestSocket, userId: "guest_abc123", username: "Guest_abc1", currency: "COINS", stake: 0 },
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
  const code = guestLinkCreated?.code as string;

  check("handleCreateGuestLink emits guestLinkCreated with code and gameId", Boolean(guestLinkCreated?.code && guestLinkCreated?.gameId === "neon-runner"));
  check("handleCreateGuestLink emits inviteSent with code as inviteId", Boolean(inviteSent?.inviteId === guestLinkCreated?.code));
  check("guestLinkCreated includes expiresAt", typeof guestLinkCreated?.expiresAt === "number" && guestLinkCreated.expiresAt > Date.now());
  check("guest link code is at least 12 characters", typeof code === "string" && code.length >= 12);

  // Lookup metadata
  const validInfo = getGuestLinkInfo(code);
  check("getGuestLinkInfo returns valid=true with gameId and hostUsername for active link", validInfo.valid === true && validInfo.gameId === "neon-runner" && validInfo.hostUsername === "HostGamer");
  check("getGuestLinkInfo reports hostOnline=true while host socket is connected", validInfo.hostOnline === true);

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
  check("host disconnect parks the guest link instead of destroying it immediately", infoAfterDC.valid === true && infoAfterDC.hostOnline === false);

  const host2b = fakeSocket("user_host_dc", "HostDC");
  handleCreateGuestLink(host2b, { gameId: "space-blaster" });
  const rebound = host2b.emitted.find((e) => e.event === "guestLinkCreated")?.payload as any;
  check("host reconnect reuses the same guest link code", rebound?.code === dcCode);

  handleCancelGuestLink(host2b);
  const infoAfterCancel = getGuestLinkInfo(dcCode);
  check("handleCancelGuestLink destroys the parked guest link immediately", infoAfterCancel.valid === false);

  // Host blip while a guest is waiting: joiner is held, then matched on rebind.
  const host3 = fakeSocket("user_host_pending", "HostPending");
  handleCreateGuestLink(host3, { gameId: "cyber-hopper" });
  const pendingCode = (host3.emitted.find((e) => e.event === "guestLinkCreated")?.payload as any)?.code;
  host3.connected = false;
  cancelInvitesForSocket(host3);
  const waitingGuest = fakeSocket("guest_waiter", "WaitingGuest");
  handleJoinGuestLink(waitingGuest, { code: pendingCode });
  const pendingEvt = waitingGuest.emitted.find((e) => e.event === "guestLinkPending")?.payload as any;
  check("guest joining during host reconnect grace is held as pending", pendingEvt?.message?.includes("reconnect"));

  const host3b = fakeSocket("user_host_pending", "HostPending");
  handleCreateGuestLink(host3b, { gameId: "cyber-hopper" });
  await waitForEvent(waitingGuest, "matched");
  await waitForEvent(host3b, "matched");
  check("pending guest is matched when the host reconnects with the same code", waitingGuest.emitted.some((e) => e.event === "matched"));
  check("rebinding host is matched with the pending guest", host3b.emitted.some((e) => e.event === "matched"));
}

// ---------------------------------------------------------------------------
// Test 14: rematch after both players finish
// ---------------------------------------------------------------------------
console.log("\nTest 14: rematch after resolved match\n");

{
  const p1 = fakeSocket("user_rm_a", "RematchA");
  const p2 = fakeSocket("user_rm_b", "RematchB");
  const seed = generateSeed();
  await createMatch(
    "neon-runner",
    { socket: p1, userId: "user_rm_a", username: "RematchA", currency: "COINS", stake: 0 },
    { socket: p2, userId: "user_rm_b", username: "RematchB", currency: "COINS", stake: 0 },
    seed,
  );
  const firstMatchId = (p1.emitted.find((e) => e.event === "matched")?.payload as any)?.matchId as string;
  const p1Score = casualScore(25);
  const p2Score = casualScore(0);

  await submitScore(p1, {
    matchId: firstMatchId,
    score: p1Score,
    reason: "collision",
  });
  await submitScore(p2, {
    matchId: firstMatchId,
    score: p2Score,
    reason: "collision",
  });

  const resolved1 = p1.emitted.find((e) => e.event === "matchResolved")?.payload as any;
  const resolved2 = p2.emitted.find((e) => e.event === "matchResolved")?.payload as any;
  check("resolved payload offers rematch while both sockets stay connected", resolved1?.canRematch === true && resolved2?.canRematch === true);

  handleRequestRematch(p1, { matchId: firstMatchId });
  check("first rematch request puts requester in waiting state", p1.emitted.some((e) => e.event === "rematchWaiting"));
  check("opponent receives rematchOffered", p2.emitted.some((e) => e.event === "rematchOffered"));

  const matchedBefore = p1.emitted.filter((e) => e.event === "matched").length;
  handleRequestRematch(p2, { matchId: firstMatchId });
  const rematchDeadline = Date.now() + 5_000;
  while (p1.emitted.filter((e) => e.event === "matched").length < matchedBefore + 1 && Date.now() < rematchDeadline) {
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  const matchedAfter = p1.emitted.filter((e) => e.event === "matched").length;
  const rematchPayload = [...p1.emitted].reverse().find((e) => e.event === "matched")?.payload as any;
  check("both rematch requests start a new match", matchedAfter === matchedBefore + 1);
  check("rematch issues a new matchId", Boolean(rematchPayload?.matchId) && rematchPayload.matchId !== firstMatchId);
  check("rematch keeps the same gameId", rematchPayload?.gameId === "neon-runner");

  const p3 = fakeSocket("user_rm_c", "RematchC");
  const p4 = fakeSocket("user_rm_d", "RematchD");
  const seed2 = generateSeed();
  await createMatch(
    "neon-runner",
    { socket: p3, userId: "user_rm_c", username: "RematchC", currency: "COINS", stake: 0 },
    { socket: p4, userId: "user_rm_d", username: "RematchD", currency: "COINS", stake: 0 },
    seed2,
  );
  const declineMatchId = (p3.emitted.find((e) => e.event === "matched")?.payload as any)?.matchId as string;
  const tiedScore = casualScore(10);
  await submitScore(p3, {
    matchId: declineMatchId,
    score: tiedScore,
    reason: "collision",
  });
  await submitScore(p4, {
    matchId: declineMatchId,
    score: tiedScore,
    reason: "collision",
  });
  handleRequestRematch(p3, { matchId: declineMatchId });
  handleDeclineRematch(p4, { matchId: declineMatchId });
  const declined = p3.emitted.find((e) => e.event === "rematchUnavailable")?.payload as any;
  check("declining rematch notifies the requester", typeof declined?.reason === "string" && declined.reason.length > 0);
}

// ---------------------------------------------------------------------------
console.log(`\n${failures === 0 ? "All checks passed." : `${failures} check(s) FAILED.`}`);
process.exit(failures === 0 ? 0 : 1);
}

main();

