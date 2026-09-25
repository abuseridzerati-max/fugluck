import './require-disposable-test-database.ts';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { io as connect, type Socket } from 'socket.io-client';
import { SpaceBlasterEngine } from '../games/space-blaster/engine';
import { LiveControls } from '../packages/server/src/competitions/authorityRuntime';
import { AuthorityStore } from '../packages/server/src/competitions/authorityStore';
import { attachMatchmaking } from '../packages/server/src/matchmaking';
import { pool } from '../packages/server/src/db/client';
import { signSessionToken } from '../packages/server/src/auth/jwt';
import { templateService, lifecycleEngine } from '../packages/server/src/competitions';
import { SandboxAccountingAdapter } from '../packages/server/src/accounting/sandboxAdapter';
import type { AuthorityBinding, AuthorityControls, AuthoritySnapshot } from '@fugluck/shared';

let passes=0, failures=0;
function check(label:string,ok:unknown) { console.log(`${ok?'PASS':'FAIL'} ${label}`); ok?passes++:failures++; }
function rejects(label:string,fn:()=>unknown) { try {fn();check(label,false);} catch {check(label,true);} }
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
function once(socket:Socket,event:string,timeout=45000):Promise<any> { return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{socket.off(event,handler);reject(Error(`Timeout: ${event}`));},timeout);function handler(p:any){clearTimeout(timer);resolve(p);}socket.once(event,handler);}); }
async function until(fn:()=>boolean,timeout=10000){const end=Date.now()+timeout;while(!fn()){if(Date.now()>end)throw Error('condition timeout');await sleep(20);}}
const prefix=`authority_${Date.now()}`;
const users=[0,1,2].map(i=>`${prefix}_${i}`);
const adapter=new SandboxAccountingAdapter();
const sockets:Socket[]=[];
const firing=new Set<string>();
const instances:string[]=[];
const legacyTemplates:string[]=[];
let server:ReturnType<typeof createServer>|undefined, io:ReturnType<typeof attachMatchmaking>|undefined;
async function main(){
  const e=new SpaceBlasterEngine(77);const x=e.shipX;e.update(1/60,{moveRight:true});check('legal server movement',e.shipX>x&&e.shipX-x<9);
  for(let i=0;i<300;i++)e.update(1/60,{moveRight:true});check('canonical viewport clamp',e.shipX===1250);
  const fire=new SpaceBlasterEngine(4);fire.update(1/60,{shootPressed:true});fire.update(1/60,{shootPressed:true});check('fire cadence enforced',fire.bullets.length===1);
  const a=new SpaceBlasterEngine(3),b=new SpaceBlasterEngine(3);for(let i=0;i<120;i++){a.update(1/60,{});b.update(1/60,{})}check('seeded spawn determinism',JSON.stringify(a.asteroids)===JSON.stringify(b.asteroids));check('survival score',a.score===4);
  const hit=new SpaceBlasterEngine(9);hit.bullets=[{id:1,x:100,y:115,active:true}];hit.asteroids=[{id:1,x:100,y:100,vx:0,vy:0,radius:20,active:true}];hit.update(1/60,{});check('server bullet collision awards 10',hit.score===10&&!hit.asteroids[0].active);
  hit.asteroids=[{id:2,x:hit.shipX,y:hit.shipY,vx:0,vy:0,radius:20,active:true}];check('ship collision ends run',hit.update(1/60,{})==='collision'&&hit.gameOver);
  const controls=new LiveControls();const times=new Map([[1,1000]]);const p={seq:1,snapshot:1,left:true,right:false,up:false,down:false,fire:true} as AuthorityControls;
  controls.accept(p,1000,times);check('current input consumed',controls.take(1000).shootPressed);check('fire pulse consumed once',!controls.take(1000).shootPressed);
  rejects('duplicate input',()=>controls.accept(p,1000,times));rejects('out of order input',()=>controls.accept({...p,seq:0},1000,times));rejects('stale input',()=>controls.accept({...p,seq:2},1600,times));rejects('malformed controls',()=>controls.accept({...p,seq:2,left:1 as any},1000,times));
  for(let i=2;i<=12;i++)controls.accept({...p,seq:i},1000,times);rejects('impossible control rate',()=>controls.accept({...p,seq:13},1000,times));check('held control expires after 250ms',!controls.take(1251).moveLeft);
  // Early feasibility: 20 simultaneous current states, real wall-clock scheduling, no replay.
  const engines=Array.from({length:20},(_,i)=>new SpaceBlasterEngine(i+1));let ticks=0,cost=0,max=0,bytes=0,snaps=0;
  const cpu=process.cpuUsage(),began=performance.now();
  await new Promise<void>(resolve=>{const timer=setInterval(()=>{const elapsed=performance.now()-began;while(ticks<Math.floor(elapsed*60/1000)&&ticks<300){const t=performance.now();for(const engine of engines)engine.update(1/60,{moveRight:true});const dt=performance.now()-t;cost+=dt;max=Math.max(max,dt);ticks++;if(ticks%3===0){for(const engine of engines)bytes+=Buffer.byteLength(JSON.stringify({seq:ticks,serverTime:Date.now(),startAt:Date.now()-elapsed,deadline:Date.now()-elapsed+180000,state:engine.gameOver?'COMPLETED':'ACTIVE',gameOver:engine.gameOver,tickCount:engine.tickCount,score:engine.score,shipX:engine.shipX,shipY:engine.shipY,bullets:engine.bullets.filter(b=>b.active),asteroids:engine.asteroids.filter(a=>a.active)}));snaps+=20;}}if(ticks===300){clearInterval(timer);resolve();}},4);});
  const seconds=(performance.now()-began)/1000,used=process.cpuUsage(cpu);
  console.log('BENCHMARK '+JSON.stringify({sessions:20,seconds,tickHz:ticks/seconds,averageBatchTickMs:cost/ticks,maxBatchTickMs:max,averageSessionTickMs:cost/ticks/20,snapshotHzPerSession:snaps/seconds/20,outboundBytesPerSecondPerSession:bytes/seconds/20,processCpuMs:(used.user+used.system)/1000}));check('20-session live feasibility below 250ms lag budget',max<250&&ticks===300);

  process.env.ENABLE_COMPETITION_AUTHORITY='true';
  for(const id of users){await pool.query(`INSERT INTO users(id,username,password_hash,role,is_email_verified) VALUES($1,$2,'test-only','user',true)`,[id,id]);await adapter.grantSandboxTestFunds(id,10000);}
  const template=await templateService.createTemplate({id:prefix,gameId:'space-blaster',title:'Authority test',format:'HEAD_TO_HEAD',participantCapacity:2,currency:'GEL',entryFeeMinor:500,prizes:[{placement:1,amountMinor:900}],rulesVersion:'space-blaster-rv001-v1',skillAssessmentVersion:'v1',enabled:true,isSandbox:true});
  // A fixed server seed makes the first asteroid intersect the legal firing lane.
  // Both players still run the unchanged live engine; no scores/hits are injected.
  server=createServer();io=attachMatchmaking(server,{authorityOptions:{capTicks:120,countdownMs:3000,readyMs:15000,reconnectMs:1000,seedFactory:()=>127}});await new Promise<void>(r=>server!.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${(server.address() as any).port}`;
  async function socket(user:string){const s=connect(url,{auth:{token:signSessionToken({sub:user})},transports:['websocket'],autoConnect:false,reconnection:false});sockets.push(s);s.on('authority:probe',ack=>ack());
    let current:AuthorityBinding|undefined,last:AuthoritySnapshot|undefined,sequence=0;
    s.on('authority:session',p=>{current=p;sequence=0});s.on('authority:snapshot',p=>{last=p});
    const heartbeat=setInterval(()=>{if(s.connected&&current&&last?.state==='ACTIVE'&&last.startAt!==null&&last.serverTime>last.startAt)s.volatile.emit('authority:controls',{...current,seq:++sequence,snapshot:last.seq,left:false,right:false,up:false,down:false,fire:firing.has(user)})},100);
    s.on('disconnect',()=>clearInterval(heartbeat));s.on('authority:outcome',()=>{last=undefined;current=undefined});s.on('authority:error',p=>console.log('AUTHORITY_EVENT',p.code));const ready=once(s,'connect');s.connect();await ready;return s;}
  let s1=await socket(users[0]),s2=await socket(users[1]);const outsider=await socket(users[2]);
  for(const [gameId,rulesVersion] of [['neon-runner','nr-1.0'],['pixel-ninja-dash','pnd-1.0'],['cyber-hopper','ch-1.0']]) {
    // Emulate legacy rows that predate the current certification guard. New
    // template creation correctly rejects these candidates before they exist.
    const blockedId=`${prefix}_${gameId}`;legacyTemplates.push(blockedId);
    await pool.query(`INSERT INTO competition_templates
      (id, game_id, title, format, participant_capacity, currency, entry_fee_minor, rules_version, skill_assessment_version, enabled, jurisdiction)
      VALUES ($1,$2,'Legacy blocked candidate','HEAD_TO_HEAD',2,'GEL',500,$3,'v1',true,'GE')`,[blockedId,gameId,rulesVersion]);
    const rejected=once(s1,'competition:error');s1.emit('competition:join',{templateId:blockedId});check(`${gameId} remains blocked at public entry`,(await rejected).message.includes('blocked'));
  }
  check('unsupported games reserve no funds',(await pool.query('SELECT count(*)::int n FROM sandbox_entry_reservations WHERE user_id=$1',[users[0]])).rows[0].n===0);
  async function pair(){const bp1=once(s1,'authority:session'),bp2=once(s2,'authority:session');let joined=once(s1,'competition:joined');s1.emit('competition:join',{templateId:template.id});const j=await joined;instances.push(j.instanceId);joined=once(s2,'competition:joined');s2.emit('competition:join',{templateId:template.id});await joined;return {b1:await bp1 as AuthorityBinding,b2:await bp2 as AuthorityBinding,instance:j.instanceId};}
  async function error(s:Socket,event:string,payload:any,label:string,expected:string){const response=once(s,'authority:error');s.emit(event,payload);check(label,(await response).code===expected);}
  let pair1=await pair();
  for(const [key,value] of Object.entries({sessionId:'wrong',instanceId:'wrong',matchId:'wrong',gameId:'wrong',version:'wrong',nonce:'wrong',epoch:99}))await error(s1,'authority:ready',{...pair1.b1,[key]:value},`binding rejects ${key}`,['sessionId','instanceId'].includes(key)?'SESSION_OWNERSHIP':'SESSION_BINDING');
  await error(outsider,'authority:ready',pair1.b1,'wrong authenticated user','SESSION_OWNERSHIP');await error(s1,'authority:ready',null,'malformed message','MESSAGE_SHAPE');
  const replacement=await socket(users[0]);const next=once(replacement,'authority:session');replacement.emit('authority:resume',{instanceId:pair1.instance});const newBinding=await next;
  await error(s1,'authority:ready',pair1.b1,'old controlling connection fenced','SESSION_OWNERSHIP');s1.disconnect();s1=replacement;check('reconnect rotates epoch and nonce',newBinding.epoch>pair1.b1.epoch&&newBinding.nonce!==pair1.b1.nonce);pair1.b1=newBinding;
  const firstFrames:AuthoritySnapshot[]=[];
  let snap1:AuthoritySnapshot|undefined;s1.on('authority:snapshot',p=>{snap1=p;if(p.sessionId===pair1.b1.sessionId)firstFrames.push(p)});s1.on('authority:outcome',p=>console.log('OUTCOME',p));
  const out1=once(s1,'authority:outcome');s1.emit('authority:ready',pair1.b1);s2.emit('authority:ready',pair1.b2);
  await until(()=>snap1?.state==='ACTIVE'&&snap1.serverTime>snap1.startAt!,15000);
  await error(s1,'authority:controls',{...pair1.b1,seq:1,snapshot:snap1!.seq,left:false,right:false,up:false,down:false,fire:false,score:999999,winnerUserId:users[0]},'client cannot choose score or winner','INPUT_SHAPE');
  let blocked=false;try{await lifecycleEngine.submitScore({instanceId:pair1.instance,userId:users[0],score:999999,durationMs:1,inputLog:[],viewport:{width:1280,height:720}})}catch(e:any){blocked=e.code==='LIVE_AUTHORITY_REQUIRED'}check('legacy score service cannot bypass authority',blocked);
  const outcome=await out1;check('real sockets: cap tie void/refund',outcome.status==='VOIDED'&&outcome.winnerUserId===null&&outcome.reason==='SERVER_RESULTS');
  check('real socket sequence is continuous per participant',firstFrames.length>20&&firstFrames.every((p,i)=>!i||p.seq===firstFrames[i-1].seq+1));
  check('real snapshots carry binding and creation/emit clocks',firstFrames.every(p=>p.sessionId===pair1.b1.sessionId&&p.epoch===pair1.b1.epoch&&p.emittedAt>=p.createdAt&&p.serverTime===p.createdAt));
  const rows=(await pool.query(`SELECT v.* FROM competition_authority_results v JOIN competition_authority_sessions s ON s.id=v.session_id JOIN competition_authority_runs r ON r.id=s.run_id WHERE r.instance_id=$1`,[pair1.instance])).rows;check('two immutable server results at cap',rows.length===2&&rows.every(r=>r.ticks===120&&r.score===4));
  let immutable=false;try{await pool.query('UPDATE competition_authority_results SET score=999 WHERE id=$1',[rows[0].id])}catch{immutable=Boolean(rows[0])}check('result update forbidden',immutable);
  const run=(await pool.query('SELECT * FROM competition_authority_runs WHERE instance_id=$1',[pair1.instance])).rows[0];
  const store=new AuthorityStore();await Promise.all([store.apply(run.id),store.apply(run.id)]);check('exactly one settlement after duplicate application',(await pool.query('SELECT count(*)::int n FROM sandbox_settlements WHERE competition_instance_id=$1',[pair1.instance])).rows[0].n===1);
  check('instance lifecycle terminal',(await pool.query('SELECT status FROM competition_instances WHERE id=$1',[pair1.instance])).rows[0].status==='VOIDED');
  const terminalParticipants=async(instance:string)=>(await pool.query('SELECT status,rank,prize_won_minor FROM competition_participants WHERE instance_id=$1',[instance])).rows;
  check('draw participants terminal without invented placement',(await terminalParticipants(pair1.instance)).every(p=>p.status==='VOIDED'&&p.rank===null&&p.prize_won_minor===0));
  check('draw refund instance report reconciles',(await adapter.reconcileCompetitionInstance(pair1.instance)).discrepancyMinor===0);
  const history=(await pool.query('SELECT score_p1,score_p2,input_log_p1,input_log_p2 FROM matches_history WHERE competition_instance_id=$1',[pair1.instance])).rows[0];
  check('history receives authoritative scores without input logs',history.score_p1===4&&history.score_p2===4&&history.input_log_p1===null&&history.input_log_p2===null);
  await error(s1,'authority:forfeit',pair1.b1,'duplicate terminal request rejected','SESSION_OWNERSHIP');
  const second=await pair();const out2=once(s1,'authority:outcome');snap1=undefined;s1.emit('authority:ready',second.b1);s2.emit('authority:ready',second.b2);await until(()=>snap1?.state==='ACTIVE'&&snap1.serverTime>snap1.startAt!,15000);s2.emit('authority:forfeit',second.b2);const win=await out2;check('real socket explicit forfeit settles opponent',win.status==='SETTLED'&&win.winnerUserId===users[0]);
  const settlement=(await pool.query('SELECT * FROM sandbox_settlements WHERE competition_instance_id=$1',[second.instance])).rows[0];check('predetermined prize 900 and margin 100',settlement.total_prizes_awarded_minor===900&&settlement.platform_margin_minor===100);
  const forfeitedParts=await terminalParticipants(second.instance);
  check('forfeiter terminal state preserved',forfeitedParts.some(p=>p.status==='FORFEITED'&&p.rank===2));
  check('forfeit winner terminal',forfeitedParts.some(p=>p.status==='SUBMITTED'&&p.rank===1));
  const third=await pair();const out3=once(s1,'authority:outcome');const expired=await out3;check('ready expiration voids without arbitrary winner',expired.status==='VOIDED'&&expired.reason==='READY_EXPIRED');
  firing.add(users[0]);const earned=await pair();const earnedOutcome=once(s1,'authority:outcome');s1.emit('authority:ready',earned.b1);s2.emit('authority:ready',earned.b2);const earnedWin=await earnedOutcome;firing.delete(users[0]);
  check('real controls earn a normal score-based winner',earnedWin.status==='SETTLED'&&earnedWin.reason==='SERVER_RESULTS'&&earnedWin.winnerUserId===users[0]&&earnedWin.yourScore>=14);
  const earnedDecision=(await pool.query('SELECT d.* FROM competition_authority_decisions d JOIN competition_authority_runs r ON r.id=d.run_id WHERE r.instance_id=$1',[earned.instance])).rows[0];check('normal winner decision references two immutable results',earnedDecision.kind==='WIN'&&earnedDecision.result_ids.length===2);
  check('normal earned winner paid exactly once',(await pool.query('SELECT total_prizes_awarded_minor FROM sandbox_settlements WHERE competition_instance_id=$1',[earned.instance])).rows[0].total_prizes_awarded_minor===900);
  const earnedParts=await terminalParticipants(earned.instance);
  check('normal winner terminal',earnedParts.some(p=>p.status==='SUBMITTED'&&p.rank===1));
  check('normal loser terminal',earnedParts.some(p=>p.status==='SUBMITTED'&&p.rank===2));
  const fourth=await pair();snap1=undefined;s1.emit('authority:ready',fourth.b1);s2.emit('authority:ready',fourth.b2);await until(()=>snap1?.state==='ACTIVE'&&snap1.startAt!==null&&snap1.serverTime>snap1.startAt!,15000);
  const old=s2;old.disconnect();s2=await socket(users[1]);const rebound=once(s2,'authority:session');s2.emit('authority:resume',{instanceId:fourth.instance});const resumed=await rebound;check('active reconnect replaces nonce',resumed.nonce!==fourth.b2.nonce&&resumed.epoch>fourth.b2.epoch);
  const out4=await once(s1,'authority:outcome');check('active reconnect preserves server run',out4.reason==='SERVER_RESULTS');
  const fifth=await pair();snap1=undefined;s1.emit('authority:ready',fifth.b1);s2.emit('authority:ready',fifth.b2);await until(()=>snap1?.state==='ACTIVE'&&snap1.startAt!==null&&snap1.serverTime>snap1.startAt!,15000);const out5=once(s1,'authority:outcome');s2.disconnect();const abandoned=await out5;check('isolated abandonment after grace',abandoned.reason==='RECONNECT_EXPIRED'&&abandoned.winnerUserId===users[0]);s2=await socket(users[1]);
  const sixth=await pair();snap1=undefined;s1.emit('authority:ready',sixth.b1);s2.emit('authority:ready',sixth.b2);await until(()=>snap1?.state==='ACTIVE'&&snap1.startAt!==null&&snap1.serverTime>snap1.startAt!,15000);s1.disconnect();s2.disconnect();await sleep(4500);const voided=await store.resumeOutcome(sixth.instance,users[0]);check('both disconnected never creates winner',voided?.status==='VOIDED'&&voided.winnerUserId===null);
  check('outsider cannot retrieve private authority outcome',await store.resumeOutcome(sixth.instance,users[2])===null);
  check('system void participants terminal without placement',(await terminalParticipants(sixth.instance)).every(p=>p.status==='VOIDED'&&p.rank===null));
  check('system refund instance report reconciles',(await adapter.reconcileCompetitionInstance(sixth.instance)).discrepancyMinor===0);
  const settledRun=(await pool.query('SELECT id FROM competition_authority_runs WHERE instance_id=$1',[second.instance])).rows[0];let decisionProtected=false;try{await pool.query("UPDATE competition_authority_decisions SET kind='VOID',winner_user_id=NULL WHERE run_id=$1",[settledRun.id])}catch{decisionProtected=true}check('terminal decision cannot be replaced',decisionProtected);
  let duplicateProtected=false;try{await pool.query('INSERT INTO competition_authority_results(id,session_id,score,ticks,reason) VALUES($1,$2,999,1,\'FAKE\')',[randomUUID(),rows[0].session_id])}catch{duplicateProtected=Boolean(rows[0])}check('duplicate durable result blocked',duplicateProtected);
  s1=await socket(users[0]);s2=await socket(users[1]);const seventh=await pair();await new Promise<void>(r=>io!.close(()=>r()));io=undefined;await sleep(2200);await store.recover();const recovered=await store.resumeOutcome(seventh.instance,users[0]);check('process loss recovery void/refund',recovered?.status==='VOIDED'&&recovered.reason==='OWNER_STATE_LOST');
  const winnerResults=(await pool.query('SELECT count(*)::int n FROM competition_authority_results v JOIN competition_authority_sessions s ON s.id=v.session_id WHERE s.run_id=$1',[settledRun.id])).rows[0].n;check('forfeit outcome has two server result references',winnerResults===2);
  console.log(`AUTHORITY CHECK: ${passes} passed, ${failures} failed`);
}
async function cleanup(){
  sockets.forEach(s=>s.disconnect());if(io)await new Promise<void>(r=>io!.close(()=>r()));
  // Explicitly scoped to this script's fixtures in the guarded disposable database.
  for(const id of instances){
    await pool.query('DELETE FROM competition_authority_results WHERE session_id IN (SELECT s.id FROM competition_authority_sessions s JOIN competition_authority_runs r ON r.id=s.run_id WHERE r.instance_id=$1)',[id]);
    await pool.query('DELETE FROM competition_authority_decisions WHERE run_id IN (SELECT id FROM competition_authority_runs WHERE instance_id=$1)',[id]);
    await pool.query('DELETE FROM competition_authority_sessions WHERE run_id IN (SELECT id FROM competition_authority_runs WHERE instance_id=$1)',[id]);
    await pool.query('DELETE FROM competition_authority_runs WHERE instance_id=$1',[id]);
  }
  if(legacyTemplates.length) await pool.query('DELETE FROM competition_templates WHERE id = ANY($1::varchar[])',[legacyTemplates]);
  await pool.end();
}
main().catch(e=>{failures++;console.error(e.stack);}).finally(async()=>{await cleanup();process.exit(failures?1:0);});
