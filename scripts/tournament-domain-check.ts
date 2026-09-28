// Database/model fixtures only. Genuine live-engine acceptance is tournament-authority-check.ts.
import { tournamentTestDatabase } from './tournament-test-database';
import { randomUUID } from 'node:crypto';
import { pool } from '../packages/server/src/db/client';
import { TournamentService } from '../packages/server/src/competitions/tournamentService';
import { AuthorityStore } from '../packages/server/src/competitions/authorityStore';
import { SandboxAccountingAdapter } from '../packages/server/src/accounting/sandboxAdapter';
import { CommercialAccountingAdapter } from '../packages/server/src/accounting/commercialAdapter';
import { ensureTournamentCatalog, readProduct, tournamentTx, createTournamentInstance, currentTournamentConfig, saveTournamentConfig } from '../packages/server/src/competitions/tournamentPersistence';
import { recordStandardQualification, qualificationView, replaceTournamentTickets } from '../packages/server/src/competitions/tournamentQualification';
import { readPlayerInstance, readTournamentCatalog } from '../packages/server/src/competitions/playerReadModel';
import { templateService } from '../packages/server/src/competitions/templateService';
import { defaultTournamentConfig, freezeTournamentTerms } from '../packages/server/src/competitions/tournamentRules';
import { createMoney, TOURNAMENT_CAPACITIES } from '@fugluck/shared';

let passes=0,failures=0,cleanup:(()=>Promise<void>)|undefined;
function check(label:string,ok:unknown){console.log(`${ok?'PASS':'FAIL'} ${label}`);ok?passes++:failures++;}
async function rejects(label:string,fn:()=>Promise<unknown>){try{await fn();check(label,false)}catch{check(label,true)}}
const sandbox=new SandboxAccountingAdapter(),commercial=new CommercialAccountingAdapter(pool);
const service=new TournamentService(sandbox),commercialService=new TournamentService(commercial);
let store:AuthorityStore,commercialStore:AuthorityStore;
const users=Array.from({length:18},(_,i)=>`knockout_player_${i}`);
async function root(id:string){return (await pool.query('SELECT * FROM competition_tournaments WHERE instance_id=$1',[id])).rows[0]}
async function brackets(id:string){return (await pool.query('SELECT * FROM competition_bracket_matches WHERE instance_id=$1 ORDER BY round,position',[id])).rows}

