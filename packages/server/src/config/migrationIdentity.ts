import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const hash = (text: string) => createHash('sha256').update(text).digest('hex');
export type AppliedMigration = { hash: string; created_at: string | number };
export function expectedMigrations() {
  const root = new URL('../../drizzle/', import.meta.url);
  const journal = JSON.parse(readFileSync(new URL('meta/_journal.json', root), 'utf8')) as { entries: Array<{ tag: string; when: number }> };
  return journal.entries.map(entry => {
    const canonical = readFileSync(fileURLToPath(new URL(`${entry.tag}.sql`, root)), 'utf8').replace(/\r\n/g, '\n');
    // Historical migrations were run from Windows and Linux. Accept only these
    // two exact newline representations of the reviewed SQL, not unknown hashes.
    return { tag: entry.tag, timestamp: entry.when, hash: hash(canonical), windowsHash: hash(canonical.replace(/\n/g, '\r\n')) };
  });
}

export function compareMigrationIdentity(rows: AppliedMigration[]) {
  const expected = expectedMigrations();
  const ordered = [...rows].sort((a, b) => Number(a.created_at) - Number(b.created_at));
  const matches = ordered.length === expected.length && ordered.every((row, i) => {
    const item = expected[i];
    return Number(row.created_at) === item.timestamp && [item.hash, item.windowsHash].includes(row.hash);
  });
  const head = ordered.at(-1);
  return {
    status: matches ? 'match' as const : 'mismatch' as const,
    expectedCount: expected.length,
    appliedCount: ordered.length,
    expectedHead: expected.at(-1)?.tag ?? null,
    appliedHead: head ? expected.find(m => m.timestamp === Number(head.created_at) && [m.hash, m.windowsHash].includes(head.hash))?.tag ?? 'unknown' : null,
    appliedHeadHash: head?.hash ?? null,
    // Drizzle created_at is the journal version timestamp, NOT actual application time.
    journalTimestamp: head ? Number(head.created_at) : null,
    expectedChainFingerprint: hash(JSON.stringify(expected.map(({ tag, timestamp, hash }) => ({ tag, timestamp, hash })))),
  };
}

type QueryClient = { query: (text: string) => Promise<{ rows: AppliedMigration[] }> };
export async function readMigrationIdentity(client: QueryClient) {
  try {
    const result = await client.query('SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at');
    return compareMigrationIdentity(result.rows);
  } catch {
    return { ...compareMigrationIdentity([]), status: 'unavailable' as const };
  }
}

export async function enforceMigrationIdentity(client: QueryClient) {
  const identity = await readMigrationIdentity(client);
  if (identity.status !== 'match') throw new Error(`Database migration identity is ${identity.status}; startup refused before recovery or traffic.`);
  return identity;
}
