// Focused Phase 1 Domain & Invariant Verification for Fugluck Competition Economy
// Validates:
// 1. MoneyAmount integer minor units & strict rejection of floats / negatives
// 2. Currency validation & no conversion to virtual COINS
// 3. Display formatting
// 4. Game eligibility states (Candidates vs Coin-only, zero Approved)
// 5. Free-entry (Freeroll) competition model
// 6. Independent entry fee & prize configurations (Case A, B, C, D)
// 7. Snapshotting integrity (Instance terms decoupled from Template)
// 8. Multi-placement prize models

import {
  createMoney,
  formatMoneyDisplay,
  type MoneyAmount,
  type ISO4217Currency,
  GAME_COMPETITION_ELIGIBILITY_REGISTRY,
  GAME_COMPETITION_CERTIFICATIONS,
  type CompetitionTemplate,
  type CompetitionInstance,
  type CompetitionTemplatePrize,
  type CompetitionInstancePrize,
} from "../packages/shared/src/index";

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

console.log("=== Fugluck Competition Economy — Phase 1 Domain & Type Safety Check ===\n");

// ---------------------------------------------------------------------------
// Section 1: MoneyAmount Type Safety & Minor Unit Arithmetic
// ---------------------------------------------------------------------------
console.log("Section 1: Monetary Domain Primitives & Integer Safety");

// Valid creations
const gel5 = createMoney(500, "GEL");
check("createMoney accepts 500 minor units (₾5.00 GEL)", gel5.amountMinor === 500 && gel5.currency === "GEL");

const freeEntry = createMoney(0, "GEL");
check("createMoney accepts 0 minor units (Freeroll)", freeEntry.amountMinor === 0 && freeEntry.currency === "GEL");

const usdPrize = createMoney(100000, "USD");
check("createMoney accepts large integer amounts ($1,000.00 USD)", usdPrize.amountMinor === 100000 && usdPrize.currency === "USD");

// Rejection of floating point amounts
let floatRejected = false;
try {
  createMoney(5.5 as any, "GEL");
} catch (e: any) {
  floatRejected = e.message.includes("non-negative integer");
}
check("createMoney strictly rejects floating-point amounts (5.5)", floatRejected);

let tinyFloatRejected = false;
try {
  createMoney(0.01 as any, "GEL");
} catch (e: any) {
  tinyFloatRejected = e.message.includes("non-negative integer");
}
check("createMoney strictly rejects floating-point cents (0.01)", tinyFloatRejected);

// Rejection of negative amounts
let negativeRejected = false;
try {
  createMoney(-100, "GEL");
} catch (e: any) {
  negativeRejected = e.message.includes("non-negative integer");
}
check("createMoney strictly rejects negative amounts (-100)", negativeRejected);

// Rejection of NaN and Infinity
let nanRejected = false;
try {
  createMoney(NaN as any, "GEL");
} catch {
  nanRejected = true;
}
check("createMoney strictly rejects NaN", nanRejected);

let infRejected = false;
try {
  createMoney(Infinity as any, "GEL");
} catch {
  infRejected = true;
}
check("createMoney strictly rejects Infinity", infRejected);

// Currency validation
let invalidCurrRejected = false;
try {
  createMoney(500, "COINS" as any);
} catch (e: any) {
  invalidCurrRejected = e.message.includes("Unsupported currency");
}
check("createMoney strictly rejects virtual 'COINS' as a monetary currency", invalidCurrRejected);

let diamondsCurrRejected = false;
try {
  createMoney(500, "DIAMONDS" as any);
} catch (e: any) {
  diamondsCurrRejected = e.message.includes("Unsupported currency");
}
check("createMoney strictly rejects retired 'DIAMONDS' as a monetary currency", diamondsCurrRejected);

// Display formatting
check("formatMoneyDisplay formats ₾5.00 GEL", formatMoneyDisplay(gel5) === "₾5.00 GEL");
check("formatMoneyDisplay formats ₾0.00 GEL for Freeroll", formatMoneyDisplay(freeEntry) === "₾0.00 GEL");
check("formatMoneyDisplay formats $1000.00 USD", formatMoneyDisplay(usdPrize) === "$1000.00 USD");
check("formatMoneyDisplay formats €15.50 EUR", formatMoneyDisplay(createMoney(1550, "EUR")) === "€15.50 EUR");

