import { logger } from '../utils/safeLogger';
import { CURRENT_POLICY_VERSIONS, type PolicyType, type PublicUser } from "@fugluck/shared";
import { createHash, randomUUID } from "node:crypto";
import { and, desc, eq, or } from "drizzle-orm";
import { Router } from "express";
import { hashPassword, validatePasswordPolicy, verifyPassword } from "../auth/password";
import { getClearCookieOptions, getSessionCookieOptions, SESSION_COOKIE_NAME, signSessionToken, signSocketTicket, verifySessionToken } from "../auth/jwt";
import { disconnectUserSessions, revokeSession } from '../auth/session';
import { signGuestTicket } from '../auth/jwt';
import { attachSession, requireAuth } from "../auth/middleware";
import { db } from "../db/client";
import { passwordResetTokens, policyAcceptances, users, type User } from "../db/schema";
import { ensureSignupGrant } from "../wallet/ledger";
import { sandboxAccountingAdapter } from "../accounting";
import { createRateLimiterMiddleware } from "../utils/rateLimiter";
import { sendPasswordResetEmail } from "../email/emailService";

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

async function toPublicUser(user: User): Promise<PublicUser> {
  const balances = await ensureSignupGrant(user.id);
  let sandboxGelMinor = 0;
  let sandboxGelReservedMinor = 0;
  try {
    const sb = await sandboxAccountingAdapter.getUserBalance(user.id);
    sandboxGelMinor = sb.availableMinor;
    sandboxGelReservedMinor = sb.reservedMinor;
  } catch (err) {
    logger.error("[auth] Failed to retrieve sandbox balance:", err);
  }
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    avatarUrl: user.avatarUrl,
    role: user.role as PublicUser["role"],
    gamesPlayed: user.gamesPlayed,
    gamesWon: user.gamesWon,
    isEmailVerified: user.isEmailVerified ?? false,
    createdAt: user.createdAt.toISOString(),
    balances: {
      ...balances,
      sandboxGelMinor,
      sandboxGelReservedMinor,
    },
  };
}

function setSessionCookie(res: import("express").Response, user: User) {
  const token = signSessionToken({ sub: user.id }, user.passwordHash);
  res.cookie(SESSION_COOKIE_NAME, token, getSessionCookieOptions());
}

const authLimiter = createRateLimiterMiddleware({
  windowMs: 60 * 1000,
  maxRequests: 5,
  message: "Too many authentication attempts. Please try again later.",
});

const resendLimiter = createRateLimiterMiddleware({
  windowMs: 15 * 60 * 1000,
  maxRequests: 3,
  message: "Too many verification resend attempts. Please wait 15 minutes.",
});

const forgotPasswordLimiter = createRateLimiterMiddleware({
  windowMs: 15 * 60 * 1000,
  maxRequests: 5,
  message: "Too many password reset requests. Please wait 15 minutes.",
});

export const authRouter = Router();
authRouter.post('/guest-ticket', createRateLimiterMiddleware({windowMs:60_000,maxRequests:20}), (_req,res) => {
  res.setHeader('Cache-Control','no-store');
  res.json({token:signGuestTicket(),expiresInMs:SESSION_GUEST_LIFETIME_MS});
});
const SESSION_GUEST_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

authRouter.post('/socket-ticket', attachSession, requireAuth, (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ token: signSocketTicket(_req.userId!, _req.sessionPayload) });
});

authRouter.get("/policies/versions", (_req, res) => {
  res.json({
    versions: CURRENT_POLICY_VERSIONS,
    requiredAtSignup: {
      terms: CURRENT_POLICY_VERSIONS.TERMS,
      privacy: CURRENT_POLICY_VERSIONS.PRIVACY,
    },
  });
});

authRouter.get("/policies/my-acceptances", attachSession, requireAuth, async (req, res) => {
  const acceptances = await db.query.policyAcceptances.findMany({
    where: eq(policyAcceptances.userId, req.userId!),
    orderBy: [desc(policyAcceptances.acceptedAt)],
  });
  res.json({ acceptances });
});

