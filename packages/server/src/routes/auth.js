import { createHash, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { Router } from "express";
import { hashPassword, validatePasswordPolicy, verifyPassword } from "../auth/password";
import { SESSION_COOKIE_MAX_AGE_MS, SESSION_COOKIE_NAME, signSessionToken } from "../auth/jwt";
import { attachSession, requireAuth } from "../auth/middleware";
import { db } from "../db/client";
import { emailVerificationTokens, users } from "../db/schema";
import { ensureSignupGrant } from "../wallet/ledger";
import { createRateLimiterMiddleware } from "../utils/rateLimiter";
const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/;
function hashToken(rawToken) {
    return createHash("sha256").update(rawToken).digest("hex");
}
async function toPublicUser(user) {
    const balances = await ensureSignupGrant(user.id);
    return {
        id: user.id,
        username: user.username,
        email: user.email,
        avatarUrl: user.avatarUrl,
        gamesPlayed: user.gamesPlayed,
        gamesWon: user.gamesWon,
        isEmailVerified: user.isEmailVerified ?? false,
        createdAt: user.createdAt.toISOString(),
        balances,
    };
}
function setSessionCookie(res, userId) {
    const token = signSessionToken({ sub: userId });
    res.cookie(SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: SESSION_COOKIE_MAX_AGE_MS,
    });
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
export const authRouter = Router();
authRouter.post("/signup", authLimiter, async (req, res) => {
    const { username, password, email } = req.body ?? {};
    if (typeof username !== "string" || !USERNAME_PATTERN.test(username)) {
        res.status(400).json({ error: "Username must be 3-20 characters: letters, numbers, underscores only." });
        return;
    }
    const passwordPolicy = validatePasswordPolicy(password);
    if (!passwordPolicy.valid) {
        res.status(400).json({ error: passwordPolicy.error });
        return;
    }
    if (email !== undefined && email !== null && (typeof email !== "string" || email.length > 255 || !email.includes("@"))) {
        res.status(400).json({ error: "Email must be valid and under 255 characters." });
        return;
    }
    const existing = await db.query.users.findFirst({ where: eq(users.username, username) });
    if (existing) {
        res.status(409).json({ error: "That username is already taken." });
        return;
    }
    const passwordHash = await hashPassword(password);
    const id = randomUUID();
    const [user] = await db
        .insert(users)
        .values({
        id,
        username,
        email: email || null,
        passwordHash,
        isEmailVerified: false,
    })
        .returning();
    // Create registration email verification token (24-hour expiration)
    const rawVerificationToken = randomUUID();
    const tokenHash = hashToken(rawVerificationToken);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await db.insert(emailVerificationTokens).values({
        id: `evt_${randomUUID()}`,
        userId: user.id,
        tokenHash,
        expiresAt,
    });
    setSessionCookie(res, user.id);
    res.status(201).json({
        user: await toPublicUser(user),
        verificationToken: rawVerificationToken,
        verificationMessage: "Verification email sent. Please verify your email to complete registration.",
    });
});
authRouter.post("/verify-email", async (req, res) => {
    const { token } = req.body ?? {};
    if (typeof token !== "string" || token.trim().length === 0) {
        res.status(400).json({ error: "Verification token is required." });
        return;
    }
    const tokenHash = hashToken(token.trim());
    const record = await db.query.emailVerificationTokens.findFirst({
        where: eq(emailVerificationTokens.tokenHash, tokenHash),
    });
    if (!record) {
        res.status(400).json({ error: "Invalid or expired verification token." });
        return;
    }
    if (Date.now() > record.expiresAt.getTime()) {
        await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.id, record.id));
        res.status(400).json({ error: "Verification token has expired. Please request a new one." });
        return;
    }
    // Update user as verified
    const [updatedUser] = await db
        .update(users)
        .set({
        isEmailVerified: true,
        emailVerifiedAt: new Date(),
    })
        .where(eq(users.id, record.userId))
        .returning();
    // Delete used token
    await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.id, record.id));
    res.json({
        message: "Email verified successfully.",
        user: await toPublicUser(updatedUser),
    });
});
authRouter.post("/resend-verification", resendLimiter, attachSession, async (req, res) => {
    const { email } = req.body ?? {};
    let user = null;
    if (req.userId) {
        user = await db.query.users.findFirst({ where: eq(users.id, req.userId) });
    }
    else if (typeof email === "string" && email.trim().length > 0) {
        user = await db.query.users.findFirst({ where: eq(users.email, email.trim()) });
    }
    if (user && !user.isEmailVerified) {
        const rawVerificationToken = randomUUID();
        const tokenHash = hashToken(rawVerificationToken);
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await db.insert(emailVerificationTokens).values({
            id: `evt_${randomUUID()}`,
            userId: user.id,
            tokenHash,
            expiresAt,
        });
    }
    // Safe response regardless of account existence to prevent account enumeration
    res.json({
        message: "If that account exists and is unverified, a verification link has been sent.",
    });
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
    setSessionCookie(res, user.id);
    res.json({ user: await toPublicUser(user) });
});
authRouter.post("/logout", (_req, res) => {
    res.clearCookie(SESSION_COOKIE_NAME);
    res.status(204).end();
});
authRouter.get("/me", attachSession, requireAuth, async (req, res) => {
    const user = await db.query.users.findFirst({ where: eq(users.id, req.userId) });
    if (!user) {
        res.status(401).json({ error: "Not authenticated" });
        return;
    }
    res.json({ user: await toPublicUser(user) });
});
