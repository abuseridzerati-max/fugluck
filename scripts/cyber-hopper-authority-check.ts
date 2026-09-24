import './require-disposable-test-database.ts';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { io as connect, type Socket } from 'socket.io-client';
import { CyberHopperEngine } from '../games/cyber-hopper/engine';
import { CELL_HEIGHT, CELL_WIDTH, GRID_COLS, GRID_ROWS, VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from '../games/cyber-hopper/constants';
import { LiveControls } from '../packages/server/src/competitions/authorityRuntime';
import { AuthorityStore } from '../packages/server/src/competitions/authorityStore';
import { attachMatchmaking } from '../packages/server/src/matchmaking';
import { pool } from '../packages/server/src/db/client';
import { signSessionToken } from '../packages/server/src/auth/jwt';
import { templateService, lifecycleEngine } from '../packages/server/src/competitions';
import { SandboxAccountingAdapter } from '../packages/server/src/accounting/sandboxAdapter';
import { CYBER_HOPPER_AUTHORITY_VERSION, type AuthorityBinding, type AuthorityControls, type AuthoritySnapshot } from '@fugluck/shared';

let passes = 0, failures = 0;
function check(label: string, ok: unknown) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`);
  ok ? passes++ : failures++;
}
function rejects(label: string, fn: () => unknown) {
  try { fn(); check(label, false); } catch { check(label, true); }
}
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
function once(socket: Socket, event: string, timeout = 45000): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(Error(`Timeout: ${event}`));
    }, timeout);
    function handler(p: any) {
      clearTimeout(timer);
      resolve(p);
    }
    socket.once(event, handler);
  });
}
async function until(fn: () => boolean | Promise<boolean>, timeout = 10000) {
  const end = Date.now() + timeout;
  while (!(await fn())) {
    if (Date.now() > end) throw Error('condition timeout');
    await sleep(20);
  }
}

const prefix = `ch_auth_${Date.now()}`;
const users = [0, 1, 2].map(i => `${prefix}_${i}`);
const adapter = new SandboxAccountingAdapter();
const sockets: Socket[] = [];
let server: ReturnType<typeof createServer> | undefined;

async function runBenchmark(sessionCount: number, durationSec = 3) {
  const engines = Array.from({ length: sessionCount }, (_, i) => new CyberHopperEngine(i + 1));
  engines.forEach(e => e.resize(VIRTUAL_WIDTH, VIRTUAL_HEIGHT));
  let ticks = 0, cost = 0, max = 0, bytes = 0, snaps = 0;
  const targetTicks = durationSec * 60;
  const cpu = process.cpuUsage(), began = performance.now();

  await new Promise<void>(resolve => {
    const timer = setInterval(() => {
      const elapsed = performance.now() - began;
      while (ticks < Math.floor((elapsed * 60) / 1000) && ticks < targetTicks) {
        const t = performance.now();
        for (const engine of engines) {
          const hop = ticks % 60 === 0 ? { hopUp: true } : {};
          engine.update(1 / 60, hop);
        }
        const dt = performance.now() - t;
        cost += dt;
        max = Math.max(max, dt);
        ticks++;
        if (ticks % 3 === 0) {
          for (const engine of engines) {
            const snap: AuthoritySnapshot = {
              sessionId: 'bench',
              epoch: 1,
              createdAt: Date.now(),
              emittedAt: Date.now(),
              seq: ticks,
              serverTime: Date.now(),
              startAt: Date.now() - elapsed,
              deadline: Date.now() - elapsed + 180000,
              state: engine.gameOver ? 'COMPLETED' : 'ACTIVE',
              tickCount: engine.tickCount,
              score: engine.score,
              gameOver: engine.gameOver,
              gridX: engine.gridX,
              gridY: engine.gridY,
              roundsCompleted: engine.roundsCompleted,
              obstacles: engine.obstacles
                .filter(o => o.active && o.x >= -o.width && o.x <= VIRTUAL_WIDTH + o.width)
                .map(o => ({
                  id: o.id,
                  x: Math.round(o.x),
                  y: Math.round(o.y),
                  width: o.width,
                  height: Math.round(o.height),
                  direction: o.direction,
                  color: o.color,
                  active: true,
                })),
            };
            bytes += Buffer.byteLength(JSON.stringify(snap));
            snaps++;
          }
        }
      }
      if (ticks >= targetTicks) {
        clearInterval(timer);
        resolve();
      }
    }, 4);
  });

  const seconds = (performance.now() - began) / 1000;
  const used = process.cpuUsage(cpu);
  const metrics = {
    sessions: sessionCount,
    seconds,
    tickHz: ticks / seconds,
    averageBatchTickMs: cost / ticks,
    maxBatchTickMs: max,
    averageSessionTickMs: cost / ticks / sessionCount,
    snapshotHzPerSession: snaps / seconds / sessionCount,
    averageSnapshotPayloadBytes: bytes / snaps,
    outboundBytesPerSecondPerSession: bytes / seconds / sessionCount,
    processCpuMs: (used.user + used.system) / 1000,
  };
  console.log(`BENCHMARK ${sessionCount}-session: ${JSON.stringify(metrics)}`);
  return metrics;
}

async function main() {
  // 1. Engine Invariant Tests
  const engine = new CyberHopperEngine(42);
  engine.resize(VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
  check('initial frog at center row 0', engine.gridX === Math.floor(GRID_COLS / 2) && engine.gridY === 0);
  engine.update(1 / 60, { hopUp: true });
  check('hopUp advances gridY and awards 10', engine.gridY === 1 && engine.score === 10);
  engine.update(1 / 60, { hopLeft: true });
  check('hopLeft updates gridX', engine.gridX === Math.floor(GRID_COLS / 2) - 1);
  engine.update(1 / 60, { hopDown: true });
  check('hopDown reduces gridY without double awarding score', engine.gridY === 0 && engine.score === 10);

  // Jump to row 10 (goal)
  for (let r = engine.gridY; r < GRID_ROWS - 1; r++) {
    engine.update(1 / 60, { hopUp: true });
  }
  check('top row goal awards 150 bonus and round increment', engine.roundsCompleted === 1 && engine.gridY === 0 && engine.score === (GRID_ROWS - 1) * 10 + 150);

  // Determinism check
  const e1 = new CyberHopperEngine(99), e2 = new CyberHopperEngine(99);
  for (let i = 0; i < 180; i++) {
    e1.update(1 / 60, {});
    e2.update(1 / 60, {});
  }
  check('seeded hazard determinism across ticks', JSON.stringify(e1.obstacles) === JSON.stringify(e2.obstacles));

  // Collision check
  const victim = new CyberHopperEngine(101);
  victim.resize(VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
  victim.gridX = 10;
  victim.gridY = 1;
  const laneY = VIRTUAL_HEIGHT - 1.5 * CELL_HEIGHT;
  victim.obstacles = [{
    id: 999,
    laneIndex: 1,
    x: (victim.gridX + 0.5) * CELL_WIDTH,
    y: laneY,
    width: 60,
    height: 30,
    speed: 100,
    direction: 1,
    color: '#ff0055',
    active: true,
  }];
  const collisionResult = victim.update(1 / 60, {});
  check('car collision is server-determined and ends game', collisionResult === 'collision' && victim.gameOver);

  // 2. LiveControls Checks
  const controls = new LiveControls();
  const times = new Map([[1, 1000]]);
  const p = { seq: 1, snapshot: 1, hopUp: true } as AuthorityControls;
  controls.accept(p, 1000, times, 'cyber-hopper');
  check('valid hop accepted by controls', controls.take(1000, 'cyber-hopper').hopUp);
  check('hop pulse consumed once (discrete semantics)', !controls.take(1000, 'cyber-hopper').hopUp);

  rejects('duplicate input rejected', () => controls.accept(p, 1000, times, 'cyber-hopper'));
  rejects('out of order input rejected', () => controls.accept({ ...p, seq: 0 }, 1000, times, 'cyber-hopper'));
  rejects('stale input rejected', () => controls.accept({ ...p, seq: 2 }, 1600, times, 'cyber-hopper'));
  rejects('malformed controls rejected', () => controls.accept({ ...p, seq: 2, hopUp: 'not_a_boolean' as any }, 1000, times, 'cyber-hopper'));

  for (let i = 2; i <= 12; i++) controls.accept({ ...p, seq: i }, 1000, times, 'cyber-hopper');
  rejects('excessive input rate handled', () => controls.accept({ ...p, seq: 13 }, 1000, times, 'cyber-hopper'));
  const idleControls = new LiveControls();
  idleControls.accept({ ...p, seq: 1, hopRight: true }, 1000, times, 'cyber-hopper');
  check('idle controls neutral after 250ms', !idleControls.take(1251, 'cyber-hopper').hopRight);

  // 3. Multi-Session Feasibility / Performance Benchmark (1, 10, 20 sessions)
  const bench1 = await runBenchmark(1, 2);
  check('1-session simulation tick near 60Hz', bench1.tickHz >= 58 && bench1.tickHz <= 62);
  const bench10 = await runBenchmark(10, 2);
  check('10-session simulation tick near 60Hz', bench10.tickHz >= 58 && bench10.tickHz <= 62);
  const bench20 = await runBenchmark(20, 3);
  check('20-session live feasibility below 250ms lag budget', bench20.maxBatchTickMs < 250 && bench20.tickHz >= 58);
  check('snapshot payload under 2.5KB', bench20.averageSnapshotPayloadBytes < 2500);

  // 4. Real Socket & Matchmaking Authority Lifecycle
  process.env.ENABLE_COMPETITION_AUTHORITY = 'true';
  for (const id of users) {
    await pool.query(`INSERT INTO users(id,username,password_hash,role,is_email_verified) VALUES($1,$2,'test-only','user',true)`, [id, id]);
    await adapter.grantSandboxTestFunds(id, 10000);
  }

  const template = await templateService.createTemplate({
    id: `${prefix}_template`,
    gameId: 'cyber-hopper',
    title: 'Cyber Hopper Authority Test',
    format: 'HEAD_TO_HEAD',
    participantCapacity: 2,
    currency: 'GEL',
    entryFeeMinor: 500,
    prizes: [{ placement: 1, amountMinor: 900 }],
    rulesVersion: CYBER_HOPPER_AUTHORITY_VERSION,
    skillAssessmentVersion: 'v1',
    enabled: true,
    isSandbox: true,
  });

  server = createServer();
  attachMatchmaking(server, {
    authorityOptions: { capTicks: 120, countdownMs: 3000, readyMs: 15000, reconnectMs: 1000, seedFactory: () => 314 },
  });
  await new Promise<void>(r => server!.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${(server.address() as any).port}`;

  const hopping = new Set<string>();
  async function createSocket(user: string) {
    const s = connect(url, { auth: { token: signSessionToken({ sub: user }) }, transports: ['websocket'], autoConnect: false, reconnection: false });
    sockets.push(s);
    s.on('authority:probe', ack => ack());
    let current: AuthorityBinding | undefined, last: AuthoritySnapshot | undefined, sequence = 0;
    s.on('authority:session', p => { current = p; sequence = 0; });
    s.on('authority:snapshot', p => { last = p; });
    const heartbeat = setInterval(() => {
      if (s.connected && current && last?.state === 'ACTIVE' && last.startAt !== null && last.serverTime > last.startAt) {
        const doHop = hopping.has(user);
        s.volatile.emit('authority:controls', {
          ...current,
          seq: ++sequence,
          snapshot: last.seq,
          hopUp: doHop,
          hopDown: false,
          hopLeft: false,
          hopRight: false,
        });
      }
    }, 100);
    s.on('disconnect', () => clearInterval(heartbeat));
    s.on('authority:outcome', () => { last = undefined; current = undefined; });
    const ready = once(s, 'connect');
    s.connect();
    await ready;
    return s;
  }

  let s1 = await createSocket(users[0]), s2 = await createSocket(users[1]);
  const outsider = await createSocket(users[2]);

  async function pair() {
    const bp1 = once(s1, 'authority:session'), bp2 = once(s2, 'authority:session');
    let joined = once(s1, 'competition:joined');
    s1.emit('competition:join', { templateId: template.id });
    const j = await joined;
    joined = once(s2, 'competition:joined');
    s2.emit('competition:join', { templateId: template.id });
    await joined;
    return { b1: (await bp1) as AuthorityBinding, b2: (await bp2) as AuthorityBinding, instance: j.instanceId };
  }

  async function expectError(s: Socket, event: string, payload: any, label: string, expected: string) {
    const response = once(s, 'authority:error');
    s.emit(event, payload);
    check(label, (await response).code === expected);
  }

  // Trial 1: Binding security, reconnect, tie at cap
  let pair1 = await pair();
  check('binding has cyber-hopper gameId', pair1.b1.gameId === 'cyber-hopper');
  check('binding has cyber-hopper rulesVersion', pair1.b1.version === CYBER_HOPPER_AUTHORITY_VERSION);

  await expectError(s1, 'authority:ready', { ...pair1.b1, sessionId: 'wrong' }, 'wrong authority session rejected', 'SESSION_OWNERSHIP');
  await expectError(s1, 'authority:ready', { ...pair1.b1, version: 'wrong' }, 'wrong version rejected', 'SESSION_BINDING');
  await expectError(outsider, 'authority:ready', pair1.b1, 'wrong user rejected', 'SESSION_OWNERSHIP');

  // Reconnect
  const replacement = await createSocket(users[0]);
  const nextSession = once(replacement, 'authority:session');
  replacement.emit('authority:resume', { instanceId: pair1.instance });
  const newBinding = await nextSession;
  await expectError(s1, 'authority:ready', pair1.b1, 'old controller fenced', 'SESSION_OWNERSHIP');
  s1.disconnect();
  s1 = replacement;
  check('reconnect preserves authority and rotates epoch', newBinding.epoch > pair1.b1.epoch && newBinding.nonce !== pair1.b1.nonce);
  pair1.b1 = newBinding;

  const snapshotsP1: AuthoritySnapshot[] = [];
  let snap1: AuthoritySnapshot | undefined;
  s1.on('authority:snapshot', p => { snap1 = p; if (p.sessionId === pair1.b1.sessionId) snapshotsP1.push(p); });
  const out1 = once(s1, 'authority:outcome');
  s1.emit('authority:ready', pair1.b1);
  s2.emit('authority:ready', pair1.b2);

  await until(() => snap1?.state === 'ACTIVE' && snap1.serverTime > snap1.startAt!, 15000);

  // Adversarial input attempts
  await expectError(s1, 'authority:controls', { ...pair1.b1, seq: 1, snapshot: snap1!.seq, score: 999999, winnerUserId: users[0] }, 'client cannot submit arbitrary score or winner', 'INPUT_SHAPE');
  await expectError(s1, 'authority:controls', { ...pair1.b1, seq: 1, snapshot: snap1!.seq, left: true, fire: true }, 'Space Blaster controls rejected on Cyber Hopper', 'INPUT_SHAPE');

  let blockedLegacy = false;
  try {
    await lifecycleEngine.submitScore({ instanceId: pair1.instance, userId: users[0], score: 999999, durationMs: 1, inputLog: [], viewport: { width: 1280, height: 720 } });
  } catch (e: any) {
    blockedLegacy = e.code === 'LIVE_AUTHORITY_REQUIRED';
  }
  check('client cannot submit arbitrary score via legacy service', blockedLegacy);

  const outcome1 = await out1;
  check('timeout/deadline handled with equal score void/refund', outcome1.status === 'VOIDED' && outcome1.winnerUserId === null);
  check('snapshot exposed gridX and active obstacles', snapshotsP1.some(p => p.gridX !== undefined && Array.isArray(p.obstacles)));

  const run1 = (await pool.query('SELECT * FROM competition_authority_runs WHERE instance_id=$1', [pair1.instance])).rows[0];
  const store = new AuthorityStore();
  await Promise.all([store.apply(run1.id), store.apply(run1.id)]);
  check('duplicate completion cannot double settle', (await pool.query('SELECT count(*)::int n FROM sandbox_settlements WHERE competition_instance_id=$1', [pair1.instance])).rows[0].n === 1);
  check('reconciliation remains zero after tie refund', (await adapter.reconcileCompetitionInstance(pair1.instance)).discrepancyMinor === 0);

  // Trial 2: Natural server-earned win via hops
  hopping.add(users[0]); // User 0 hops forward and scores points; User 1 stays idle at row 0
  const pair2 = await pair();
  const out2 = once(s1, 'authority:outcome');
  snap1 = undefined;
  s1.emit('authority:ready', pair2.b1);
  s2.emit('authority:ready', pair2.b2);
  const earnedOutcome = await out2;
  hopping.delete(users[0]);

  check('score increments and goal awards are server-determined', earnedOutcome.status === 'SETTLED' && earnedOutcome.winnerUserId === users[0] && earnedOutcome.yourScore >= 10);
  check('settlement exactly once for natural winner', (await pool.query('SELECT count(*)::int n FROM sandbox_settlements WHERE competition_instance_id=$1', [pair2.instance])).rows[0].n === 1);
  const settlement2 = (await pool.query('SELECT * FROM sandbox_settlements WHERE competition_instance_id=$1', [pair2.instance])).rows[0];
  check('predetermined prize 900 and platform margin 100', settlement2.total_prizes_awarded_minor === 900 && settlement2.platform_margin_minor === 100);
  check('reconciliation remains zero after winner settlement', (await adapter.reconcileCompetitionInstance(pair2.instance)).discrepancyMinor === 0);

  const parts2 = (await pool.query('SELECT user_id, status, rank, prize_won_minor FROM competition_participants WHERE instance_id=$1', [pair2.instance])).rows;
  const p1Part = parts2.find(p => p.user_id === users[0]), p2Part = parts2.find(p => p.user_id === users[1]);
  check('terminal participant states: winner SUBMITTED rank 1, loser SUBMITTED rank 2', p1Part?.status === 'SUBMITTED' && p1Part?.rank === 1 && p2Part?.status === 'SUBMITTED' && p2Part?.rank === 2);

  // Trial 3: Explicit forfeit settles opponent
  const pair3 = await pair();
  const out3 = once(s1, 'authority:outcome');
  snap1 = undefined;
  s1.emit('authority:ready', pair3.b1);
  s2.emit('authority:ready', pair3.b2);
  await until(() => snap1?.state === 'ACTIVE' && snap1.serverTime > snap1.startAt!, 15000);
  s2.emit('authority:forfeit', pair3.b2);
  const forfeitOutcome = await out3;
  check('player forfeit settles opponent', forfeitOutcome.status === 'SETTLED' && forfeitOutcome.winnerUserId === users[0]);
  const parts3 = (await pool.query('SELECT user_id, status, rank FROM competition_participants WHERE instance_id=$1', [pair3.instance])).rows;
  check('forfeit terminal participant states: opponent SUBMITTED, forfeiter FORFEITED', parts3.some(p => p.user_id === users[0] && p.status === 'SUBMITTED') && parts3.some(p => p.user_id === users[1] && p.status === 'FORFEITED'));

  // Trial 4: System failure / both disconnected voids safely without unjustified winner
  const pair4 = await pair();
  snap1 = undefined;
  s1.emit('authority:ready', pair4.b1);
  s2.emit('authority:ready', pair4.b2);
  await until(() => snap1?.state === 'ACTIVE' && snap1.serverTime > snap1.startAt!, 15000);
  s1.disconnect();
  s2.disconnect();
  await until(async () => {
    const row = (await pool.query('SELECT status FROM competition_instances WHERE id=$1', [pair4.instance])).rows[0];
    return row?.status === 'VOIDED';
  }, 15000);
  const run4 = (await pool.query('SELECT status FROM competition_authority_runs WHERE instance_id=$1', [pair4.instance])).rows[0];
  check('system failure does not create unjustified winner', run4.status === 'VOIDED');
  check('both-disconnect settlement reconciliation remains zero', (await adapter.reconcileCompetitionInstance(pair4.instance)).discrepancyMinor === 0);

  // Teardown
  for (const s of sockets) { if (s.connected) s.disconnect(); }
  if (server) await new Promise<void>(r => server!.close(() => r()));
  await pool.end();

  console.log(`\nCYBER HOPPER AUTHORITY CHECK: ${passes} passed, ${failures} failed`);
  process.exitCode = failures ? 1 : 0;
}

main().catch(e => {
  console.error('CYBER HOPPER CHECK CRASHED:', e);
  process.exitCode = 1;
});
