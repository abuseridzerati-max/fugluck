// Isolated failure/recovery fixtures. Live game acceptance is tournament-authority-check.ts.
import { tournamentTestDatabase } from './tournament-test-database';
import { randomUUID } from 'node:crypto';
import { pool } from '../packages/server/src/db/client';
import { SandboxAccountingAdapter } from '../packages/server/src/accounting/sandboxAdapter';
import { TournamentService } from '../packages/server/src/competitions/tournamentService';
import { AuthorityStore } from '../packages/server/src/competitions/authorityStore';
import { defaultTournamentConfig } from '../packages/server/src/competitions/tournamentRules';
import { ensureTournamentCatalog, saveTournamentConfig, readProduct, tournamentTx } from '../packages/server/src/competitions/tournamentPersistence';
import { replaceTournamentTickets, qualificationView } from '../packages/server/src/competitions/tournamentQualification';
import { readPlayerInstance, readTournamentCatalog } from '../packages/server/src/competitions/playerReadModel';
import { templateService } from '../packages/server/src/competitions/templateService';
import type { CaptureEntryParams, ReserveEntryParams, SettleCompetitionParams } from '../packages/server/src/accounting/port';
import express from 'express';
import cookieParser from 'cookie-parser';
import { createServer } from 'node:http';
import { stagingMockCommercialRouter } from '../packages/server/src/routes/stagingMockCommercial';
import { getDatabaseTargetIdentity } from '../packages/server/src/config/deploymentIdentity';
import { signSessionToken, SESSION_COOKIE_NAME } from '../packages/server/src/auth/jwt';

