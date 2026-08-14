// Comprehensive Wallet Settlement Integrity, Idempotency, Concurrency & Crash Safety Test Suite for ArcadeClash.
// Run: npx tsx scripts/wallet-settlement-integrity-check.ts

import dotenv from "dotenv";
dotenv.config({ path: "packages/server/.env" });

import { randomUUID } from "node:crypto";

let failures = 0;

function check(label: string, pass: boolean, detail?: string) {
  if (pass) {
    console.log(`  PASS  ${label}`);
  } else {
    failures++;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

console.log("=== wallet-settlement-integrity-check ===");

async function main() {
  const { db, ensureUserSchema } = await import("../packages/server/src/db/client.ts");
  const { users, ledgerEntries } = await import("../packages/server/src/db/schema.ts");
  const { sql, eq } = await import("drizzle-orm");
  const {
    escrowStake,
    getBalances,
    payoutWinner,
    refundMatchSettlement,
    refundStake,
    ensureSignupGrant,
    ensureMatchSettlementsTable,
    grantDiamondsStub,
  } = await import("../packages/server/src/wallet/ledger.ts");

  await ensureUserSchema();
  await ensureMatchSettlementsTable();

  // Create test users P1 & P2
  const p1Id = `usr_hp1_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const p2Id = `usr_hp2_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  await db.insert(users).values([
    { id: p1Id, username: p1Id, passwordHash: "hash" },
    { id: p2Id, username: p2Id, passwordHash: "hash" },
  ]);

  await ensureSignupGrant(p1Id);
  await ensureSignupGrant(p2Id);

  const initBalP1 = await getBalances(p1Id);
  const initBalP2 = await getBalances(p2Id);

  const stake = 100; // 100 COINS stake

  // Helper to verify derived balance invariant
  async function assertDerivedBalanceInvariant(userId: string) {
    const derived = await getBalances(userId);

    const [coinsDb] = await db
      .select({ val: sql<number>`coalesce(sum(amount), 0)::int` })
      .from(ledgerEntries)
      .where(sql`${ledgerEntries.userId} = ${userId} AND ${ledgerEntries.currency} = 'COINS'`);

    const [diamondsDb] = await db
      .select({ val: sql<number>`coalesce(sum(amount), 0)::int` })
      .from(ledgerEntries)
      .where(sql`${ledgerEntries.userId} = ${userId} AND ${ledgerEntries.currency} = 'DIAMONDS'`);

    const expectedCoins = coinsDb?.val ?? 0;
    const expectedDiamonds = diamondsDb?.val ?? 0;

    return derived.coins === expectedCoins && derived.diamonds === expectedDiamonds;
  }

  // ---------------------------------------------------------------------------
  // Test 1: Stake Escrow & Duplicate Stake Protection
  // ---------------------------------------------------------------------------
  console.log("\nTest 1: Stake Escrow & Duplicate Stake Protection");

  const matchId1 = `match_escrow_${randomUUID()}`;
  const balP1BeforeEscrow = await getBalances(p1Id);

  await escrowStake(p1Id, "COINS", stake, matchId1);
  const balP1AfterEscrow1 = await getBalances(p1Id);
  check("Escrow debits user balance by exact stake amount", balP1AfterEscrow1.coins === balP1BeforeEscrow.coins - stake);

  // Duplicate escrow attempt for same matchId & user
  await escrowStake(p1Id, "COINS", stake, matchId1);
  const balP1AfterEscrow2 = await getBalances(p1Id);
  check("Duplicate escrow attempt is safely ignored idempotently", balP1AfterEscrow2.coins === balP1AfterEscrow1.coins);
  check("Derived balance matches SUM(ledger) after escrow", await assertDerivedBalanceInvariant(p1Id));

  // ---------------------------------------------------------------------------
  // Test 2: Negative Balance Escrow Protection
  // ---------------------------------------------------------------------------
  console.log("\nTest 2: Negative Balance Escrow Protection");

  const lowBalUser = `usr_lbal_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  await db.insert(users).values({ id: lowBalUser, username: lowBalUser, passwordHash: "hash" });
  // Grant 50 COINS
  await db.insert(ledgerEntries).values({
    id: `ledger_${randomUUID()}`,
    userId: lowBalUser,
    currency: "COINS",
    amount: 50,
    reason: "init_low_bal",
  });

  let insufficientErrThrown = false;
  try {
    await escrowStake(lowBalUser, "COINS", 100, `match_overdraft_${randomUUID()}`);
  } catch (err: any) {
    insufficientErrThrown = err.message.includes("Insufficient COINS balance");
  }
  check("Overdraft escrow attempt throws Insufficient COINS balance error", insufficientErrThrown);

  const lowUserBalAfter = await getBalances(lowBalUser);
  check("User balance remains positive and non-negative (50 COINS)", lowUserBalAfter.coins === 50);

  // ---------------------------------------------------------------------------
  // Test 3: Sequential & Concurrent Payout Hardening
  // ---------------------------------------------------------------------------
  console.log("\nTest 3: Sequential & Concurrent Payout Hardening");

  const matchIdPayout = `match_payout_${randomUUID()}`;
  await escrowStake(p1Id, "COINS", stake, matchIdPayout);
  await escrowStake(p2Id, "COINS", stake, matchIdPayout);

  const balP1BeforePayout = await getBalances(p1Id);

  // Launch 10 concurrent payout attempts for exact same matchId
  const concurrentResults = await Promise.all([
    payoutWinner(p1Id, p2Id, "COINS", stake, matchIdPayout),
    payoutWinner(p1Id, p2Id, "COINS", stake, matchIdPayout),
    payoutWinner(p1Id, p2Id, "COINS", stake, matchIdPayout),
    payoutWinner(p1Id, p2Id, "COINS", stake, matchIdPayout),
    payoutWinner(p1Id, p2Id, "COINS", stake, matchIdPayout),
    payoutWinner(p1Id, p2Id, "COINS", stake, matchIdPayout),
    payoutWinner(p1Id, p2Id, "COINS", stake, matchIdPayout),
    payoutWinner(p1Id, p2Id, "COINS", stake, matchIdPayout),
    payoutWinner(p1Id, p2Id, "COINS", stake, matchIdPayout),
    payoutWinner(p1Id, p2Id, "COINS", stake, matchIdPayout),
  ]);

  const newlySettledCount = concurrentResults.filter((r) => r.alreadySettled === false).length;
  const alreadySettledCount = concurrentResults.filter((r) => r.alreadySettled === true).length;

  check("Exactly 1 concurrent payout attempt succeeded (newlySettledCount = 1)", newlySettledCount === 1);
  check("9 concurrent payout attempts were safely rejected by DB constraint", alreadySettledCount === 9);

  const balP1AfterRace = await getBalances(p1Id);
  check("P1 balance increased by exactly 1 payout amount (200 COINS)", balP1AfterRace.coins === balP1BeforePayout.coins + 200);
  check("Derived balance matches SUM(ledger) after payout", await assertDerivedBalanceInvariant(p1Id));

  // ---------------------------------------------------------------------------
  // Test 4: Match Draw & Refund Settlement
  // ---------------------------------------------------------------------------
  console.log("\nTest 4: Match Draw & Refund Settlement");

  const matchIdDraw = `match_draw_${randomUUID()}`;
  await escrowStake(p1Id, "COINS", stake, matchIdDraw);
  await escrowStake(p2Id, "COINS", stake, matchIdDraw);

  const balP1BeforeRefund = await getBalances(p1Id);
  const balP2BeforeRefund = await getBalances(p2Id);

  const drawRes = await refundMatchSettlement(p1Id, p2Id, "COINS", stake, matchIdDraw, "DRAW");
  check("Draw settlement refunded both players (alreadySettled = false)", drawRes.alreadySettled === false);

  const balP1AfterDraw = await getBalances(p1Id);
  const balP2AfterDraw = await getBalances(p2Id);
  check("Player 1 received exact stake refund (+100 COINS)", balP1AfterDraw.coins === balP1BeforeRefund.coins + stake);
  check("Player 2 received exact stake refund (+100 COINS)", balP2AfterDraw.coins === balP2BeforeRefund.coins + stake);

  // Retry draw settlement
  const drawRetryRes = await refundMatchSettlement(p1Id, p2Id, "COINS", stake, matchIdDraw, "DRAW");
  check("Retrying draw settlement returns alreadySettled = true", drawRetryRes.alreadySettled === true);
  check("Player 1 balance unchanged on draw retry", (await getBalances(p1Id)).coins === balP1AfterDraw.coins);

  // ---------------------------------------------------------------------------
  // Test 5: Mutual Exclusion Guard (Payout vs Refund)
  // ---------------------------------------------------------------------------
  console.log("\nTest 5: Mutual Exclusion Guard (Payout vs Refund)");

  const matchIdMut = `match_mut_${randomUUID()}`;
  await escrowStake(p1Id, "COINS", stake, matchIdMut);
  await escrowStake(p2Id, "COINS", stake, matchIdMut);

  const payResMut = await payoutWinner(p1Id, p2Id, "COINS", stake, matchIdMut);
  check("Initial payout succeeded", payResMut.alreadySettled === false);

  const refundResMut = await refundMatchSettlement(p1Id, p2Id, "COINS", stake, matchIdMut, "REFUND");
  check("Subsequent refund attempt rejected by match_settlements primary key constraint", refundResMut.alreadySettled === true);

  // ---------------------------------------------------------------------------
  // Test 6: Currency & Integer Validation Controls
  // ---------------------------------------------------------------------------
  console.log("\nTest 6: Currency & Integer Validation Controls");

  let floatErr = false;
  try {
    // @ts-expect-error floating point test
    await escrowStake(p1Id, "COINS", 10.5, "match_float");
  } catch (err: any) {
    floatErr = err.message.includes("must be a positive integer");
  }
  check("Floating point stake amount rejected", floatErr);

  let negErr = false;
  try {
    await escrowStake(p1Id, "COINS", -50, "match_neg");
  } catch (err: any) {
    negErr = err.message.includes("must be a positive integer");
  }
  check("Negative stake amount rejected", negErr);

  let badCurrencyErr = false;
  try {
    // @ts-expect-error invalid currency test
    await escrowStake(p1Id, "EUROS", 100, "match_curr");
  } catch (err: any) {
    badCurrencyErr = err.message.includes("Invalid currency");
  }
  check("Invalid currency (EUROS) rejected", badCurrencyErr);

  // Test Cross-Currency Isolation
  const balP1PreDiamond = await getBalances(p1Id);
  await grantDiamondsStub(p1Id, 50, "pack_test");
  const balP1PostDiamond = await getBalances(p1Id);
  check("Diamond grant increases diamonds by 50", balP1PostDiamond.diamonds === balP1PreDiamond.diamonds + 50);
  check("Diamond grant does NOT alter coins balance", balP1PostDiamond.coins === balP1PreDiamond.coins);

  if (failures > 0) {
    console.log(`\nFAILURE: ${failures} check(s) failed.`);
    process.exit(1);
  }

  console.log("\nALL WALLET SETTLEMENT INTEGRITY & CONCURRENCY CHECKS PASSED 100%.");
}

main().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
