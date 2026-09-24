import './require-disposable-test-database';
import { createServer } from 'node:http';
import { performance } from 'node:perf_hooks';
import { Server } from 'socket.io';
import { io, type Socket } from 'socket.io-client';
import { AuthorityRuntime } from '../packages/server/src/competitions/authorityRuntime';
import type { AuthorityStore } from '../packages/server/src/competitions/authorityStore';
import { admissionSummary } from '../packages/server/src/competitions/authorityAdmission';
import { pool } from '../packages/server/src/db/client';

let passed=0,failed=0;
function check(label:string,ok:unknown){console.log(`${ok?'PASS':'FAIL'} ${label}`);ok?passed++:failed++}
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function until(fn:()=>boolean,ms=15000){const end=performance.now()+ms;while(!fn()){if(performance.now()>end)throw Error('LATENCY_TEST_TIMEOUT');await sleep(10)}}

// Fault injection is confined to this test. Real runtime, socket transport,
// admission sampling, game engines and timers; no production configuration override.
class DelayedStore {
 delayMs=800; epochs=new Map<string,number>(); results=0; decisions:string[]=[]; pendingRenewals=0;
 async create(id:string){return {id,instanceId:id,matchId:`match_${id}`,seed:127,sessions:[0,1].map(i=>({sessionId:`${id}_session_${i}`,userId:`${id}_user_${i}`}))}}
 async bind(_id:string,sessionId:string){const epoch=(this.epochs.get(sessionId)??0)+1;this.epochs.set(sessionId,epoch);return epoch}
 async renew(ids:string[]){this.pendingRenewals++;try{await sleep(this.delayMs);return new Set(ids)}finally{this.pendingRenewals--}}
 async ready(){}
 async start(){return {startAt:Date.now()+100,deadline:Date.now()+180000}}
 async result(){await sleep(200);this.results++}
 async decide(id:string,reason:string){await sleep(200);this.decisions.push(reason);return {instanceId:id,status:'VOIDED',reason,winnerUserId:null}}
 async recover(){}
 async resumeOutcome(){return null}
 async close(){}
}
async function stress(count:number){
 const store=new DelayedStore(),runtime=new AuthorityRuntime(store as unknown as AuthorityStore);
 const http=createServer(),server=new Server(http),clients:Socket[]=[],serverSockets=new Map<string,any>();
 server.on('connection',s=>{const userId=String(s.handshake.auth.fixtureUser);s.data.userId=userId;s.data.isGuest=false;serverSockets.set(userId,s);runtime.register(s as any)});
 await new Promise<void>(r=>http.listen(0,'127.0.0.1',r));
 const url=`http://127.0.0.1:${(http.address() as any).port}`,runs:any[]=[];
 const observations=new Map<string,{active:number,lastTick:number}>();
 const heartbeat=setInterval(()=>{},1000);
 try{
  for(let i=0;i<count;i++)for(let j=0;j<2;j++){
   const userId=`latency_${count}_${i}_user_${j}`;
   const s=io(url,{transports:['websocket'],auth:{fixtureUser:userId},reconnection:false});clients.push(s);
   s.on('authority:probe',ack=>ack());
   let binding:any,seq=0;
   s.on('authority:session',b=>{binding=b;s.emit('authority:ready',b)});
   observations.set(userId,{active:0,lastTick:0});
   s.on('authority:snapshot',p=>{if(p.state==='ACTIVE'&&p.tickCount>0){const o=observations.get(userId)!;o.active++;o.lastTick=p.tickCount;if(binding)s.emit('authority:controls',{...binding,seq:++seq,snapshot:p.seq,left:false,right:true,up:false,down:false,fire:true})}});
   await new Promise<void>(r=>s.once('connect',r));
  }
  for(let i=0;i<count;i++){
   const id=`latency_${count}_${i}`;await runtime.create(id);const r=runtime.runs.get(id)!;runs.push(r);
   for(const p of r.players)await runtime.bind(r,p,serverSockets.get(p.userId));
  }
  await until(()=>runs.every(r=>r.startMono!==null&&r.ticks>0));
  check(`${count} sessions: admission accepts real socket RTT while DB renewals take 800ms`,runs.every(r=>!r.stopped));
  const beforeTicks=runs.reduce((n,r)=>n+r.ticks,0),beforeSnaps=[...observations.values()].reduce((n,o)=>n+o.active,0);
  const beforeCost=runtime.metrics.tickMs,beforeCount=runtime.metrics.ticks,cpu=process.cpuUsage(),began=performance.now();
  await until(()=>store.pendingRenewals>0);
  const inFlightTicks=runs[0].ticks,inFlightSnaps=runs[0].metrics.snapshots;await sleep(250);
  check(`${count} sessions: ticks advance during pending heartbeat`,runs[0].ticks-inFlightTicks>=10);
  check(`${count} sessions: snapshots advance during pending heartbeat`,runs[0].metrics.snapshots>inFlightSnaps);
  await sleep(Math.max(0,3000-(performance.now()-began)));
  const seconds=(performance.now()-began)/1000,used=process.cpuUsage(cpu),ticks=runs.reduce((n,r)=>n+r.ticks,0)-beforeTicks;
  const tickHz=ticks/seconds/count,snapshotHz=([...observations.values()].reduce((n,o)=>n+o.active,0)-beforeSnaps)/seconds/(count*2);
  check(`${count} sessions: live tick target maintained`,tickHz>=57&&tickHz<=63);
  check(`${count} sessions: snapshots remain near 20Hz`,snapshotHz>=17&&snapshotHz<=22);
  check(`${count} sessions: bounded healthy lease remains active`,runs.every(r=>!r.stopped));
  console.log('AUTHORITY_STRESS '+JSON.stringify({sessions:count,players:count*2,targetTickHz:60,tickHz,snapshotHz,meanTickMs:(runtime.metrics.tickMs-beforeCost)/(runtime.metrics.ticks-beforeCount),maxTickMs:runtime.metrics.maxTickMs,maxHeartbeatMs:runtime.metrics.maxLeaseRoundtripMs,maxSnapshotPublishMs:Math.max(...runs.map(r=>r.metrics.maxSnapshotMs)),cpuMs:(used.user+used.system)/1000,rssMiB:process.memoryUsage().rss/1048576,persistence:'injected asynchronous 800ms; actual database durability is tested by competition-authority-check'}));
  if(count===1){
   // A renewal that cannot be acknowledged inside the unchanged lease budget
   // must stop authority instead of allowing endless memory-only play.
   store.delayMs=2500;await until(()=>runs[0].stopped,5000);
   const stoppedTicks=runs[0].ticks;await sleep(350);
   check('expired lease stops ticks even while renewal is pending',runs[0].ticks===stoppedTicks);
   check('lost lease produces void instead of winner',store.decisions.includes('LEASE_UNCERTAIN'));
  }
 }finally{
  for(const r of runs)if(!r.stopped)await runtime.finish(r,'TEST_CLEANUP',undefined,true);
  clearInterval(heartbeat);runtime.close();clients.forEach(s=>s.disconnect());await new Promise<void>(r=>server.close(()=>r()));
 }
}
async function main(){
 check('RTT limit is inclusive',admissionSummary(Array(20).fill(100)).accepted);
 check('genuine high client RTT is rejected',!admissionSummary(Array(20).fill(101)).accepted);
 check('jitter limit is enforced',!admissionSummary([...Array(10).fill(40),...Array(10).fill(71)]).accepted);
 check('missing samples cannot pass admission',!admissionSummary(Array(19).fill(1)).accepted);
 check('invalid timing cannot pass admission',!admissionSummary([...Array(19).fill(1),NaN]).accepted);
 check('nearest-rank p95 uses second-largest of 20',admissionSummary([...Array(19).fill(20),1000]).p95RttMs===20);
 for(const sessions of [1,10,20])await stress(sessions);
 console.log(`AUTHORITY LATENCY CHECK: ${passed} passed, ${failed} failed`);
}
main().catch(e=>{failed++;console.error(e.message)}).finally(async()=>{await pool.end();process.exitCode=failed?1:0});