let passed=0,failed=0,cleanup:(()=>Promise<void>)|undefined,authority:AuthorityStore;
const check=(name:string,ok:unknown)=>{console.log((ok?'PASS ':'FAIL ')+name);ok?passed++:failed++;};
async function rejects(name:string,fn:()=>Promise<unknown>){try{await fn();check(name,false)}catch{check(name,true)}}
class FaultAdapter extends SandboxAccountingAdapter {
  reserveFailure=false;captureFailure=false;settleFailure=false;
  async reserveEntry(p:ReserveEntryParams){const result=await super.reserveEntry(p);if(this.reserveFailure){this.reserveFailure=false;throw Error('TEST_COMMIT_REPLY_LOST')}return result;}
  async captureEntry(p:CaptureEntryParams){if(this.captureFailure){this.captureFailure=false;throw Error('TEST_CAPTURE_UNAVAILABLE')}return super.captureEntry(p);}
  async settleCompetition(p:SettleCompetitionParams){if(this.settleFailure){this.settleFailure=false;throw Error('TEST_FINAL_UNAVAILABLE')}return super.settleCompetition(p);}
}
const adapter=new FaultAdapter(),service=new TournamentService(adapter);
const users=Array.from({length:6},(_,i)=>'recovery_player_'+i);
const root=async(id:string)=>(await pool.query('SELECT * FROM competition_tournaments WHERE instance_id=$1',[id])).rows[0];
const brackets=async(id:string)=>(await pool.query('SELECT * FROM competition_bracket_matches WHERE instance_id=$1 ORDER BY round,position',[id])).rows;
const tickets=async(user:string,product:string)=>(await pool.query('SELECT * FROM competition_qualification_tickets WHERE user_id=$1 AND product=$2 ORDER BY qualified_at',[user,product])).rows;
async function ticket(user:string,product:any){
  const id=randomUUID();await pool.query("INSERT INTO competition_qualification_tickets(id,user_id,game_id,product,cycle_id,state,qualified_at) VALUES($1,$2,$3,$4,$5,'AVAILABLE',now())",[id,user,product.game_id,product.product,product.cycle_id]);
  await pool.query('INSERT INTO competition_qualification_tracks(user_id,game_id,product,target_cycle_id) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',[user,product.game_id,product.product,product.cycle_id]);return id;
}
async function fill(templateId:string,pair=users.slice(0,2)){
  const entries=[];for(const user of pair)entries.push(await service.join(templateId,user));return entries[0].instanceId;
}
async function modelWin(id:string,match:any){
  const run=await authority.create(id,120,127,match.id);
  await tournamentTx(async c=>{
    for(const [i,s] of run.sessions.entries()){
      await c.query("UPDATE competition_authority_sessions SET status='COMPLETED',terminal_at=now() WHERE id=$1",[s.sessionId]);
      await c.query("INSERT INTO competition_authority_results(id,session_id,score,ticks,reason) VALUES($1,$2,$3,120,'TEST_RECOVERY_FIXTURE')",[randomUUID(),s.sessionId,i?1:2]);
    }
    await c.query("UPDATE competition_authority_runs SET status='COMPLETED',terminal_at=now() WHERE id=$1",[run.id]);
    await c.query("INSERT INTO competition_authority_decisions(run_id,kind,winner_user_id,reason) VALUES($1,'WIN',$2,'TEST_RECOVERY_FIXTURE')",[run.id,run.sessions[0].userId]);
  });return run;
}
async function main(){
  cleanup=await tournamentTestDatabase();authority=new AuthorityStore(undefined,adapter);
  for(const game of ['space-blaster','cyber-hopper'])await saveTournamentConfig(game,{...defaultTournamentConfig(game),readyMs:1000,waitingMs:600000,promoCapacities:[4],giftCapacities:[4]},'isolated-recovery-test');
  await ensureTournamentCatalog();const products=(await pool.query("SELECT * FROM competition_products WHERE game_id='space-blaster'")).rows;
  const standard=products.find(p=>p.product==='STANDARD'&&p.terms.capacity===2),promo=products.find(p=>p.product==='PROMO'),gift=products.find(p=>p.product==='GIFT');
  for(const user of users){await pool.query("INSERT INTO users(id,username,password_hash,is_email_verified) VALUES($1,$1::text,'test-only',true)",[user]);if(user!==users[5])await adapter.grantSandboxTestFunds(user,50000);}
  const before=(await adapter.getUserBalance(users[0])).availableMinor;
  adapter.reserveFailure=true;await rejects('ambiguous reservation reply is retained for recovery',()=>service.join(standard.template_id,users[0]));
  await service.recover();const recovered=(await pool.query("SELECT instance_id FROM competition_entry_intents WHERE user_id=$1 AND state='ACCEPTED'",[users[0]])).rows[0].instance_id;
  check('reservation retry admits exactly one seat',(await pool.query('SELECT count(*)::int n FROM competition_participants WHERE instance_id=$1',[recovered])).rows[0].n===1);
  check('reservation retry debits exactly once',(await adapter.getUserBalance(users[0])).availableMinor===before-standard.terms.entryMinor);
  check('cancel is idempotent',await service.cancel(recovered,users[0])&&await service.cancel(recovered,users[0]));
  check('cancel releases original reservation',(await adapter.getUserBalance(users[0])).availableMinor===before);

  const promoTicket=await ticket(users[0],promo),otherTicket=await ticket(users[1],promo),poorTicket=await ticket(users[5],promo);
  await rejects('insufficient Promo funds reject join',()=>service.join(promo.template_id,users[5]));
  check('failed paid admission does not burn ticket',(await tickets(users[5],'PROMO')).find(t=>t.id===poorTicket).state==='AVAILABLE');
  const entries=await Promise.all([service.join(promo.template_id,users[0]),service.join(promo.template_id,users[0]),service.join(promo.template_id,users[1])]);
  const promoId=entries[0].instanceId;
  check('concurrent ticket join has two unique seats',entries.every(e=>e.instanceId===promoId)&&(await root(promoId)).state==='WAITING'&&(await pool.query('SELECT count(*)::int n FROM competition_participants WHERE instance_id=$1',[promoId])).rows[0].n===2);
  await rejects('outsider cannot enter a qualified event',()=>service.join(promo.template_id,users[2]));
  check('outsider cannot cancel waiting room',!await service.cancel(promoId,users[2]));
  await service.cancel(promoId,users[0]);await service.process(promoId);
  const actor=(await tickets(users[0],'PROMO')).find(t=>t.id===promoTicket),other=(await tickets(users[1],'PROMO')).find(t=>t.id===otherTicket);
  check('voluntary cancellation leaves own ticket consumed',actor.state==='CONSUMED'&&!actor.replaced_by);
  check('other waiting player receives linked replacement',other.state==='REPLACED'&&Boolean(other.replaced_by));
  check('replacement cannot stockpile',(await tickets(users[1],'PROMO')).filter(t=>t.state==='AVAILABLE').length===1);
  check('cancel refunds every paid participant',(await pool.query('SELECT status FROM sandbox_entry_reservations WHERE competition_instance_id=$1',[promoId])).rows.every(r=>r.status==='RELEASED'));
  await rejects('ticket ownership cannot be rewritten',()=>pool.query('UPDATE competition_qualification_tickets SET user_id=$2 WHERE id=$1',[other.replaced_by,users[2]]));
  await rejects('ticket target cycle cannot be rewritten',()=>pool.query('UPDATE competition_qualification_tickets SET cycle_id=$2 WHERE id=$1',[other.replaced_by,promo.cycle_id]));
  await rejects('consumed ticket cannot become available again',()=>pool.query("UPDATE competition_qualification_tickets SET state='AVAILABLE' WHERE id=$1",[promoTicket]));
  const targetMismatch=await readProduct(promo.template_id);
  await rejects('replacement cannot enter the expired original cycle',()=>service.join(targetMismatch!.template_id,users[1]));
  for(const user of users.slice(0,2))await ticket(user,gift);
  const giftId=await fill(gift.template_id);await service.requestVoid(giftId,'PLATFORM_VOID');
  const cycle=(await pool.query('SELECT ends_at FROM competition_special_cycles WHERE id=$1',[gift.cycle_id])).rows[0];
  await service.process(giftId,new Date(cycle.ends_at).getTime()+1);
  check('free Gift join never reserves money',(await pool.query('SELECT 1 FROM sandbox_entry_reservations WHERE competition_instance_id=$1',[giftId])).rowCount===0);
  check('late platform recovery restores expired consumed tickets',(await tickets(users[0],'GIFT')).some(t=>t.state==='REPLACED'&&t.replaced_by)&&(await tickets(users[0],'GIFT')).filter(t=>t.state==='AVAILABLE').length===1);
  await replaceTournamentTickets(giftId,new Date(cycle.ends_at).getTime()+1);
  check('replacement recovery is idempotent',(await tickets(users[0],'GIFT')).length===2);
  check('Gift replacement preserves Promo audit with normal clock expiry',(await tickets(users[1],'PROMO')).length===2&&(await tickets(users[1],'PROMO')).find(t=>t.id===other.replaced_by).state==='EXPIRED');

  let id=await fill(standard.template_id);adapter.captureFailure=true;
  await rejects('capture outage leaves durable full tournament',()=>service.process(id));
  check('capture outage does not create a bracket',(await root(id)).state==='CAPTURING'&&(await brackets(id)).length===0);
  await service.process(id);const initial=await root(id);
  check('capture recovery seeds exactly once',initial.state==='PLAYING'&&(await brackets(id)).length===1);
  await service.process(id);check('repeated recovery preserves draw',(await root(id)).seed===initial.seed);
  let match=(await brackets(id))[0],run=await authority.create(id,120,127,match.id);
  await rejects('duplicate authority run cannot bind same bracket',()=>authority.create(id,120,128,match.id));
  // Expired ownership is an infrastructure fixture, never a supplied winner.
  await pool.query("UPDATE competition_authority_runs SET lease_until=clock_timestamp()-interval '1 second' WHERE id=$1",[run.id]);
  await authority.recover();match=(await brackets(id))[0];
  check('lost owner retries the same pair',match.state==='READY'&&match.failures===1&&match.player1_id===initial.seeded_order[0]&&match.player2_id===initial.seeded_order[1]);
  await rejects('old owner cannot write after recovery',()=>authority.result(run.id,run.sessions[0].sessionId,99,120,'CAP_REACHED'));
  run=await modelWin(id,match);adapter.settleFailure=true;
  await rejects('final accounting outage remains retryable',()=>authority.apply(run.id));
  check('failed final has no payout and keeps winner',(await root(id)).state==='FINALIZING'&&(await root(id)).winner_user_id===run.sessions[0].userId);
  await Promise.all([service.process(id),authority.apply(run.id),authority.apply(run.id)]);await service.process(id);
  check('concurrent final recovery settles once',(await root(id)).state==='SETTLED'&&(await pool.query("SELECT count(*)::int n FROM sandbox_settlements WHERE competition_instance_id=$1 AND status='SETTLED'",[id])).rows[0].n===1);
  const loser=run.sessions[1].userId,view=await readPlayerInstance(id,loser);
  check('eliminated player resumes correct result',view?.tournament?.playerState==='ELIMINATED'&&view.tournament.yourScore===1&&view.tournament.opponentScore===2);
  await rejects('settled bracket winner cannot change',()=>pool.query('UPDATE competition_bracket_matches SET winner_user_id=$2 WHERE id=$1',[match.id,loser]));
  check('settled final cannot be voided',!await service.requestVoid(id,'LATE_VOID'));

  id=await fill(standard.template_id);await service.process(id);match=(await brackets(id))[0];run=await authority.create(id,120,127,match.id);
  let renewal=setInterval(()=>{void authority.renew([run.id]).catch(()=>{})},300);
  try{
    const s=run.sessions[0],epoch=await authority.bind(run.id,s.sessionId,'ready-controller','test-ready-nonce');
    await authority.ready(run.id,s.sessionId,'ready-controller',epoch);
    await new Promise(r=>setTimeout(r,1100));await authority.noShow(run.id,run.sessions[1].userId);
    await authority.decide(run.id,'READY_NO_SHOW',run.sessions[1].userId);await authority.apply(run.id);
  }finally{clearInterval(renewal)}
  check('one-sided ready no-show advances present player',(await root(id)).state==='SETTLED'&&(await root(id)).winner_user_id===run.sessions[0].userId);
  check('no-show records zero-play server evidence',(await pool.query('SELECT v.ticks FROM competition_authority_results v JOIN competition_authority_sessions s ON s.id=v.session_id WHERE s.run_id=$1',[run.id])).rows.every(r=>r.ticks===0));
  check('no-show cannot create qualification',(await qualificationView(run.sessions[0].userId,'space-blaster')).promo.progress===0);
  id=await fill(standard.template_id);await service.process(id);run=await authority.create(id,120,127,(await brackets(id))[0].id);
  renewal=setInterval(()=>{void authority.renew([run.id]).catch(()=>{})},300);
  try{await authority.decide(run.id,'READY_EXPIRED',undefined,true);}finally{clearInterval(renewal)}
  check('both absent voids tournament without guessed winner',(await root(id)).state==='VOIDED'&&!(await root(id)).winner_user_id);
  check('both absent refunds captured entries',(await pool.query('SELECT status FROM sandbox_entry_reservations WHERE competition_instance_id=$1',[id])).rows.every(r=>r.status==='REFUNDED'));
  // Unsafe edits and flag transitions stay outside the admitted game path.
  await pool.query("UPDATE users SET status='suspended' WHERE id=$1",[users[3]]);
  await rejects('inactive account cannot enter',()=>service.join(standard.template_id,users[3]));
  const publicData=await readTournamentCatalog(await templateService.listTemplates(),users[0]);
  check('player catalog contains no authority/accounting secrets',!/(nonce_hash|seeded_order|ledger|provider_reference|controller_id)/.test(JSON.stringify(publicData)));
  check('qualification cycle reads do not consume tickets',(await tickets(users[0],'GIFT')).filter(t=>t.state==='AVAILABLE').length===1);
  await mockProvisioningChecks();
}
async function mockProvisioningChecks(){
  // Only the already opened isolated disposable pool is queried. This literal identity exercises
  // the hosted route guards; no connection is ever opened to the placeholder staging URI.
  const before={...process.env},ids=Array.from({length:4},(_,i)=>(i+1).toString().repeat(8)+'-1111-4111-8111-111111111111');
  for(const id of ids)await pool.query("INSERT INTO users(id,username,password_hash) VALUES($1,$2,'test-only')",[id,'mock_'+id.slice(0,8)]);
  const fixture='postgresql://postgres.gzfcucvxfzzjzjtgkwpd:fixture@aws-1-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require';
  Object.assign(process.env,{APP_ENV:'staging',NODE_ENV:'production',DATABASE_URL:fixture,DATABASE_TARGET_FINGERPRINT:getDatabaseTargetIdentity(fixture)!.fingerprint,
    RENDER_SERVICE_ID:'srv-da2c50c9v7es73db3dkg',STAGING_MOCK_COMMERCIAL_ENABLED:'true',STAGING_MOCK_COMPETITIONS_ENABLED:'true',
    STAGING_MOCK_AUTHORIZATION:'a'.repeat(64),STAGING_MOCK_PROVIDER_KEY:'b'.repeat(64),STAGING_MOCK_USER_IDS:ids.join(','),
    REAL_MONEY_ENABLED:'false',REAL_MONEY_DEPOSITS_ENABLED:'false',REAL_MONEY_WITHDRAWALS_ENABLED:'false',REAL_MONEY_COMPETITIONS_ENABLED:'false'});
  const app=express();app.use(express.json(),cookieParser());app.use('/mock',stagingMockCommercialRouter);
  const server=createServer(app);await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+(server.address() as any).port+'/mock/tournaments/ensure';
  const headers={cookie:SESSION_COOKIE_NAME+'='+signSessionToken({sub:ids[0]}),origin:'https://staging.fugluck.com','content-type':'application/json','x-staging-mock-authorization':'a'.repeat(64)};
  const post=(h:Record<string,string>)=>fetch(url,{method:'POST',headers:h,body:JSON.stringify({capacity:16,prizeMinor:999999,provenance:'LIVE'})});
  try{
    check('mock provisioning requires a signed-in operator user',(await post({'content-type':'application/json'})).status===401);
    check('mock provisioning rejects unlisted users',(await post({...headers,cookie:SESSION_COOKIE_NAME+'='+signSessionToken({sub:users[0]})})).status===403);
    check('mock provisioning requires operator authorization',(await post({...headers,'x-staging-mock-authorization':'c'.repeat(64)})).status===403);
    check('mock provisioning rejects another browser origin',(await post({...headers,origin:'https://www.fugluck.com'})).status===403);
    process.env.ENABLE_KNOCKOUT_TOURNAMENTS='false';check('mock provisioning respects tournament switch',(await post(headers)).status===403);process.env.ENABLE_KNOCKOUT_TOURNAMENTS='true';
    const response=await post(headers),body=await response.json() as any;
    check('authorized mock provisioning creates two server-defined products',response.status===200&&body.templates.length===2);
    const rows=(await pool.query('SELECT * FROM competition_products WHERE template_id=ANY($1::text[])',[body.templates])).rows;
    check('mock provisioning ignores client financial and capacity terms',rows.length===2&&rows.every(r=>r.provenance==='STAGING_MOCK'&&r.product==='STANDARD'&&r.terms.capacity===4&&r.terms.prizeMinor===r.terms.referenceEntryMinor*4*.9));
    const again=await (await post(headers)).json() as any;check('mock provisioning repeats without duplicates',JSON.stringify(again.templates)===JSON.stringify(body.templates));
    const publicRows=await readTournamentCatalog(await templateService.listTemplates(),ids[0]);check('mock products remain absent from player discovery',publicRows.every(t=>!body.templates.includes(t.id)));
  }finally{
    await new Promise<void>(r=>server.close(()=>r()));
    for(const key of Object.keys(process.env))if(!(key in before))delete process.env[key];Object.assign(process.env,before);
  }
}
main().catch(e=>{console.error(e);failed++}).finally(async()=>{await authority?.close();if(cleanup)await cleanup();console.log('Tournament recovery: '+passed+' PASS, '+failed+' FAIL');process.exitCode=failed?1:0});
