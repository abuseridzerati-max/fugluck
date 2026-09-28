// Four real authenticated clients, unchanged live engines, normal controls and authoritative receipts.
// No inserted result, supplied score, selected winner, or direct financial balance write.
import { tournamentTestDatabase } from './tournament-test-database';
import { createServer } from 'node:http';
import { io as connect, type Socket } from 'socket.io-client';
import { pool } from '../packages/server/src/db/client';
import { attachMatchmaking } from '../packages/server/src/matchmaking';
import { signSessionToken } from '../packages/server/src/auth/jwt';
import { CommercialAccountingAdapter } from '../packages/server/src/accounting/commercialAdapter';
import { MockPaymentProvider } from '../packages/server/src/payments/mockProvider';
import { FinancialFlows } from '../packages/server/src/payments/financialFlows';
import { ensureTournamentCatalog } from '../packages/server/src/competitions/tournamentPersistence';
import { readPlayerInstance } from '../packages/server/src/competitions/playerReadModel';
import type { AuthorityBinding, AuthoritySnapshot } from '@fugluck/shared';
let passes=0,failures=0,cleanup:(()=>Promise<void>)|undefined;
function check(label:string,ok:unknown){console.log(`${ok?'PASS':'FAIL'} ${label}`);ok?passes++:failures++;}
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function until(fn:()=>Promise<boolean>|boolean,timeout=120000){const end=Date.now()+timeout;while(!await fn()){if(Date.now()>end)throw Error('Tournament acceptance timeout');await sleep(300)}}
function once(s:Socket,event:string,timeout=45000):Promise<any>{return new Promise((resolve,reject)=>{const handler=(p:any)=>{clearTimeout(timer);resolve(p)},timer=setTimeout(()=>{s.off(event,handler);reject(Error(`Timed out ${event}`))},timeout);s.once(event,handler)})}
const adapter=new CommercialAccountingAdapter(pool),users=Array.from({length:4},(_,i)=>`live_bracket_player_${i}`);
const provider=new MockPaymentProvider('isolated-knockout-test-signing-key');
const flows=new FinancialFlows(pool,provider,{enabled:{DEPOSIT:true,COMPETITION:true,WITHDRAWAL:false},maxSingleMinor:{DEPOSIT:20000,COMPETITION:10000},requireVerifiedIdentity:{COMPETITION:false},allowedJurisdictions:{DEPOSIT:['GE'],COMPETITION:['GE']}});
let server:ReturnType<typeof createServer>,io:ReturnType<typeof attachMatchmaking>,sockets:Socket[]=[],url='';
const bindings=new Map<string,AuthorityBinding>(),frames=new Map<string,AuthoritySnapshot>(),seenSessions=new Set<string>(),errors:string[]=[],outcomes:any[]=[];
let activeInstance:string|null=null;
async function boot(){server=createServer();io=attachMatchmaking(server,{competitionAccounting:adapter,authorityOptions:{capTicks:240,countdownMs:1500,seedFactory:()=>127}});await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));url=`http://127.0.0.1:${(server.address() as any).port}`;}
async function client(userId:string){
  const s=connect(url,{transports:['websocket'],auth:{token:signSessionToken({sub:userId})},autoConnect:false,reconnection:false});sockets.push(s);let seq=0,hopped=false;
  s.on('authority:probe',ack=>ack());
  s.on('authority:session',(b:AuthorityBinding)=>{bindings.set(userId,b);seenSessions.add(b.sessionId);frames.delete(userId);seq=0;hopped=false;s.emit('authority:ready',b)});
  s.on('authority:snapshot',(f:AuthoritySnapshot)=>{if(f.sessionId===bindings.get(userId)?.sessionId)frames.set(userId,f)});
  s.on('authority:outcome',p=>{outcomes.push({...p,userId});if(p.matchId===bindings.get(userId)?.matchId){bindings.delete(userId);frames.delete(userId)}});
  s.on('authority:error',p=>{errors.push(p.code)});
  const send=setInterval(()=>{
    const b=bindings.get(userId),f=frames.get(userId);if(!s.connected||!b||!f||f.state!=='ACTIVE'||!f.startAt||f.serverTime<f.startAt)return;
    const opponent=[...bindings.entries()].find(([id,other])=>id!==userId&&other.matchId===b.matchId)?.[0];
    const attacking=opponent!==undefined&&userId<opponent;
    if(b.gameId==='cyber-hopper'){
      const hop=attacking&&!hopped;hopped||=hop;s.volatile.emit('authority:controls',{...b,seq:++seq,snapshot:f.seq,hopUp:hop,hopDown:false,hopLeft:false,hopRight:false});
    }else s.volatile.emit('authority:controls',{...b,seq:++seq,snapshot:f.seq,left:false,right:false,up:false,down:false,fire:attacking});
  },50);
  s.on('disconnect',()=>clearInterval(send));
  const connected=once(s,'connect');s.connect();await connected;
  if(activeInstance)s.emit('authority:resume',{instanceId:activeInstance});
  return s;
}
async function main(){
  cleanup=await tournamentTestDatabase();await ensureTournamentCatalog();
  for(const id of users){await pool.query("INSERT INTO users(id,username,password_hash,is_email_verified) VALUES($1,$1::text,'synthetic-test-only',true)",[id]);
    const deposit=await flows.requestDeposit({userId:id,currency:'GEL',amountMinor:20000,idempotencyKey:`mock_deposit_${id}`,accountActive:true,identityVerified:false,jurisdiction:'GE',riskSignals:[]});
    const event=provider.makeWebhook(deposit.providerReference!,{status:'SUCCEEDED'});await flows.handleWebhook(event.body,event.signature);
    check(`${id} signed mock deposit funds available`,await adapter.ledger.balance({kind:'USER_AVAILABLE',userId:id},'GEL')===20000);
  }
  await boot();for(const id of users)await client(id);
  for(const game of ['space-blaster','cyber-hopper']){
    const product=(await pool.query("SELECT template_id,terms FROM competition_products WHERE game_id=$1 AND product='STANDARD' AND (terms->>'capacity')::int=4",[game])).rows[0];
    const startSessions=seenSessions.size;outcomes.length=0;
    for(const s of sockets){const joined=once(s,'competition:joined');s.emit('competition:join',{templateId:product.template_id});const receipt=await joined;activeInstance=receipt.instanceId;}
    const id=activeInstance!;await until(()=>[...frames.values()].some(f=>f.state==='ACTIVE'&&f.tickCount>5));
    check(`${game} two real semifinals active`,(await pool.query('SELECT count(*)::int n FROM competition_authority_runs WHERE instance_id=$1',[id])).rows[0].n===2);
    check(`${game} no payout before final`,(await pool.query("SELECT count(*)::int n FROM commercial_operations WHERE competition_instance_id=$1 AND kind='COMPETITION'",[id])).rows[0].n===0);
    if(game==='space-blaster'){
      process.env.ENABLE_KNOCKOUT_TOURNAMENTS='false';const blocked=once(sockets[0],'competition:error');sockets[0].emit('competition:join',{templateId:product.template_id});check('action switch rejects new join during tournament',Boolean((await blocked).code));
    }else{
      await until(async()=>(await pool.query("SELECT count(*)::int n FROM competition_bracket_matches WHERE instance_id=$1 AND round=1 AND state='COMPLETE'",[id])).rows[0].n===2);
      const seed=(await pool.query('SELECT seeded_order FROM competition_tournaments WHERE instance_id=$1',[id])).rows[0].seeded_order;
      let finalMatchId:string|undefined;
      await until(async()=>{finalMatchId=(await pool.query('SELECT r.match_id FROM competition_authority_runs r JOIN competition_bracket_matches b ON b.id=r.bracket_match_id WHERE r.instance_id=$1 AND b.round=2 ORDER BY r.created_at DESC LIMIT 1',[id])).rows[0]?.match_id;return Boolean(finalMatchId)});
      await until(()=>[...frames.entries()].some(([user,f])=>bindings.get(user)?.matchId===finalMatchId&&f.state==='ACTIVE'&&f.tickCount>=10));
      check('Cyber Hopper restart interrupts a genuinely active final',[...frames.entries()].some(([user,f])=>bindings.get(user)?.matchId===finalMatchId&&f.tickCount>=10&&f.tickCount<240));
      // Render drains transports before its shutdown signal reaches the owner.
      // Reproduce that ordering, not only an in-process io.close().
      for(const s of sockets)s.disconnect();await sleep(150);
      check('transport drain before shutdown preserves the active final during reconnect grace',(await pool.query('SELECT state FROM competition_tournaments WHERE instance_id=$1',[id])).rows[0].state==='PLAYING'&&(await pool.query('SELECT state FROM competition_bracket_matches WHERE instance_id=$1 AND round=2',[id])).rows[0].state==='ACTIVE');
      await new Promise<void>(r=>io.close(()=>r()));sockets=[];bindings.clear();frames.clear();
      await sleep(2500);await boot();for(const user of users)await client(user);
      check('Cyber Hopper restart preserves finished semifinals and seeding',(await pool.query("SELECT count(*)::int n FROM competition_bracket_matches WHERE instance_id=$1 AND round=1 AND state='COMPLETE'",[id])).rows[0].n===2&&JSON.stringify((await pool.query('SELECT seeded_order FROM competition_tournaments WHERE instance_id=$1',[id])).rows[0].seeded_order)===JSON.stringify(seed));
    }
    await until(async()=>['SETTLED','VOIDED'].includes((await pool.query('SELECT state FROM competition_tournaments WHERE instance_id=$1',[id])).rows[0].state));
    const root=(await pool.query('SELECT * FROM competition_tournaments WHERE instance_id=$1',[id])).rows[0];
    const runs=(await pool.query(`SELECT r.*,d.kind,d.winner_user_id,d.applied_at FROM competition_authority_runs r JOIN competition_authority_decisions d ON d.run_id=r.id WHERE r.instance_id=$1`,[id])).rows;
    const results=(await pool.query(`SELECT v.* FROM competition_authority_results v JOIN competition_authority_sessions s ON s.id=v.session_id JOIN competition_authority_runs r ON r.id=s.run_id WHERE r.instance_id=$1`,[id])).rows;
    check(`${game} genuine multi-round final settles`,root.state==='SETTLED'&&Boolean(root.winner_user_id));
    check(`${game} all three bracket matches complete`,(await pool.query("SELECT count(*)::int n FROM competition_bracket_matches WHERE instance_id=$1 AND state='COMPLETE'",[id])).rows[0].n===3);
    check(`${game} server authority determines every round`,runs.filter(r=>['WIN','FORFEIT'].includes(r.kind)).length===3&&runs.every(r=>r.applied_at));
    if(game==='cyber-hopper')check('active-final restart rematches under a fresh fenced attempt',runs.some(r=>r.kind==='VOID')&&(await pool.query('SELECT attempt FROM competition_bracket_matches WHERE instance_id=$1 AND round=2',[id])).rows[0].attempt===2);
    check(`${game} live receipt provenance`,results.length>=6&&results.every(r=>r.ticks>0&&['CAP_REACHED','COLLISION'].includes(r.reason)));
    check(`${game} final uses fresh authority sessions`,seenSessions.size-startSessions>=6);
    const settlement=(await pool.query("SELECT * FROM commercial_operations WHERE competition_instance_id=$1 AND kind='COMPETITION'",[id])).rows;
    check(`${game} one frozen final payout`,settlement.length===1&&settlement[0].status==='SETTLED'&&Number(settlement[0].amount_minor)===product.terms.prizeMinor);
    check(`${game} each entry captured once`,(await pool.query("SELECT count(*)::int n FROM commercial_operations WHERE competition_instance_id=$1 AND kind='ENTRY' AND status='CAPTURED'",[id])).rows[0].n===4);
    check(`${game} accounting reconciles`,(await pool.query(`SELECT t.id FROM commercial_transactions t JOIN commercial_postings p ON p.transaction_id=t.id WHERE t.reference_id=$1 GROUP BY t.id HAVING sum(p.amount_minor)<>0`,[id])).rowCount===0);
    check(`${game} synthetic live acceptance earns no qualification`,(await pool.query('SELECT count(*)::int n FROM competition_qualification_events WHERE instance_id=$1',[id])).rows[0].n===0);
    const view=await readPlayerInstance(id,root.winner_user_id);check(`${game} refresh reads champion and final`,view?.tournament?.playerState==='CHAMPION'&&view.tournament.matches.length===3);
    console.log('ACCEPTANCE_EVIDENCE',JSON.stringify({game,instanceId:id,winnerUserId:root.winner_user_id,finalRunId:root.final_run_id,authorityRuns:runs.map(r=>({id:r.id,kind:r.kind,bracketMatchId:r.bracket_match_id})),scores:results.map(r=>({score:r.score,ticks:r.ticks,reason:r.reason})),prizeMinor:product.terms.prizeMinor}));
    process.env.ENABLE_KNOCKOUT_TOURNAMENTS='true';activeInstance=null;
  }
  console.log('AUTHORITY_CODES',JSON.stringify([...new Set(errors)]));
  check('no integrity or persistence errors',errors.every(e=>['SESSION_UNAVAILABLE','SESSION_TERMINAL','RESUME_RATE','NOT_ACTIVE','INPUT_STALE','INPUT_SEQUENCE'].includes(e)));
}
main().catch(e=>{console.error(e);failures++}).finally(async()=>{for(const s of sockets)s.disconnect();if(io)await new Promise<void>(r=>io.close(()=>r()));if(cleanup)await cleanup();console.log(`Tournament live authority: ${passes} PASS, ${failures} FAIL`);process.exitCode=failures?1:0});
