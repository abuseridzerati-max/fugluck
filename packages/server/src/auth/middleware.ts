import type { NextFunction, Request, Response } from "express";
import { SESSION_COOKIE_NAME, verifySessionToken } from "./jwt";
import type { SessionTokenPayload } from './jwt';
import { sessionUser } from './session';
import type { User } from '../db/schema';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      sessionPayload?: SessionTokenPayload;
      sessionUser?: User;
      sessionRestricted?: boolean;
    }
  }
}

// Attaches req.userId when a valid session cookie is present; never blocks
// the request. Use requireAuth for routes that must reject unauthenticated
// requests outright.
export async function attachSession(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[SESSION_COOKIE_NAME];
  const payload = token ? verifySessionToken(token) : null;
  if (payload?.sessionPurpose === 'user') {
    const user = await sessionUser(payload);
    if (user && user.status !== 'banned' && user.status !== 'suspended') {
      req.userId = user.id; req.sessionPayload = payload; req.sessionUser = user;
    } else if (user) req.sessionRestricted = true;
  }
  next();
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.sessionRestricted) { res.status(403).json({ error: 'Account suspended or banned.' }); return; }
  if (!req.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const { db } = await import("../db/client");
  const { users } = await import("../db/schema");
  const { eq } = await import("drizzle-orm");

  const user = await db.query.users.findFirst({ where: eq(users.id, req.userId) });
  if (!user || user.status === "banned" || user.status === "suspended") {
    res.status(403).json({ error: "Account suspended or banned." });
    return;
  }

  next();
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const { db } = await import("../db/client");
  const { users } = await import("../db/schema");
  const { eq } = await import("drizzle-orm");

  const user = await db.query.users.findFirst({ where: eq(users.id, req.userId) });
  if (!user || user.status === "banned" || user.status === "suspended") {
    res.status(403).json({ error: "Account access restricted." });
    return;
  }

  if (user.role !== "OWNER" && user.role !== "SUPER_ADMIN" && user.role !== "ADMIN" && user.role !== "MODERATOR" && user.role !== "SUPPORT") {
    res.status(403).json({ error: "Forbidden: Administrative privilege required." });
    return;
  }

  next();
}

export const ADMIN_SESSION_COOKIE_NAME = "ac_admin_session";

export async function requireEmailVerified(req: Request, res: Response, next: NextFunction) {
  if (!req.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const { db } = await import("../db/client");
  const { users } = await import("../db/schema");
  const { eq } = await import("drizzle-orm");

  const user = await db.query.users.findFirst({ where: eq(users.id, req.userId) });
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  if (!user.isEmailVerified) {
    res.status(403).json({ error: "Email verification required to access this feature." });
    return;
  }

  next();
}

export async function requireOwnerAdmin(req: Request, res: Response, next: NextFunction) {
  const adminToken = req.cookies?.[ADMIN_SESSION_COOKIE_NAME];
  const payload = adminToken ? verifySessionToken(adminToken) : null;

  if (!payload || !payload.sub || payload.sessionPurpose !== 'admin') {
    res.status(401).json({ error: "Not authenticated as administrator" });
    return;
  }

  const { db } = await import("../db/client");
  const { users } = await import("../db/schema");
  const { eq } = await import("drizzle-orm");

  const user = await sessionUser(payload);
  if (!user || user.status === "banned" || user.status === "suspended") {
    res.status(403).json({ error: "Account access restricted." });
    return;
  }

  if (user.role !== "OWNER" && user.role !== "SUPER_ADMIN" && user.role !== "ADMIN") {
    res.status(403).json({ error: "Forbidden: Owner administrative privilege required." });
    return;
  }

  req.userId = user.id;
  req.sessionPayload = payload;
  req.sessionUser = user;
  next();
}
