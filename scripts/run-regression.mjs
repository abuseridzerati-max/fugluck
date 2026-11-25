import { spawn } from 'node:child_process';
import { mkdirSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const unreachableDatabase = 'postgresql://unused@127.0.0.1:1/fugluck_application_unreachable';
// A reviewed allowlist is deliberately required for the database-free subset.
// New checks run in the full suite, but cannot silently enter --read-only.
const readOnlyChecks = new Set([
  'admin-console-check.ts', 'admin-security-check.ts', 'authority-presentation-check.ts',
  'canvas-render-check.ts', 'competition-phase1-domain-check.ts', 'competition-socket-session-check.ts',
  'cors-audit-check.ts', 'determinism-check.ts', 'environment-safety-check.ts', 'file-upload-audit-check.ts',
  'game-module-lifecycle-check.ts', 'i18n-check.ts', 'input-validation-check.ts',
  'password-policy-check.ts', 'password-security-check.ts', 'proxy-rate-limit-check.ts',
  'rate-limit-check.ts', 'registration-verification-check.ts', 'regression-runner-check.ts',
  'request-logging-audit-check.ts', 'score-validation-check.ts', 'sql-injection-check.ts',
  'staging-readiness-check.ts', 'test-database-safety-check.ts', 'tournament-rules-check.ts',
  'wallet-friends-check.ts', 'xss-audit-check.ts',
]);

export function discoverChecks(directory = path.join(root, 'scripts')) {
  return readdirSync(directory, { withFileTypes: true })
    .filter(item => item.isFile() && item.name.endsWith('-check.ts')).map(item => item.name).sort();
}

export function localTestDestination(value) {
  let url;
  try { url = new URL(value); } catch { throw Error('An explicit local TEST_DATABASE_URL is required.'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['127.0.0.1', '[::1]', 'localhost'].includes(url.hostname)) {
    throw Error('Regression refuses non-loopback database destinations.');
  }
  // Fail closed on pg routing overrides and unreviewed connection options.
  if ([...url.searchParams.keys()].some(key => !['sslmode', 'application_name', 'connect_timeout'].includes(key))) {
    throw Error('Regression refuses unreviewed database URL options.');
  }
  const database = decodeURIComponent(url.pathname.slice(1));
  if (!/^(?:fugluck|arcadeclash)(?:_[a-z0-9]+)*_test$/.test(database)) throw Error('Regression requires an explicit disposable test database name.');
  return { url, database, port: Number(url.port || 5432) };
}

export function testEnvironment(testDatabaseUrl = 'postgresql://unused@127.0.0.1:1/fugluck_unreachable_test', source = process.env) {
  const env = {};
  for (const [key, value] of Object.entries(source)) {
    if (/^(path|systemroot|windir|temp|tmp|home|userprofile|localappdata|appdata|comspec|pathext|processor_architecture|number_of_processors)$/i.test(key)) env[key] = value;
  }
  return Object.assign(env, {
    APP_ENV: 'test', NODE_ENV: 'test', VITE_APP_ENV: 'test', VITE_API_URL: 'http://127.0.0.1:4000',
    DATABASE_URL: unreachableDatabase, TEST_DATABASE_URL: testDatabaseUrl,
    JWT_SECRET: 'local-regression-only-not-a-hosted-signing-key', EMAIL_PROVIDER: 'logger', RESEND_API_KEY: '', SMTP_HOST: '',
    DOTENV_CONFIG_PATH: path.join(root, 'Temp', 'regression-no-environment-file'),
    APP_URL: 'http://127.0.0.1:5173', PUBLIC_APP_URL: '', CLIENT_ORIGIN: 'http://127.0.0.1:5173', ALLOWED_ORIGINS: 'http://127.0.0.1:5173',
    COOKIE_DOMAIN: '', COOKIE_SAMESITE: 'lax', TRUST_PROXY: 'false', RENDER: '', RENDER_SERVICE_ID: '',
    ENABLE_COMPETITION_AUTHORITY: 'false', ENABLE_KNOCKOUT_TOURNAMENTS: 'false', SANDBOX_COMPETITION_MODE: 'true',
    REAL_MONEY_ENABLED: 'false', REAL_MONEY_DEPOSITS_ENABLED: 'false', REAL_MONEY_WITHDRAWALS_ENABLED: 'false', REAL_MONEY_COMPETITIONS_ENABLED: 'false',
    STAGING_MOCK_COMMERCIAL_ENABLED: 'false', STAGING_MOCK_DEPOSITS_ENABLED: 'false', STAGING_MOCK_WITHDRAWALS_ENABLED: 'false', STAGING_MOCK_COMPETITIONS_ENABLED: 'false',
    STAGING_MOCK_AUTHORIZATION: '', STAGING_MOCK_PROVIDER_KEY: '', STAGING_MOCK_USER_IDS: '',
    PAYMENT_PROVIDER_SECRET: '', PAYMENT_WEBHOOK_SECRET: '', PAYOUT_PROVIDER_SECRET: '',
    ADMIN_USERNAME: 'regression_local_admin', ADMIN_PASSWORD: 'RegressionOnlyPassword1!', NEW_ADMIN_PASSWORD: '',
    PGOPTIONS: '', GIT_OPTIONAL_LOCKS: '0', NO_COLOR: '1',
  });
}

export async function verifyLocalDatabase(value, expectedDirectory) {
  const destination = localTestDestination(value);
  if (!expectedDirectory) throw Error('FUGLUCK_TEST_DATA_DIRECTORY must identify the disposable local PostgreSQL cluster.');
  const expected = realpathSync(expectedDirectory);
  const client = new pg.Client({ connectionString: value, connectionTimeoutMillis: 5000, query_timeout: 5000 });
  try {
    await client.connect();
    const { rows: [actual] } = await client.query("SELECT current_database() AS database, host(inet_server_addr()) AS address, inet_server_port() AS port, current_setting('data_directory') AS data_directory");
    const normalize = p => process.platform === 'win32' ? realpathSync(p).toLowerCase() : realpathSync(p);
    if (!['127.0.0.1', '::1'].includes(actual.address) || actual.port !== destination.port || actual.database !== destination.database || normalize(actual.data_directory) !== normalize(expected)) {
      throw Error('Actual PostgreSQL identity does not match the explicit local test target.');
    }
    return actual;
  } finally { await client.end(); }
}

export function classifyResult(output, exitCode, timedOut = false) {
  const passed = (output.match(/^\s*PASS\s+/gm) ?? []).length;
  const failed = (output.match(/^\s*FAIL\s+/gm) ?? []).length;
  return { passed, failed, exitCode, timedOut, status: !timedOut && exitCode === 0 && passed > 0 && failed === 0 ? 'PASS' : 'FAIL' };
}

export function runCheck(file, env, timeoutMs = 180_000) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, ['--import', 'tsx', file], { cwd: root, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '', timedOut = false;
    child.stdout.on('data', chunk => { output += chunk; });
    child.stderr.on('data', chunk => { output += chunk; });
    const timer = setTimeout(() => {
      timedOut = true;
      if (process.platform === 'win32') {
        // Only this owned test process and its descendants; never a process-name kill.
        spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true, stdio: 'ignore' }).on('error', () => child.kill());
      } else child.kill('SIGKILL');
    }, timeoutMs);
    child.on('error', () => { output += '\nTest process could not start.\n'; });
    child.on('close', code => { clearTimeout(timer); resolve({ ...classifyResult(output, code, timedOut), output }); });
  });
}

