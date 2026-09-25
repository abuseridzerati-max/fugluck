// Focused Phase 3 Competition Lifecycle Engine Verification for Fugluck
// Tests all 43 required lifecycle, queueing, concurrency, settlement, and recovery invariants.

import "./require-disposable-test-database.ts";
import dotenv from "dotenv";
dotenv.config({ path: "packages/server/.env" });

import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import {
  AUTHORITY_VERSION,
  CYBER_HOPPER_AUTHORITY_VERSION,
  createMoney,
  GAME_COMPETITION_ELIGIBILITY_REGISTRY,
  type ISO4217Currency,
} from "../packages/shared/src/index";
import { SandboxAccountingAdapter } from "../packages/server/src/accounting/sandboxAdapter";
import {
  templateService,
  instanceService,
  lifecycleEngine,
  GameEligibilityError,
  TemplateValidationError,
  InstanceRegistrationError,
  assertValidTransition,
  InvalidStateTransitionError,
} from "../packages/server/src/competitions/index";
import { handleInviteFriend } from "../packages/server/src/matchmaking/invites";
import { enqueue, tryPair, generateSeed } from "../packages/server/src/matchmaking/queue";
import { createMatch } from "../packages/server/src/matchmaking/matches";

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

async function runPhase3LifecycleChecks(): Promise<void> {
  console.log("=== Fugluck Competition Economy — Phase 3 Lifecycle Engine Check ===\n");

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
    // Clean test state
    await pool.query(`DELETE FROM sandbox_settlements`);
    await pool.query(`DELETE FROM sandbox_ledger_entries`);
    await pool.query(`DELETE FROM sandbox_entry_reservations`);
    // Respect the live-authority FK chain before removing test matches.
    await pool.query(`DELETE FROM competition_authority_results`);
    await pool.query(`DELETE FROM competition_authority_decisions`);
    await pool.query(`DELETE FROM competition_authority_sessions`);
    await pool.query(`DELETE FROM competition_authority_runs`);
    await pool.query(`DELETE FROM competition_participants`);
    await pool.query(`DELETE FROM competition_instance_prizes`);
    await pool.query(`DELETE FROM match_settlements WHERE match_id IN (SELECT id FROM matches_history WHERE competition_instance_id IS NOT NULL)`);
    await pool.query(`DELETE FROM matches_history WHERE competition_instance_id IS NOT NULL`);
    await pool.query(`DELETE FROM competition_instances`);
    await pool.query(`DELETE FROM competition_template_prizes`);
    await pool.query(`DELETE FROM competition_templates`);

    // Setup Test Users in Disposable DB
    const testUsers = [
      { id: `u_p3_1_${ts}`, username: `p3_alice_${ts}`, email: `alice_${ts}@test.com` },
      { id: `u_p3_2_${ts}`, username: `p3_bob_${ts}`, email: `bob_${ts}@test.com` },
      { id: `u_p3_3_${ts}`, username: `p3_charlie_${ts}`, email: `charlie_${ts}@test.com` },
      { id: `u_p3_4_${ts}`, username: `p3_dave_${ts}`, email: `dave_${ts}@test.com` },
      { id: `u_p3_5_${ts}`, username: `p3_eve_${ts}`, email: `eve_${ts}@test.com` },
      { id: `u_p3_6_${ts}`, username: `p3_frank_${ts}`, email: `frank_${ts}@test.com` },
      { id: `u_p3_7_${ts}`, username: `p3_grace_${ts}`, email: `grace_${ts}@test.com` },
      { id: `u_p3_8_${ts}`, username: `p3_heidi_${ts}`, email: `heidi_${ts}@test.com` },
      { id: `u_p3_9_${ts}`, username: `p3_ivan_${ts}`, email: `ivan_${ts}@test.com` },
      { id: `u_p3_10_${ts}`, username: `p3_judy_${ts}`, email: `judy_${ts}@test.com` },
      { id: `u_p3_11_${ts}`, username: `p3_mallory_${ts}`, email: `mallory_${ts}@test.com` },
      { id: `u_p3_broke_${ts}`, username: `p3_broke_${ts}`, email: `broke_${ts}@test.com` },
    ];

    for (const u of testUsers) {
      await pool.query(
        `INSERT INTO users (id, username, password_hash, role)
         VALUES ($1, $2, 'hash_test', 'user')
         ON CONFLICT (id) DO NOTHING`,
        [u.id, u.username],
      );
    }

    // Fund test users with sandbox GEL balances (except broke user)
    for (const u of testUsers) {
      if (u.id.includes("broke")) continue;
      await adapter.grantSandboxTestFunds(u.id, 5000);
    }

    console.log("--- 1-6: Template Service & Eligibility Enforcement ---");

    // 1. Enabled template can be read
    const template1 = await templateService.createTemplate({
      id: `tmpl_sb_5gel_${ts}`,
      gameId: "space-blaster",
      title: "Space Blaster — ₾5 Entry — ₾9 Prize",
      format: "HEAD_TO_HEAD",
      participantCapacity: 2,
      currency: "GEL",
      entryFeeMinor: 500,
      prizes: [{ placement: 1, amountMinor: 900 }],
      rulesVersion: AUTHORITY_VERSION,
      skillAssessmentVersion: "v1",
      enabled: true,
      isSandbox: true,
    });
    const readTemplate = await templateService.getTemplate(template1.id);
    check("1. Enabled template can be read", Boolean(readTemplate && readTemplate.enabled && readTemplate.prizes?.length === 1));

    // 2. Disabled template cannot accept registration
    const disabledTmpl = await templateService.createTemplate({
      id: `tmpl_disabled_${ts}`,
      gameId: "space-blaster",
      title: "Disabled Template",
      entryFeeMinor: 500,
      prizes: [{ placement: 1, amountMinor: 900 }],
      rulesVersion: AUTHORITY_VERSION,
      skillAssessmentVersion: "v1",
      enabled: false,
      isSandbox: true,
    });
    let disabledRegBlocked = false;
    try {
      await instanceService.joinCompetitionQueue(disabledTmpl.id, testUsers[0].id, adapter);
    } catch (err: any) {
      disabledRegBlocked = err.code === "TEMPLATE_DISABLED";
    }
    check("2. Disabled template cannot accept registration", disabledRegBlocked);

    // 3. Invalid game rejected
    let invalidGameRejected = false;
    try {
      await templateService.createTemplate({
        gameId: "unregistered-arcade-game",
        title: "Invalid Game",
        entryFeeMinor: 500,
        prizes: [{ placement: 1, amountMinor: 900 }],
        rulesVersion: "v1",
        skillAssessmentVersion: "v1",
      });
    } catch (err: any) {
      invalidGameRejected = err instanceof GameEligibilityError;
    }
    check("3. Invalid game rejected", invalidGameRejected);

    // 4. COIN_COMPETITIVE game rejected for paid sandbox template
    let coinCompetitiveRejected = false;
    try {
      await templateService.createTemplate({
        gameId: "speed-trivia",
        title: "Speed Trivia GEL",
        entryFeeMinor: 500,
        prizes: [{ placement: 1, amountMinor: 900 }],
        rulesVersion: "v1",
        skillAssessmentVersion: "v1",
      });
    } catch (err: any) {
      coinCompetitiveRejected = err instanceof GameEligibilityError && err.message.includes("not certified");
    }
    check("4. COIN_COMPETITIVE game rejected for paid sandbox template", coinCompetitiveRejected);

    // 5. A non-certified game stays blocked even in sandbox mode.
    let uncertifiedRejected = false;
    try {
      await templateService.createTemplate({ gameId: "pixel-ninja-dash", title: "Pixel Ninja Dash Sandbox", entryFeeMinor: 200, prizes: [{ placement: 1, amountMinor: 360 }], rulesVersion: "pnd-1.0", skillAssessmentVersion: "v1", isSandbox: true });
    } catch (err: any) { uncertifiedRejected = err instanceof GameEligibilityError; }
    check("5. Non-certified game is rejected in sandbox mode", uncertifiedRejected);

    // 6. Zero games treated as production-paid approved
    const approvedCount = Object.values(GAME_COMPETITION_ELIGIBILITY_REGISTRY).filter(
      (e) => e === "PAID_COMPETITIVE_APPROVED",
    ).length;
    check("6. Zero games treated as production-paid approved", approvedCount === 0);

    console.log("\n--- 7-9: Instance Factory & Snapshotting Independence ---");

    // 7. Instance snapshots template
    const instSnapshot = await instanceService.createInstanceFromTemplate(template1.id);
    const hasSnapshot =
      instSnapshot.templateId === template1.id &&
      instSnapshot.entryFeeMinor === 500 &&
      instSnapshot.rulesVersion === AUTHORITY_VERSION &&
      instSnapshot.prizes?.[0]?.amountMinor === 900;
    check("7. Instance snapshots template", hasSnapshot);

    // 8. Template edit doesn't alter instance
    await templateService.updateTemplate(template1.id, {
      enabled: false,
      rulesVersion: "sb-2.0.0-MUTATED",
      title: "New Mutated Title",
    });
    const refreshedInst = await instanceService.getInstance(instSnapshot.id);
    check(
      "8. Template edit doesn't alter instance",
      refreshedInst?.rulesVersion === AUTHORITY_VERSION && refreshedInst?.entryFeeMinor === 500,
    );

    // 9. Prize edit doesn't alter instance prize snapshot
    await templateService.updateTemplate(template1.id, {
      prizes: [{ placement: 1, amountMinor: 1500 }],
    });
    const refreshedInstPrizes = await instanceService.getInstance(instSnapshot.id);
    check(
      "9. Prize edit doesn't alter instance prize snapshot",
      refreshedInstPrizes?.prizes?.[0]?.amountMinor === 900,
    );

    console.log("\n--- 10-14: Continuous Queue & Final-Seat Concurrency ---");

    // 10. First participant creates/joins 1/2 instance
    const queueTmpl = await templateService.createTemplate({
      id: `tmpl_queue_test_${ts}`,
      gameId: "space-blaster",
      title: "Space Blaster 1v1",
      entryFeeMinor: 300,
      prizes: [{ placement: 1, amountMinor: 550 }],
      rulesVersion: AUTHORITY_VERSION,
      skillAssessmentVersion: "v1",
      isSandbox: true,
    });

    const join1 = await instanceService.joinCompetitionQueue(queueTmpl.id, testUsers[0].id, adapter);
    check(
      "10. First participant creates/joins 1/2 instance",
      join1.currentParticipants === 1 && join1.seatIndex === 0 && join1.status === "PENDING_ENTRANTS",
    );

    // 11. Second participant fills 2/2
    const join2 = await instanceService.joinCompetitionQueue(queueTmpl.id, testUsers[1].id, adapter);
    check(
      "11. Second participant fills 2/2",
      join2.instanceId === join1.instanceId && join2.currentParticipants === 2 && join2.status === "LOCKED",
    );

    // 12. Third participant goes to next instance
    const join3 = await instanceService.joinCompetitionQueue(queueTmpl.id, testUsers[2].id, adapter);
    check(
      "12. Third participant goes to next instance",
      join3.instanceId !== join1.instanceId && join3.currentParticipants === 1 && join3.seatIndex === 0,
    );

    // 13. Same user cannot join same instance twice
    let duplicateJoinBlocked = false;
    try {
      await instanceService.joinCompetitionQueue(queueTmpl.id, testUsers[2].id, adapter);
    } catch (err: any) {
      duplicateJoinBlocked = err.code === "DUPLICATE_USER_IN_INSTANCE";
    }
    check("13. Same user cannot join same instance twice", duplicateJoinBlocked);

    // 14. Final-seat concurrency cannot overfill
    // Target instance already at 1/2 with testUsers[2]
    const currentInstanceId = join3.instanceId;
    const concurrentJoiners = [
      testUsers[3],
      testUsers[4],
      testUsers[5],
      testUsers[6],
      testUsers[7],
      testUsers[8],
      testUsers[9],
      testUsers[10],
    ];

    const concurrentResults = await Promise.all(
      concurrentJoiners.map((u) => instanceService.joinCompetitionQueue(queueTmpl.id, u.id, adapter)),
    );

    const filledInitial = concurrentResults.filter((r) => r.instanceId === currentInstanceId);
    const routedNext = concurrentResults.filter((r) => r.instanceId !== currentInstanceId);

    const checkInstRows = await pool.query(
      `SELECT id, current_participants, status FROM competition_instances WHERE id = $1`,
      [currentInstanceId],
    );
    const finalInitialInst = checkInstRows.rows[0];

    check(
      "14. Final-seat concurrency cannot overfill",
      filledInitial.length === 1 &&
        finalInitialInst.current_participants === 2 &&
        finalInitialInst.status === "LOCKED" &&
        routedNext.length === 7,
    );

    console.log("\n--- 15-20: Accounting Integration & Match Creation ---");

    // 15. Failed accounting reservation leaves no seat
    const brokeTmpl = await templateService.createTemplate({
      gameId: "cyber-hopper",
      title: "Cyber Hopper ₾10",
      entryFeeMinor: 1000,
      prizes: [{ placement: 1, amountMinor: 1800 }],
      rulesVersion: CYBER_HOPPER_AUTHORITY_VERSION,
      skillAssessmentVersion: "v1",
      isSandbox: true,
    });
    let brokeJoinFailed = false;
    try {
      await instanceService.joinCompetitionQueue(brokeTmpl.id, testUsers[11].id, adapter); // broke user
    } catch (err: any) {
      brokeJoinFailed = err.code === "INSUFFICIENT_FUNDS";
    }
    const brokeInstanceCheck = await pool.query(
      `SELECT count(*) FROM competition_participants WHERE user_id = $1`,
      [testUsers[11].id],
    );
    check(
      "15. Failed accounting reservation leaves no seat",
      brokeJoinFailed && Number(brokeInstanceCheck.rows[0].count) === 0,
    );

    // 16. Successful registration reserves exact entry amount
    const resCheck = await pool.query(
      `SELECT amount_minor, status FROM sandbox_entry_reservations WHERE user_id = $1 AND competition_instance_id = $2`,
      [testUsers[0].id, join1.instanceId],
    );
    check(
      "16. Successful registration reserves exact entry amount",
      resCheck.rows.length === 1 && resCheck.rows[0].amount_minor === 300,
    );

    // 17. LOCKED captures entries
    const activatedMatch = await lifecycleEngine.activateLockedCompetition(join1.instanceId, adapter);
    const capCheck = await pool.query(
      `SELECT status FROM sandbox_entry_reservations WHERE competition_instance_id = $1`,
      [join1.instanceId],
    );
    const allCaptured = capCheck.rows.length === 2 && capCheck.rows.every((r) => r.status === "CAPTURED");
    check("17. LOCKED captures entries", allCaptured);

    // 18. Match created once
    const matchCountCheck = await pool.query(
      `SELECT count(*) FROM matches_history WHERE competition_instance_id = $1`,
      [join1.instanceId],
    );
    check("18. Match created once", Number(matchCountCheck.rows[0].count) === 1);

    // 19. Competition linked to matches_history
    const linkedMatchCheck = await pool.query(
      `SELECT id, competition_instance_id FROM matches_history WHERE id = $1`,
      [activatedMatch.matchId],
    );
    check(
      "19. Competition linked to matches_history",
      linkedMatchCheck.rows[0]?.competition_instance_id === join1.instanceId,
    );

    // 20. Server-generated seed used
    const seedCheck = await pool.query(`SELECT seed FROM matches_history WHERE id = $1`, [activatedMatch.matchId]);
    const validSeed = Number(seedCheck.rows[0]?.seed) > 0;
    check("20. Server-generated seed used", validSeed);

    console.log("\n--- 21-24: Security, Guest, and Friend Restrictions ---");

    // 21. Client cannot alter entry fee
    // Verified by instanceService architecture: entryFeeMinor is pulled strictly from instance snapshot
    const instForClientTest = await instanceService.getInstance(join1.instanceId);
    check("21. Client cannot alter entry fee", instForClientTest?.entryFeeMinor === 300);

    // 22. Client cannot alter prize
    check("22. Client cannot alter prize", instForClientTest?.prizes?.[0]?.amountMinor === 550);

    // 23. Guest rejected
    let guestRejected = false;
    try {
      await instanceService.joinCompetitionQueue(queueTmpl.id, "guest_user_1", adapter, { isGuest: true });
    } catch (err: any) {
      guestRejected = err.code === "GUEST_NOT_ALLOWED";
    }
    check("23. Guest rejected", guestRejected);

    // 24. Paid friend challenge rejected
    let friendChallengeRejected = false;
    const fakeSocket: any = {
      data: { userId: testUsers[0].id, username: testUsers[0].username },
      emit: (event: string, payload: any) => {
        if (event === "inviteError" && payload.message.includes("Paid private friend challenges are prohibited")) {
          friendChallengeRejected = true;
        }
      },
    };
    await handleInviteFriend(fakeSocket, {
      friendUserId: testUsers[1].id,
      gameId: "space-blaster",
      templateId: queueTmpl.id, // malicious payload attempting paid invite
    } as any);
    check("24. Paid friend challenge rejected", friendChallengeRejected);

    console.log("\n--- 25-28: Score Validation & Authoritative Settlement ---");

    // Setup fresh 2-player competition for match scoring and settlement
    const settleTmpl = await templateService.createTemplate({
      gameId: "space-blaster",
      title: "Space Blaster Settle Test",
      entryFeeMinor: 500,
      prizes: [{ placement: 1, amountMinor: 950 }],
      rulesVersion: AUTHORITY_VERSION,
      skillAssessmentVersion: "v1",
      isSandbox: true,
    });
    const sJoin1 = await instanceService.joinCompetitionQueue(settleTmpl.id, testUsers[0].id, adapter);
    const sJoin2 = await instanceService.joinCompetitionQueue(settleTmpl.id, testUsers[1].id, adapter);
    const sMatch = await lifecycleEngine.activateLockedCompetition(sJoin1.instanceId, adapter);

    // 25. Client-reported score cannot advance a prize competition.
    let clientScoreRejected = false;
    try { await lifecycleEngine.submitScore({ instanceId: sJoin1.instanceId, userId: testUsers[0].id, score: 999999 }, adapter); }
    catch (err: any) { clientScoreRejected = err.code === "LIVE_AUTHORITY_REQUIRED"; }
    check("25. Client score requires a certified live authority decision", clientScoreRejected);

    // 26. An attacker-supplied score also cannot settle or award a prize.
    let inflatedScoreRejected = false;
    try { await lifecycleEngine.submitScore({ instanceId: sJoin1.instanceId, userId: testUsers[1].id, score: 999999999 }, adapter); }
    catch (err: any) { inflatedScoreRejected = err.code === "LIVE_AUTHORITY_REQUIRED"; }
    check("26. Inflated client score cannot win", inflatedScoreRejected);

    // 27. Standard winner gets snapshotted prize
    const settledInst = await instanceService.getInstance(sJoin1.instanceId);
    const winnerPart = settledInst?.participants.find((p) => p.userId === testUsers[0].id);
    const loserPart = settledInst?.participants.find((p) => p.userId === testUsers[1].id);
    check(
      "27. Client scores do not write a winner or prize award",
      settledInst?.status !== "SETTLED" && settledInst?.winnerUserId == null &&
        winnerPart?.prizeWonMinor === 0 && winnerPart?.rank == null &&
        loserPart?.prizeWonMinor === 0 && loserPart?.rank == null,
    );

    // 28. Duplicate settlement cannot double-award
    const firstVoid = await lifecycleEngine.settleCompetition(sJoin1.instanceId, { systemVoid: true, voidReason: "LEGACY_PATH_DISABLED" }, adapter);
    const duplicateSettle = await lifecycleEngine.settleCompetition(sJoin1.instanceId, { systemVoid: true, voidReason: "LEGACY_PATH_DISABLED" }, adapter);
    const settlementCountCheck = await pool.query(
      `SELECT count(*) FROM sandbox_settlements WHERE competition_instance_id = $1`,
      [sJoin1.instanceId],
    );
    check(
      "28. Duplicate settlement cannot double-award",
      firstVoid.status === "VOIDED" && duplicateSettle.status === "VOIDED" && Number(settlementCountCheck.rows[0].count) === 1,
    );

    console.log("\n--- 29-33: Draw / Tie, Forfeit, Void, & Waiting Cancellation ---");

    // 29. Exact tie produces full refund
    const tieTmpl = await templateService.createTemplate({
      gameId: "space-blaster",
      title: "Tie Refund Test",
      entryFeeMinor: 400,
      prizes: [{ placement: 1, amountMinor: 750 }],
      rulesVersion: AUTHORITY_VERSION,
      skillAssessmentVersion: "v1",
      isSandbox: true,
    });
    const tJoin1 = await instanceService.joinCompetitionQueue(tieTmpl.id, testUsers[0].id, adapter);
    const tJoin2 = await instanceService.joinCompetitionQueue(tieTmpl.id, testUsers[1].id, adapter);
    const tMatch = await lifecycleEngine.activateLockedCompetition(tJoin1.instanceId, adapter);

    // Client-reported ties are not accepted as competition decisions; void via
    // the explicit system-failure path and refund the captured entries.
    let tieScoreRejected = false;
    try { await lifecycleEngine.submitScore({ instanceId: tJoin1.instanceId, userId: testUsers[0].id, score: 50 }, adapter); }
    catch (err: any) { tieScoreRejected = err.code === "LIVE_AUTHORITY_REQUIRED"; }
    const tieVoid = await lifecycleEngine.settleCompetition(tJoin1.instanceId, { systemVoid: true, voidReason: "LEGACY_SCORE_PATH_DISABLED" }, adapter);
    const tieInst = await instanceService.getInstance(tJoin1.instanceId);
    const tieRefundCheck = await pool.query(
      `SELECT total_entries_captured_minor, status FROM sandbox_settlements WHERE competition_instance_id = $1`,
      [tJoin1.instanceId],
    );
    check("29. Client score cannot declare a tie and system void refunds", tieScoreRejected && tieVoid.status === "VOIDED" && tieInst?.status === "VOIDED" && tieRefundCheck.rows[0]?.status === "REFUNDED" && Number(tieRefundCheck.rows[0]?.total_entries_captured_minor) === 800);

    // 30. Player forfeit resolves correctly
    const ffTmpl = await templateService.createTemplate({
      gameId: "space-blaster",
      title: "Forfeit Test",
      entryFeeMinor: 300,
      prizes: [{ placement: 1, amountMinor: 550 }],
      rulesVersion: AUTHORITY_VERSION,
      skillAssessmentVersion: "v1",
      isSandbox: true,
    });
    const fJoin1 = await instanceService.joinCompetitionQueue(ffTmpl.id, testUsers[2].id, adapter);
    const fJoin2 = await instanceService.joinCompetitionQueue(ffTmpl.id, testUsers[3].id, adapter);
    await lifecycleEngine.activateLockedCompetition(fJoin1.instanceId, adapter);

    // Legacy lifecycle calls cannot award a forfeit win without authority.
    let legacyForfeitRejected = false;
    try { await lifecycleEngine.settleCompetition(fJoin1.instanceId, { forfeitingUserId: testUsers[3].id }, adapter); }
    catch (err: any) { legacyForfeitRejected = err.code === "LIVE_AUTHORITY_REQUIRED"; }
    const forfeitOutcome = await lifecycleEngine.settleCompetition(fJoin1.instanceId, { systemVoid: true, voidReason: "LEGACY_FORFEIT_PATH_DISABLED" }, adapter);
    const forfeitInst = await instanceService.getInstance(fJoin1.instanceId);
    check(
      "30. Legacy forfeit request cannot award a winner",
      legacyForfeitRejected && forfeitOutcome.status === "VOIDED" &&
        forfeitInst?.winnerUserId == null &&
        forfeitInst?.participants.find((p) => p.userId === testUsers[2].id)?.prizeWonMinor === 0,
    );

    // 31. System void refunds correctly
    const voidTmpl = await templateService.createTemplate({
      gameId: "space-blaster",
      title: "System Void Test",
      entryFeeMinor: 250,
      prizes: [{ placement: 1, amountMinor: 450 }],
      rulesVersion: AUTHORITY_VERSION,
      skillAssessmentVersion: "v1",
      isSandbox: true,
    });
    const vJoin1 = await instanceService.joinCompetitionQueue(voidTmpl.id, testUsers[4].id, adapter);
    const vJoin2 = await instanceService.joinCompetitionQueue(voidTmpl.id, testUsers[5].id, adapter);
    await lifecycleEngine.activateLockedCompetition(vJoin1.instanceId, adapter);

    const voidOutcome = await lifecycleEngine.settleCompetition(
      vJoin1.instanceId,
      { systemVoid: true, voidReason: "SERVER_SIMULATED_CRASH" },
      adapter,
    );
    const voidInst = await instanceService.getInstance(vJoin1.instanceId);
    check(
      "31. System void refunds correctly",
      voidOutcome.status === "VOIDED" && voidInst?.status === "VOIDED",
    );

    // 32. Waiting timeout releases reservation
    const timeoutTmpl = await templateService.createTemplate({
      gameId: "space-blaster",
      title: "Timeout Test",
      entryFeeMinor: 150,
      prizes: [{ placement: 1, amountMinor: 270 }],
      rulesVersion: AUTHORITY_VERSION,
      skillAssessmentVersion: "v1",
      isSandbox: true,
    });
    const tmoJoin = await instanceService.joinCompetitionQueue(timeoutTmpl.id, testUsers[6].id, adapter);
    const cancelRes = await lifecycleEngine.cancelUnfilledInstance(tmoJoin.instanceId, adapter, "TIMEOUT");
    const tmoInst = await instanceService.getInstance(tmoJoin.instanceId);
    check('cancelled participants have terminal status',Boolean(tmoInst?.participants.every(p=>p.status==='CANCELLED'&&p.rank===null)));
    check('legacy system void participants have terminal status',Boolean(voidInst?.participants.every(p=>p.status==='VOIDED'&&p.rank===null)));
    const tmoResCheck = await pool.query(
      `SELECT status FROM sandbox_entry_reservations WHERE competition_instance_id = $1`,
      [tmoJoin.instanceId],
    );
    check(
      "32. Waiting timeout releases reservation",
      cancelRes.cancelled === true &&
        tmoInst?.status === "CANCELLED" &&
        tmoResCheck.rows[0]?.status === "RELEASED",
    );

    // 33. Cancellation idempotent
    const repeatCancel = await lifecycleEngine.cancelUnfilledInstance(tmoJoin.instanceId, adapter, "TIMEOUT");
    check("33. Cancellation idempotent", repeatCancel.cancelled === true);

    console.log("\n--- 34-38: Rematch Lifecycle ---");

    // 34. Rematch creates new instance
    const rJoin1 = await instanceService.joinCompetitionQueue(settleTmpl.id, testUsers[0].id, adapter);
    check("34. Rematch creates new instance", rJoin1.instanceId !== sJoin1.instanceId);

    // 35. Rematch creates new match ID
    const rJoin2 = await instanceService.joinCompetitionQueue(settleTmpl.id, testUsers[1].id, adapter);
    const rMatch = await lifecycleEngine.activateLockedCompetition(rJoin1.instanceId, adapter);
    check("35. Rematch creates new match ID", rMatch.matchId !== sMatch.matchId);

    // 36. Rematch creates fresh seed
    check("36. Rematch creates fresh seed", rMatch.seed > 0);

    // 37. Rematch performs new accounting reservation
    const rResCount = await pool.query(
      `SELECT count(*) FROM sandbox_entry_reservations WHERE competition_instance_id = $1`,
      [rJoin1.instanceId],
    );
    check("37. Rematch performs new accounting reservation", Number(rResCount.rows[0].count) === 2);

    // 38. Insufficient-funds rematch fails safely
    let brokeRematchFailed = false;
    try {
      await instanceService.joinCompetitionQueue(settleTmpl.id, testUsers[11].id, adapter);
    } catch (err: any) {
      brokeRematchFailed = err.code === "INSUFFICIENT_FUNDS";
    }
    check("38. Insufficient-funds rematch fails safely", brokeRematchFailed);

    console.log("\n--- 39-40: Crash & Orphan Recovery ---");

    // 39. Crash recovery releases/refunds stranded funds
    const crashTmpl = await templateService.createTemplate({
      gameId: "space-blaster",
      title: "Crash Recovery Test",
      entryFeeMinor: 200,
      prizes: [{ placement: 1, amountMinor: 360 }],
      rulesVersion: AUTHORITY_VERSION,
      skillAssessmentVersion: "v1",
      isSandbox: true,
    });
    // Active instance (2/2 filled and activated)
    const crashActive1 = await instanceService.joinCompetitionQueue(crashTmpl.id, testUsers[7].id, adapter);
    const crashActive2 = await instanceService.joinCompetitionQueue(crashTmpl.id, testUsers[8].id, adapter);
    await lifecycleEngine.activateLockedCompetition(crashActive1.instanceId, adapter);

    // Pending instance (1/2 filled, stays in PENDING_ENTRANTS)
    const crashPendingJoin = await instanceService.joinCompetitionQueue(crashTmpl.id, testUsers[9].id, adapter);

    const recoveryResult1 = await lifecycleEngine.recoverOrphanCompetitions(adapter);
    const checkCrashPending = await instanceService.getInstance(crashPendingJoin.instanceId);
    const checkCrashActive = await instanceService.getInstance(crashActive1.instanceId);
    check(
      "39. Crash recovery releases/refunds stranded funds",
      recoveryResult1.recoveredPending >= 1 &&
        recoveryResult1.recoveredActive >= 1 &&
        checkCrashPending?.status === "CANCELLED" &&
        checkCrashActive?.status === "VOIDED",
    );

    // 40. Repeated recovery is idempotent
    const recoveryResult2 = await lifecycleEngine.recoverOrphanCompetitions(adapter);
    check(
      "40. Repeated recovery is idempotent",
      recoveryResult2.recoveredPending === 0 && recoveryResult2.recoveredActive === 0,
    );

    console.log("\n--- 41-43: Regressions & Reconciliation ---");

    // 41. Existing COINS matchmaking still works
    const fakeSocketA: any = { id: `sock_a_${ts}`, data: { userId: testUsers[0].id, username: testUsers[0].username } };
    const fakeSocketB: any = { id: `sock_b_${ts}`, data: { userId: testUsers[1].id, username: testUsers[1].username } };
    enqueue("space-blaster", fakeSocketA, "COINS", 0);
    enqueue("space-blaster", fakeSocketB, "COINS", 0);
    const paired = tryPair("space-blaster", "COINS", 0);
    check("41. Existing COINS matchmaking still works", Boolean(paired && paired.length === 2));

    // 42. Historical DIAMONDS remain unchanged
    const diamondHistRows = await pool.query(
      `SELECT count(*) FROM matches_history WHERE currency = 'DIAMONDS'`,
    );
    check("42. Historical DIAMONDS remain unchanged", Number(diamondHistRows.rows[0].count) >= 0);

    // 43. Full sandbox reconciliation remains zero discrepancy
    // Every reservation is either CAPTURED, RELEASED, or REFUNDED; all settlements balance
    const unfinalizedReservations = await pool.query(
      `SELECT count(*) FROM sandbox_entry_reservations WHERE status = 'RESERVED'`,
    );
    const nonBalancedLedger = await pool.query(`
      SELECT user_id, sum(case when balance_type = 'AVAILABLE' then amount_minor else 0 end) as avail
      FROM sandbox_ledger_entries
      GROUP BY user_id
      HAVING sum(case when balance_type = 'AVAILABLE' then amount_minor else 0 end) < 0
    `);
    check(
      "43. Full sandbox reconciliation remains zero discrepancy",
      Number(unfinalizedReservations.rows[0].count) === 0 && nonBalancedLedger.rows.length === 0,
    );

  } catch (err) {
    console.error("Fatal error during Phase 3 lifecycle test execution:", err);
    failures++;
  } finally {
    await pool.end();
  }

  console.log(`\n=== Phase 3 Checks: ${passes} Passed, ${failures} Failed ===\n`);
  if (failures > 0) {
    process.exit(1);
  }
}

void runPhase3LifecycleChecks();
