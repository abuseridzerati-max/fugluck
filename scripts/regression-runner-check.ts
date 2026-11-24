import { mkdtempSync, writeFileSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { classifyResult, discoverChecks, localTestDestination, runCheck, testEnvironment } from './run-regression.mjs';

let passed = 0, failed = 0;
function check(name: string, ok: boolean) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); ok ? passed++ : failed++; }
async function main() {
  const directory = mkdtempSync(path.join(tmpdir(), 'fugluck-runner-test-'));
  try {
    writeFileSync(path.join(directory, 'b-check.ts'), ''); writeFileSync(path.join(directory, 'a-check.ts'), '');
    writeFileSync(path.join(directory, 'seed-admin.ts'), '');
    check('discovery includes every check in stable order and excludes operational helpers', discoverChecks(directory).join(',') === 'a-check.ts,b-check.ts');
    check('zero assertions cannot be reported as passing', classifyResult('', 0).status === 'FAIL');
    check('printed failure cannot be masked by exit zero', classifyResult('PASS first\nFAIL second\n', 0).status === 'FAIL');
    check('nonzero exit cannot be masked by passing assertions', classifyResult('PASS first\n', 1).status === 'FAIL');
    check('timeout cannot pass', classifyResult('PASS first\n', 0, true).status === 'FAIL');
    check('normal result counts exact assertion lines', classifyResult('PASS first\n  PASS second\n2 PASS, 0 FAIL\n', 0).passed === 2);
    for (const url of ['postgresql://db.example.com/fugluck_test', 'postgresql://127.0.0.1/fugluck', 'postgresql://127.0.0.1/fugluck_test?host=db.example.com', 'postgresql://127.0.0.1/fugluck_test?database=production']) {
      let refused = false; try { localTestDestination(url); } catch { refused = true; }
      check('unsafe database destination/options refused', refused);
    }
    check('explicit local test destination accepted structurally', localTestDestination('postgresql://127.0.0.1:55439/fugluck_local_test').port === 55439);
    const env = testEnvironment(undefined, { ...process.env, NODE_OPTIONS: '--inspect', RESEND_API_KEY: 'hosted-secret', DATABASE_URL: 'postgresql://hosted/production', REAL_MONEY_ENABLED: 'true' });
    check('child environment cannot inherit hosted DB, email credentials or Node injection', !env.DATABASE_URL.includes('hosted') && env.RESEND_API_KEY === '' && !('NODE_OPTIONS' in env));
    check('child money gates remain disabled', env.REAL_MONEY_ENABLED === 'false' && env.REAL_MONEY_WITHDRAWALS_ENABLED === 'false');
    const fixture = path.join(directory, 'fixture.ts');
    writeFileSync(fixture, "console.log('FAIL intentional fixture');");
    check('real child failure is preserved with exit zero', (await runCheck(fixture, env)).status === 'FAIL');
    writeFileSync(fixture, "console.log('PASS subsequent fixture');");
    check('a subsequent child still executes after failure', (await runCheck(fixture, env)).status === 'PASS');
    writeFileSync(fixture, 'setInterval(()=>{},1000);');
    check('hung child is bounded by watchdog', (await runCheck(fixture, env, 1500)).timedOut);
  } finally {
    const actual = realpathSync(directory);
    if (path.dirname(actual) !== realpathSync(tmpdir()) || !path.basename(actual).startsWith('fugluck-runner-test-')) {
      throw Error('Refusing cleanup outside the owned temporary fixture');
    }
    rmSync(actual, { recursive: true });
  }
  console.log(`Regression runner: ${passed} PASS, ${failed} FAIL`);
  if (failed) process.exitCode = 1;
}
main().catch(() => { console.error('FAIL regression runner fixture'); process.exitCode = 1; });
