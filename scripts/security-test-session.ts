import './require-disposable-test-database';
import { pool } from '../packages/server/src/db/client';
import { signSessionToken } from '../packages/server/src/auth/jwt';
/** Test-only proof issued from an actual isolated account, using the production token format. */
export async function fixtureSession(userId: string, purpose: 'user' | 'admin' = 'user'): Promise<string> {
  const row = (await pool.query<{password_hash: string}>('SELECT password_hash FROM users WHERE id=$1', [userId])).rows[0];
  if (!row) throw Error('Fixture session account missing');
  return signSessionToken({ sub: userId, sessionPurpose: purpose }, row.password_hash);
}
