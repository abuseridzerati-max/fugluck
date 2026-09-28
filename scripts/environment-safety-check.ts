import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { validateStartupConfig } from '../packages/server/src/config/startup';
import { getDatabaseTargetIdentity, getDeploymentIdentity, getBuildRevision, connectionStringWithManagedTls } from '../packages/server/src/config/deploymentIdentity';
import { commercialGate, getCommercialSafety, COMMERCIAL_SWITCHES } from '../packages/server/src/config/commercialSafety';
import { compareMigrationIdentity, expectedMigrations, enforceMigrationIdentity, readMigrationIdentity } from '../packages/server/src/config/migrationIdentity';
import { getClientDeployment } from '../packages/client/deploymentConfig';
import { getHealthPayload } from '../packages/server/src/config/health';
import { allowedMockUser, stagingMockAction, stagingMockMode, validMockAuthorization, validateStagingMockConfig } from '../packages/server/src/config/stagingMockCommercial';

let passed = 0, failed = 0;
function check(label: string, condition: unknown) { console.log(`${condition ? 'PASS' : 'FAIL'} ${label}`); condition ? passed++ : failed++; }
const dbUrl = 'postgresql://postgres.gzfcucvxfzzjzjtgkwpd:fixture-secret@aws-1-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require';
const fingerprint = getDatabaseTargetIdentity(dbUrl)!.fingerprint;
const base = { APP_ENV: 'staging', NODE_ENV: 'production', DATABASE_URL: dbUrl, DATABASE_TARGET_FINGERPRINT: fingerprint, DATABASE_REGION: 'eu-central-1', JWT_SECRET: 'x'.repeat(64), GIT_SHA: 'a'.repeat(40), CLIENT_ORIGIN: 'https://staging.fugluck.com', ALLOWED_ORIGINS: 'https://staging.fugluck.com', APP_URL: 'https://staging.fugluck.com' };
const mockIds='11111111-1111-4111-8111-111111111111,22222222-2222-4222-8222-222222222222';
const mockEnv={...base,RENDER_SERVICE_ID:'srv-da2c50c9v7es73db3dkg',STAGING_MOCK_COMMERCIAL_ENABLED:'true',
  STAGING_MOCK_DEPOSITS_ENABLED:'true',STAGING_MOCK_COMPETITIONS_ENABLED:'true',STAGING_MOCK_WITHDRAWALS_ENABLED:'true',
  STAGING_MOCK_AUTHORIZATION:'a'.repeat(64),STAGING_MOCK_PROVIDER_KEY:'b'.repeat(64),STAGING_MOCK_USER_IDS:mockIds};
check('Explicit registered staging mock mode is accepted',validateStartupConfig(mockEnv).valid&&stagingMockMode(mockEnv));
check('Staging mock mode cannot activate in production',!stagingMockMode({...mockEnv,APP_ENV:'production'})&&
  !validateStartupConfig({...mockEnv,APP_ENV:'production'}).valid);
check('Staging mock mode cannot use another service',!stagingMockMode({...mockEnv,RENDER_SERVICE_ID:'other'})&&
  validateStagingMockConfig({...mockEnv,RENDER_SERVICE_ID:'other'}).length>0);
check('Mock actions require the independent master gate',!stagingMockAction('deposits',{...mockEnv,STAGING_MOCK_COMMERCIAL_ENABLED:'false'}));
check('Mock action kill switches are independent',!stagingMockAction('deposits',{...mockEnv,STAGING_MOCK_DEPOSITS_ENABLED:'false'})&&
  stagingMockAction('competitions',{...mockEnv,STAGING_MOCK_DEPOSITS_ENABLED:'false'}));
check('Staging mock requires two separate secrets',!validateStartupConfig({...mockEnv,STAGING_MOCK_PROVIDER_KEY:undefined}).valid&&
  !validateStartupConfig({...mockEnv,STAGING_MOCK_AUTHORIZATION:undefined}).valid);
check('Staging mock requires two synthetic allowlisted users',!validateStartupConfig({...mockEnv,STAGING_MOCK_USER_IDS:'any'}).valid&&
  allowedMockUser(mockIds.split(',')[0],mockEnv)&&!allowedMockUser('outsider',mockEnv));
check('Operator authorization compares exact secret',validMockAuthorization('a'.repeat(64),mockEnv)&&
  !validMockAuthorization('c'.repeat(64),mockEnv));
