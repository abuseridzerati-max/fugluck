import "dotenv/config";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import { createHmac, randomUUID } from 'node:crypto';
import { getAppEnvironment } from '../config/environment';

if (!process.env.JWT_SECRET) {
  dotenv.config({ path: "packages/server/.env" });
}

// A plain guarded const doesn't narrow to `string` inside functions defined
// later in the module (TS control-flow analysis doesn't carry across
// closures) — routing through a function with an explicit return type does.
function requireJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set — copy packages/server/.env.example to .env and fill it in.");
  }
  return secret;
}
const JWT_SECRET = requireJwtSecret();

const EXPIRES_IN = "7d";
const sessionScope = () => {
  const environment = getAppEnvironment();
  return environment === 'staging' || environment === 'production'
    ? { issuer: `fugluck:${environment}`, audience: `fugluck:${environment}:api` } : {};
};

export type SessionTokenPayload = {
  sub: string; // user id
  credentialVersion?: string;
  jti?: string;
  exp?: number;
  sessionPurpose?: 'user' | 'admin';
};

export function credentialVersion(passwordHash: string): string {
  return createHmac('sha256', JWT_SECRET).update(`credential:${passwordHash}`).digest('hex');
}

export function signSessionToken(payload: SessionTokenPayload, passwordHash?: string): string {
  return jwt.sign({ ...payload, jti: randomUUID(), sessionPurpose: payload.sessionPurpose ?? 'user',
    ...(passwordHash ? { credentialVersion: credentialVersion(passwordHash) } : {}) }, JWT_SECRET,
    { expiresIn: EXPIRES_IN, ...sessionScope() });
}

export function verifySessionToken(token: string): SessionTokenPayload | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'], ...sessionScope() }) as jwt.JwtPayload;
    return typeof payload.sub === 'string' && !payload.purpose && typeof payload.exp === 'number' &&
      typeof payload.jti === 'string' && ['user', 'admin'].includes(payload.sessionPurpose)
      ? { sub: payload.sub, credentialVersion: payload.credentialVersion, jti: payload.jti,
          exp: payload.exp, sessionPurpose: payload.sessionPurpose } : null;
  } catch {
    return null;
  }
}

// Transport-only proof issued through the authenticated HTTP session. Never
// usable as an HTTP session cookie, and never stored by the browser.
export function signSocketTicket(userId: string, session?: SessionTokenPayload): string {
  const environment = getAppEnvironment();
  return jwt.sign({ sub: userId, purpose: 'socket', credentialVersion: session?.credentialVersion,
    jti: session?.jti, sessionPurpose: session?.sessionPurpose, sessionExpiresAt: session?.exp }, JWT_SECRET, {
    expiresIn: '60s', issuer: `fugluck:${environment}`, audience: `fugluck:${environment}:socket`,
  });
}

export function verifySocketTicket(token: unknown): SessionTokenPayload | null {
  if (typeof token !== 'string' || !token) return null;
  try {
    const environment = getAppEnvironment();
    const payload = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256'], issuer: `fugluck:${environment}`, audience: `fugluck:${environment}:socket`,
    }) as jwt.JwtPayload;
    return typeof payload.sub === 'string' && payload.purpose === 'socket' && typeof payload.exp === 'number' &&
      typeof payload.sessionExpiresAt === 'number' && payload.sessionExpiresAt > Date.now() / 1000 &&
      typeof payload.jti === 'string' && payload.sessionPurpose === 'user'
      ? { sub: payload.sub, credentialVersion: payload.credentialVersion, jti: payload.jti,
          exp: payload.sessionExpiresAt, sessionPurpose: 'user' } : null;
  } catch { return null; }
}

export const SESSION_COOKIE_NAME = "ac_session";
export function signGuestTicket(): string {
  return jwt.sign({sub:`guest_${randomUUID()}`,purpose:'guest'},JWT_SECRET,{
    expiresIn:EXPIRES_IN,issuer:`fugluck:${getAppEnvironment()}`,audience:`fugluck:${getAppEnvironment()}:guest`,
  });
}
export function verifyGuestTicket(token: unknown): string | null {
  if(typeof token !== 'string') return null;
  try {
    const payload=jwt.verify(token,JWT_SECRET,{algorithms:['HS256'],issuer:`fugluck:${getAppEnvironment()}`,
      audience:`fugluck:${getAppEnvironment()}:guest`}) as jwt.JwtPayload;
    return payload.purpose==='guest' && typeof payload.exp==='number' && typeof payload.sub==='string' &&
      /^guest_[a-f0-9-]{36}$/.test(payload.sub) ? payload.sub : null;
  } catch { return null; }
}
export const SESSION_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days, matches EXPIRES_IN

export type SessionCookieOptions = {
  httpOnly: boolean;
  sameSite: "lax" | "strict" | "none";
  secure: boolean;
  domain?: string;
  maxAge?: number;
};

export function getSessionCookieOptions(): SessionCookieOptions {
  const isProduction = process.env.NODE_ENV === "production";
  const sameSite = (process.env.COOKIE_SAMESITE as "lax" | "strict" | "none") || "lax";
  const domain = process.env.COOKIE_DOMAIN || undefined;

  return {
    httpOnly: true,
    sameSite,
    secure: isProduction || sameSite === "none",
    domain,
    maxAge: SESSION_COOKIE_MAX_AGE_MS,
  };
}

export function getClearCookieOptions(): Partial<SessionCookieOptions> {
  const isProduction = process.env.NODE_ENV === "production";
  const sameSite = (process.env.COOKIE_SAMESITE as "lax" | "strict" | "none") || "lax";
  const domain = process.env.COOKIE_DOMAIN || undefined;

  return {
    httpOnly: true,
    sameSite,
    secure: isProduction || sameSite === "none",
    domain,
  };
}

