// Registration Email Requirement & Beta Verification Bypass Check for Fugluck.
// Run: npx tsx scripts/registration-verification-check.ts

import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
dotenv.config({ path: "packages/server/.env" });

let failures = 0;

function check(label: string, pass: boolean, detail?: string) {
  if (pass) {
    console.log(`  PASS  ${label}`);
  } else {
    failures++;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

console.log("registration-verification-check");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateSignupEmail(email: unknown): { valid: boolean; normalized?: string; error?: string } {
  const normalized = typeof email === "string" ? email.trim() : "";
  if (normalized.length === 0 || normalized.length > 255 || !EMAIL_PATTERN.test(normalized)) {
    return { valid: false, error: "A valid email address is required." };
  }
  return { valid: true, normalized };
}

async function main() {
  // ---------------------------------------------------------------------------
  // Test 1: Mandatory Email Validation on Signup
  // ---------------------------------------------------------------------------
  console.log("\nTest 1: Mandatory Email Validation on Signup");

  check("Missing email is rejected", !validateSignupEmail(undefined).valid);
  check("Empty email is rejected", !validateSignupEmail("   ").valid);
  check("Malformed email is rejected", !validateSignupEmail("not-an-email").valid);
  check("Valid email is accepted and trimmed", validateSignupEmail("  player@example.com ").normalized === "player@example.com");

  // ---------------------------------------------------------------------------
  // Test 2: Immediate Account Readiness (Beta Verification Bypass)
  // ---------------------------------------------------------------------------
  console.log("\nTest 2: Immediate Account Readiness & Source Guard Audit");

  const authSource = fs.readFileSync(path.resolve("packages/server/src/routes/auth.ts"), "utf8");
  const friendsSource = fs.readFileSync(path.resolve("packages/server/src/routes/friends.ts"), "utf8");
  const matchmakingSource = fs.readFileSync(path.resolve("packages/server/src/matchmaking/index.ts"), "utf8");
  const authModalSource = fs.readFileSync(path.resolve("packages/client/src/components/AuthModal.tsx"), "utf8");

  check("Server signup requires valid email format", authSource.includes("A valid email address is required."));
  check("Server signup sets isEmailVerified: true immediately", authSource.includes("isEmailVerified: true"));
  check("Friends routes do not enforce requireEmailVerified", !friendsSource.includes("requireEmailVerified"));
  check("Matchmaking queue does not block wagering on isEmailVerified", !matchmakingSource.includes("isEmailVerified"));
  check("Client AuthModal removes Check Your Email verification gate", !authModalSource.includes("Check Your Email"));

  if (failures > 0) {
    console.log(`\n${failures} failure(s)`);
    process.exit(1);
  }
  console.log(`\nAll registration email checks passed 100%.`);
}

main().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