check('Real-money flags stay forbidden with mock mode',!validateStartupConfig({...mockEnv,REAL_MONEY_ENABLED:'true'}).valid&&
  !stagingMockMode({...mockEnv,REAL_MONEY_ENABLED:'true'}));
const invalid = (change: NodeJS.ProcessEnv) => !validateStartupConfig({ ...base, ...change }).valid;
check('Valid explicit staging configuration is accepted', validateStartupConfig(base).valid);
const knockout={...base,ENABLE_KNOCKOUT_TOURNAMENTS:'true',ENABLE_COMPETITION_AUTHORITY:'true'};
check('Knockout staging requires certified authority',validateStartupConfig(knockout).valid&&!validateStartupConfig({...knockout,ENABLE_COMPETITION_AUTHORITY:'false'}).valid);
check('Knockout cannot activate in production',!validateStartupConfig({...knockout,APP_ENV:'production'}).valid);
check('Knockout cannot activate any real-money switch',Object.values(COMMERCIAL_SWITCHES).every(key=>!validateStartupConfig({...knockout,[key]:'true'}).valid));
for(const count of [4,8,16]){
  const ids=Array.from({length:count},(_,i)=>(i+1).toString(16).padStart(8,'0')+'-1111-4111-8111-111111111111').join(',');
  check(count+' synthetic mock participants are allowed only in staging',validateStartupConfig({...mockEnv,STAGING_MOCK_USER_IDS:ids}).valid&&!stagingMockMode({...mockEnv,STAGING_MOCK_USER_IDS:ids,APP_ENV:'production'}));
}
check('Duplicate synthetic allowlist members are refused',!validateStartupConfig({...mockEnv,STAGING_MOCK_USER_IDS:Array(4).fill(mockIds.split(',')[0]).join(',')}).valid);
check('Unsupported three-player allowlist is refused',!validateStartupConfig({...mockEnv,STAGING_MOCK_USER_IDS:mockIds+',33333333-3333-4333-8333-333333333333'}).valid);
check('APP_ENV cannot be omitted', invalid({ APP_ENV: undefined }));
check('APP_ENV cannot be inferred from a production runtime', getDeploymentIdentity({ NODE_ENV: 'production' }).environment === 'unconfigured');
check('Hosted service cannot downgrade runtime security', invalid({ NODE_ENV: 'development' }));
check('Render cannot bypass identity with a development label', invalid({ RENDER: 'true', APP_ENV: 'development', NODE_ENV: 'development' }));
check('Production cannot start against staging data', invalid({ APP_ENV: 'production' }));
check('An unregistered production target cannot start', invalid({ APP_ENV: 'production', DATABASE_URL: dbUrl.replace('gzfcucvxfzzjzjtgkwpd', 'abcdefghijklmnopqrst') }));
check('A legacy Tokyo database cannot masquerade as staging', invalid({ DATABASE_URL: dbUrl.replace('eu-central-1', 'ap-northeast-1') }));
check('A different pooler tenant has a different fingerprint', getDatabaseTargetIdentity(dbUrl.replace('gzfcucvxfzzjzjtgkwpd', 'abcdefghijklmnopqrst'))?.fingerprint !== fingerprint);
check('A different pooler tenant cannot masquerade as staging', invalid({ DATABASE_URL: dbUrl.replace('gzfcucvxfzzjzjtgkwpd', 'abcdefghijklmnopqrst') }));
check('Missing expected fingerprint is refused', invalid({ DATABASE_TARGET_FINGERPRINT: undefined }));
check('Incorrect expected fingerprint is refused', invalid({ DATABASE_TARGET_FINGERPRINT: '0'.repeat(64) }));
check('Password rotation does not alter the target fingerprint', getDatabaseTargetIdentity(dbUrl.replace('fixture-secret', 'new-fixture-secret'))?.fingerprint === fingerprint);
check('Password never appears in identity or errors', !JSON.stringify({ identity: getDeploymentIdentity(base), validation: validateStartupConfig(base) }).includes('fixture-secret'));
check('Different database names change fingerprints', getDatabaseTargetIdentity(dbUrl.replace('/postgres?', '/other?'))?.fingerprint !== fingerprint);
check('Query-string host override is refused', getDatabaseTargetIdentity(`${dbUrl}&host=elsewhere`) === null);
check('Query-string user override is refused', getDatabaseTargetIdentity(`${dbUrl}&user=other`) === null);
check('Query-string password override is refused', getDatabaseTargetIdentity(`${dbUrl}&password=other`) === null);
check('URL encoded connection override is refused', getDatabaseTargetIdentity(`${dbUrl}&%68ost=elsewhere`) === null);
check('Malformed percent encoding is refused safely', getDatabaseTargetIdentity(dbUrl.replace('/postgres?', '/%zz?')) === null);
check('Explicit TLS downgrade is refused', invalid({ DATABASE_URL: dbUrl.replace('sslmode=require', 'sslmode=disable') }));
const managedTlsUrl = connectionStringWithManagedTls(`${dbUrl}&application_name=safety-check`);
check('Managing TLS preserves the selected database and other query parameters', new URL(managedTlsUrl).pathname === '/postgres' && new URL(managedTlsUrl).searchParams.get('application_name') === 'safety-check');
check('The actual pg target retains the verified fingerprint', getDatabaseTargetIdentity(managedTlsUrl)?.fingerprint === fingerprint);
check('Staging cannot share parent-domain cookies', invalid({ COOKIE_DOMAIN: '.fugluck.com' }));
check('Staging cannot allow production browser origins', invalid({ ALLOWED_ORIGINS: 'https://www.fugluck.com' }));
check('Staging cannot send account links to production', invalid({ APP_URL: 'https://www.fugluck.com' }));
check('Incorrect service identity is refused', invalid({ RENDER_SERVICE_ID: 'another-service' }));
check('Missing region metadata is refused', invalid({ DATABASE_REGION: undefined }));
check('Missing deployed revision is refused', invalid({ GIT_SHA: undefined }));
check('Truncated deployed revisions are refused', invalid({ GIT_SHA: 'abcdef0' }));
check('Full deployed revisions are preserved', getBuildRevision(base) === base.GIT_SHA);
check('Public health identifies environment and exact revision', getHealthPayload(base).environment === 'staging' && getHealthPayload(base).revision === base.GIT_SHA);
check('Public health excludes database targets and credentials', !JSON.stringify(getHealthPayload(base)).includes(fingerprint) && !JSON.stringify(getHealthPayload(base)).includes('fixture-secret'));
check('All commercial operations default off', Object.values(getCommercialSafety({})).filter(x => typeof x === 'object').every(x => !x.allowed));
for (const [action, key] of Object.entries(COMMERCIAL_SWITCHES)) check(`${action} activation is refused at boot`, invalid({ [key]: 'true' }));
check('Malformed financial flags fail closed', invalid({ REAL_MONEY_ENABLED: 'TRUE' }));
const enabled = Object.fromEntries(Object.values(COMMERCIAL_SWITCHES).map(k => [k, 'true']));
for (const action of ['deposits', 'withdrawals', 'competitions'] as const) {
  check(`${action} can be independently disabled`, commercialGate(action, { ...enabled, [COMMERCIAL_SWITCHES[action]]: 'false' }).reason === 'ACTION_DISABLED');
  check(`${action} cannot be activated before implementation acceptance`, commercialGate(action, enabled).reason === 'COMMERCIAL_IMPLEMENTATION_NOT_ACCEPTED');
}
check('Global money switch blocks all actions', commercialGate('withdrawals', { ...enabled, REAL_MONEY_ENABLED: 'false' }).reason === 'MONEY_DISABLED');
for (const key of ['PAYMENT_PROVIDER_SECRET', 'PAYMENT_WEBHOOK_SECRET', 'PAYOUT_PROVIDER_SECRET']) check(`${key} is forbidden in this release`, invalid({ [key]: 'fixture-only' }));
const expected = expectedMigrations();
const rows = expected.map(m => ({ hash: m.hash, created_at: m.timestamp }));
check('Full canonical migration chain matches', compareMigrationIdentity(rows).status === 'match');
check('Historical Windows migration hashes match exact SQL content', compareMigrationIdentity(expected.map(m => ({ hash: m.windowsHash, created_at: m.timestamp }))).status === 'match');
check('Missing migration is refused', compareMigrationIdentity(rows.slice(0, -1)).status === 'mismatch');
check('Unknown extra migration is refused', compareMigrationIdentity([...rows, { hash: 'x', created_at: 9e12 }]).status === 'mismatch');
check('Tampered historical migration is refused even if the head matches', compareMigrationIdentity(rows.map((m, i) => i === 0 ? { ...m, hash: '0'.repeat(64) } : m)).status === 'mismatch');
check('Duplicate migration metadata is refused', compareMigrationIdentity([...rows, rows[0]]).status === 'mismatch');
check('Wrong journal timestamp is refused', compareMigrationIdentity(rows.map((m, i) => i === 0 ? { ...m, created_at: 1 } : m)).status === 'mismatch');
async function main() {
  const originalEnv = { ...process.env };
  process.env.JWT_SECRET = 'environment-test-secret-with-no-real-world-value';
  process.env.APP_ENV = 'staging';
  process.env.NODE_ENV = 'production';
  delete process.env.COOKIE_DOMAIN;
  const jwt = await import('../packages/server/src/auth/jwt');
  const stagingToken = jwt.signSessionToken({ sub: 'fixture-user' });
  check('Staging token verifies in staging', jwt.verifySessionToken(stagingToken)?.sub === 'fixture-user');
  process.env.APP_ENV = 'production';
  check('Staging token cannot authenticate in production even with a reused key', jwt.verifySessionToken(stagingToken) === null);
  const productionToken = jwt.signSessionToken({ sub: 'fixture-user' });
  process.env.APP_ENV = 'staging';
  check('Production token cannot authenticate in staging even with a reused key', jwt.verifySessionToken(productionToken) === null);
  check('Hosted cookies remain secure and host-only', jwt.getSessionCookieOptions().secure && jwt.getSessionCookieOptions().domain === undefined);
  process.env = originalEnv;
  const refusedBoot = spawnSync(process.execPath, ['--import', 'tsx', 'packages/server/src/index.ts'], { env: { ...process.env, ...base, DATABASE_URL: 'postgresql://fixture:private-fixture@127.0.0.1:1/fugluck_safety_test' }, encoding: 'utf8', timeout: 15000 });
  const bootOutput = `${refusedBoot.stdout}${refusedBoot.stderr}`;
  check('Actual server process refuses an incorrect target before listening', refusedBoot.status !== 0 && bootOutput.includes('Startup configuration validation failed') && !bootOutput.includes('listening on'));
  check('Rejected boot does not leak connection credentials', !bootOutput.includes('private-fixture'));
  check('Unavailable migration metadata is reported explicitly', (await readMigrationIdentity({ query: async () => { throw new Error('fixture'); } })).status === 'unavailable');
  let refused = false;
  try { await enforceMigrationIdentity({ query: async () => ({ rows: rows.slice(1) }) }); } catch { refused = true; }
  check('Startup migration gate throws on incomplete history', refused);
  check('Startup accepts the complete migration history', (await enforceMigrationIdentity({ query: async () => ({ rows }) })).status === 'match');
  const client = { VERCEL: '1', VERCEL_ENV: 'preview', VITE_APP_ENV: 'staging', VITE_API_URL: 'https://api-staging.fugluck.com', VERCEL_GIT_COMMIT_SHA: 'b'.repeat(40) };
  check('Staging client identity is explicit', getClientDeployment(client).environment === 'staging');
  for (const [label, change] of Object.entries({ 'missing environment': { VITE_APP_ENV: undefined }, 'wrong API': { VITE_API_URL: 'https://api.fugluck.com' }, 'production promotion': { VERCEL_ENV: 'production' }, 'unaccepted production': { VITE_APP_ENV: 'production' }, 'missing revision': { VERCEL_GIT_COMMIT_SHA: undefined } })) {
    let rejected = false; try { getClientDeployment({ ...client, ...change }); } catch { rejected = true; }
    check(`Client build rejects ${label}`, rejected);
  }
  const startup = readFileSync('packages/server/src/index.ts', 'utf8');
  check('Hosted migration gate precedes recovery and listening', startup.indexOf('if (isHostedEnvironment()) await enforceMigrationIdentity(pool)') < startup.indexOf('io = attachMatchmaking(httpServer)') && startup.indexOf('io = attachMatchmaking(httpServer)') < startup.indexOf('httpServer.listen(port, host'));
  console.log(`Environment Safety Check: ${passed} PASS, ${failed} FAIL`);
  process.exitCode = failed ? 1 : 0;
}
void main();