export async function main(args = process.argv.slice(2)) {
  if (args.some(arg => arg !== '--read-only')) throw Error('Usage: node scripts/run-regression.mjs [--read-only]');
  const readOnly = args.includes('--read-only');
  const inventory = discoverChecks();
  const selected = inventory.filter(file => !readOnly || readOnlyChecks.has(file));
  const skipped = inventory.filter(file => !selected.includes(file));
  const database = readOnly ? null : await verifyLocalDatabase(process.env.TEST_DATABASE_URL, process.env.FUGLUCK_TEST_DATA_DIRECTORY);
  const env = testEnvironment(readOnly ? undefined : process.env.TEST_DATABASE_URL);
  const outputDirectory = path.join(root, 'Temp', 'regression', new Date().toISOString().replace(/[:.]/g, '-'));
  mkdirSync(outputDirectory, { recursive: true });
  const results = [];
  // Migration setup must precede existing tests that depend on public schema.
  selected.sort((a, b) => Number(b === 'migration-schema-parity-check.ts') - Number(a === 'migration-schema-parity-check.ts') || a.localeCompare(b));
  for (const file of selected) {
    const { output, ...result } = await runCheck(path.join(root, 'scripts', file), env);
    writeFileSync(path.join(outputDirectory, file + '.log'), output);
    results.push({ file, ...result });
    console.log(`${result.status} ${file}: ${result.passed} passed, ${result.failed} failed, exit=${result.exitCode}${result.timedOut ? ', TIMEOUT' : ''}`);
    writeFileSync(path.join(outputDirectory, 'progress.json'), JSON.stringify(results, null, 2));
  }
  const summary = { checkedAt: new Date().toISOString(), mode: readOnly ? 'read-only' : 'isolated-local', database,
    discovered: inventory.length, executed: results.length, skipped, passed: results.reduce((sum, r) => sum + r.passed, 0),
    failed: results.reduce((sum, r) => sum + r.failed, 0), unsuccessfulScripts: results.filter(r => r.status !== 'PASS').length, scripts: results };
  writeFileSync(path.join(outputDirectory, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ ...summary, scripts: undefined, evidence: path.join(outputDirectory, 'summary.json') }));
  if (summary.unsuccessfulScripts) process.exitCode = 1;
  return summary;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => { console.error('Regression refused or interrupted. Verify the explicit loopback TEST_DATABASE_URL and FUGLUCK_TEST_DATA_DIRECTORY; no hosted target is permitted.'); process.exitCode = 1; });
}
