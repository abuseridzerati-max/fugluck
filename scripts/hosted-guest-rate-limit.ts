// Staging-only acceptance. Run after deployment with a fresh 60-second window:
// npx tsx scripts/hosted-guest-rate-limit.ts <full deployed SHA>
// No account, database credential, deposit, competition entry or provider action.
const revision = process.argv[2];
if (!revision || !/^[a-f0-9]{40}$/.test(revision)) throw Error('A full deployed revision is required');
const base = 'https://api-staging.fugluck.com', origin = 'https://staging.fugluck.com';
let passed = 0, failed = 0;
const checks: { name: string, passed: boolean }[] = [];
function check(name: string, ok: boolean) {
  checks.push({ name, passed: ok }); ok ? passed++ : failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  if (!ok) throw Error('HOSTED_GUEST_ACCEPTANCE_FAILED');
}
async function post(headers: Record<string, string> = {}, host = base) {
  return fetch(host + '/api/auth/guest-ticket', { method: 'POST', headers: { Origin: origin, ...headers }, signal: AbortSignal.timeout(55_000) });
}
async function main() {
  const health = await (await fetch(base + '/api/health')).json();
  const front = await (await fetch(origin + '/deployment.json')).json();
  check('frontend/backend match the reviewed staging revision', health.environment === 'staging' && front.environment === 'staging' && health.revision === revision && front.revision === revision);
  check('staging healthy and migrations match', health.ok === true && health.database === 'connected' && health.migrations === 'match');
  check('real money, deposits and withdrawals remain disabled', health.commercial.moneyEnabled === false && health.commercial.deposits.allowed === false && health.commercial.withdrawals.allowed === false);
  // Never reset the server limiter. A full quiet window avoids counting earlier
  // guest issuance from the separate signed-guest ownership acceptance run.
  console.log('Waiting 61 seconds for the guest issuance window to expire.');
  await new Promise(resolve => setTimeout(resolve, 61_000));
  const started = Date.now();
  for (let i = 0; i < 20; i++) {
    const r = await post(i % 2 ? { 'X-Forwarded-For': `198.51.100.${i + 1}` } : {});
    const body = await r.json();
    check(`allowed guest request ${i + 1}`, r.status === 200 && typeof body.token === 'string');
  }
  for (let i = 21; i <= 25; i++) {
    const r = await post();
    check(`guest request ${i} is HTTP 429`, r.status === 429);
    check(`guest request ${i} supplies Retry-After`, Number(r.headers.get('retry-after')) > 0 && Number(r.headers.get('retry-after')) <= 60);
  }
  for (const value of ['198.51.100.251', '10.1.2.3', '172.71.1.1', '::ffff:198.51.100.252', '2001:db8::1', 'bad:123', '10.2.3.4, 198.51.100.253']) {
    check(`XFF spoof cannot bypass: ${value}`, (await post({ 'X-Forwarded-For': value })).status === 429);
  }
  check('Forwarded spoof cannot bypass', (await post({ Forwarded: 'for=198.51.100.254;proto=https' })).status === 429);
  check('X-Real-IP spoof cannot bypass', (await post({ 'X-Real-IP': '198.51.100.254' })).status === 429);
  check('Render hostname shares the same client/endpoint bucket', (await post({ 'X-Forwarded-For': '198.51.100.255' }, 'https://fugluck-api-staging.onrender.com')).status === 429);
  check('burst completes inside the configured one-minute window', Date.now() - started < 60_000);
  // Retry-After is operational: blocked calls do not prolong the rolling window.
  console.log('Waiting 61 seconds to verify legitimate issuance resumes.');
  await new Promise(resolve => setTimeout(resolve, 61_000));
  check('legitimate guest issuance resumes after expiry', (await post()).status === 200);
}
main().catch(error => { if (!failed) failed++; console.error(error.message); process.exitCode = 1; }).finally(() => console.log(JSON.stringify({ revision, passed, failed, checks })));
