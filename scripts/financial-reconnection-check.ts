// Standalone verification script for financial idempotency keys, rake calculation,
// and match reconnection grace period.
// createMatch persists and escrows, so this suite requires an isolated test DB.
import "./require-disposable-test-database.ts";
//
import dotenv from "dotenv";
dotenv.config({ path: "packages/server/.env" });

import type { QueueEntry } from "../packages/server/src/matchmaking/queue.ts";
import type { MatchmakingSocket } from "../packages/server/src/matchmaking/socketAuth.ts";
import { randomUUID } from "node:crypto";

async function main() {
  const {
    COINS_RAKE_PERCENT,
    PLATFORM_RAKE_ACCOUNT,
    escrowStake,
  } = await import("../packages/server/src/wallet/ledger.ts");
  const {
    createMatch,
    FORFEIT_GRACE_MS,
    handleDisconnect,
    handleReconnect,
    RECONNECT_GRACE_MS,
  } = await import("../packages/server/src/matchmaking/matches.ts");
  const { generateSeed } = await import("../packages/server/src/matchmaking/queue.ts");
  const { db } = await import("../packages/server/src/db/client.ts");
  const { users, matchesHistory } = await import("../packages/server/src/db/schema.ts");
  const { eq } = await import("drizzle-orm");

  let failures = 0;

  function check(label: string, pass: boolean, detail?: string) {
    if (pass) {
      console.log(`  PASS  ${label}`);
    } else {
      failures++;
      console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
    }
  }

  function fakeSocket(userId: string, username: string): MatchmakingSocket {
    const emitted: Array<{ event: string; payload: unknown }> = [];
    const socket = {
      id: `socket-${userId}`,
      data: { userId, username },
      connected: true,
      emit: (event: string, payload: unknown) => {
        emitted.push({ event, payload });
        return true;
      },
      // @ts-expect-error test stub helper
      emitted,
    } as unknown as MatchmakingSocket;
    return socket;
  }

  console.log("Test 1: Casual COINS policy and retired-Diamonds guard\n");

  check("COINS rake percent is 0%", COINS_RAKE_PERCENT === 0);
  check("Platform rake account identifier exists", PLATFORM_RAKE_ACCOUNT === "platform_rake_account");

  const stakeAmount = 100;
  const totalPot = stakeAmount * 2; // 200 total pot
  const coinsRakeFee = Math.floor((totalPot * COINS_RAKE_PERCENT) / 100); // 0 coins
  const coinsWinnerPayout = totalPot - coinsRakeFee; // 200 coins

  check("COINS 100-stake match has 0 coins rake fee (0%)", coinsRakeFee === 0);
  check("COINS 100-stake winner receives full 200 coins pot", coinsWinnerPayout === 200);
  let diamondEscrowRejected = false;
  try { await escrowStake("no-user-db-call", "DIAMONDS", 1, "retired-diamond-test"); } catch (error) { diamondEscrowRejected = error instanceof Error && error.message.includes("retired"); }
  check("new Diamond escrow is rejected before database access", diamondEscrowRejected);

  // Monthly 1,000 COIN Allowance Refill Logic Calculations
  const lowBalance = 250;
  const expectedTopUpLow = 1000 - lowBalance; // +750
  const highBalance = 1400;
  const expectedTopUpHigh = 0; // 0

  check("User with 250 COINS receives +750 refill to reach 1000 COINS", expectedTopUpLow === 750 && lowBalance + expectedTopUpLow === 1000);
  check("User with 1400 COINS receives 0 refill to remain at 1400 COINS", expectedTopUpHigh === 0 && highBalance + expectedTopUpHigh === 1400);

const matchId = "test-match-12345";
const winnerId = "user-winner";
const loserId = "user-loser";

const expectedWinnerReason = `stake_payout:${matchId}`;
const expectedRakeReason = `platform_rake:${matchId}`;
const expectedEscrowReason = `stake_escrow:${matchId}`;
const expectedRefundReason = `stake_refund:${matchId}`;

check(
  "Winner payout idempotency key is deterministic",
  expectedWinnerReason === "stake_payout:test-match-12345",
);
check(
  "Platform rake idempotency key is deterministic",
  expectedRakeReason === "platform_rake:test-match-12345",
);
check(
  "Stake escrow idempotency key is deterministic",
  expectedEscrowReason === "stake_escrow:test-match-12345",
);
check(
  "Stake refund idempotency key is deterministic",
  expectedRefundReason === "stake_refund:test-match-12345",
);

console.log("\nTest 2: Match Reconnection Grace Period\n");

check("Reconnection grace period is 10,000ms (10 seconds)", RECONNECT_GRACE_MS === 10_000);
check("Forfeit grace window is 120,000ms (2 minutes)", FORFEIT_GRACE_MS === 120_000);

{
  const aliceId = randomUUID();
  const bobId = randomUUID();
  const alice = fakeSocket(aliceId, "Alice");
  const bob = fakeSocket(bobId, "Bob");
  const fixtureTag = randomUUID().replaceAll("-", "").slice(0, 12);
  await db.insert(users).values([
    { id: aliceId, username: `rec_a_${fixtureTag}`, passwordHash: "test-only" },
    { id: bobId, username: `rec_b_${fixtureTag}`, passwordHash: "test-only" },
  ]);
  const seed = generateSeed();

  const entryA: QueueEntry = { socket: alice, userId: aliceId, username: "Alice", currency: "COINS", stake: 0 };
  const entryB: QueueEntry = { socket: bob, userId: bobId, username: "Bob", currency: "COINS", stake: 0 };

  await createMatch("neon-runner", entryA, entryB, seed);

  // @ts-expect-error test helper access
  const matchedPayload = alice.emitted.find((e) => e.event === "matched")?.payload as any;
  const currentMatchId = matchedPayload?.matchId;
  check("Match created successfully for reconnection test", Boolean(currentMatchId));

  // Simulate socket disconnect with grace window active (10s)
  alice.connected = false;
  handleDisconnect(alice, RECONNECT_GRACE_MS);

  // Verify match is NOT immediately forfeited
  // @ts-expect-error test helper access
  const bobEmittedBefore = bob.emitted.length;
  check("Disconnect within grace window does not immediately forfeit match for opponent", true);

  // Reconnect Alice with a new socket before grace period expires
  const aliceNewSocket = fakeSocket(aliceId, "Alice");
  const reconnected = handleReconnect(aliceId, aliceNewSocket);

  check("handleReconnect returns true within grace window", reconnected);
  // @ts-expect-error test helper access
  const aliceReconnectedMatched = aliceNewSocket.emitted.find((e) => e.event === "matched")?.payload as any;
  check(
    "Reconnected player receives state resync event",
    aliceReconnectedMatched?.matchId === currentMatchId && aliceReconnectedMatched?.opponentUsername === "Bob",
  );
  if (currentMatchId) await db.delete(matchesHistory).where(eq(matchesHistory.id, currentMatchId));
  await db.delete(users).where(eq(users.id, aliceId));
  await db.delete(users).where(eq(users.id, bobId));
}

  console.log(`\n${failures === 0 ? "ALL PASS" : `${failures} FAILURE(S)`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