authRouter.post("/policies/accept", attachSession, requireAuth, async (req, res) => {
  const { policyType, policyVersion, source } = req.body ?? {};

  if (typeof policyType !== "string" || !(policyType in CURRENT_POLICY_VERSIONS)) {
    res.status(400).json({ error: "Invalid or unsupported policy type." });
    return;
  }
  const typedPolicy = policyType as PolicyType;
  const currentVersion = CURRENT_POLICY_VERSIONS[typedPolicy];
  if (typeof policyVersion !== "string" || policyVersion !== currentVersion) {
    res.status(400).json({
      error: `Policy version must match the current version (${currentVersion}).`,
      currentVersion,
    });
    return;
  }

  const clientIp = req.ip || req.socket.remoteAddress || "127.0.0.1";
  const userAgent = (req.headers["user-agent"] as string) || null;

  const id = `pa_${randomUUID()}`;
  await db.insert(policyAcceptances).values({
    id,
    userId: req.userId!,
    policyType: typedPolicy,
    policyVersion,
    source: typeof source === "string" ? source.slice(0, 32) : "user_action",
    ipAddress: clientIp,
    userAgent,
  });

  res.json({ success: true, id, policyType: typedPolicy, policyVersion });
});

authRouter.post("/signup", authLimiter, async (req, res) => {
  const { username, password, email, acceptedPolicies } = req.body ?? {};

  if (typeof username !== "string" || !USERNAME_PATTERN.test(username)) {
    res.status(400).json({ error: "Username must be 3-20 characters: letters, numbers, underscores only." });
    return;
  }

  const passwordPolicy = validatePasswordPolicy(password);
  if (!passwordPolicy.valid) {
    res.status(400).json({ error: passwordPolicy.error });
    return;
  }

  const normalizedEmail = typeof email === "string" ? email.trim() : "";
  if (normalizedEmail.length === 0 || normalizedEmail.length > 255 || !EMAIL_PATTERN.test(normalizedEmail)) {
    res.status(400).json({ error: "A valid email address is required." });
    return;
  }

  // Server-side mandatory consent validation for current Terms & Privacy Policy
  if (
    !acceptedPolicies ||
    typeof acceptedPolicies !== "object" ||
    acceptedPolicies.termsVersion !== CURRENT_POLICY_VERSIONS.TERMS ||
    acceptedPolicies.privacyVersion !== CURRENT_POLICY_VERSIONS.PRIVACY
  ) {
    res.status(400).json({
      error: "You must agree to the current Terms of Service and acknowledge the Privacy Policy.",
      requiredVersions: {
        terms: CURRENT_POLICY_VERSIONS.TERMS,
        privacy: CURRENT_POLICY_VERSIONS.PRIVACY,
      },
    });
    return;
  }

  const existing = await db.query.users.findFirst({ where: eq(users.username, username) });
  if (existing) {
    res.status(409).json({ error: "That username is already taken." });
    return;
  }

  const existingEmail = await db.query.users.findFirst({ where: eq(users.email, normalizedEmail) });
  if (existingEmail) {
    res.status(409).json({ error: "An account with that email already exists." });
    return;
  }

  const clientIp = req.ip || req.socket.remoteAddress || "127.0.0.1";
  const userAgent = (req.headers["user-agent"] as string) || null;
  const passwordHash = await hashPassword(password);
  const id = randomUUID();
  const now = new Date();

  const [user] = await db
    .insert(users)
    .values({
      id,
      username,
      email: normalizedEmail,
      passwordHash,
      isEmailVerified: true,
      emailVerifiedAt: now,
    })
    .returning();

  // Atomically record durable legal acceptance records for Terms and Privacy
  await db.insert(policyAcceptances).values([
    {
      id: `pa_${randomUUID()}`,
      userId: user.id,
      policyType: "TERMS",
      policyVersion: CURRENT_POLICY_VERSIONS.TERMS,
      source: "registration",
      ipAddress: clientIp,
      userAgent,
    },
    {
      id: `pa_${randomUUID()}`,
      userId: user.id,
      policyType: "PRIVACY",
      policyVersion: CURRENT_POLICY_VERSIONS.PRIVACY,
      source: "registration",
      ipAddress: clientIp,
      userAgent,
    },
  ]);

  setSessionCookie(res, user);

  res.status(201).json({
    user: await toPublicUser(user),
  });
});

// Email verification is temporarily disabled for beta; keep legacy endpoints harmlessly inert.
authRouter.post("/verify-email", authLimiter, (_req, res) => {
  res.json({
    message: "Email verification is not currently required.",
  });
});

authRouter.post("/resend-verification", resendLimiter, (_req, res) => {
  res.json({
    message: "Email verification is not currently required.",
  });
});

