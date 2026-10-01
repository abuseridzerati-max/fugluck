import { createServer, type Server } from 'node:http';
import express from 'express';
import { getTrustProxy, renderProxyTrust, normalizeRateLimitIp } from '../packages/server/src/config/trustedProxy';
import { globalRateLimiter } from '../packages/server/src/utils/rateLimiter';

let passed = 0, failed = 0;
function check(label: string, ok: unknown) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); ok ? passed++ : failed++; }
const chain = (client: string, i = 0) => `${client}, ${i % 2 ? '172.71.144.123' : '162.158.229.130'}, 10.196.${i % 3}.78`;

async function main() {
  check('direct traffic is the default', getTrustProxy({}) === false);
  check('false disables forwarded trust', getTrustProxy({ TRUST_PROXY: 'false' }) === false);
  check('zero does not become one-hop trust', getTrustProxy({ TRUST_PROXY: '0' }) === false);
  check('explicit Render mode requires platform identity', getTrustProxy({ TRUST_PROXY: 'render', RENDER: 'true' }) === renderProxyTrust);
  for (const mode of ['true', '1', '2', '3', 'nonsense', 'render']) {
    let rejected = false; try { getTrustProxy({ TRUST_PROXY: mode }); } catch { rejected = true; }
    check(`unsafe/unverified configuration rejected: ${mode}`, rejected);
  }
  for (const [address, layer, expected] of [
    ['127.0.0.1', 0, true], ['::1', 0, true], ['::ffff:127.0.0.1', 0, true],
    ['203.0.113.1', 0, false], ['10.196.1.78', 1, true], ['::ffff:10.196.2.78', 1, true],
    ['203.0.113.1', 1, false], ['172.71.144.123', 2, true], ['162.158.229.130', 2, true],
    ['2606:4700::1', 2, true], ['203.0.113.1', 2, false], ['10.1.1.1', 2, false],
    ['162.158.229.130', 3, false], ['10.196.1.78', 3, false], ['invalid', 1, false],
  ] as const) check(`proxy role ${layer}: ${address}`, renderProxyTrust(address, layer) === expected);
  check('mapped IPv4 shares its IPv4 bucket', normalizeRateLimitIp('::ffff:203.0.113.1') === normalizeRateLimitIp('203.0.113.1'));
  check('hex mapped IPv4 shares its IPv4 bucket', normalizeRateLimitIp('::ffff:cb00:7101') === '203.0.113.1');
  check('equivalent IPv6 spellings share a bucket', normalizeRateLimitIp('2001:0DB8:0001:0002:0000:0000:0000:0003') === normalizeRateLimitIp('2001:db8:1:2::3'));
  check('IPv6 interface rotation shares a /64 bucket', normalizeRateLimitIp('2001:db8:1:2::4') === normalizeRateLimitIp('2001:db8:1:2::ffff'));
  check('different IPv6 /64s stay independent', normalizeRateLimitIp('2001:db8:1:3::4') !== normalizeRateLimitIp('2001:db8:1:2::4'));
  for (const invalid of [undefined, 'invalid', '203.0.113.1:1234', '1.2.3.4, 5.6.7.8']) check('invalid IP is fail-closed: ' + invalid, normalizeRateLimitIp(invalid) === 'unknown');

  // Exercise the actual guest router/limiter; no database connection or writes.
  process.env.APP_ENV = 'test'; process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'postgresql://unused@127.0.0.1:1/proxy_test_unreachable';
  process.env.JWT_SECRET = 'ProxyRegressionLocalOnly-LongTestSecret';
  const { authRouter } = await import('../packages/server/src/routes/auth');
  const { pool } = await import('../packages/server/src/db/client');
  const servers: Server[] = [];
  async function serve(trust: ReturnType<typeof getTrustProxy>) {
    const app = express(); app.set('trust proxy', trust);
    app.use(express.json()); app.use('/api/auth', authRouter);
    app.get('/identity', (req, res) => res.json({ ip: req.ip, protocol: req.protocol }));
    const server = createServer(app); servers.push(server);
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    return `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  }
  try {
    const base = await serve(getTrustProxy({ TRUST_PROXY: 'render', RENDER: 'true' }));
    const post = (headers: Record<string, string>) => fetch(base + '/api/auth/guest-ticket', { method: 'POST', headers });
    for (let i = 0; i < 20; i++) {
      const r = await post({ 'x-forwarded-for': chain('203.0.113.7', i) });
      const body = await r.json() as { token?: string };
      check(`real guest endpoint allows request ${i + 1} with rotating proxy chain`, r.status === 200 && !!body.token);
    }
    const over = await post({ 'x-forwarded-for': chain('203.0.113.7', 20) });
    check('real guest endpoint rejects request 21 with 429', over.status === 429);
    check('rate rejection supplies bounded Retry-After', Number(over.headers.get('retry-after')) > 0 && Number(over.headers.get('retry-after')) <= 60);
    for (const prefix of ['198.51.100.99', '10.1.2.3', '172.71.1.1', '::ffff:198.51.100.99', 'bad:123', '1.2.3.4, 5.6.7.8']) {
      check(`caller XFF prefix cannot bypass: ${prefix}`, (await post({ 'x-forwarded-for': `${prefix}, ${chain('203.0.113.7', 23)}` })).status === 429);
    }
    for (const header of ['forwarded', 'cf-connecting-ip', 'x-real-ip']) check(`${header} cannot bypass`, (await post({ 'x-forwarded-for': chain('203.0.113.7'), [header]: 'for=198.51.100.50' })).status === 429);
    check('a different public client remains allowed', (await post({ 'x-forwarded-for': chain('203.0.113.8') })).status === 200);
    let ipv6Allowed = true;
    for (let i = 0; i < 20; i++) ipv6Allowed &&= (await post({ 'x-forwarded-for': chain(`2001:db8:1:2::${i + 1}`) })).status === 200;
    check('first 20 IPv6 requests allowed', ipv6Allowed);
    check('IPv6 spelling/interface changes cannot bypass request 21', (await post({ 'x-forwarded-for': chain('2001:0DB8:0001:0002::FFFF') })).status === 429);
    for (const client of ['203.0.113.9', '10.1.1.1', '172.71.1.1', '2606:4700::99']) {
      const r = await fetch(base + '/identity', { headers: { 'x-forwarded-for': `198.51.100.77, ${chain(client)}`, 'forwarded': 'for=198.51.100.77', 'x-forwarded-proto': 'https' } });
      const body = await r.json() as { ip: string, protocol: string };
      check(`client is never skipped even inside a trusted range: ${client}`, body.ip === client);
      check(`legitimate proxy HTTPS metadata preserved: ${client}`, body.protocol === 'https');
    }
    const short = await (await fetch(base + '/identity', { headers: { 'x-forwarded-for': '198.51.100.77, 203.0.113.10' } })).json() as { ip: string };
    check('shorter unexpected chain stops at untrusted address', short.ip === '203.0.113.10');
    const direct = await serve(false);
    const directIdentity = await (await fetch(direct + '/identity', { headers: { 'x-forwarded-for': chain('198.51.100.77'), 'forwarded': 'for=198.51.100.77' } })).json() as { ip: string };
    check('direct mode ignores all forwarded identities', directIdentity.ip === '127.0.0.1');
    let directAllowed = true;
    for (let i = 0; i < 20; i++) directAllowed &&= (await fetch(direct + '/api/auth/guest-ticket', { method: 'POST', headers: { 'x-forwarded-for': `198.51.100.${i}` } })).status === 200;
    check('direct mode permits the configured first 20 requests', directAllowed);
    check('direct caller cannot rotate XFF for request 21', (await fetch(direct + '/api/auth/guest-ticket', { method: 'POST', headers: { 'x-forwarded-for': '198.51.100.250' } })).status === 429);
    const now = Date.now; const key = 'proxy-regression-window';
    try {
      Date.now = () => 1_000_000; globalRateLimiter.resetKey(key);
      for (let i = 0; i < 20; i++) globalRateLimiter.checkRateLimit(key, 20, 60_000);
      Date.now = () => 1_059_999;
      check('counter remains blocked until the window expires', !globalRateLimiter.checkRateLimit(key, 20, 60_000).allowed);
      Date.now = () => 1_060_000;
      check('legitimate requests resume after window expiry', globalRateLimiter.checkRateLimit(key, 20, 60_000).allowed);
    } finally { Date.now = now; globalRateLimiter.resetKey(key); }
  } finally {
    for (const server of servers) await new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
    await pool.end();
  }
}
main().catch(err => { failed++; console.error(err); }).finally(() => { console.log(`Proxy/rate-limit checks: ${passed} passed, ${failed} failed`); process.exitCode = failed ? 1 : 0; });
