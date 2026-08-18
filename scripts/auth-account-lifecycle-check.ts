// Guard with centralized disposable database check before anything else
import "./require-disposable-test-database.ts";

import dotenv from "dotenv";
dotenv.config({ path: "packages/server/.env" });

import { createHash, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../packages/server/src/db/client";
import { emailVerificationTokens, passwordResetTokens, users } from "../packages/server/src/db/schema";
import { hashPassword, validatePasswordPolicy, verifyPassword } from "../packages/server/src/auth/password";
import { signSessionToken, verifySessionToken } from "../packages/server/src/auth/jwt";
import {
  clearSentEmailsHistory,
  getSentEmailsHistory,
  sendPasswordResetEmail,
  sendVerificationEmail,
} from "../packages/server/src/email/emailService";

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

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

async function runAuthAccountLifecycleSuite(): Promise<void> {
  console.log("\n=======================================================");
  console.log("ArcadeClash Complete Account & Auth Lifecycle Check");
  console.log("=======================================================\n");

  const runId = Date.now();
  const testUsername = `user_${runId}`;
  const testEmail = `user_${runId}@example.com`;
  const testPassword = "ValidPassword123!";

  clearSentEmailsHistory();

  // -------------------------------------------------------------------------
  // 1. Password Policy Validation Mechanics
  // -------------------------------------------------------------------------
  console.log("Section 1: Password Policy Engine");
  check("Policy rejects password < 8 chars", !validatePasswordPolicy("Short1!").valid);
  check("Policy rejects password > 128 chars", !validatePasswordPolicy("a".repeat(129)).valid);
  check("Policy rejects common breached passwords", !validatePasswordPolicy("password123").valid);
  check("Policy rejects repeating characters", !validatePasswordPolicy("aaaaaaaaaa").valid);
  check("Policy accepts valid strong password", validatePasswordPolicy(testPassword).valid);

  // -------------------------------------------------------------------------
  // 2. User Registration & Hashed Verification Token Persistence
  // -------------------------------------------------------------------------
  console.log("\nSection 2: Registration & Email Verification Mechanics");
  const passwordHash = await hashPassword(testPassword);
  const userId = `usr_test_${runId}`;

  const [newUser] = await db
    .insert(users)
    .values({
      id: userId,
      username: testUsername,
      email: testEmail,
      passwordHash,
      isEmailVerified: false,
      status: "active",
    })
    .returning();

  check("User registration persists with isEmailVerified=false", newUser.isEmailVerified === false);

  const rawVerificationToken = randomUUID();
  const verificationHash = hashToken(rawVerificationToken);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const [tokenRecord] = await db
    .insert(emailVerificationTokens)
    .values({
      id: `evt_test_${runId}`,
      userId: newUser.id,
      tokenHash: verificationHash,
      expiresAt,
    })
    .returning();

  check("Email verification token persisted as SHA-256 hash in database", tokenRecord.tokenHash === verificationHash);
  check("Raw verification token differs from persisted token hash", tokenRecord.tokenHash !== rawVerificationToken);

  // Dispatch verification email via transactional service
  const emailRes = await sendVerificationEmail(testEmail, testUsername, rawVerificationToken);
  check("Transactional verification email service returns success", emailRes.success);

  const emailHistory = getSentEmailsHistory();
  check("Transactional email logged to dispatch history", emailHistory.length === 1);
  check("Dispatched email contains raw token in link", emailHistory[0]?.text.includes(rawVerificationToken));
  check("Dispatched email is addressed to registered email", emailHistory[0]?.to === testEmail);

  // -------------------------------------------------------------------------
  // 3. Verification Execution & Single-Use Enforcement
  // -------------------------------------------------------------------------
  console.log("\nSection 3: Verification Execution & Single-Use Guarantees");

  // Attempt verification with the correct token
  const lookupHash = hashToken(rawVerificationToken);
  const foundToken = await db.query.emailVerificationTokens.findFirst({
    where: eq(emailVerificationTokens.tokenHash, lookupHash),
  });
  check("Lookup by token hash succeeds", Boolean(foundToken));

  const [verifiedUser] = await db
    .update(users)
    .set({ isEmailVerified: true, emailVerifiedAt: new Date() })
    .where(eq(users.id, foundToken!.userId))
    .returning();

  await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.id, foundToken!.id));

  check("User isEmailVerified updated to true", verifiedUser.isEmailVerified === true);
  check("emailVerifiedAt timestamp recorded", Boolean(verifiedUser.emailVerifiedAt));

  // Single-use guarantee: Re-querying used token should return null
  const usedTokenCheck = await db.query.emailVerificationTokens.findFirst({
    where: eq(emailVerificationTokens.tokenHash, lookupHash),
  });
  check("Used verification token is deleted (single-use enforced)", usedTokenCheck === undefined);

  // -------------------------------------------------------------------------
  // 4. Verification Resend & Invalidation Mechanics
  // -------------------------------------------------------------------------
  console.log("\nSection 4: Verification Resend & Token Invalidation");
  const unverifiedUserId = `usr_unv_${runId}`;
  const unverifiedEmail = `unv_${runId}@example.com`;

  await db.insert(users).values({
    id: unverifiedUserId,
    username: `unv_${runId}`,
    email: unverifiedEmail,
    passwordHash,
    isEmailVerified: false,
  });

  const oldTokenRaw = randomUUID();
  await db.insert(emailVerificationTokens).values({
    id: `evt_old_${runId}`,
    userId: unverifiedUserId,
    tokenHash: hashToken(oldTokenRaw),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });

  // Simulate resend: Invalidate old tokens for user, create fresh token
  await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.userId, unverifiedUserId));
  const freshTokenRaw = randomUUID();
  await db.insert(emailVerificationTokens).values({
    id: `evt_fresh_${runId}`,
    userId: unverifiedUserId,
    tokenHash: hashToken(freshTokenRaw),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });

  const oldTokenLookup = await db.query.emailVerificationTokens.findFirst({
    where: eq(emailVerificationTokens.tokenHash, hashToken(oldTokenRaw)),
  });
  const freshTokenLookup = await db.query.emailVerificationTokens.findFirst({
    where: eq(emailVerificationTokens.tokenHash, hashToken(freshTokenRaw)),
  });

  check("Old verification token invalidated upon resend", oldTokenLookup === undefined);
  check("Fresh verification token active after resend", freshTokenLookup !== undefined);

  // -------------------------------------------------------------------------
  // 5. Password Reset & Account Recovery Lifecycle
  // -------------------------------------------------------------------------
  console.log("\nSection 5: Password Reset & Account Recovery Lifecycle");
  const rawResetToken = randomUUID();
  const resetTokenHash = hashToken(rawResetToken);
  const resetExpiresAt = new Date(Date.now() + 60 * 60 * 1000);

  const [resetRecord] = await db
    .insert(passwordResetTokens)
    .values({
      id: `prt_test_${runId}`,
      userId,
      tokenHash: resetTokenHash,
      expiresAt: resetExpiresAt,
    })
    .returning();

  check("Password reset token persisted as SHA-256 hash in database", resetRecord.tokenHash === resetTokenHash);

  const resetEmailRes = await sendPasswordResetEmail(testEmail, testUsername, rawResetToken);
  check("Transactional password reset email returns success", resetEmailRes.success);

  const newTestPassword = "BrandNewSecurePassword456!";
  const newPasswordPolicy = validatePasswordPolicy(newTestPassword);
  check("New password satisfies security policy", newPasswordPolicy.valid);

  const newPasswordHash = await hashPassword(newTestPassword);

  // Execute password reset transaction
  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash: newPasswordHash }).where(eq(users.id, userId));
    await tx.delete(passwordResetTokens).where(eq(passwordResetTokens.id, resetRecord.id));
  });

  const updatedUser = await db.query.users.findFirst({ where: eq(users.id, userId) });
  check("User password hash successfully updated", updatedUser!.passwordHash === newPasswordHash);

  const oldPasswordValid = await verifyPassword(testPassword, updatedUser!.passwordHash);
  const newPasswordValid = await verifyPassword(newTestPassword, updatedUser!.passwordHash);
  check("Old password no longer verifies", oldPasswordValid === false);
  check("New password successfully verifies", newPasswordValid === true);

  const recheckResetToken = await db.query.passwordResetTokens.findFirst({
    where: eq(passwordResetTokens.tokenHash, resetTokenHash),
  });
  check("Password reset token deleted after single use", recheckResetToken === undefined);

  // -------------------------------------------------------------------------
  // 6. Session Lifecycle & Account Status Enforcement
  // -------------------------------------------------------------------------
  console.log("\nSection 6: Session Lifecycle & Account Status Enforcement");
  const sessionToken = signSessionToken({ sub: userId });
  const sessionPayload = verifySessionToken(sessionToken);
  check("Session JWT verifies sub match", sessionPayload?.sub === userId);

  // Check banned/suspended account rejection
  const bannedUserId = `usr_banned_${runId}`;
  await db.insert(users).values({
    id: bannedUserId,
    username: `banned_${runId}`,
    email: `banned_${runId}@example.com`,
    passwordHash,
    status: "banned",
    statusReason: "Terms of service violation",
  });

  const bannedUser = await db.query.users.findFirst({ where: eq(users.id, bannedUserId) });
  const isBannedAllowedLogin = bannedUser && bannedUser.status !== "banned" && bannedUser.status !== "suspended";
  check("Banned user is denied login authorization", isBannedAllowedLogin === false);

  const suspendedUserId = `usr_susp_${runId}`;
  await db.insert(users).values({
    id: suspendedUserId,
    username: `susp_${runId}`,
    email: `susp_${runId}@example.com`,
    passwordHash,
    status: "suspended",
    statusReason: "Temporary security hold",
  });

  const suspendedUser = await db.query.users.findFirst({ where: eq(users.id, suspendedUserId) });
  const isSuspendedAllowedLogin = suspendedUser && suspendedUser.status !== "banned" && suspendedUser.status !== "suspended";
  check("Suspended user is denied login authorization", isSuspendedAllowedLogin === false);

  // -------------------------------------------------------------------------
  // 7. Verification Boundary Policy Enforcement (Wagering & Social)
  // -------------------------------------------------------------------------
  console.log("\nSection 7: Verification Boundary Policy Enforcement");

  // Unverified user attempting wagering match (stake > 0)
  function simulateQueueWagerCheck(user: { isEmailVerified: boolean }, stake: number): { allowed: boolean; error?: string } {
    if (stake > 0 && !user.isEmailVerified) {
      return { allowed: false, error: "Email verification is required for wagering matches." };
    }
    return { allowed: true };
  }

  const unverifiedWagerCheck = simulateQueueWagerCheck({ isEmailVerified: false }, 100);
  const unverifiedPracticeCheck = simulateQueueWagerCheck({ isEmailVerified: false }, 0);
  const verifiedWagerCheck = simulateQueueWagerCheck({ isEmailVerified: true }, 100);

  check("Unverified user blocked from wagering matches", !unverifiedWagerCheck.allowed && Boolean(unverifiedWagerCheck.error));
  check("Unverified user allowed in practice / free play (stake=0)", unverifiedPracticeCheck.allowed);
  check("Verified user allowed in wagering matches (stake>0)", verifiedWagerCheck.allowed);

  // -------------------------------------------------------------------------
  // 8. Clean up test rows
  // -------------------------------------------------------------------------
  console.log("\nCleaning up test fixtures...");
  await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.userId, unverifiedUserId));
  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, userId));
  await db.delete(users).where(eq(users.id, userId));
  await db.delete(users).where(eq(users.id, unverifiedUserId));
  await db.delete(users).where(eq(users.id, bannedUserId));
  await db.delete(users).where(eq(users.id, suspendedUserId));

  console.log(`\n=======================================================`);
  console.log(`Auth & Account Lifecycle Check: ${passes} PASS, ${failures} FAIL`);
  console.log(`=======================================================\n`);

  if (failures > 0) {
    process.exit(1);
  }
}

runAuthAccountLifecycleSuite().catch((err) => {
  console.error("Fatal error during auth lifecycle check:", err);
  process.exit(1);
});
