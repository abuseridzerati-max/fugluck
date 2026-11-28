// Comprehensive Coins Knockout Tournament verification on isolated disposable schema.
import { tournamentTestDatabase } from './tournament-test-database';
import { randomUUID } from 'node:crypto';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import i18next from 'i18next';
import { I18nextProvider } from 'react-i18next';
import express from 'express';
import cookieParser from 'cookie-parser';
import { createServer } from 'node:http';
import { TOURNAMENT_CAPACITIES } from '@fugluck/shared';
import { pool } from '../packages/server/src/db/client';
import { TournamentService } from '../packages/server/src/competitions/tournamentService';
import { AuthorityStore } from '../packages/server/src/competitions/authorityStore';
import { CoinTournamentAccountingAdapter } from '../packages/server/src/accounting/coinTournamentAdapter';
import { ensureCoinTournamentCatalog, ensureTournamentCatalog, tournamentTx } from '../packages/server/src/competitions/tournamentPersistence';
import { COIN_TOURNAMENT_ENTRY_COINS, freezeCoinTournamentTerms } from '../packages/server/src/competitions/tournamentRules';
import { qualificationView } from '../packages/server/src/competitions/tournamentQualification';
import { readPlayerInstance } from '../packages/server/src/competitions/playerReadModel';
import { competitionsRouter } from '../packages/server/src/routes/competitions';
import { moneyLabel } from '../packages/client/src/lib/competitionPresentation';
import { CompetitionQualification, CompetitionResult, CompetitionRules, CompetitionTerms } from '../packages/client/src/components/CompetitionUI';
import en from '../packages/client/src/locales/en.json';
import ka from '../packages/client/src/locales/ka.json';
import ru from '../packages/client/src/locales/ru.json';

