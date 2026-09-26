/** Read-only evidence collector. No seed, migration, repair, or recovery imports. */
import dotenv from 'dotenv';
import { Pool } from 'pg';
import { getDeploymentIdentity, isHostedEnvironment } from '../packages/server/src/config/deploymentIdentity';
import { validateStartupConfig } from '../packages/server/src/config/startup';
import { getCommercialSafety } from '../packages/server/src/config/commercialSafety';
import { compareMigrationIdentity, readMigrationIdentity } from '../packages/server/src/config/migrationIdentity';

dotenv.config({ path: 'packages/server/.env' });
async function main() {
  const config = validateStartupConfig();
  let migrations = { ...compareMigrationIdentity([]), status: 'not queried' };
  if (process.argv.includes('--check-database')) {
    if (!isHostedEnvironment() || !config.valid) throw new Error('Database inspection requires valid, registered hosted configuration. No connection attempted.');
    const url = new URL(process.env.DATABASE_URL!);
    url.searchParams.delete('sslmode');
    const pool = new Pool({ connectionString: url.toString(), ssl: { rejectUnauthorized: true, ...(process.env.DATABASE_CA_CERT ? { ca: process.env.DATABASE_CA_CERT.replace(/\\n/g, '\n') } : {}) }, connectionTimeoutMillis: 5000, query_timeout: 5000 });
    try { migrations = await readMigrationIdentity(pool); } finally { await pool.end(); }
  }
  console.log(JSON.stringify({ checkedAt: new Date().toISOString(), scope: 'Current process configuration; not a provider deployment attestation', databaseQueried: process.argv.includes('--check-database'), identity: getDeploymentIdentity(), commercial: getCommercialSafety(), configuration: config, migrations }, null, 2));
  if (!config.valid || (process.argv.includes('--check-database') && migrations.status !== 'match')) process.exitCode = 1;
}
void main().catch(() => { console.error('Environment baseline could not be verified. No secrets or database errors are printed.'); process.exitCode = 1; });
