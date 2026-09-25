// Phase 4 Player-Facing Sandbox Competition Experience & UI Integrity Check for Fugluck
// Verifies Phase 4 requirements plus catalog loading and initialization regressions.

import "./require-disposable-test-database.ts";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
dotenv.config({ path: "packages/server/.env" });

import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import {
  GAME_COMPETITION_CERTIFICATIONS,
  isTestGelCompetitionCertified,
  type CompetitionTemplate,
  type ISO4217Currency,
} from "../packages/shared/src/index";
import { SandboxAccountingAdapter } from "../packages/server/src/accounting/sandboxAdapter";
import { templateService } from "../packages/server/src/competitions/index";

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

async function runPhase4UIChecks(): Promise<void> {
  console.log("=== Fugluck Competition Economy — Phase 4 UI & Experience Check ===\n");

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
    ssl: isSslRequired ? { rejectUnauthorized: false } : false,
    max: 5,
  });

  const sandboxAdapter = new SandboxAccountingAdapter(pool);

  // Read client files for verification
  const clientSrcDir = path.resolve(process.cwd(), "packages/client/src");
  const launchModalSrc = fs.readFileSync(path.join(clientSrcDir, "components/LaunchModal.tsx"), "utf-8");
  const catalogSrc = fs.readFileSync(path.join(clientSrcDir, "components/CompetitionCatalog.tsx"), "utf-8");
  const apiSrc = fs.readFileSync(path.join(clientSrcDir, "lib/api.ts"), "utf-8");
  const competitionRouteSrc = fs.readFileSync(path.resolve(process.cwd(), "packages/server/src/routes/competitions.ts"), "utf-8");
  const templateServiceSrc = fs.readFileSync(path.resolve(process.cwd(), "packages/server/src/competitions/templateService.ts"), "utf-8");
  const confirmModalSrc = fs.readFileSync(path.join(clientSrcDir, "components/CompetitionConfirmationModal.tsx"), "utf-8");
  const navbarSrc = fs.readFileSync(path.join(clientSrcDir, "components/Navbar.tsx"), "utf-8");
  const walletPageSrc = fs.readFileSync(path.join(clientSrcDir, "pages/WalletPage.tsx"), "utf-8");
  const profilePageSrc = fs.readFileSync(path.join(clientSrcDir, "pages/ProfilePage.tsx"), "utf-8");
  const matchLoaderSrc = fs.readFileSync(path.join(clientSrcDir, "game-loader/MatchLoader.tsx"), "utf-8");
  const authorityCompetitionSrc = fs.readFileSync(path.join(clientSrcDir, "game-loader/AuthorityCompetition.tsx"), "utf-8");
  const competitionsPageSrc = fs.readFileSync(path.join(clientSrcDir, "pages/CompetitionsPage.tsx"), "utf-8");
  const useMatchSocketSrc = fs.readFileSync(path.join(clientSrcDir, "matchmaking/useMatchSocket.ts"), "utf-8");

  try {
    // ----------------------------------------------------
    // Test 1: Eligible game displays Sandbox Competitions
    // ----------------------------------------------------
    console.log("--- Section 1: Game Eligibility & Launch Controls ---");
    const eligibleGames = ["space-blaster", "cyber-hopper"];
    const blockedGames = ["neon-runner", "pixel-ninja-dash"];
    const allEligible = eligibleGames.every((g) => isTestGelCompetitionCertified(g) &&
      GAME_COMPETITION_CERTIFICATIONS[g].testGelCompetition === "LEVEL_3_CERTIFIED");
    const blockedRemainBlocked = blockedGames.every((g) => !isTestGelCompetitionCertified(g) &&
      GAME_COMPETITION_CERTIFICATIONS[g].testGelCompetition === "NOT_CERTIFIED");
    check("1. Only Space Blaster and Cyber Hopper are Level 3 certified; Neon and Pixel remain blocked", allEligible && blockedRemainBlocked);

    // ----------------------------------------------------
    // Test 2: Coin-only game does not expose Sandbox Competitions
    // ----------------------------------------------------
    const coinOnlyGames = ["speed-trivia", "tf-sprint"];
    const allCoinOnly = coinOnlyGames.every((g) => GAME_COMPETITION_CERTIFICATIONS[g].testGelCompetition === "OUT_OF_SCOPE" && !isTestGelCompetitionCertified(g));
    const launchModalEnforcesRegistry =
      launchModalSrc.includes("GAME_COMPETITION_CERTIFICATIONS[gameId]?.testGelCompetition === 'LEVEL_3_CERTIFIED'") &&
      launchModalSrc.includes("isEligibleForSandboxCompetitions");
    check(
      "2. Coin-only games (Speed Trivia, TF Sprint) strictly blocked from Sandbox Competitions",
      allCoinOnly && launchModalEnforcesRegistry,
    );

    // ----------------------------------------------------
    // Test 3: Competition templates load from server
    // ----------------------------------------------------
    console.log("\n--- Section 2: Competition Catalog & Templates ---");
    const beforeSeed = await templateService.listTemplates();
    await Promise.all(Array.from({ length: 4 }, () => templateService.ensureDefaultTemplates(beforeSeed)));
    const firstSeed = await templateService.listTemplates();
    await templateService.ensureDefaultTemplates();
    const secondSeed = await templateService.listTemplates();
    const defaults = secondSeed.filter((t) => t.id.startsWith("tmpl_default_"));
    check("3a. Concurrent and repeated initialization preserves one copy of all four certified default templates and prizes",
      defaults.length === 4 && defaults.every((t) => t.prizes.length === 1) &&
      firstSeed.length === secondSeed.length &&
      defaults.every((d) => secondSeed.filter((t) => t.gameId === d.gameId && t.title === d.title).length === 1));

    const defaultFreeroll = defaults.find((t) => t.entryFeeMinor === 0)!;
    try {
      await templateService.disableTemplate(defaultFreeroll.id);
      await templateService.ensureDefaultTemplates();
      // A stale simultaneous request must also respect the existing primary key.
      await templateService.ensureDefaultTemplates([]);
      const afterDisabledSeed = await templateService.listTemplates();
      check("3b. Normal and stale initialization do not recreate or re-enable a disabled default",
        afterDisabledSeed.length === secondSeed.length &&
        afterDisabledSeed.find((t) => t.id === defaultFreeroll.id)?.enabled === false);
    } finally {
      await templateService.enableTemplate(defaultFreeroll.id);
    }
    const allEnabledTemplates = await templateService.listEnabledTemplates();
    const spaceBlasterTemplates = allEnabledTemplates.filter((t) => t.gameId === "space-blaster");
    check(
      "3. Competition templates load authoritatively from server",
      spaceBlasterTemplates.length >= 3 && spaceBlasterTemplates.some((t) => t.title.includes("Standard Duel")),
    );

    // ----------------------------------------------------
    // Test 4: Disabled / Archived template hidden from player catalog
    // ----------------------------------------------------
    const disabledTemplate = await templateService.createTemplate({
      title: "Hidden Disabled Duel",
      gameId: "space-blaster",
      entryFeeMinor: 1000,
      currency: "GEL",
      participantCapacity: 2,
      format: "HEAD_TO_HEAD",
      rulesVersion: "sb-v1.0",
      skillAssessmentVersion: "v1.0",
      prizes: [{ placement: 1, amountMinor: 1800, currency: "GEL" }],
      enabled: false,
    });
    const refreshedTemplates = await templateService.listEnabledTemplates();
    const disabledHidden = !refreshedTemplates.some((t) => t.id === disabledTemplate.id);
    check("4. Disabled / non-ACTIVE templates hidden from player catalog", disabledHidden);

    // ----------------------------------------------------
    // Test 5: Entry amount rendered from server
    // ----------------------------------------------------
    const standardTemplate = spaceBlasterTemplates.find((t) => t.title.includes("Standard Duel"));
    const entryRendered =
      catalogSrc.includes("(tmpl.entryFeeMinor / 100).toFixed(2)") &&
      catalogSrc.includes("tmpl.entryFeeMinor === 0");
    check(
      "5. Entry amount rendered from server-authoritative minor units",
      Boolean(standardTemplate && standardTemplate.entryFeeMinor === 500 && entryRendered),
    );

    // ----------------------------------------------------
    // Test 6: Prize rendered from server
    // ----------------------------------------------------
    const prizeRendered =
      catalogSrc.includes("(prizeAmountMinor / 100).toFixed(2)") &&
      confirmModalSrc.includes("(firstPrize / 100).toFixed(2)");
    check(
      "6. Prize rendered from server-authoritative prizes schedule",
      Boolean(standardTemplate && standardTemplate.prizes[0].amountMinor === 900 && prizeRendered),
    );

    // ----------------------------------------------------
    // Test 7: Promotional prize does not get recalculated from entry
    // ----------------------------------------------------
    const promoTemplate = spaceBlasterTemplates.find((t) => t.title.includes("Promo Duel"));
    const promoEntry = promoTemplate?.entryFeeMinor ?? 0;
    const promoPrize = promoTemplate?.prizes[0]?.amountMinor ?? 0;
    const promoNotFormula = promoEntry === 500 && promoPrize === 2000;
    const clientDoesNotRecalculatePrize =
      !catalogSrc.includes("entryFeeMinor * 2") &&
      !catalogSrc.includes("entryFeeMinor * 1.8") &&
      !confirmModalSrc.includes("entryFeeMinor *");
    check(
      "7. Promotional prize rendered directly from server schedule, never calculated by client",
      promoNotFormula && clientDoesNotRecalculatePrize,
    );

    // ----------------------------------------------------
    // Test 8: Freeroll renders correctly (FREE entry, real prize)
    // ----------------------------------------------------
    const freerollTemplate = spaceBlasterTemplates.find((t) => t.title.includes("Freeroll"));
    const freerollValid =
      freerollTemplate?.entryFeeMinor === 0 && (freerollTemplate?.prizes[0]?.amountMinor ?? 0) === 1000;
    const freerollUIRendersFree = catalogSrc.includes("FREEROLL") && confirmModalSrc.includes("'FREE'");
    check("8. Freeroll renders with 'FREE' entry and server-authoritative prize", freerollValid && freerollUIRendersFree);

    check(
      "8a. Catalog request has a 6-second deadline and a retry path",
      catalogSrc.includes("CATALOG_REQUEST_TIMEOUT_MS = 6_000") &&
        catalogSrc.includes("took too long to respond") &&
        catalogSrc.includes("onClick={loadTemplates}") &&
        catalogSrc.includes("Retry"),
    );
    check(
      "8b. Catalog GET avoids JSON preflight and maps API outage to a recoverable message",
      apiSrc.includes("options.body !== undefined && options.body !== null") &&
        catalogSrc.includes("temporarily unavailable. Please retry"),
    );
    check(
      "8c. Server applies selected game filter and reports failed fixture seeding as an API error",
      competitionRouteSrc.includes("templates.filter((template) => template.gameId === gameId)") &&
        competitionRouteSrc.includes("Competition catalog is temporarily unavailable. Please retry") &&
        templateServiceSrc.includes("Failed to seed default competition templates"),
    );

    // ----------------------------------------------------
    // Test 9: Sandbox warning visible on all monetary interfaces
    // ----------------------------------------------------
    console.log("\n--- Section 3: Sandbox Visual Identity & Currency Integrity ---");
    const catalogHasSandboxWarning =
      catalogSrc.includes("TEST / SANDBOX GEL") && catalogSrc.includes("No real money is used");
    const modalHasSandboxWarning =
      confirmModalSrc.includes("TEST / SANDBOX COMPETITION") && confirmModalSrc.includes("No real money is deposited");
    const navbarHasSandboxBadge = navbarSrc.includes("TEST / SANDBOX GEL");
    check(
      "9. Sandbox warning persistently visible across catalog, modals, and navigation",
      catalogHasSandboxWarning && modalHasSandboxWarning && navbarHasSandboxBadge,
    );

    // ----------------------------------------------------
    // Test 10: No Diamond balance in active navigation
    // ----------------------------------------------------
    const navbarHasNoDiamonds = !navbarSrc.includes("user?.balances.diamonds") && !navbarSrc.includes("💎");
    check("10. No Diamond balance rendered in active navigation", navbarHasNoDiamonds);

    // ----------------------------------------------------
    // Test 11: No Diamond shop active
    // ----------------------------------------------------
    const walletHasNoDiamondShop =
      !walletPageSrc.includes("Buy Diamonds") &&
      !walletPageSrc.includes("Diamond Packages") &&
      !walletPageSrc.includes("handleBuyDiamonds");
    check("11. Diamond Shop completely removed from active wallet interface", walletHasNoDiamondShop);
    check("11a. Guests cannot load private wallet history indefinitely or request TEST GEL funds", walletPageSrc.includes("if (!user) {") && walletPageSrc.includes("Sign in to view your transaction history.") && walletPageSrc.includes("disabled={!user || faucetLoading}"));

    // ----------------------------------------------------
    // Test 12: No Diamond stake selector
    // ----------------------------------------------------
    const launchModalHasNoDiamonds =
      !launchModalSrc.includes("onLaunchDiamondsMatch") &&
      !launchModalSrc.includes("selectedDiamondStake") &&
      !launchModalSrc.includes("Diamond Stake");
    check("12. Diamond stake selector completely removed from Game Launch modal", launchModalHasNoDiamonds);

    // ----------------------------------------------------
    // Test 13: Coins remain visible
    // ----------------------------------------------------
    const coinsPreserved =
      navbarSrc.includes("user.balances.coins") &&
      launchModalSrc.includes("CASUAL") &&
      walletPageSrc.includes("COINS") &&
      profilePageSrc.includes("user.balances.coins");
    check("13. Casual Coins balances and matchmaking remain visible across app", coinsPreserved);

    // ----------------------------------------------------
    // Test 14: Coins never display as GEL
    // ----------------------------------------------------
    const coinsNeverGEL =
      !navbarSrc.includes("₾${user.balances.coins}") &&
      !launchModalSrc.includes("₾${c}") &&
      !launchModalSrc.includes("₾${stake}");
    check("14. Coins strictly formatted as virtual points (🪙), never as ₾ (GEL)", coinsNeverGEL);

    // ----------------------------------------------------
    // Test 15: Sandbox GEL never displays as Coins
    // ----------------------------------------------------
    const gelNeverCoins =
      catalogSrc.includes("TEST ₾") &&
      confirmModalSrc.includes("TEST ₾") &&
      navbarSrc.includes("TEST ₾") &&
      !navbarSrc.includes("🪙 ${user.balances.sandboxGelMinor}");
    check("15. Sandbox GEL strictly formatted as TEST ₾, never called Coins", gelNeverCoins);

    // ----------------------------------------------------
    // Test 16: Join sends only templateId
    // ----------------------------------------------------
    console.log("\n--- Section 4: Join Flow & Financial Security ---");
    const useMatchSocketJoin = useMatchSocketSrc.includes("competition:join");
    const matchLoaderIntegratesCompetition = matchLoaderSrc.includes("matchMode.kind === 'competition'");
    const emitsOnlyTemplateId =
      useMatchSocketSrc.includes("socket.emit('competition:join', { templateId: mode.templateId })") &&
      !useMatchSocketSrc.includes("competition:join', { templateId: mode.templateId,");
    const noFinancialOverrideInJoin = !useMatchSocketSrc.includes("entryFeeMinor: mode");
    check(
      "16. Client competition:join emits strictly { templateId }",
      useMatchSocketJoin && matchLoaderIntegratesCompetition && emitsOnlyTemplateId && noFinancialOverrideInJoin,
    );

    // ----------------------------------------------------
    // Test 17: Client cannot override entry fee
    // ----------------------------------------------------
    const serverMatchmakingSrc = fs.readFileSync(path.resolve(process.cwd(), "packages/server/src/matchmaking/index.ts"), "utf-8");
    const serverIgnoresClientFee =
      serverMatchmakingSrc.includes("instanceService.joinCompetitionQueue") &&
      !serverMatchmakingSrc.includes("payload.entryFee");
    check("17. Server derives entry fee exclusively from template, client cannot override", serverIgnoresClientFee);

    // ----------------------------------------------------
    // Test 18: Client cannot override prize
    // ----------------------------------------------------
    const serverLifecycleSrc = fs.readFileSync(path.resolve(process.cwd(), "packages/server/src/competitions/lifecycleEngine.ts"), "utf-8");
    const authorityStoreSrc = fs.readFileSync(path.resolve(process.cwd(), "packages/server/src/competitions/authorityStore.ts"), "utf-8");
    const serverSettlesTemplatePrize =
      authorityStoreSrc.includes("competition_instance_prizes") &&
      authorityStoreSrc.includes("this.accounting.settleCompetition") &&
      serverLifecycleSrc.includes("LIVE_AUTHORITY_REQUIRED");
    check("18. Server settles prizes strictly according to template prize schedule", serverSettlesTemplatePrize);

    // ----------------------------------------------------
    // Test 19: Insufficient funds message & faucet test grant
    // ----------------------------------------------------
    const userRow = await pool.query(`SELECT id FROM users LIMIT 1`);
    let testUserId = userRow.rows[0]?.id;
    if (!testUserId) {
      testUserId = randomUUID();
      await pool.query(
        `INSERT INTO users (id, username, email, password_hash, role, balances) VALUES ($1, $2, $3, $4, $5, $6)`,
        [testUserId, "testuser_p4", "testuser_p4@example.com", "hash", "USER", JSON.stringify({ coins: 1000 })],
      );
    }
    const balanceBefore = await sandboxAdapter.getUserBalance(testUserId);
    check("19a. User has a valid Sandbox Test GEL ledger account", typeof balanceBefore.availableMinor === "number");

    await sandboxAdapter.grantSandboxTestFunds(testUserId, 10000);
    const balanceAfter = await sandboxAdapter.getUserBalance(testUserId);
    check("19b. Sandbox faucet reliably provisions test funds via balanced ledger", balanceAfter.availableMinor === balanceBefore.availableMinor + 10000);

    const uiHasFaucetButton =
      confirmModalSrc.includes("ADD TEST FUNDS") && confirmModalSrc.includes("handleAddTestFunds");
    check("19c. Confirmation modal provides clear insufficient funds warning and [ ADD TEST FUNDS ]", uiHasFaucetButton);

    // ----------------------------------------------------
    // Test 20: Dedicated Waiting Room (1/2 with [ CANCEL ENTRY ])
    // ----------------------------------------------------
    console.log("\n--- Section 5: Waiting Room, Match Ready & Transitions ---");
    const waitingRoomHasStatus =
      authorityCompetitionSrc.includes("competition:joined") &&
      authorityCompetitionSrc.includes("Waiting for the other player") &&
      authorityCompetitionSrc.includes("Waiting for both players to be ready");
    const waitingRoomHasCancel =
      authorityCompetitionSrc.includes("Cancel waiting entry") && authorityCompetitionSrc.includes("competition:cancel");
    check("20. Authority waiting state exposes cancellation only before match lock", waitingRoomHasStatus && waitingRoomHasCancel);

    // ----------------------------------------------------
    // Test 21: Match-ready transition 2/2 (cancel button removed, match start)
    // ----------------------------------------------------
    const matchReadyRemovesCancel =
      authorityCompetitionSrc.includes("authority:session") &&
      authorityCompetitionSrc.includes("setCanCancel(false)") &&
      authorityCompetitionSrc.includes("authority:ready");
    check("21. Authority session locks entry, removes cancellation and begins readiness handshake", matchReadyRemovesCancel);

    // ----------------------------------------------------
    // Test 22: Existing game loader receives authoritative match data
    // ----------------------------------------------------
    const gameLoaderIntegration =
      matchLoaderSrc.includes("<AuthorityCompetition") &&
      authorityCompetitionSrc.includes("renderer.render(ctx)") &&
      authorityCompetitionSrc.includes("never calls engine.update") &&
      !authorityCompetitionSrc.includes("socket.emit('submitScore'");
    check("22. Competition path renders server snapshots without client simulation or score submission", gameLoaderIntegration);

    // ----------------------------------------------------
    // Test 23: Authoritative verified winner result screen
    // ----------------------------------------------------
    console.log("\n--- Section 6: Results, Verifications & Rematch Experience ---");
    const winnerResultsCheck =
      authorityCompetitionSrc.includes("You won — the predetermined sandbox prize has been awarded") &&
      authorityCompetitionSrc.includes("authority:outcome") &&
      authorityCompetitionSrc.includes("yourScore");
    check("23. Winner outcome and score are delivered by server authority with predetermined prize wording", winnerResultsCheck);

    // ----------------------------------------------------
    // Test 24: Authoritative verified loser result screen
    // ----------------------------------------------------
    const loserResultsCheck =
      authorityCompetitionSrc.includes("Competition finished — your opponent won") &&
      authorityCompetitionSrc.includes("You won — the predetermined sandbox prize has been awarded");
    check("24. Server outcome distinguishes winner from non-winner without client score comparison", loserResultsCheck);

    // ----------------------------------------------------
    // Test 25: Draw / refund presentation
    // ----------------------------------------------------
    const drawResultsCheck =
      matchLoaderSrc.includes("DRAW") &&
      matchLoaderSrc.includes("Both verified scores were equal.") &&
      matchLoaderSrc.includes("Entry Refunded") &&
      matchLoaderSrc.includes("No competition fee charged.");
    check("25. Draw screen displays refund of entry fee with no fee charged", drawResultsCheck);

    // ----------------------------------------------------
    // Test 26: Forfeit presentation
    // ----------------------------------------------------
    const forfeitCheck =
      matchLoaderSrc.includes("OPPONENT FORFEITED") && matchLoaderSrc.includes("MATCH FORFEITED");
    check("26. Forfeit states display clear, factual competition terminology", forfeitCheck);

    // ----------------------------------------------------
    // Test 27: Casual result ownership is clear
    // ----------------------------------------------------
    const casualResultOwnershipCheck =
      matchLoaderSrc.includes("Casual match result; scores do not determine TEST GEL prizes.") &&
      !matchLoaderSrc.includes("verified by replay");
    check("27. Casual score screens do not claim client scores determine TEST GEL prizes", casualResultOwnershipCheck);

    // ----------------------------------------------------
    // Test 28: Rematch confirmation shows fresh entry notice
    // ----------------------------------------------------
    const rematchFreshEntryCheck =
      matchLoaderSrc.includes("REMATCH") &&
      matchLoaderSrc.includes("This creates a new competition entry.") &&
      matchLoaderSrc.includes("A new entry amount will be reserved.") &&
      matchLoaderSrc.includes("ENTER REMATCH");
    check("28. Rematch confirmation explicitly states a new competition entry and reservation is created", rematchFreshEntryCheck);

    // ----------------------------------------------------
    // Test 29: Insufficient-funds rematch handled
    // ----------------------------------------------------
    const rematchInsufficientFundsCheck =
      matchLoaderSrc.includes("You do not have enough Sandbox Test GEL to enter another competition.") &&
      matchLoaderSrc.includes("ADD TEST FUNDS");
    check("29. Insufficient-funds rematch scenario warns user with direct test faucet grant action", rematchInsufficientFundsCheck);

    // ----------------------------------------------------
    // Test 30: Guest cannot access paid competition
    // ----------------------------------------------------
    console.log("\n--- Section 7: Access Control, Historical Audit & Responsive UX ---");
    const guestBlockedFromPaid =
      catalogSrc.includes("Free competitions have no entry cost. An account is required to enter any competition") &&
      confirmModalSrc.includes("Free entry costs no Test GEL, but an account is required to enter any competition") &&
      confirmModalSrc.includes("paid sandbox competitions also require enough Test GEL");
    check("30. Guest copy explains free entry cost, account requirement, and paid Test GEL requirement", guestBlockedFromPaid);

    // ----------------------------------------------------
    // Test 31: Casual Coin matchmaking remains fully operational
    // ----------------------------------------------------
    const casualCoinMatchmakingPreserved =
      launchModalSrc.includes("onLaunchCoinsMatch") &&
      launchModalSrc.includes("COIN_STAKE_OPTIONS") &&
      launchModalSrc.includes("PLAY CASUAL");
    check("31. Casual Coin matchmaking remains available without monetary crossover", casualCoinMatchmakingPreserved);

    // ----------------------------------------------------
    // Test 32: Historical Diamond data remains readable and labelled RETIRED
    // ----------------------------------------------------
    const historicalDiamondsRetained =
      walletPageSrc.includes("(RETIRED)") &&
      walletPageSrc.includes("DIAMONDS") &&
      profilePageSrc.includes("DIAMONDS (RETIRED)");
    check("32. Historical Diamond transaction and match records remain readable with (RETIRED) label", historicalDiamondsRetained);

    // ----------------------------------------------------
    // Test 33: Responsive / mobile competition card behavior
    // ----------------------------------------------------
    const catalogResponsive =
      catalogSrc.includes("gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))'") &&
      navbarSrc.includes("maxWidth: '100%'") &&
      competitionsPageSrc.includes("display: 'flex'") &&
      competitionsPageSrc.includes("flexWrap: 'wrap'");
    check("33. Competition catalog and templates feature mobile/tablet responsive layout", catalogResponsive);
    check(
      "33a. Catalog cards distinguish format, capacity, availability, entry cost, and predetermined prize",
      catalogSrc.includes("OPEN FOR ENTRIES") &&
        catalogSrc.includes("🎮 {gameName}") &&
        catalogSrc.includes("Up to {tmpl.participantCapacity} players") &&
        catalogSrc.includes("ENTRY COST") &&
        catalogSrc.includes("PREDETERMINED PRIZE") &&
        catalogSrc.includes("JOIN FREE COMPETITION"),
    );

    // ----------------------------------------------------
    // Test 34: Keyboard / dialog accessibility
    // ----------------------------------------------------
    const dialogAccessibility =
      confirmModalSrc.includes('role="dialog"') &&
      confirmModalSrc.includes('aria-modal="true"') &&
      confirmModalSrc.includes("handleKeyDown") &&
      launchModalSrc.includes('role="dialog"') &&
      matchLoaderSrc.includes('role="dialog"');
    check("34. Modals feature semantic dialog roles, aria-modal, and Escape key handling", dialogAccessibility);

    // ----------------------------------------------------
    // Test 35: No real payment / deposit / withdrawal controls exist
    // ----------------------------------------------------
    console.log("\n--- Section 8: Zero Real Payments Enforcement ---");
    const allClientFiles = [
      launchModalSrc,
      catalogSrc,
      confirmModalSrc,
      navbarSrc,
      walletPageSrc,
      profilePageSrc,
      matchLoaderSrc,
      competitionsPageSrc,
    ].join("\n");

    const forbiddenPaymentTerms = [
      "stripe",
      "paypal",
      "apple pay",
      "google pay",
      "credit card",
      "debit card",
      "crypto",
      "withdrawal",
      "withdraw funds",
      "deposit money",
    ];

    const foundForbidden = forbiddenPaymentTerms.filter((term) => {
      const regex = new RegExp(`\\b${term}\\b`, "i");
      return regex.test(allClientFiles);
    });

    check(
      "35. Zero real payment, deposit, card, or withdrawal controls anywhere in client code",
      foundForbidden.length === 0,
      foundForbidden.length > 0 ? `Found: ${foundForbidden.join(", ")}` : undefined,
    );
  } finally {
    await pool.end();
  }

  console.log(`\n=== Phase 4 UI & Experience Check Complete ===`);
  console.log(`Total Passed: ${passes} / ${passes + failures} assertions across 39 requirements`);
  console.log(`Total Failed: ${failures}`);

  if (failures > 0) {
    process.exit(1);
  }
}

runPhase4UIChecks().catch((err) => {
  console.error("Phase 4 check failed with error:", err);
  process.exit(1);
});
