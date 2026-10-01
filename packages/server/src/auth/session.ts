import { eq } from 'drizzle-orm';
import { db, pool } from '../db/client';
import { users, type User } from '../db/schema';
import { credentialVersion, type SessionTokenPayload } from './jwt';

/** Password changes invalidate every issued proof; logout persists single-session revocation. */
export async function sessionUser(payload: SessionTokenPayload): Promise<User | null> {
  if (!payload.jti || !payload.credentialVersion || !payload.exp || payload.exp <= Date.now() / 1000) return null;
  const user = await db.query.users.findFirst({ where: eq(users.id, payload.sub) });
  if (!user || credentialVersion(user.passwordHash) !== payload.credentialVersion) return null;
  const revoked = await pool.query('SELECT 1 FROM auth_session_revocations WHERE session_id=$1', [payload.jti]);
  return revoked.rowCount ? null : user;
}

type ConnectedSession = { payload: SessionTokenPayload; disconnect: () => void };
const connections = new Set<ConnectedSession>();
export function trackSessionSocket(payload: SessionTokenPayload, disconnect: () => void): () => void {
  const entry = { payload, disconnect }; connections.add(entry);
  return () => connections.delete(entry);
}
export function disconnectUserSessions(userId: string): void {
  for (const entry of connections) if (entry.payload.sub === userId) entry.disconnect();
}
export async function revokeSession(payload: SessionTokenPayload | null): Promise<void> {
  if (!payload?.jti || !payload.exp) return;
  await pool.query(`INSERT INTO auth_session_revocations(session_id,expires_at) VALUES($1,to_timestamp($2))
    ON CONFLICT(session_id) DO NOTHING`, [payload.jti, payload.exp]);
  for (const entry of connections) if (entry.payload.jti === payload.jti) entry.disconnect();
  // Cleanup is bounded by expiry; no active revocation is ever removed.
  await pool.query('DELETE FROM auth_session_revocations WHERE expires_at < now()');
}
