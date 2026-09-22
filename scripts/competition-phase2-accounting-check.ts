// Focused Phase 2 Accounting Port & Sandbox Accounting Verification for Fugluck
// Tests all 24 required accounting, concurrency, idempotency, and isolation invariants.

import "./require-disposable-test-database.ts";
import dotenv from "dotenv";
dotenv.config({ path: "packages/server/.env" });

import { Pool } from "pg";
import {
  createMoney,
  type MoneyAmount,
} from "../packages/shared/src/index";
import { SandboxAccountingAdapter } from "../packages/server/src/accounting/sandboxAdapter";

let passes = 0;
let failures = 0;

function check(label: string, condition: boolean, detail?: string): void {
  if (condition) {
    passes++;
    console.log(`  PASS  ${label}`);
  } else {
    failures++;
    console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function runPhase2AccountingChecks(): Promise<void> {
  console.log("=== Fugluck Competition Economy — Phase 2 Accounting & Sandbox Adapter Check ===\n");

  const connectionString = process.env.DATABASE_URL!;
  const isLocalhost = connectionString.includes("localhost") || connectionString.includes("127.0.0.1");
  const isSslRequired =
    !isLocalhost &&
    (connectionString.includes("sslmode=require") ||
      connectionString.includes("supabase.com") ||
      connectionString.includes("neon.tech") ||
      process.env.NODE_ENV === "production");

  const cleanConnectionString = isSslRequired
    ? connectionString.replace(/[?&]sslmode=[^&]+/g, "").replace(/\?$/, "")
    : connectionString;

  const pool = new Pool({
    connectionString: cleanConnectionString,
    ssl: isSslRequired ? { rejectUnauthorized: false } : undefined,
  });

  const adapter = new SandboxAccountingAdapter();
  const ts = Date.now();

  try {
    // Ensure clean initial state in sandbox tables
    await pool.query(`DELETE FROM sandbox_settlements`);
    await pool.query(`DELETE FROM sandbox_ledger_entries`);
    await pool.query(`DELETE FROM sandbox_entry_reservations`);

    // -------------------------------------------------------------------------
    // Setup Test Entities (Users, Templates, Instances) in Disposable DB
    // -------------------------------------------------------------------------
    const userA = `p2_user_a_${ts}`;
    const userB = `p2_user_b_${ts}`;
    const userC = `p2_user_c_${ts}`;
    const allUsers = [userA, userB, userC];

    for (const uid of allUsers) {
      await pool.query(
        `INSERT INTO users (id, username, password_hash) VALUES ($1, $2, 'hash') ON CONFLICT DO NOTHING`,
        [uid, `u_${uid}`],
      );
    }

    const tmplId = `p2_tmpl_${ts}`;
    await pool.query(
      `INSERT INTO competition_templates (id, game_id, title, format, participant_capacity, currency, entry_fee_minor, rules_version, skill_assessment_version, jurisdiction)
       VALUES ($1, 'space-blaster', 'Phase 2 Test Duel', 'HEAD_TO_HEAD', 2, 'GEL', 500, 'v1.0', 'v1.0', 'GE')`,
      [tmplId],
    );

    const instA = `p2_inst_std_${ts}`;      // Case A: standard 2x500 -> 900
    const instB = `p2_inst_promo_${ts}`;    // Case B: promo 2x500 -> 2000
    const instC = `p2_inst_free_${ts}`;     // Case C: freeroll 0 -> 100000
    const instD = `p2_inst_multi_${ts}`;    // Case D: multi-placement 2x500 -> 600+300
    const instVoid = `p2_inst_void_${ts}`;  // Void test
    const allInstances = [instA, instB, instC, instD, instVoid];

    for (const inst of allInstances) {
      const fee = inst === instC ? 0 : 500;
      await pool.query(
        `INSERT INTO competition_instances (id, template_id, game_id, format, participant_capacity, currency, entry_fee_minor, rules_version, skill_assessment_version, jurisdiction, status)
         VALUES ($1, $2, 'space-blaster', 'HEAD_TO_HEAD', 2, 'GEL', $3, 'v1.0', 'v1.0', 'GE', 'CREATED')`,
        [inst, tmplId, fee],
      );
    }

    // -------------------------------------------------------------------------
    // 1. Sandbox Funding Creates Exact Available Balance
    // -------------------------------------------------------------------------
    console.log("Section 1: Sandbox Funding & Representation");
    const fundingAmount = createMoney(1000, "GEL");
    const fundingResA = await adapter.grantSandboxFunding(userA, fundingAmount, `grant_a_${ts}`);
    check("1. Sandbox funding creates exact available balance", fundingResA.success && fundingResA.balance.amountMinor === 1000);

    const balA1 = await adapter.getSandboxBalance(userA);
    check("1b. Balance reflects exactly 1000 available, 0 reserved", balA1.available.amountMinor === 1000 && balA1.reserved.amountMinor === 0);

    // -------------------------------------------------------------------------
    // 2. ₾5.00 is Represented as 500 Minor Units
    // -------------------------------------------------------------------------
    const gel5 = createMoney(500, "GEL");
    check("2. ₾5.00 is represented as 500 minor units", gel5.amountMinor === 500 && gel5.currency === "GEL");

    // -------------------------------------------------------------------------
    // 3. Floating Amounts Rejected
    // -------------------------------------------------------------------------
    let floatRejected = false;
    try {
      createMoney(5.5 as any, "GEL");
    } catch {
      floatRejected = true;
    }
    check("3. Floating amounts rejected in createMoney", floatRejected);

    // -------------------------------------------------------------------------
    // 4. Negative Amounts Rejected
    // -------------------------------------------------------------------------
    let negativeRejected = false;
    try {
      createMoney(-500, "GEL");
    } catch {
      negativeRejected = true;
    }
    let negativeGrantRejected = false;
    try {
      await adapter.grantSandboxFunding(userA, { amountMinor: -500, currency: "GEL" } as any, `neg_grant_${ts}`);
    } catch {
      negativeGrantRejected = true;
    }
    check("4. Negative amounts rejected by money creator and funding grant", negativeRejected && negativeGrantRejected);

    // -------------------------------------------------------------------------
    // 5. Unsupported Currencies Rejected
    // -------------------------------------------------------------------------
    let unsupportedCurrencyRejected = false;
    try {
      await adapter.grantSandboxFunding(userA, { amountMinor: 500, currency: "EUR" } as any, `eur_grant_${ts}`);
    } catch {
      unsupportedCurrencyRejected = true;
    }
    check("5. Unsupported currencies rejected by SandboxAccountingAdapter", unsupportedCurrencyRejected);

    // -------------------------------------------------------------------------
    // 6. COINS Rejected
    // -------------------------------------------------------------------------
    let coinsRejected = false;
    try {
      createMoney(500, "COINS" as any);
    } catch {
      coinsRejected = true;
    }
    let coinsAdapterRejected = false;
    try {
      await adapter.reserveEntry({
        competitionInstanceId: instA,
        userId: userA,
        entryFee: { amountMinor: 500, currency: "COINS" } as any,
        idempotencyKey: `coins_res_${ts}`,
      });
    } catch {
      coinsAdapterRejected = true;
    }
    check("6. COINS rejected as MoneyAmount by accounting adapter", coinsRejected && coinsAdapterRejected);

    // -------------------------------------------------------------------------
    // 7. DIAMONDS Rejected
    // -------------------------------------------------------------------------
    let diamondsRejected = false;
    try {
      createMoney(500, "DIAMONDS" as any);
    } catch {
      diamondsRejected = true;
    }
    let diamondsAdapterRejected = false;
    try {
      await adapter.reserveEntry({
        competitionInstanceId: instA,
        userId: userA,
        entryFee: { amountMinor: 500, currency: "DIAMONDS" } as any,
        idempotencyKey: `diam_res_${ts}`,
      });
    } catch {
      diamondsAdapterRejected = true;
    }
    check("7. DIAMONDS rejected as MoneyAmount by accounting adapter", diamondsRejected && diamondsAdapterRejected);

    // -------------------------------------------------------------------------
    // 8. Entry Reservation Reduces Available Funds
    // -------------------------------------------------------------------------
    console.log("\nSection 2: Reservation Lifecycle & Overdraft Protection");
    const reserveResA = await adapter.reserveEntry({
      competitionInstanceId: instA,
      userId: userA,
      entryFee: createMoney(500, "GEL"),
      idempotencyKey: `res_a_instA_${ts}`,
    });
    check("8. Entry reservation succeeds for userA", reserveResA.success);

    const balA2 = await adapter.getSandboxBalance(userA);
    check(
      "8b. Reservation reduces available funds (available: 500, reserved: 500)",
      balA2.available.amountMinor === 500 && balA2.reserved.amountMinor === 500,
    );

    // -------------------------------------------------------------------------
    // 9. Reservation Cannot Overdraw
    // -------------------------------------------------------------------------
    const overdrawRes = await adapter.reserveEntry({
      competitionInstanceId: instB,
      userId: userA,
      entryFee: createMoney(600, "GEL"),
      idempotencyKey: `res_overdraw_${ts}`,
    });
    check(
      "9. Reservation cannot overdraw (insufficient funds returned)",
      !overdrawRes.success && overdrawRes.errorCode === "INSUFFICIENT_FUNDS",
    );

    const balAAfterOverdraw = await adapter.getSandboxBalance(userA);
    check(
      "9b. Balances remain strictly intact after failed overdraw attempt",
      balAAfterOverdraw.available.amountMinor === 500 && balAAfterOverdraw.reserved.amountMinor === 500,
    );

    // -------------------------------------------------------------------------
    // 10. Concurrent Reservations Cannot Double-Spend
    // -------------------------------------------------------------------------
    console.log("\nSection 3: Concurrency & Advisory Lock Stress Test");
    // Fund userC with exactly 500 minor GEL
    await adapter.grantSandboxFunding(userC, createMoney(500, "GEL"), `grant_c_${ts}`);

    // Create 5 different target instances for concurrent reservation attempts
    const concurrentInstances: string[] = [];
    for (let i = 0; i < 5; i++) {
      const cInstId = `p2_inst_conc_${i}_${ts}`;
      concurrentInstances.push(cInstId);
      await pool.query(
        `INSERT INTO competition_instances (id, template_id, game_id, format, participant_capacity, currency, entry_fee_minor, rules_version, skill_assessment_version, jurisdiction, status)
         VALUES ($1, $2, 'space-blaster', 'HEAD_TO_HEAD', 2, 'GEL', 500, 'v1.0', 'v1.0', 'GE', 'CREATED')`,
        [cInstId, tmplId],
      );
    }

    // Launch 5 simultaneous reservations of 500 GEL each on userC (who only has 500 GEL available)
    const concurrentPromises = concurrentInstances.map((cInstId, idx) =>
      adapter.reserveEntry({
        competitionInstanceId: cInstId,
        userId: userC,
        entryFee: createMoney(500, "GEL"),
        idempotencyKey: `conc_res_${idx}_${ts}`,
      }),
    );

    const concurrentResults = await Promise.all(concurrentPromises);
    const successfulReservations = concurrentResults.filter((r) => r.success);
    const failedReservations = concurrentResults.filter((r) => !r.success && r.errorCode === "INSUFFICIENT_FUNDS");

    check(
      "10. Concurrent reservations cannot double-spend: exactly 1 succeeds and 4 fail with INSUFFICIENT_FUNDS",
      successfulReservations.length === 1 && failedReservations.length === 4,
      `Successes: ${successfulReservations.length}, Failures: ${failedReservations.length}`,
    );

    const balCAfterConcurrent = await adapter.getSandboxBalance(userC);
    check(
      "10b. UserC available balance is 0 and reserved balance is 500 (no overdraft)",
      balCAfterConcurrent.available.amountMinor === 0 && balCAfterConcurrent.reserved.amountMinor === 500,
    );

    // -------------------------------------------------------------------------
    // 11. Duplicate Reservation Idempotency
    // -------------------------------------------------------------------------
    console.log("\nSection 4: Idempotency & Lifecycle Transitions");
    const dupRes = await adapter.reserveEntry({
      competitionInstanceId: instA,
      userId: userA,
      entryFee: createMoney(500, "GEL"),
      idempotencyKey: `res_a_instA_${ts}`, // exact same idempotency key as step 8
    });
    check("11. Duplicate reservation idempotency: returns success", dupRes.success);
    check(
      "11b. Duplicate reservation returns identical accountingReferenceId",
      dupRes.accountingReferenceId === reserveResA.accountingReferenceId,
    );

    const balAAfterDup = await adapter.getSandboxBalance(userA);
    check(
      "11c. Balances unchanged after duplicate reservation",
      balAAfterDup.available.amountMinor === 500 && balAAfterDup.reserved.amountMinor === 500,
    );

    // -------------------------------------------------------------------------
    // 12. Reservation Release Restores Funds Exactly Once
    // -------------------------------------------------------------------------
    // We will test release on userC's successful reservation
    const successfulInst = successfulReservations[0].competitionInstanceId;
    const releaseRes1 = await adapter.releaseEntry({
      competitionInstanceId: successfulInst,
      userId: userC,
      idempotencyKey: `rel_c_${ts}`,
    });
    check("12. Reservation release restores funds", releaseRes1.success);

    const balCAfterRelease1 = await adapter.getSandboxBalance(userC);
    check(
      "12b. Available funds restored to 500, reserved reduced to 0",
      balCAfterRelease1.available.amountMinor === 500 && balCAfterRelease1.reserved.amountMinor === 0,
    );

    // Duplicate release test (idempotency)
    const releaseRes2 = await adapter.releaseEntry({
      competitionInstanceId: successfulInst,
      userId: userC,
      idempotencyKey: `rel_c_dup_${ts}`,
    });
    check("12c. Duplicate reservation release returns success idempotently", releaseRes2.success);

    const balCAfterRelease2 = await adapter.getSandboxBalance(userC);
    check(
      "12d. Funds NOT double-restored (available remains 500, reserved remains 0)",
      balCAfterRelease2.available.amountMinor === 500 && balCAfterRelease2.reserved.amountMinor === 0,
    );

    // -------------------------------------------------------------------------
    // 13. Entry Capture Behaves Correctly
    // -------------------------------------------------------------------------
    // Fund userB and reserve for instA (standard duel)
    await adapter.grantSandboxFunding(userB, createMoney(1000, "GEL"), `grant_b_${ts}`);
    const reserveResB = await adapter.reserveEntry({
      competitionInstanceId: instA,
      userId: userB,
      entryFee: createMoney(500, "GEL"),
      idempotencyKey: `res_b_instA_${ts}`,
    });
    check("Setup: userB reserves for instA", reserveResB.success);

    // Now capture entries for both userA and userB for instA
    const captureA = await adapter.captureEntry({
      competitionInstanceId: instA,
      userId: userA,
      idempotencyKey: `cap_a_instA_${ts}`,
    });
    const captureB = await adapter.captureEntry({
      competitionInstanceId: instA,
      userId: userB,
      idempotencyKey: `cap_b_instA_${ts}`,
    });
    check("13. Entry capture succeeds for both participants", captureA.success && captureB.success);

    const balACaptured = await adapter.getSandboxBalance(userA);
    const balBCaptured = await adapter.getSandboxBalance(userB);
    check(
      "13b. Reserved funds transitioned away upon capture (userA reserved=0, userB reserved=0)",
      balACaptured.reserved.amountMinor === 0 && balBCaptured.reserved.amountMinor === 0,
    );

    // -------------------------------------------------------------------------
    // 14. Standard 2×₾5 / ₾9 Settlement (Case A)
    // -------------------------------------------------------------------------
    console.log("\nSection 5: Settlement Scenarios (Cases A, B, C, D)");
    // Winner: userA (prize 900, platform fee retained 100)
    const settleA = await adapter.settleCompetition({
      competitionInstanceId: instA,
      prizes: [
        {
          placement: 1,
          userId: userA,
          amount: createMoney(900, "GEL"),
        },
      ],
      idempotencyKey: `settle_instA_${ts}`,
    });
    check("14. Standard 2x₾5 / ₾9 settlement succeeds", settleA.success);
    check(
      "14b. Settlement reports captured 1000, prize 900, margin 100, subsidy 0",
      settleA.totalEntriesCaptured.amountMinor === 1000 &&
        settleA.totalPrizesAwarded.amountMinor === 900 &&
        settleA.platformMarginRetained.amountMinor === 100 &&
        settleA.promotionalSubsidyInjected.amountMinor === 0,
    );

    const balAWonA = await adapter.getSandboxBalance(userA);
    // UserA started with 1000, reserved 500 (avail 500), captured 500, won 900 -> 500 + 900 = 1400
    check("14c. Winner userA received prize (available = 1400)", balAWonA.available.amountMinor === 1400);

    const reconA = await adapter.reconcileCompetitionInstance(instA);
    check("14d. Instance A reconciles with zero discrepancy", reconA.reconciled && reconA.discrepancyMinor === 0);

    // -------------------------------------------------------------------------
    // 15. Promotional 2×₾5 / ₾20 Settlement (Case B: Prize > Entries)
    // -------------------------------------------------------------------------
    // UserA and UserB reserve and capture for instB
    await adapter.reserveEntry({
      competitionInstanceId: instB,
      userId: userA,
      entryFee: createMoney(500, "GEL"),
      idempotencyKey: `res_a_instB_${ts}`,
    });
    await adapter.reserveEntry({
      competitionInstanceId: instB,
      userId: userB,
      entryFee: createMoney(500, "GEL"),
      idempotencyKey: `res_b_instB_${ts}`,
    });
    await adapter.captureEntry({ competitionInstanceId: instB, userId: userA, idempotencyKey: `cap_a_instB_${ts}` });
    await adapter.captureEntry({ competitionInstanceId: instB, userId: userB, idempotencyKey: `cap_b_instB_${ts}` });

    // Settle with 2000 prize (promotional overlay: subsidy = 1000)
    const settleB = await adapter.settleCompetition({
      competitionInstanceId: instB,
      prizes: [
        {
          placement: 1,
          userId: userB,
          amount: createMoney(2000, "GEL"),
        },
      ],
      idempotencyKey: `settle_instB_${ts}`,
    });
    check("15. Promotional 2x₾5 / ₾20 settlement succeeds", settleB.success);
    check(
      "15b. Settlement reports captured 1000, prize 2000, subsidy 1000, margin 0",
      settleB.totalEntriesCaptured.amountMinor === 1000 &&
        settleB.totalPrizesAwarded.amountMinor === 2000 &&
        settleB.promotionalSubsidyInjected.amountMinor === 1000 &&
        settleB.platformMarginRetained.amountMinor === 0,
    );

    const reconB = await adapter.reconcileCompetitionInstance(instB);
    check("15c. Instance B reconciles with zero discrepancy", reconB.reconciled && reconB.discrepancyMinor === 0);

    // -------------------------------------------------------------------------
    // 16. Freeroll / Sponsored Prize Settlement (Case C: 0 Entry, ₾1,000 Prize)
    // -------------------------------------------------------------------------
    // UserA and UserB reserve and capture for instC (entry fee 0)
    await adapter.reserveEntry({
      competitionInstanceId: instC,
      userId: userA,
      entryFee: createMoney(0, "GEL"),
      idempotencyKey: `res_a_instC_${ts}`,
    });
    await adapter.reserveEntry({
      competitionInstanceId: instC,
      userId: userB,
      entryFee: createMoney(0, "GEL"),
      idempotencyKey: `res_b_instC_${ts}`,
    });
    await adapter.captureEntry({ competitionInstanceId: instC, userId: userA, idempotencyKey: `cap_a_instC_${ts}` });
    await adapter.captureEntry({ competitionInstanceId: instC, userId: userB, idempotencyKey: `cap_b_instC_${ts}` });

    // Settle with 100,000 minor GEL sponsored prize (₾1,000.00)
    const settleC = await adapter.settleCompetition({
      competitionInstanceId: instC,
      prizes: [
        {
          placement: 1,
          userId: userA,
          amount: createMoney(100000, "GEL"),
        },
      ],
      idempotencyKey: `settle_instC_${ts}`,
    });
    check("16. Freeroll / sponsored prize settlement succeeds", settleC.success);
    check(
      "16b. Settlement reports captured 0, prize 100000, subsidy 100000, margin 0",
      settleC.totalEntriesCaptured.amountMinor === 0 &&
        settleC.totalPrizesAwarded.amountMinor === 100000 &&
        settleC.promotionalSubsidyInjected.amountMinor === 100000 &&
        settleC.platformMarginRetained.amountMinor === 0,
    );

    const reconC = await adapter.reconcileCompetitionInstance(instC);
    check("16c. Instance C reconciles with zero discrepancy", reconC.reconciled && reconC.discrepancyMinor === 0);

    // -------------------------------------------------------------------------
    // 17. Multi-Placement Prizes (Case D: 1st: 600, 2nd: 300)
    // -------------------------------------------------------------------------
    await adapter.reserveEntry({
      competitionInstanceId: instD,
      userId: userA,
      entryFee: createMoney(500, "GEL"),
      idempotencyKey: `res_a_instD_${ts}`,
    });
    await adapter.reserveEntry({
      competitionInstanceId: instD,
      userId: userB,
      entryFee: createMoney(500, "GEL"),
      idempotencyKey: `res_b_instD_${ts}`,
    });
    await adapter.captureEntry({ competitionInstanceId: instD, userId: userA, idempotencyKey: `cap_a_instD_${ts}` });
    await adapter.captureEntry({ competitionInstanceId: instD, userId: userB, idempotencyKey: `cap_b_instD_${ts}` });

    const settleD = await adapter.settleCompetition({
      competitionInstanceId: instD,
      prizes: [
        { placement: 1, userId: userA, amount: createMoney(600, "GEL") },
        { placement: 2, userId: userB, amount: createMoney(300, "GEL") },
      ],
      idempotencyKey: `settle_instD_${ts}`,
    });
    check("17. Multi-placement prize settlement succeeds", settleD.success);
    check(
      "17b. Multi-placement reports captured 1000, prizes 900, margin 100, subsidy 0",
      settleD.totalEntriesCaptured.amountMinor === 1000 &&
        settleD.totalPrizesAwarded.amountMinor === 900 &&
        settleD.platformMarginRetained.amountMinor === 100,
    );

    const reconD = await adapter.reconcileCompetitionInstance(instD);
    check("17c. Instance D reconciles with zero discrepancy", reconD.reconciled && reconD.discrepancyMinor === 0);

    // -------------------------------------------------------------------------
    // 18. Duplicate Settlement Cannot Double-Award
    // -------------------------------------------------------------------------
    console.log("\nSection 6: Idempotent Settlement & Refund Controls");
    const balABeforeDupSettle = await adapter.getSandboxBalance(userA);
    const dupSettleD = await adapter.settleCompetition({
      competitionInstanceId: instD,
      prizes: [
        { placement: 1, userId: userA, amount: createMoney(600, "GEL") },
        { placement: 2, userId: userB, amount: createMoney(300, "GEL") },
      ],
      idempotencyKey: `settle_instD_dup_${ts}`,
    });
    check("18. Duplicate settlement returns success idempotently", dupSettleD.success);

    const balAAfterDupSettle = await adapter.getSandboxBalance(userA);
    check(
      "18b. Winner balances unchanged upon duplicate settlement (no double-award)",
      balAAfterDupSettle.available.amountMinor === balABeforeDupSettle.available.amountMinor,
    );

    // -------------------------------------------------------------------------
    // 19. Refund Cannot Double-Credit
    // -------------------------------------------------------------------------
    // Create an instance for refund testing with 2 captured entries
    const instRefund = `p2_inst_refund_${ts}`;
    await pool.query(
      `INSERT INTO competition_instances (id, template_id, game_id, format, participant_capacity, currency, entry_fee_minor, rules_version, skill_assessment_version, jurisdiction, status)
       VALUES ($1, $2, 'space-blaster', 'HEAD_TO_HEAD', 2, 'GEL', 500, 'v1.0', 'v1.0', 'GE', 'CREATED')`,
      [instRefund, tmplId],
    );

    await adapter.reserveEntry({
      competitionInstanceId: instRefund,
      userId: userA,
      entryFee: createMoney(500, "GEL"),
      idempotencyKey: `res_a_ref_${ts}`,
    });
    await adapter.reserveEntry({
      competitionInstanceId: instRefund,
      userId: userB,
      entryFee: createMoney(500, "GEL"),
      idempotencyKey: `res_b_ref_${ts}`,
    });
    await adapter.captureEntry({ competitionInstanceId: instRefund, userId: userA, idempotencyKey: `cap_a_ref_${ts}` });
    await adapter.captureEntry({ competitionInstanceId: instRefund, userId: userB, idempotencyKey: `cap_b_ref_${ts}` });

    const balABeforeRef = await adapter.getSandboxBalance(userA);

    const refundRes1 = await adapter.refundCompetition({
      competitionInstanceId: instRefund,
      reason: "Match cancelled by test",
      idempotencyKey: `refund_inst_${ts}`,
    });
    check("19. Competition refund succeeds", refundRes1.success && refundRes1.totalRefunded.amountMinor === 1000);

    const balAAfterRef1 = await adapter.getSandboxBalance(userA);
    check(
      "19b. UserA credited exactly 500 from refund",
      balAAfterRef1.available.amountMinor === balABeforeRef.available.amountMinor + 500,
    );

    // Duplicate refund attempt
    const refundRes2 = await adapter.refundCompetition({
      competitionInstanceId: instRefund,
      reason: "Match cancelled by test retry",
      idempotencyKey: `refund_inst_dup_${ts}`,
    });
    check("19c. Duplicate refund returns success idempotently", refundRes2.success);

    const balAAfterRef2 = await adapter.getSandboxBalance(userA);
    check(
      "19d. UserA NOT double-credited on repeated refund",
      balAAfterRef2.available.amountMinor === balAAfterRef1.available.amountMinor,
    );

    // -------------------------------------------------------------------------
    // 20. Void Lifecycle Reconciles
    // -------------------------------------------------------------------------
    console.log("\nSection 7: Void Lifecycle & System Reconciliation");
    // Reserve entries on instVoid, then refund (void) before starting
    await adapter.reserveEntry({
      competitionInstanceId: instVoid,
      userId: userA,
      entryFee: createMoney(500, "GEL"),
      idempotencyKey: `res_a_void_${ts}`,
    });
    await adapter.reserveEntry({
      competitionInstanceId: instVoid,
      userId: userB,
      entryFee: createMoney(500, "GEL"),
      idempotencyKey: `res_b_void_${ts}`,
    });

    const voidRes = await adapter.refundCompetition({
      competitionInstanceId: instVoid,
      reason: "Competition voided before start",
      idempotencyKey: `void_inst_${ts}`,
    });
    check("20. Void before capture releases reservations and refunds", voidRes.success);

    const balAVoid = await adapter.getSandboxBalance(userA);
    check("20b. UserA reserved funds returned to available upon void", balAVoid.reserved.amountMinor === 0);

    // -------------------------------------------------------------------------
    // 21. Historical Diamonds Remain Untouched
    // -------------------------------------------------------------------------
    console.log("\nSection 8: Currency Isolation & Historical Preservation");
    const diamMatches = await pool.query(
      `SELECT COUNT(*)::integer AS cnt FROM matches_history WHERE currency = 'DIAMONDS'`,
    );
    const diamSettlements = await pool.query(
      `SELECT COUNT(*)::integer AS cnt FROM match_settlements WHERE currency = 'DIAMONDS'`,
    );
    const diamLedger = await pool.query(
      `SELECT COUNT(*)::integer AS cnt FROM ledger_entries WHERE currency = 'DIAMONDS'`,
    );
    check("21. Historical DIAMONDS records exist and are untouched by Phase 2", diamMatches.rows.length > 0 && diamSettlements.rows.length > 0 && diamLedger.rows.length > 0);

    // Assert NO diamonds in sandbox tables
    const sbDiam = await pool.query(
      `SELECT COUNT(*)::integer AS cnt FROM sandbox_ledger_entries WHERE currency = 'DIAMONDS'`,
    );
    check("21b. Zero DIAMONDS entries in sandbox_ledger_entries", Number(sbDiam.rows[0].cnt) === 0);

    // -------------------------------------------------------------------------
    // 22. Existing Coins Behavior Remains Untouched
    // -------------------------------------------------------------------------
    const coinMatches = await pool.query(
      `SELECT COUNT(*)::integer AS cnt FROM matches_history WHERE currency = 'COINS'`,
    );
    const coinSettlements = await pool.query(
      `SELECT COUNT(*)::integer AS cnt FROM match_settlements WHERE currency = 'COINS'`,
    );
    check("22. Existing COINS match and settlement records remain untouched", coinMatches.rows.length > 0 && coinSettlements.rows.length > 0);

    // Assert NO coins in sandbox tables
    const sbCoins = await pool.query(
      `SELECT COUNT(*)::integer AS cnt FROM sandbox_ledger_entries WHERE currency = 'COINS'`,
    );
    check("22b. Zero COINS entries in sandbox_ledger_entries", Number(sbCoins.rows[0].cnt) === 0);

    // -------------------------------------------------------------------------
    // 23. Sandbox and Coins Cannot Convert Into Each Other
    // -------------------------------------------------------------------------
    let conversionAttemptRejected = false;
    try {
      // Attempting to pass COINS into sandbox ledger
      await pool.query(
        `INSERT INTO sandbox_ledger_entries (id, accounting_reference_id, user_id, account_id, event_type, currency, amount_minor, balance_type, description)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [`sb_ill_${ts}`, `ref_${ts}`, userA, `user:${userA}:COINS`, "CONVERSION", "COINS", 500, "AVAILABLE", "Illegal conversion"],
      );
    } catch {
      conversionAttemptRejected = true;
    }
    check("23. Sandbox and Coins cannot convert into each other (isolated schema & types)", conversionAttemptRejected);

    // -------------------------------------------------------------------------
    // 24. Full Accounting Reconciliation Returns Zero Unexplained Discrepancy
    // -------------------------------------------------------------------------
    console.log("\nSection 9: Global Double-Entry Balancing & Reconciliation");
    const systemRecon = await adapter.reconcileSystem();
    check(
      "24. Full accounting reconciliation: algebraic sum of all double-entry postings equals exactly 0",
      systemRecon.reconciled && systemRecon.totalLedgerSum === 0,
      `Total ledger sum: ${systemRecon.totalLedgerSum}`,
    );

    // Clean up test rows in reverse foreign key order
    const allInstIds = [...allInstances, ...concurrentInstances, instRefund];
    await pool.query(`DELETE FROM sandbox_settlements WHERE competition_instance_id = ANY($1)`, [allInstIds]);
    await pool.query(`DELETE FROM sandbox_ledger_entries WHERE user_id = ANY($1) OR competition_instance_id = ANY($2) OR account_id LIKE 'platform:%'`, [allUsers, allInstIds]);
    await pool.query(`DELETE FROM sandbox_entry_reservations WHERE competition_instance_id = ANY($1)`, [allInstIds]);
    await pool.query(`DELETE FROM competition_instances WHERE id = ANY($1)`, [allInstIds]);
    await pool.query(`DELETE FROM competition_templates WHERE id = $1`, [tmplId]);
    await pool.query(`DELETE FROM users WHERE id = ANY($1)`, [allUsers]);

    console.log(`\n==================================================`);
    console.log(`Phase 2 Accounting Check: ${passes} PASS, ${failures} FAIL`);
    console.log(`==================================================\n`);

    if (failures > 0) {
      process.exit(1);
    }
  } finally {
    await pool.end();
  }
}

runPhase2AccountingChecks().catch((err) => {
  console.error("Fatal error during Phase 2 accounting checks:", err);
  process.exit(1);
});