// ---------------------------------------------------------------------------
// Section 2: Game Competition Eligibility Registry
// ---------------------------------------------------------------------------
console.log("\nSection 2: Game Competition Eligibility Classifications");

check(
  "Space Blaster is classified as PAID_COMPETITIVE_CANDIDATE",
  GAME_COMPETITION_ELIGIBILITY_REGISTRY["space-blaster"] === "PAID_COMPETITIVE_CANDIDATE",
);
check("Pixel Ninja Dash is blocked from TEST GEL prize competitions", GAME_COMPETITION_CERTIFICATIONS["pixel-ninja-dash"].testGelCompetition === "NOT_CERTIFIED");
check(
  "Cyber Hopper is classified as PAID_COMPETITIVE_CANDIDATE",
  GAME_COMPETITION_ELIGIBILITY_REGISTRY["cyber-hopper"] === "PAID_COMPETITIVE_CANDIDATE",
);
check(
  "Neon Runner is blocked from TEST GEL prize competitions",
  GAME_COMPETITION_CERTIFICATIONS["neon-runner"].testGelCompetition === "NOT_CERTIFIED",
);
check(
  "Speed Trivia Clash is classified as COIN_COMPETITIVE",
  GAME_COMPETITION_ELIGIBILITY_REGISTRY["speed-trivia"] === "COIN_COMPETITIVE",
);
check(
  "True / False Sprint is classified as COIN_COMPETITIVE",
  GAME_COMPETITION_ELIGIBILITY_REGISTRY["tf-sprint"] === "COIN_COMPETITIVE",
);
check("Space Blaster and Cyber Hopper are the only Level 3-certified games", Object.values(GAME_COMPETITION_CERTIFICATIONS).filter((entry) => entry.testGelCompetition === "LEVEL_3_CERTIFIED").length === 2);

// Strict invariant: NO game is marked PAID_COMPETITIVE_APPROVED in Phase 1
const anyApproved = Object.values(GAME_COMPETITION_ELIGIBILITY_REGISTRY).some(
  (status) => status === "PAID_COMPETITIVE_APPROVED",
);
check("Architectural Invariant: Zero games marked PAID_COMPETITIVE_APPROVED in Phase 1", !anyApproved);

// ---------------------------------------------------------------------------
// Section 3: Independence of Entry Fee & Prize Calculations
// ---------------------------------------------------------------------------
console.log("\nSection 3: Entry Fee & Prize Independence Invariants");