/** Explicit synthetic authoritative receipts test persistence/accounting, never live gameplay. */
async function receiptFixture(id:string,match:any,kind='WIN',authority=store){
  const run=await authority.create(id,120,127,match.id);
  await tournamentTx(async c=>{
    for(const [i,s] of run.sessions.entries()){
      await c.query("UPDATE competition_authority_sessions SET status='COMPLETED',terminal_at=now() WHERE id=$1",[s.sessionId]);
      await c.query("INSERT INTO competition_authority_results(id,session_id,score,ticks,reason) VALUES($1,$2,$3,120,'TEST_RECEIPT_FIXTURE')",[randomUUID(),s.sessionId,kind==='DRAW'?10:i===0?20:10]);
    }
    await c.query("UPDATE competition_authority_runs SET status='COMPLETED',terminal_at=now() WHERE id=$1",[run.id]);
    await c.query(`INSERT INTO competition_authority_decisions(run_id,kind,winner_user_id,reason,result_ids) VALUES($1,$2,$3,'TEST_MODEL_FIXTURE','[]')`,[run.id,kind,kind==='WIN'?run.sessions[0].userId:null]);
  });
  await authority.apply(run.id);return run;
}
async function finishFixture(id:string,authority=store){
  while((await root(id)).state==='PLAYING'){
    const ready=(await brackets(id)).filter(b=>b.state==='READY');if(!ready.length)throw Error('Bracket stalled');
    for(const b of ready)await receiptFixture(id,b,'WIN',authority);
  }
}
async function main(){
  cleanup=await tournamentTestDatabase();
  store=new AuthorityStore(undefined,sandbox);commercialStore=new AuthorityStore(undefined,commercial);
  // Model/concurrency tests tolerate remote disposable-DB round trips; production defaults stay unchanged.
  for(const game of ['space-blaster','cyber-hopper'])await saveTournamentConfig(game,{...defaultTournamentConfig(game),waitingMs:600000,promoCapacities:[4],giftCapacities:[4]},'isolated-test-config');
  const ids=await ensureTournamentCatalog();
  let products=(await pool.query('SELECT * FROM competition_products')).rows;
  check('8 Standard cards and one Promo/Gift per game',ids.length===12&&products.filter(p=>p.product==='STANDARD').length===8&&products.filter(p=>p.product==='PROMO').length===2&&products.filter(p=>p.product==='GIFT').length===2);
  await Promise.all([ensureTournamentCatalog(),ensureTournamentCatalog()]);
  check('concurrent scheduler rerun creates no duplicate cycles',(await pool.query('SELECT count(*)::int n FROM competition_special_cycles')).rows[0].n===4);
  for(const id of users){await pool.query("INSERT INTO users(id,username,password_hash,is_email_verified) VALUES($1,$1::text,'test-only',true)",[id]);if(id!==users[17])await sandbox.grantSandboxTestFunds(id,50000);
    await commercial.ledger.post({idempotencyKey:`test-funding:${id}`,eventType:'TEST_FUNDING',currency:'GEL',actorId:'disposable-test',source:'test',reason:'Isolated tournament accounting fixture',postings:[{account:{kind:'FINANCIAL_ADJUSTMENTS'},amountMinor:-50000},{account:{kind:'USER_AVAILABLE',userId:id},amountMinor:50000}]});}
  const standard=(n:number)=>products.find(p=>p.game_id==='space-blaster'&&p.product==='STANDARD'&&p.terms.capacity===n).template_id as string;
  await rejects('insufficient entry rejected',()=>service.join(standard(2),users[17]));
  await sandbox.grantSandboxTestFunds(users[17],5000);
  const retried=await service.join(standard(2),users[17]);check('funded retry after rejected reservation succeeds',retried.currentParticipants===1);await service.cancel(retried.instanceId);
  process.env.ENABLE_KNOCKOUT_TOURNAMENTS='false';await rejects('entry switch blocks new joins',()=>service.join(standard(2),users[0]));process.env.ENABLE_KNOCKOUT_TOURNAMENTS='true';
  for(const capacity of TOURNAMENT_CAPACITIES){
    const joined=await Promise.all(users.slice(0,capacity).map(u=>service.join(standard(capacity),u)));
    const id=joined[0].instanceId;
    check(`${capacity} concurrent seats share one full instance`,joined.every(j=>j.instanceId===id)&&new Set(joined.map(j=>j.seatIndex)).size===capacity&&(await root(id)).state==='CAPTURING');
    await Promise.all([service.join(standard(capacity),users[0]),service.join(standard(capacity),users[0])]);
    check(`${capacity} duplicate join cannot reserve twice`,(await pool.query('SELECT count(*)::int n FROM sandbox_entry_reservations WHERE competition_instance_id=$1',[id])).rows[0].n===capacity);
    await Promise.all([service.process(id),service.process(id)]);
    const initial=await brackets(id),seed=(await root(id)).seeded_order;
    check(`${capacity} bracket has exactly N-1 matches`,initial.length===capacity-1);
    check(`${capacity} first round has no byes`,initial.filter(b=>b.round===1).length===capacity/2&&initial.filter(b=>b.round===1).every(b=>b.player1_id&&b.player2_id));
    check(`${capacity} seeded order contains each entrant once`,new Set(seed).size===capacity&&seed.every((u:string)=>users.slice(0,capacity).includes(u)));
    await rejects(`${capacity} cannot settle a semifinal`,()=>sandbox.settleCompetition({competitionInstanceId:id,idempotencyKey:`bad-final:${id}`,prizes:[{placement:1,userId:users[0],amount:createMoney(capacity*450,'GEL')}]}));
    if(capacity===4){
      const drawn=await receiptFixture(id,initial[0],'DRAW');await store.apply(drawn.id);
      check('draw rematches same pair without advancement',(await brackets(id)).find(b=>b.id===initial[0].id).state==='READY'&&(await brackets(id)).every(b=>!b.winner_user_id));
      await rejects('frozen prize cannot be edited',()=>pool.query('UPDATE competition_instance_prizes SET amount_minor=1 WHERE instance_id=$1',[id]));
      await rejects('frozen entry cannot be edited',()=>pool.query('UPDATE competition_instances SET entry_fee_minor=1 WHERE id=$1',[id]));
      await rejects('bracket seed cannot be replaced',()=>pool.query("UPDATE competition_tournaments SET seed='tampered' WHERE instance_id=$1",[id]));
      const config=await currentTournamentConfig('space-blaster');await saveTournamentConfig('space-blaster',{...config.config,referenceEntryMinor:600},'test-operator');
      check('existing tournament keeps entry and prize after config edit',(await root(id)).terms.entryMinor===500&&(await root(id)).terms.prizeMinor===1800);
      await saveTournamentConfig('space-blaster',config.config,'test-operator-restore');
      const currentIds=await ensureTournamentCatalog();products=(await pool.query('SELECT * FROM competition_products WHERE template_id=ANY($1::text[])',[currentIds])).rows;
    }
    await finishFixture(id);
    const end=await root(id),all=await brackets(id);
    await Promise.all(Array.from({length:4},()=>store.apply(end.final_run_id)));
    check(`${capacity} only one champion and frozen prize`,end.state==='SETTLED'&&all.filter(b=>b.round===Math.log2(capacity))[0].winner_user_id===end.winner_user_id);
    check(`${capacity} every semifinal/final completes once`,all.every(b=>b.state==='COMPLETE')&&(await pool.query('SELECT count(*)::int n FROM sandbox_settlements WHERE competition_instance_id=$1',[id])).rows[0].n===1);
    check(`${capacity} capture once per tournament`,(await pool.query("SELECT count(*)::int n FROM sandbox_entry_reservations WHERE competition_instance_id=$1 AND status='CAPTURED'",[id])).rows[0].n===capacity);
    check(`${capacity} balanced tournament accounting`,(await sandbox.reconcileCompetitionInstance(id)).discrepancyMinor===0);
    check(`${capacity} test play never qualifies`,(await qualificationView(users[0],'space-blaster')).promo.progress===0);
    const view=await readPlayerInstance(id,end.winner_user_id);
    check(`${capacity} player-safe final and bracket`,view?.tournament?.playerState==='CHAMPION'&&view.tournament.matches.length===capacity-1&&!JSON.stringify(view).includes('seed_commitment'));
  }
  const pending=await service.join(standard(2),users[0]);await service.process(pending.instanceId,Date.now()+700000);
  check('unfilled Standard times out and returns entry',(await root(pending.instanceId)).state==='VOIDED'&&(await pool.query('SELECT status FROM sandbox_entry_reservations WHERE competition_instance_id=$1',[pending.instanceId])).rows[0].status==='RELEASED');
  // Synthetic qualification facts represent future valid LIVE play only in this isolated schema.
  const base=await readProduct(standard(2));const now=Date.now();let qualifying:string[]=[];
  async function qualifyingFixture(index:number,options:{provenance?:string;invalidated?:boolean;ticks?:number;game?:string;product?:string}={}){
    return tournamentTx(async c=>{
      const capacity=index===0&&!Object.keys(options).length?4:2;
      const terms=capacity===4?freezeTournamentTerms('STANDARD',4,base!.terms.config,base!.terms.configRevision):base!.terms;
      const id=await createTournamentInstance(c,{...base!,provenance:(options.provenance??'LIVE') as any,game_id:options.game??base!.game_id,terms:{...terms,product:(options.product??'STANDARD') as any}});
      const matchId=`unit_history_${randomUUID()}`,runId=randomUUID(),bracketId=randomUUID();
      for(const [seat,u] of users.slice(0,capacity).entries())await c.query("INSERT INTO competition_participants(id,instance_id,user_id,seat_index,entry_fee_minor,status) VALUES($1,$2,$3,$4,500,'SUBMITTED')",[randomUUID(),id,u,seat]);
      await c.query("UPDATE competition_instances SET status='SETTLED',current_participants=$3,winner_user_id=$2,settled_at=now() WHERE id=$1",[id,users[index%2],capacity]);
      await c.query("UPDATE competition_tournaments SET state='SETTLED',winner_user_id=$2,completed_at=now(),final_run_id=$3,invalidated=$4 WHERE instance_id=$1",[id,users[index%2],runId,options.invalidated??false]);
      await c.query("INSERT INTO matches_history(id,game_id,player1_id,player2_id,competition_instance_id,currency,stake,seed,status) VALUES($1,'space-blaster',$2,$3,$4,'GEL',500,127,'COMPLETED')",[matchId,users[0],users[1],id]);
      await c.query("INSERT INTO competition_bracket_matches(id,instance_id,round,position,player1_id,player2_id,winner_user_id,state,attempt) VALUES($1,$2,$6,0,$3,$4,$5,'COMPLETE',1)",[bracketId,id,users[0],users[1],users[index%2],Math.log2(capacity)]);
      await c.query("INSERT INTO competition_authority_runs(id,instance_id,match_id,game_id,version,seed,owner_id,lease_until,status,terminal_at,bracket_match_id,bracket_attempt) VALUES($1,$2,$3,'space-blaster','space-blaster-rv001-v1',127,'test-receipt-fixture',now(),'COMPLETED',now(),$4,1)",[runId,id,matchId,bracketId]);
      for(const u of users.slice(0,2)){const s=randomUUID();await c.query("INSERT INTO competition_authority_sessions(id,run_id,user_id,status,terminal_at) VALUES($1,$2,$3,'COMPLETED',now())",[s,runId,u]);await c.query("INSERT INTO competition_authority_results(id,session_id,score,ticks,reason) VALUES($1,$2,10,$3,'TEST_QUALIFICATION_FIXTURE')",[randomUUID(),s,options.ticks??120]);}
      await c.query("INSERT INTO competition_authority_decisions(run_id,kind,winner_user_id,reason,applied_at) VALUES($1,'WIN',$2,'TEST_QUALIFICATION_FIXTURE',now())",[runId,users[index%2]]);
      if(capacity===4)for(let pos=0;pos<2;pos++){
        const semi=randomUUID(),history=randomUUID(),run=randomUUID();
        await c.query("INSERT INTO competition_bracket_matches(id,instance_id,round,position,player1_id,player2_id,winner_user_id,state,attempt) VALUES($1,$2,1,$3,$4,$5,$4,'COMPLETE',1)",[semi,id,pos,users[pos],users[pos+2]]);
        await c.query("INSERT INTO matches_history(id,game_id,player1_id,player2_id,competition_instance_id,currency,stake,seed,status) VALUES($1,'space-blaster',$2,$3,$4,'GEL',500,127,'COMPLETED')",[history,users[pos],users[pos+2],id]);
        await c.query("INSERT INTO competition_authority_runs(id,instance_id,match_id,game_id,version,seed,owner_id,lease_until,status,terminal_at,bracket_match_id,bracket_attempt) VALUES($1,$2,$3,'space-blaster','space-blaster-rv001-v1',127,'test-receipt-fixture',now(),'COMPLETED',now(),$4,1)",[run,id,history,semi]);
        for(const u of [users[pos],users[pos+2]]){const s=randomUUID();await c.query("INSERT INTO competition_authority_sessions(id,run_id,user_id,status,terminal_at) VALUES($1,$2,$3,'COMPLETED',now())",[s,run,u]);await c.query("INSERT INTO competition_authority_results(id,session_id,score,ticks,reason) VALUES($1,$2,10,120,'TEST_QUALIFICATION_FIXTURE')",[randomUUID(),s]);}
        await c.query("INSERT INTO competition_authority_decisions(run_id,kind,winner_user_id,reason,applied_at) VALUES($1,'WIN',$2,'TEST_QUALIFICATION_FIXTURE',now())",[run,users[pos]]);
      }return id;
    });
  }
  for(const variant of [{provenance:'SANDBOX'},{provenance:'STAGING_MOCK'},{invalidated:true},{ticks:0},{product:'PROMO'},{product:'GIFT'}]){const id=await qualifyingFixture(0,variant);await recordStandardQualification(id,now);check(`qualification excludes ${JSON.stringify(variant)}`,(await qualificationView(users[0],'space-blaster',now)).gift.progress===0);}
  for(let i=0;i<10;i++){const id=await qualifyingFixture(i);qualifying.push(id);await Promise.all([recordStandardQualification(id,now),recordStandardQualification(id,now)]);
    const view=await qualificationView(users[0],'space-blaster',now);check(`completion ${i+1} counted once`,view.promo.progress===Math.min(5,i+1)&&view.gift.progress===i+1);
    if(i===0)check('playing semifinal and final earns one tournament completion',(await pool.query('SELECT count(*)::int n FROM competition_authority_runs WHERE instance_id=$1',[id])).rows[0].n===3&&(await pool.query('SELECT count(*)::int n FROM competition_qualification_events WHERE instance_id=$1 AND user_id=$2',[id,users[0]])).rows[0].n===1);
  }
  const progress=await qualificationView(users[0],'space-blaster',now);
  check('independent Promo5 and Gift10 tickets',progress.promo.ticketStatus==='AVAILABLE'&&progress.gift.ticketStatus==='AVAILABLE');
  check('losses qualify equally',(await qualificationView(users[1],'space-blaster',now)).gift.progress===10);
  check('game-specific qualification isolated',(await qualificationView(users[0],'cyber-hopper',now)).gift.progress===0);
  const extra=await qualifyingFixture(11);await recordStandardQualification(extra,now);check('qualified tracks freeze without stockpiling',(await qualificationView(users[0],'space-blaster',now)).gift.progress===10&&(await pool.query("SELECT count(*)::int n FROM competition_qualification_tickets WHERE user_id=$1 AND state='AVAILABLE'",[users[0]])).rows[0].n===2);
  const catalog=await readTournamentCatalog(await templateService.listTemplates(ids),users[0],now);check('read model exposes eligible matching cycle',catalog.length===12&&catalog[0].gameId==='space-blaster'&&catalog.filter(t=>t.tournament?.product!=='STANDARD').some(t=>t.gameId==='space-blaster'&&t.tournament?.eligibility==='AVAILABLE'));
  // A deliberately constructed audit-source fixture proves invalidation closes both read and join paths.
  const promoProduct=products.find(p=>p.game_id==='space-blaster'&&p.product==='PROMO');
  await pool.query("INSERT INTO competition_qualification_tracks(user_id,game_id,product,progress,contributions,target_cycle_id) VALUES($1,'space-blaster','PROMO',5,$2,$3)",[users[16],JSON.stringify([pending.instanceId]),promoProduct.cycle_id]);
  await pool.query("INSERT INTO competition_qualification_tickets(id,user_id,game_id,product,cycle_id,state,qualified_at,source_instances) VALUES($1,$2,'space-blaster','PROMO',$3,'AVAILABLE',now(),$4)",[randomUUID(),users[16],promoProduct.cycle_id,JSON.stringify([pending.instanceId])]);
  await pool.query('UPDATE competition_tournaments SET invalidated=true WHERE instance_id=$1',[pending.instanceId]);
  check('invalidated qualification disappears from player eligibility',(await qualificationView(users[16],'space-blaster',now)).promo.ticketStatus===null);
  await rejects('invalidated ticket cannot admit a paid entry',()=>service.join(promoProduct.template_id,users[16],now));
  await rejects('invalidation cannot be silently reversed',()=>pool.query('UPDATE competition_tournaments SET invalidated=false WHERE instance_id=$1',[pending.instanceId]));
  for(const product of ['PROMO','GIFT'] as const){
    const p=products.find(p=>p.game_id==='space-blaster'&&p.product===product),capacity=p.terms.capacity;
    // Additional synthetic entitlements exercise capacity/financial semantics, not qualification earning.
    for(const u of users.slice(2,capacity))await pool.query(`INSERT INTO competition_qualification_tickets(id,user_id,game_id,product,cycle_id,state,qualified_at) VALUES($1,$2,'space-blaster',$3,$4,'AVAILABLE',now())`,[randomUUID(),u,product,p.cycle_id]);
    const joined=await Promise.all(users.slice(0,capacity).map(u=>commercialService.join(p.template_id,u,now))),id=joined[0].instanceId;
    check(`${product} full admission consumes one ticket`,joined.every(j=>j.instanceId===id)&&(await pool.query("SELECT count(*)::int n FROM competition_qualification_tickets WHERE consumed_instance_id=$1 AND state='CONSUMED'",[id])).rows[0].n===capacity);
    await commercialService.process(id);await rejects(`${product} early commercial settlement blocked`,()=>commercial.settleCompetition({competitionInstanceId:id,idempotencyKey:`early:${id}`,prizes:[{placement:1,userId:users[0],amount:createMoney(p.terms.prizeMinor,'GEL')}]}));
    // The public runtime observes scheduled start; move only the isolated test clock used in create.
    const nativeNow=Date.now;Date.now=()=>now+2*86400000;
    try{await finishFixture(id,commercialStore);}finally{Date.now=nativeNow;}
    const end=await root(id);await Promise.all([commercialStore.apply(end.final_run_id),commercialStore.apply(end.final_run_id)]);
    check(`${product} final once`,end.state==='SETTLED'&&(await pool.query("SELECT count(*)::int n FROM commercial_operations WHERE competition_instance_id=$1 AND kind='COMPETITION' AND status='SETTLED'",[id])).rows[0].n===1);
    check(`${product} captured frozen total`,Number((await pool.query("SELECT COALESCE(sum(amount_minor),0) n FROM commercial_operations WHERE competition_instance_id=$1 AND kind='ENTRY' AND status='CAPTURED'",[id])).rows[0].n)===p.terms.scheduledEntryTotalMinor);
    if(product==='GIFT')check('Gift never creates a reserve/capture operation',(await pool.query("SELECT count(*)::int n FROM commercial_operations WHERE competition_instance_id=$1 AND kind='ENTRY'",[id])).rows[0].n===0);
    const postings=(await pool.query(`SELECT a.kind,p.amount_minor FROM commercial_postings p JOIN commercial_accounts a ON a.id=p.account_id JOIN commercial_transactions t ON t.id=p.transaction_id WHERE t.reference_id=$1 AND t.event_type='PRIZE_SETTLEMENT'`,[id])).rows;
    check(`${product} explicit subsidy and prize obligation`,postings.some(x=>x.kind==='PROMOTIONAL_SUBSIDY'&&Number(x.amount_minor)===-p.terms.subsidyMinor)&&postings.filter(x=>x.kind==='PRIZE_OBLIGATION').length===2&&postings.reduce((n,x)=>n+Number(x.amount_minor),0)===0);
  }
  const expiry=Math.max(Date.parse(progress.promo.expiresAt!),Date.parse(progress.gift.expiresAt!))+1;
  const next=await qualifyingFixture(12);await recordStandardQualification(next,expiry);
  check('cycle expiry resets both consumed tracks',(await qualificationView(users[0],'space-blaster',expiry)).promo.progress===1&&(await qualificationView(users[0],'space-blaster',expiry)).gift.progress===1);
  check('frozen calculations remain integer',Number.isInteger(freezeTournamentTerms('GIFT',16,(await currentTournamentConfig('space-blaster')).config).prizeMinor));
}
main().catch(e=>{console.error(e);failures++}).finally(async()=>{await store?.close();await commercialStore?.close();if(cleanup)await cleanup();console.log(`Tournament domain: ${passes} PASS, ${failures} FAIL`);process.exitCode=failures?1:0});