let passes = 0, failures = 0;
let cleanup: (() => Promise<void>) | undefined;
function check(label: string, ok: unknown) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`);
  ok ? passes++ : failures++;
}
async function rejects(label: string, fn: () => Promise<unknown>) {
  try { await fn(); check(label, false); } catch { check(label, true); }
}

const coinAccounting = new CoinTournamentAccountingAdapter(pool);
const service = new TournamentService(undefined, coinAccounting);
let store: AuthorityStore;

async function coinBalance(userId: string): Promise<number> {
  const r = await pool.query("SELECT COALESCE(SUM(amount),0)::int AS coins FROM ledger_entries WHERE user_id=$1 AND currency='COINS'", [userId]);
  return Number(r.rows[0].coins);
}
async function grantCoins(userId: string, amount: number, tag: string) {
  await pool.query("INSERT INTO ledger_entries(id,user_id,currency,amount,reason) VALUES($1,$2,'COINS',$3,$4)", [randomUUID(), userId, amount, `coin_test_grant:${tag}:${userId}`]);
}
async function root(id: string) { return (await pool.query('SELECT * FROM competition_tournaments WHERE instance_id=$1', [id])).rows[0]; }
async function brackets(id: string) { return (await pool.query('SELECT * FROM competition_bracket_matches WHERE instance_id=$1 ORDER BY round,position', [id])).rows; }

async function receiptFixture(id: string, match: any, kind: 'WIN' | 'DRAW' = 'WIN') {
  const run = await store.create(id, 120, 127, match.id);
  await tournamentTx(async c => {
    for (const [i, s] of run.sessions.entries()) {
      await c.query("UPDATE competition_authority_sessions SET status='COMPLETED',terminal_at=now() WHERE id=$1", [s.sessionId]);
      await c.query("INSERT INTO competition_authority_results(id,session_id,score,ticks,reason) VALUES($1,$2,$3,120,'COIN_TEST_RECEIPT')", [randomUUID(), s.sessionId, kind === 'DRAW' ? 10 : i === 0 ? 25 : 10]);
    }
    await c.query("UPDATE competition_authority_runs SET status='COMPLETED',terminal_at=now() WHERE id=$1", [run.id]);
    await c.query("INSERT INTO competition_authority_decisions(run_id,kind,winner_user_id,reason,result_ids) VALUES($1,$2,$3,'COIN_TEST_DECISION','[]')", [run.id, kind, kind === 'WIN' ? run.sessions[0].userId : null]);
  });
  await store.apply(run.id);
  return run;
}

async function finishFixture(id: string) {
  while ((await root(id)).state === 'PLAYING') {
    const ready = (await brackets(id)).filter(b => b.state === 'READY');
    if (!ready.length) throw Error('Coin bracket stalled');
    for (const b of ready) await receiptFixture(id, b, 'WIN');
  }
}

async function main() {
  cleanup = await tournamentTestDatabase();
  store = new AuthorityStore();

  // 1. Rules & 0% rake economics
  for (const cap of TOURNAMENT_CAPACITIES) {
    const t = freezeCoinTournamentTerms(cap);
    check(`coin terms ${cap}p: ${COIN_TOURNAMENT_ENTRY_COINS} entry, ${cap * COIN_TOURNAMENT_ENTRY_COINS} prize, 0% rake, STANDARD`,
      t.product === 'STANDARD' && t.currency === 'COINS' && t.rounding === 'WHOLE_COINS' &&
      t.entryMinor === COIN_TOURNAMENT_ENTRY_COINS && t.prizeMinor === cap * COIN_TOURNAMENT_ENTRY_COINS && t.marginMinor === 0 && t.subsidyMinor === 0 && t.prizeRateBps === 10000);
  }

  // 2. Catalog materialization & concurrency idempotency (strictly 8 Standard, 0 Promo/Gift/cycles)
  const [ids1, ids2] = await Promise.all([ensureCoinTournamentCatalog(), ensureCoinTournamentCatalog()]);
  const coinProducts = (await pool.query("SELECT * FROM competition_products WHERE provenance='COINS'")).rows;
  const cycles = (await pool.query('SELECT count(*)::int AS n FROM competition_special_cycles')).rows[0].n;
  check('coin catalog creates exactly 8 STANDARD templates across 2 games and 4 capacities',
    ids1.length === 8 && ids2.length === 8 && coinProducts.length === 8 &&
    coinProducts.every(p => p.product === 'STANDARD' && p.cycle_id === null));
  check('coin catalog creates zero promotional special cycles', cycles === 0);

  // DB constraint rejects promotional COINS product
  await rejects('DB rejects PROMO product with COINS provenance', async () => {
    await pool.query("INSERT INTO competition_templates(id,game_id,title,format,participant_capacity,currency,entry_fee_minor,rules_version,skill_assessment_version,jurisdiction,enabled) VALUES('tmpl_bad_coin_promo','space-blaster','PROMO','TOURNAMENT_BRACKET',4,'COINS',100,'space-blaster-rv001-v1','knockout-coins-v1','GLOBAL',true)");
    await pool.query("INSERT INTO competition_products(template_id,game_id,product,terms,cycle_id,provenance) VALUES('tmpl_bad_coin_promo','space-blaster','PROMO','{}',NULL,'COINS')");
  });

  // 3. Seed test users
  const users = Array.from({ length: 18 }, (_, i) => `coin_ko_player_${i}`);
  for (const u of users) {
    await pool.query("INSERT INTO users(id,username,password_hash,is_email_verified) VALUES($1,$1::text,'test-only',true)", [u]);
    if (u !== users[17]) await grantCoins(u, 1000, 'initial');
  }
  const sbTemplate = (cap: number) => coinProducts.find(p => p.game_id === 'space-blaster' && p.terms.capacity === cap)!.template_id as string;
  const chTemplate = (cap: number) => coinProducts.find(p => p.game_id === 'cyber-hopper' && p.terms.capacity === cap)!.template_id as string;

  // 4. Insufficient balance, retry, cancel & waiting timeout
  await rejects('insufficient Coins balance rejected on join', () => service.join(sbTemplate(2), users[17]));
  check('rejected join leaves zero coin reservations', (await pool.query('SELECT count(*)::int AS n FROM coin_tournament_reservations WHERE user_id=$1', [users[17]])).rows[0].n === 0);

  await grantCoins(users[17], 500, 'topup');
  const joinedWait = await service.join(sbTemplate(2), users[17]);
  check(`funded Coin join debits ${COIN_TOURNAMENT_ENTRY_COINS} Coin(s) immediately`, (await coinBalance(users[17])) === 500 - COIN_TOURNAMENT_ENTRY_COINS && joinedWait.currency === 'COINS');
  check('coin join writes zero rows to sandbox or commercial GEL tables',
    (await pool.query('SELECT count(*)::int AS n FROM sandbox_entry_reservations')).rows[0].n === 0 &&
    (await pool.query('SELECT count(*)::int AS n FROM commercial_operations')).rows[0].n === 0);

  await service.cancel(joinedWait.instanceId, users[17]);
  check(`leaving waiting Coin room refunds ${COIN_TOURNAMENT_ENTRY_COINS} Coin(s) exactly`, (await coinBalance(users[17])) === 500);
  const cancelledView = await readPlayerInstance(joinedWait.instanceId, users[17]);
  check('cancelled Coin room reports entryReturned=true and currency=COINS',
    cancelledView?.status === 'CANCELLED' && cancelledView.currency === 'COINS' && cancelledView.participants[0].entryReturned === true);

  // Waiting timeout voids & refunds
  const timeoutJoin = await service.join(chTemplate(4), users[17]);
  await service.process(timeoutJoin.instanceId, Date.now() + 200000);
  check('timed-out unfilled Coin room voids and returns Coins',
    (await root(timeoutJoin.instanceId)).state === 'VOIDED' && (await coinBalance(users[17])) === 500);

  // 5. Full 2 / 4 / 8 / 16-player Coin knockout brackets + conservation of Coins
  for (const capacity of TOURNAMENT_CAPACITIES) {
    const entrants = users.slice(0, capacity);
    const beforeSum = (await Promise.all(entrants.map(coinBalance))).reduce((a, b) => a + b, 0);
    const tid = capacity === 4 ? chTemplate(capacity) : sbTemplate(capacity);

    const joins = await Promise.all(entrants.map(u => service.join(tid, u)));
    const instId = joins[0].instanceId;
    check(`${capacity}p Coin bracket fills one shared instance`,
      joins.every(j => j.instanceId === instId) && new Set(joins.map(j => j.seatIndex)).size === capacity && (await root(instId)).state === 'CAPTURING');

    // Duplicate join cannot reserve twice
    await Promise.all([service.join(tid, entrants[0]), service.join(tid, entrants[0])]);
    check(`${capacity}p duplicate Coin join does not double-reserve`,
      (await pool.query('SELECT count(*)::int AS n FROM coin_tournament_reservations WHERE competition_instance_id=$1', [instId])).rows[0].n === capacity);

    await Promise.all([service.process(instId), service.process(instId)]);
    const initial = await brackets(instId);
    check(`${capacity}p Coin bracket creates ${capacity - 1} matches with no byes`,
      initial.length === capacity - 1 && initial.filter(b => b.round === 1).length === capacity / 2);

    // Semifinal/early settlement must fail
    const premature = await coinAccounting.settleCompetition({
      competitionInstanceId: instId,
      winnerUserId: entrants[0],
      prizeCoins: capacity * COIN_TOURNAMENT_ENTRY_COINS,
      idempotencyKey: `premature:${instId}`,
    });
    check(`${capacity}p cannot settle Coin tournament before Final`, !premature.success);

    // Test draw rematch on 4p
    if (capacity === 4) {
      const drawn = await receiptFixture(instId, initial[0], 'DRAW');
      await store.apply(drawn.id);
      check('Coin bracket draw rematches same pair without advancing',
        (await brackets(instId)).find(b => b.id === initial[0].id).state === 'READY');
    }

    await finishFixture(instId);
    const end = await root(instId);
    // Repeated apply is idempotent
    await Promise.all(Array.from({ length: 3 }, () => store.apply(end.final_run_id)));

    const afterSum = (await Promise.all(entrants.map(coinBalance))).reduce((a, b) => a + b, 0);
    const settlementCount = (await pool.query('SELECT count(*)::int AS n FROM coin_tournament_settlements WHERE competition_instance_id=$1', [instId])).rows[0].n;
    check(`${capacity}p Coin tournament settles once with 0% rake (total Coins strictly conserved)`,
      end.state === 'SETTLED' && settlementCount === 1 && afterSum === beforeSum);
    check(`${capacity}p Coin tournament grants zero GEL qualification progress`,
      (await qualificationView(end.winner_user_id, capacity === 4 ? 'cyber-hopper' : 'space-blaster')).promo.progress === 0 &&
      (await qualificationView(end.winner_user_id, capacity === 4 ? 'cyber-hopper' : 'space-blaster')).gift.progress === 0);
  }

  // 6. Active mid-bracket void refunds all captured Coins
  const voidEntrants = users.slice(0, 2);
  const voidBefore = await Promise.all(voidEntrants.map(coinBalance));
  const voidJoins = await Promise.all(voidEntrants.map(u => service.join(sbTemplate(2), u)));
  await service.process(voidJoins[0].instanceId);
  await service.requestVoid(voidJoins[0].instanceId, 'BOTH_DISCONNECTED');
  await service.process(voidJoins[0].instanceId);
  const voidAfter = await Promise.all(voidEntrants.map(coinBalance));
  check('active Coin tournament void refunds 100% of captured Coins to every player',
    (await root(voidJoins[0].instanceId)).state === 'VOIDED' && voidAfter[0] === voidBefore[0] && voidAfter[1] === voidBefore[1]);

  // 7. Zero spillover into GEL tables
  check('entire Coin tournament suite wrote zero rows to sandbox_ledger_entries or commercial_postings',
    (await pool.query('SELECT count(*)::int AS n FROM sandbox_ledger_entries')).rows[0].n === 0 &&
    (await pool.query('SELECT count(*)::int AS n FROM commercial_postings')).rows[0].n === 0);

  // 8. HTTP API separation (COINS vs GEL) + feature flag
  await ensureTournamentCatalog();
  const app = express();
  app.use(cookieParser());
  app.use('/api/competitions', competitionsRouter);
  const server = createServer(app);
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  const port = (server.address() as { port: number }).port;
  const baseUrl = `http://127.0.0.1:${port}/api/competitions`;
  try {
    const coinRes = await (await fetch(`${baseUrl}/templates?currency=COINS`)).json() as any;
    check('GET /templates?currency=COINS returns 8 Coin STANDARD cards with promosEnabled=false',
      coinRes.playerMode === 'coins' && coinRes.joiningAvailable === true && coinRes.templates.length === 8 &&
      coinRes.templates.every((t: any) => t.currency === 'COINS' && t.tournament?.product === 'STANDARD' && t.tournament?.promosEnabled === false));

    const coinFiltered = await (await fetch(`${baseUrl}/templates?currency=COINS&gameId=cyber-hopper`)).json() as any;
    check('GET /templates?currency=COINS&gameId=cyber-hopper returns 4 Cyber Hopper Coin cards',
      coinFiltered.templates.length === 4 && coinFiltered.templates.every((t: any) => t.gameId === 'cyber-hopper'));

    const gelRes = await (await fetch(`${baseUrl}/templates`)).json() as any;
    check('default GET /templates (GEL) never mixes Coin templates into GEL catalog',
      gelRes.playerMode === 'sandbox' && gelRes.templates.every((t: any) => t.currency === 'GEL'));

    process.env.ENABLE_COIN_TOURNAMENTS = 'false';
    const disabledRes = await (await fetch(`${baseUrl}/templates?currency=COINS`)).json() as any;
    check('ENABLE_COIN_TOURNAMENTS=false cleanly closes Coin tournament catalog',
      disabledRes.playerMode === 'coins' && disabledRes.joiningAvailable === false && disabledRes.templates.length === 0);
    await rejects('ENABLE_COIN_TOURNAMENTS=false blocks Coin joins', () => service.join(sbTemplate(2), users[0]));
    delete process.env.ENABLE_COIN_TOURNAMENTS;

    // 9. UI formatting & zero promotional rendering for Coin cards across EN/KA/RU
    check('moneyLabel formats COINS as whole integer without GEL decimals',
      moneyLabel(100, 'COINS') === '100 COINS' && moneyLabel(1600, 'COINS') === '1600 COINS' && moneyLabel(500, 'GEL') === '5.00 GEL');

    const sampleCoinCard = coinRes.templates[0];
    const i18n = i18next.createInstance();
    await i18n.init({ resources: { en: { translation: en }, ka: { translation: ka }, ru: { translation: ru } }, fallbackLng: 'en', interpolation: { escapeValue: false } });
    for (const lang of ['en', 'ka', 'ru']) {
      await i18n.changeLanguage(lang);
      const render = (el: React.ReactNode) => renderToStaticMarkup(React.createElement(I18nextProvider, { i18n }, el));
      const qual = render(React.createElement(CompetitionQualification, { template: sampleCoinCard }));
      check(`${lang} Coin card renders zero Promo/Gift qualification markup`, qual === '');
      const termsHtml = render(React.createElement(CompetitionTerms, { entryMinor: 100, prizeMinor: 1600, currency: 'COINS' }));
      check(`${lang} Coin terms show 100 COINS entry and 1600 COINS prize`, termsHtml.includes('100 COINS') && termsHtml.includes('1600 COINS'));
      const rulesHtml = render(React.createElement(CompetitionRules, { template: sampleCoinCard }));
      check(`${lang} Coin rules link /coins instead of /sandbox-notice`, rulesHtml.includes('href="/coins"') && !rulesHtml.includes('href="/sandbox-notice"'));
      const resHtml = render(React.createElement(CompetitionResult, {
        instance: { ...sampleCoinCard, id: 'c_inst', templateId: sampleCoinCard.id, status: 'SETTLED', currentParticipants: 2, winnerUserId: 'u1', participants: [{ userId: 'u1', score: 25, prizeWonMinor: 200, status: 'SUBMITTED' }, { userId: 'u2', score: 10, prizeWonMinor: 0, status: 'SUBMITTED' }] },
        userId: 'u1',
      }));
      check(`${lang} Coin result displays Coins label and 200 COINS prize`, resHtml.includes(i18n.t('competition.coinsLabel')) && resHtml.includes('200 COINS'));
    }
  } finally {
    await new Promise<void>(r => server.close(() => r()));
  }
}

main()
  .catch(e => { console.error(e); failures++; })
  .finally(async () => {
    await store?.close();
    if (cleanup) await cleanup();
    console.log(`\nCoin tournaments check: ${passes} passed, ${failures} failed`);
    process.exit(failures ? 1 : 0);
  });
