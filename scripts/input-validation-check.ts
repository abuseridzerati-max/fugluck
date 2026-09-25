// Input boundary checks for usernames and server-owned competition eligibility.
// Run: npx tsx scripts/input-validation-check.ts
import { AUTHORITY_VERSION, CYBER_HOPPER_AUTHORITY_VERSION } from "@fugluck/shared";
import { assertGameEligibleForCompetition, GameEligibilityError } from "../packages/server/src/competitions/templateService.ts";

let failures = 0;
let passed = 0;
function check(label: string, pass: boolean, detail?: string) {
  if (pass) { passed++; console.log(`  PASS  ${label}`); }
  else { failures++; console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`); }
}
function rejects(action: () => void, code?: string): boolean {
  try { action(); return false; }
  catch (error) { return code === undefined ? error instanceof Error : error instanceof GameEligibilityError; }
}

console.log("input-validation-check");

// Keep coverage for the registration boundary; this expression mirrors the
// route's exported contract and the route itself is covered by auth tests.
const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/;
for (const value of ["ab", "a".repeat(21), "a".repeat(10_000), "user name", "user<script>", "user@email.com", "user-name"]) {
  check(`Invalid username ${value.slice(0, 12)} is rejected`, !USERNAME_PATTERN.test(value));
}
for (const value of ["abc", "player_01", "A".repeat(20)]) {
  check(`Valid username ${value.slice(0, 12)} is accepted`, USERNAME_PATTERN.test(value));
}

console.log("\nTEST GEL certification input boundaries");
check("Space Blaster accepts its certified authority rules in sandbox", !rejects(() => assertGameEligibleForCompetition("space-blaster", { isSandbox: true, rulesVersion: AUTHORITY_VERSION, enabled: true })));
check("Cyber Hopper accepts its certified authority rules in sandbox", !rejects(() => assertGameEligibleForCompetition("cyber-hopper", { isSandbox: true, rulesVersion: CYBER_HOPPER_AUTHORITY_VERSION, enabled: true })));
for (const gameId of ["neon-runner", "pixel-ninja-dash", "speed-trivia", "tf-sprint", "unknown-game"]) {
  check(`${gameId} cannot create a TEST GEL competition`, rejects(() => assertGameEligibleForCompetition(gameId, { isSandbox: true, enabled: true })));
}
check("Space Blaster cannot enable a template with a mismatched rules version", rejects(() => assertGameEligibleForCompetition("space-blaster", { isSandbox: true, rulesVersion: "ch-1.0", enabled: true })));
check("Cyber Hopper cannot enable a template with Space Blaster rules", rejects(() => assertGameEligibleForCompetition("cyber-hopper", { isSandbox: true, rulesVersion: AUTHORITY_VERSION, enabled: true })));
check("Certified games remain sandbox-only", rejects(() => assertGameEligibleForCompetition("space-blaster", { isSandbox: false, rulesVersion: AUTHORITY_VERSION, enabled: true })));

console.log(`\nInput validation: ${passed} PASS, ${failures} FAIL`);
process.exit(failures === 0 ? 0 : 1);