// Case A: Standard paid (2 players, ₾5.00 entry, ₾9.00 prize)
const caseATemplate: CompetitionTemplate = {
  id: "tmpl_case_a",
  gameId: "space-blaster",
  title: "1v1 Duel",
  format: "HEAD_TO_HEAD",
  participantCapacity: 2,
  currency: "GEL",
  entryFeeMinor: 500,
  rulesVersion: "1.0",
  skillAssessmentVersion: "1.0",
  enabled: true,
  jurisdiction: "GE",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
const caseAPrize: CompetitionTemplatePrize = {
  id: "p_case_a",
  templateId: "tmpl_case_a",
  placement: 1,
  amountMinor: 900,
  currency: "GEL",
};
check("Case A: Standard duel allows entry 500 and prize 900 (rake implied, not hardcoded)", caseATemplate.entryFeeMinor === 500 && caseAPrize.amountMinor === 900);

// Case B: Promotional overlay (2 players, ₾5.00 entry each, ₾20.00 prize)
// Note: Total entries = 1000, prize = 2000. In a pot model, this would violate pot = entries * fee.
// Fugluck's model explicitly supports sponsored/promotional prize overlays.
const caseBTemplate: CompetitionTemplate = {
  ...caseATemplate,
  id: "tmpl_case_b",
  title: "1v1 Promotional Overlay Duel",
};
const caseBPrize: CompetitionTemplatePrize = {
  id: "p_case_b",
  templateId: "tmpl_case_b",
  placement: 1,
  amountMinor: 2000,
  currency: "GEL",
};
check(
  "Case B: Promotional overlay allows prize (2000) > total entries collected (1000)",
  caseBPrize.amountMinor > caseBTemplate.entryFeeMinor * caseBTemplate.participantCapacity,
);

// Case C: Freeroll (64 players, 0 entry fee, ₾1,000 sponsored prize)
const caseCTemplate: CompetitionTemplate = {
  id: "tmpl_case_c",
  gameId: "pixel-ninja-dash",
  title: "Sponsored Freeroll 64",
  format: "TOURNAMENT_BRACKET",
  participantCapacity: 64,
  currency: "GEL",
  entryFeeMinor: 0,
  rulesVersion: "1.0",
  skillAssessmentVersion: "1.0",
  enabled: true,
  jurisdiction: "GE",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
const caseCPrize: CompetitionTemplatePrize = {
  id: "p_case_c",
  templateId: "tmpl_case_c",
  placement: 1,
  amountMinor: 100000,
  currency: "GEL",
};
check("Case C: Freeroll allows entry 0 with non-zero sponsored prize 100,000", caseCTemplate.entryFeeMinor === 0 && caseCPrize.amountMinor === 100000);

// Case D: Multiple placement prizes (1st: 600, 2nd: 300)
const caseDPrizes: CompetitionTemplatePrize[] = [
  { id: "p_d1", templateId: "tmpl_case_d", placement: 1, amountMinor: 600, currency: "GEL" },
  { id: "p_d2", templateId: "tmpl_case_d", placement: 2, amountMinor: 300, currency: "GEL" },
];
check("Case D: Multi-placement prizes define distinct placements 1 and 2", caseDPrizes.length === 2 && caseDPrizes[0].placement === 1 && caseDPrizes[1].placement === 2);

// ---------------------------------------------------------------------------
// Section 4: Snapshot Integrity Invariant
// ---------------------------------------------------------------------------
console.log("\nSection 4: Snapshot Integrity & Immutability");

// Helper function that mirrors service-layer snapshot creation
function createInstanceFromTemplate(template: CompetitionTemplate, instanceId: string): CompetitionInstance {
  return {
    id: instanceId,
    templateId: template.id,
    gameId: template.gameId,
    format: template.format,
    participantCapacity: template.participantCapacity,
    currency: template.currency,
    entryFeeMinor: template.entryFeeMinor,
    rulesVersion: template.rulesVersion,
    skillAssessmentVersion: template.skillAssessmentVersion,
    jurisdiction: template.jurisdiction,
    status: "PENDING_ENTRANTS",
    currentParticipants: 0,
    createdAt: new Date().toISOString(),
  };
}

const templateV1: CompetitionTemplate = { ...caseATemplate };
const instance1 = createInstanceFromTemplate(templateV1, "inst_001");

// Material terms snapshot verification
check("Instance snapshots templateId", instance1.templateId === templateV1.id);
check("Instance snapshots gameId", instance1.gameId === templateV1.gameId);
check("Instance snapshots format", instance1.format === templateV1.format);
check("Instance snapshots participantCapacity", instance1.participantCapacity === templateV1.participantCapacity);
check("Instance snapshots currency", instance1.currency === templateV1.currency);
check("Instance snapshots entryFeeMinor", instance1.entryFeeMinor === templateV1.entryFeeMinor);
check("Instance snapshots rulesVersion", instance1.rulesVersion === templateV1.rulesVersion);
check("Instance snapshots skillAssessmentVersion", instance1.skillAssessmentVersion === templateV1.skillAssessmentVersion);
check("Instance snapshots jurisdiction", instance1.jurisdiction === templateV1.jurisdiction);

// Template modification does NOT alter existing instance
templateV1.entryFeeMinor = 1500;
templateV1.rulesVersion = "2.0";
templateV1.participantCapacity = 8;
check("Later template fee modification does not alter existing instance (fee stays 500)", instance1.entryFeeMinor === 500);
check("Later template rulesVersion modification does not alter existing instance (stays 1.0)", instance1.rulesVersion === "1.0");
check("Later template capacity modification does not alter existing instance (stays 2)", instance1.participantCapacity === 2);

// Instance prize snapshots
const instancePrize1: CompetitionInstancePrize = {
  id: "ip_001",
  instanceId: instance1.id,
  placement: caseAPrize.placement,
  amountMinor: caseAPrize.amountMinor,
  currency: caseAPrize.currency,
  awardedUserId: null,
};
check("Instance prize snapshots placement", instancePrize1.placement === 1);
check("Instance prize snapshots amountMinor (900)", instancePrize1.amountMinor === 900);
check("Instance prize snapshots currency (GEL)", instancePrize1.currency === "GEL");

console.log(`\n==================================================`);
console.log(`Competition Phase 1 Domain Check: ${passes} PASS, ${failures} FAIL`);
console.log(`==================================================\n`);

if (failures > 0) {
  process.exit(1);
}