authRouter.post("/forgot-password", forgotPasswordLimiter, async (req, res) => {
  const { email, username } = req.body ?? {};

  let user = null;
  if (typeof email === "string" && email.trim().length > 0) {
    user = await db.query.users.findFirst({ where: eq(users.email, email.trim()) });
  } else if (typeof username === "string" && username.trim().length > 0) {
    user = await db.query.users.findFirst({ where: eq(users.username, username.trim()) });
  }

  let rawResetToken: string | undefined;
  if (user && user.email && user.status !== "banned" && user.status !== "suspended") {
    // Invalidate any previous pending reset tokens for this user
    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, user.id));

    rawResetToken = randomUUID();
    const tokenHash = hashToken(rawResetToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1-hour expiration

    await db.insert(passwordResetTokens).values({
      id: `prt_${randomUUID()}`,
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    await sendPasswordResetEmail(user.email, user.username, rawResetToken).catch((err) => {
      logger.error("[auth] Failed to dispatch password reset email:", err);
    });
  }

  const responsePayload: Record<string, unknown> = {
    message: "If that account exists, password reset instructions have been sent to the registered email.",
  };

  if (process.env.NODE_ENV !== "production" && rawResetToken) {
    responsePayload.resetToken = rawResetToken;
  }

  // Safe non-enumerating response
  res.json(responsePayload);
});

authRouter.post("/reset-password", authLimiter, async (req, res) => {
  const { token, newPassword } = req.body ?? {};

  if (typeof token !== "string" || token.trim().length === 0) {
    res.status(400).json({ error: "Reset token is required." });
    return;
  }

  const passwordPolicy = validatePasswordPolicy(newPassword);
  if (!passwordPolicy.valid) {
    res.status(400).json({ error: passwordPolicy.error });
    return;
  }

  const tokenHash = hashToken(token.trim());
  const record = await db.query.passwordResetTokens.findFirst({
    where: eq(passwordResetTokens.tokenHash, tokenHash),
  });

  if (!record) {
    res.status(400).json({ error: "Invalid or expired password reset link." });
    return;
  }

  if (Date.now() > record.expiresAt.getTime()) {
    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.id, record.id));
    res.status(400).json({ error: "Password reset link has expired. Please request a new one." });
    return;
  }

  const user = await db.query.users.findFirst({ where: eq(users.id, record.userId) });
  if (!user || user.status === "banned" || user.status === "suspended") {
    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.id, record.id));
    res.status(403).json({ error: "Account access restricted." });
    return;
  }

  const newPasswordHash = await hashPassword(newPassword);

  // Consume under a row lock before changing the password. Exactly one concurrent request wins.
  const changed = await db.transaction(async (tx) => {
    const [consumed] = await tx.delete(passwordResetTokens)
      .where(and(eq(passwordResetTokens.id, record.id), eq(passwordResetTokens.tokenHash, tokenHash))).returning();
    if (!consumed || consumed.expiresAt.getTime() <= Date.now()) return false;
    const [updated] = await tx.update(users).set({ passwordHash: newPasswordHash })
      .where(and(eq(users.id, consumed.userId), eq(users.status, 'active'))).returning();
    return Boolean(updated);
  });
  if (!changed) { res.status(400).json({ error: 'Invalid or expired password reset link.' }); return; }
  disconnectUserSessions(record.userId);

  // Clear any existing session cookie so user must authenticate with new password
  res.clearCookie(SESSION_COOKIE_NAME, getClearCookieOptions());
  res.json({ message: "Password reset successfully. You may now log in with your new password." });
});

authRouter.post("/login", authLimiter, async (req, res) => {
  const { username, password } = req.body ?? {};

  if (typeof username !== "string" || typeof password !== "string") {
    res.status(400).json({ error: "Username and password are required." });
    return;
  }

  const user = await db.query.users.findFirst({ where: eq(users.username, username) });
  const valid = user ? await verifyPassword(password, user.passwordHash) : false;
  if (!user || !valid) {
    res.status(401).json({ error: "Invalid username or password." });
    return;
  }

  // Enforce account status check on login
  if (user.status === "banned" || user.status === "suspended") {
    res.status(403).json({ error: "Account suspended or banned." });
    return;
  }

  setSessionCookie(res, user);
  res.json({ user: await toPublicUser(user) });
});

authRouter.post("/logout", async (_req, res) => {
  await revokeSession(verifySessionToken(_req.cookies?.[SESSION_COOKIE_NAME]));
  res.clearCookie(SESSION_COOKIE_NAME, getClearCookieOptions());
  res.status(204).end();
});

authRouter.get("/me", attachSession, requireAuth, async (req, res) => {
  const user = await db.query.users.findFirst({ where: eq(users.id, req.userId!) });
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  res.json({ user: await toPublicUser(user) });
});
