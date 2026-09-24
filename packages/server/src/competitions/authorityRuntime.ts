import { randomBytes } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { SpaceBlasterEngine } from '@fugluck/games/space-blaster/engine';
import { AUTHORITY_VERSION, AUTHORITY_CAP_TICKS, FIXED_TIMESTEP_SEC, VIRTUAL_VIEWPORT, type AuthorityBinding, type AuthorityControls, type AuthoritySnapshot, type AuthorityState } from '@fugluck/shared';
import type { MatchmakingSocket } from '../matchmaking/socketAuth';
import { getOnlineSocket } from '../matchmaking/presence';
import { AuthorityStore } from './authorityStore';
import { measureAdmission } from './authorityAdmission';

/** Constructor dependencies only; never populated from socket or HTTP messages. */
export interface AuthorityOptions { capTicks?: number; countdownMs?: number; readyMs?: number; reconnectMs?: number; seedFactory?: () => number }
/** Single held state plus one fire pulse. Accepted controls are discarded after consumption. */
export class LiveControls {
  seq = -1; private tokens = 12; private refill = 0; lastInput = -Infinity;
  held = { moveLeft:false,moveRight:false,moveUp:false,moveDown:false,shootPressed:false };
  accept(p: AuthorityControls, now: number, snapshotTimes: Map<number,number>) {
    if (!Number.isSafeInteger(p.seq) || p.seq <= this.seq) throw Error('INPUT_SEQUENCE');
    if (!Number.isSafeInteger(p.snapshot) || now-(snapshotTimes.get(p.snapshot)??-Infinity)>500) throw Error('INPUT_STALE');
    for (const k of ['left','right','up','down','fire'] as const) if (typeof p[k] !== 'boolean') throw Error('INPUT_SHAPE');
    this.tokens=Math.min(12,this.tokens+Math.max(0,now-this.refill)*0.06); this.refill=now;
    if (this.tokens<1) throw Error('INPUT_RATE');
    this.tokens--; this.seq=p.seq; this.lastInput=now;
    this.held={moveLeft:p.left,moveRight:p.right,moveUp:p.up,moveDown:p.down,shootPressed:this.held.shootPressed||p.fire};
  }
  take(now: number) {
    if (now-this.lastInput>250) this.neutral();
    const input={...this.held}; this.held.shootPressed=false; return input;
  }
  neutral() { this.held={moveLeft:false,moveRight:false,moveUp:false,moveDown:false,shootPressed:false}; }
}
interface Player {
  userId:string; sessionId:string; binding?:AuthorityBinding; socket?:MatchmakingSocket;
  state:AuthorityState; engine:SpaceBlasterEngine; controls:LiveControls;
  disconnectedAt:number|null; snapshots:Map<number,number>; snapshotSeq:number; pending:Promise<void>; readyPendingEpoch?:number;
}
interface Run {
  id:string; instanceId:string; matchId:string; players:Player[]; created:number;
  startAt:number|null; deadline:number|null; startMono:number|null; ticks:number; snapshot:number;
  stopped:boolean; starting:boolean; leaseConfirmed:number; lastSnapshot:number; lastSnapshotPublished?:number;
  delivery:{generated:number;emitAttempts:number;backpressure:number;bytes:number;maxBytes:number;maxCreationToEmitMs:number;transports:Record<string,number>};
  metrics:{ activeLeaseMaxMs:number; waitingLeaseMaxMs:number; finalizingLeaseMaxMs:number; maxSnapshotGapMs:number; controls:number; maxTickMs:number; startMs:number; snapshotMs:number; maxSnapshotMs:number; snapshots:number; bindMaxMs:number; resultWriteMaxMs:number };
  timer:ReturnType<typeof setInterval>;
}
export class AuthorityRuntime {
  readonly runs=new Map<string,Run>();
  readonly metrics={ticks:0,tickMs:0,maxTickMs:0,snapshots:0,bytes:0,maxLeaseRoundtripMs:0};
  private recoveryTimer:ReturnType<typeof setInterval>;
  private leaseTimer:ReturnType<typeof setInterval>;
  private renewing=false;
  private recovering=false;
  private recoveryFailed=false;
  constructor(readonly store=new AuthorityStore(), readonly options:AuthorityOptions={}) {
    this.leaseTimer=setInterval(()=>{
      if(this.renewing||!this.runs.size)return;
      this.renewing=true;const sent=performance.now(),runs=[...this.runs.values()];
      const phases=runs.map(r=>r.stopped?'finalizingLeaseMaxMs' as const:r.startMono!==null&&sent>=r.startMono?'activeLeaseMaxMs' as const:'waitingLeaseMaxMs' as const);
      void store.renew(runs.map(r=>r.id)).then(ids=>{
        const elapsed=performance.now()-sent;
        this.metrics.maxLeaseRoundtripMs=Math.max(this.metrics.maxLeaseRoundtripMs,elapsed);
        runs.forEach((r,i)=>{const key=phases[i];r.metrics[key]=Math.max(r.metrics[key],elapsed);});
        for(const r of runs){if(ids.has(r.id))r.leaseConfirmed=sent;else if(!r.stopped)void this.finish(r,'LEASE_LOST',undefined,true);}
      }).catch(()=>{
        const elapsed=performance.now()-sent;
        this.metrics.maxLeaseRoundtripMs=Math.max(this.metrics.maxLeaseRoundtripMs,elapsed);
        runs.forEach((r,i)=>{const key=phases[i];r.metrics[key]=Math.max(r.metrics[key],elapsed);});
        console.warn('[authority] heartbeat failed',JSON.stringify({durationMs:elapsed,runCount:runs.length}));
        for(const r of runs)void this.finish(r,'LEASE_LOST',undefined,true);
      }).finally(()=>{this.renewing=false});
    },500);this.leaseTimer.unref();
    this.recoveryTimer=setInterval(()=>{
      if(this.recovering)return;this.recovering=true;
      void store.recover().then(()=>{this.recoveryFailed=false}).catch(()=>{
        if(!this.recoveryFailed)console.warn('[authority] Recovery delayed; durable outcomes are preserved and will retry.');
        this.recoveryFailed=true;
      }).finally(()=>{this.recovering=false;});
    },1000);
    this.recoveryTimer.unref();
  }
  register(socket:MatchmakingSocket) {
    let windowStart=performance.now(),messages=0,lastResume=-Infinity;
    const guarded=(fn:(p:any)=>Promise<void>|void)=>(p:unknown)=>{
      if(performance.now()-windowStart>=1000){windowStart=performance.now();messages=0;}
      if(++messages>120)return;
      if(socket.data.isGuest) { socket.emit('authority:error',{code:'AUTH_REQUIRED'}); return; }
      if (!p || typeof p!=='object' || Buffer.byteLength(JSON.stringify(p))>1024) { socket.emit('authority:error',{code:'MESSAGE_SHAPE'}); return; }
      void Promise.resolve().then(()=>fn(p)).catch(e=>socket.emit('authority:error',{code:typeof e.message==='string'&&/^[A-Z_]+$/.test(e.message)?e.message:'AUTHORITY_UNAVAILABLE'}));
    };
    socket.on('authority:resume',guarded(async p=>{
      if(performance.now()-lastResume<500)throw Error('RESUME_RATE');lastResume=performance.now();
      const r=this.runs.get(p.instanceId);
      if(!r) {
        const outcome=await this.store.resumeOutcome(p.instanceId,socket.data.userId);
        if(outcome) {socket.emit('authority:outcome',outcome);return;}
        throw Error('SESSION_UNAVAILABLE');
      }
      const player=r.players.find(a=>a.userId===socket.data.userId);
      if(!player) throw Error('SESSION_OWNERSHIP');
      await this.bind(r,player,socket);
    }));
    socket.on('authority:ready',guarded(async p=>{
      const {r,player}=this.authenticate(socket,p);
      if(player.state!=='CREATED'||player.readyPendingEpoch===p.epoch) throw Error('ILLEGAL_READY');
      player.readyPendingEpoch=p.epoch;
      try {
      const admission=await measureAdmission(socket);
      console.info('[authority] admission metrics',JSON.stringify({instanceId:r.instanceId,...admission}));
      // Reauthenticate after the asynchronous measurement so a replaced controller
      // cannot void or ready its successor's run.
      this.authenticate(socket,p);
      if(!admission.accepted) {await this.finish(r,'LATENCY_ADMISSION_FAILED',undefined,true);return;}
      if(player.state!=='CREATED')throw Error('ILLEGAL_READY');
      await this.store.ready(r.id,player.sessionId,socket.id,p.epoch); player.state='READY';
      if(r.players.every(a=>a.state==='READY')&&!r.starting) {
        r.starting=true;
        try {
          const began=performance.now();
          const timing=await this.store.start(r.id,this.options.countdownMs??3000,this.options.capTicks??AUTHORITY_CAP_TICKS);
          r.metrics.startMs=performance.now()-began;
          if(r.stopped)return;
          Object.assign(r,timing); r.startMono=performance.now()+timing.startAt-Date.now();
          r.players.forEach(a=>{a.state='ACTIVE';});
        } catch { await this.finish(r,'START_FAILED',undefined,true); }
      }
      } finally {if(player.readyPendingEpoch===p.epoch)player.readyPendingEpoch=undefined;}
    }));
    socket.on('authority:controls',guarded(p=>{
      if(this.runs.get(p.instanceId)?.stopped)return;
      const {r,player}=this.authenticate(socket,p);
      if(player.state!=='ACTIVE'||!r.startAt||Date.now()<r.startAt) throw Error('NOT_ACTIVE');
      if(Object.keys(p).some(k=>!['sessionId','instanceId','matchId','gameId','version','nonce','epoch','seq','snapshot','left','right','up','down','fire'].includes(k))) throw Error('INPUT_SHAPE');
      player.controls.accept(p,performance.now(),player.snapshots);
      r.metrics.controls++;
    }));
    socket.on('authority:forfeit',guarded(async p=>{
      const {r,player}=this.authenticate(socket,p);
      if(player.state!=='ACTIVE') throw Error('ILLEGAL_FORFEIT');
      const opponent=r.players.find(a=>a!==player)!;
      await this.finish(r,'EXPLICIT_FORFEIT',opponent.socket?.connected?player.userId:undefined,!opponent.socket?.connected);
    }));
    socket.on('disconnect',()=>{
      for(const r of this.runs.values()) for(const p of r.players) if(p.socket?.id===socket.id) { p.disconnectedAt=performance.now(); p.controls.neutral(); }
    });
  }
  authenticate(socket:MatchmakingSocket,p:AuthorityBinding) {
    const r=this.runs.get(p.instanceId);
    const player=r?.players.find(a=>a.sessionId===p.sessionId);
    if(!r||r.stopped||!player||player.userId!==socket.data.userId||player.socket?.id!==socket.id) throw Error('SESSION_OWNERSHIP');
    const b=player.binding;
    if(!b||Object.keys(b).some(k=>p[k as keyof AuthorityBinding]!==b[k as keyof AuthorityBinding])) throw Error('SESSION_BINDING');
    if(performance.now()-r.leaseConfirmed>1900) throw Error('AUTHORITY_UNHEALTHY');
    return {r,player};
  }
  async bind(r:Run,p:Player,socket:MatchmakingSocket) {
    // Serialize simultaneous reconnects so an older database response cannot regain control.
    p.pending=p.pending.catch(()=>{}).then(async()=>{
      if(r.stopped)throw Error('SESSION_TERMINAL');
      const nonce=randomBytes(24).toString('hex');
      const began=performance.now();
      const epoch=await this.store.bind(r.id,p.sessionId,socket.id,nonce);
      r.metrics.bindMaxMs=Math.max(r.metrics.bindMaxMs,performance.now()-began);
      if(p.socket&&p.socket.id!==socket.id) p.socket.emit('authority:error',{code:'CONTROLLER_REPLACED'});
      p.socket=socket; p.disconnectedAt=null; p.controls=new LiveControls(); p.snapshots.clear();
      p.binding={sessionId:p.sessionId,instanceId:r.instanceId,matchId:r.matchId,gameId:'space-blaster',version:AUTHORITY_VERSION,nonce,epoch};
      socket.emit('authority:session',p.binding);
      this.snapshot(r,p);
    });
    return p.pending;
  }
  async create(instanceId:string) {
    const record=await this.store.create(instanceId,this.options.capTicks??AUTHORITY_CAP_TICKS,this.options.seedFactory?.());
    const now=performance.now();
    const r:Run={...record,players:record.sessions.map(s=>({ ...s,state:'CREATED',engine:new SpaceBlasterEngine(record.seed),controls:new LiveControls(),disconnectedAt:now,snapshots:new Map(),snapshotSeq:0,pending:Promise.resolve() })),created:now,startAt:null,deadline:null,startMono:null,ticks:0,snapshot:0,stopped:false,starting:false,leaseConfirmed:now,lastSnapshot:now,delivery:{generated:0,emitAttempts:0,backpressure:0,bytes:0,maxBytes:0,maxCreationToEmitMs:0,transports:{}},metrics:{activeLeaseMaxMs:0,waitingLeaseMaxMs:0,finalizingLeaseMaxMs:0,maxSnapshotGapMs:0,controls:0,maxTickMs:0,startMs:0,snapshotMs:0,maxSnapshotMs:0,snapshots:0,bindMaxMs:0,resultWriteMaxMs:0},timer:null!};
    r.players.forEach(p=>p.engine.resize(VIRTUAL_VIEWPORT.width,VIRTUAL_VIEWPORT.height));
    this.runs.set(instanceId,r);
    r.timer=setInterval(()=>this.tick(r),4); r.timer.unref();
    for(const p of r.players) { const socket=getOnlineSocket(p.userId); if(socket) await this.bind(r,p,socket); }
    return r;
  }
  snapshot(r:Run,p:Player,reliable=false) {
    const began=performance.now();
    const e=p.engine, seq=++p.snapshotSeq, createdAt=Date.now();
    const value:AuthoritySnapshot={sessionId:p.sessionId,epoch:p.binding?.epoch??0,createdAt,emittedAt:0,seq,serverTime:createdAt,startAt:r.startAt,deadline:r.deadline,state:p.state,tickCount:e.tickCount,score:e.score,gameOver:e.gameOver,shipX:e.shipX,shipY:e.shipY,bullets:e.bullets.filter(b=>b.active),asteroids:e.asteroids.filter(a=>a.active)};
    p.snapshots.set(seq,performance.now());
    for(const [key,time] of p.snapshots) if(performance.now()-time>500) p.snapshots.delete(key);
    value.emittedAt=Date.now();
    if(p.state==='ACTIVE'&&r.startAt!==null&&value.serverTime>=r.startAt){
      const bytes=Buffer.byteLength(JSON.stringify(value));r.delivery.generated++;r.delivery.bytes+=bytes;r.delivery.maxBytes=Math.max(r.delivery.maxBytes,bytes);
      r.delivery.maxCreationToEmitMs=Math.max(r.delivery.maxCreationToEmitMs,value.emittedAt-createdAt);
      if(p.socket?.connected){r.delivery.emitAttempts++;const transport=p.socket.conn.transport.name;r.delivery.transports[transport]=(r.delivery.transports[transport]??0)+1;if(!p.socket.conn.transport.writable)r.delivery.backpressure++;}
    }
    if(p.socket?.connected) { (reliable?p.socket:p.socket.volatile).emit('authority:snapshot',value); this.metrics.snapshots++; this.metrics.bytes+=Buffer.byteLength(JSON.stringify(value)); }
    const elapsed=performance.now()-began;
    r.metrics.snapshotMs+=elapsed;r.metrics.maxSnapshotMs=Math.max(r.metrics.maxSnapshotMs,elapsed);r.metrics.snapshots++;
  }
  private async persistResult(r:Run,p:Player,reason:string) {
    const began=performance.now();
    try {await this.store.result(r.id,p.sessionId,p.engine.score,p.engine.tickCount,reason);}
    finally {r.metrics.resultWriteMaxMs=Math.max(r.metrics.resultWriteMaxMs,performance.now()-began);}
  }
  tick(r:Run) {
    if(r.stopped)return;
    const now=performance.now();
    if(now-r.leaseConfirmed>1900) { console.warn('[authority] lease acknowledgement age ms',Math.round(now-r.leaseConfirmed)); void this.finish(r,'LEASE_UNCERTAIN',undefined,true); return; }
    if(r.startMono===null) {
      if(now-r.created>(this.options.readyMs??30000)) void this.finish(r,'READY_EXPIRED',undefined,true);
    } else if(now>=r.startMono) {
      const target=Math.floor((now-r.startMono)/(FIXED_TIMESTEP_SEC*1000));
      if(now-r.startMono-r.ticks*FIXED_TIMESTEP_SEC*1000>250) { void this.finish(r,'SERVER_TICK_LAG',undefined,true); return; }
      while(r.ticks<target&&!r.stopped) {
        const began=performance.now(); r.ticks++;
        for(const p of r.players) if(p.state==='ACTIVE') {
          const collision=p.engine.update(FIXED_TIMESTEP_SEC,p.controls.take(now));
          if(collision||p.engine.tickCount>=(this.options.capTicks??AUTHORITY_CAP_TICKS)) {
            p.state='COMPLETED';
            p.pending=p.pending.then(()=>this.persistResult(r,p,collision?'COLLISION':'CAP_REACHED'));
            void p.pending.catch(()=>this.finish(r,'RESULT_PERSISTENCE_FAILED',undefined,true));
          }
        }
        const cost=performance.now()-began; this.metrics.ticks++; this.metrics.tickMs+=cost; this.metrics.maxTickMs=Math.max(this.metrics.maxTickMs,cost);
        r.metrics.maxTickMs=Math.max(r.metrics.maxTickMs,cost);
      }
      if(r.players.every(p=>p.state==='COMPLETED')) { void this.finish(r,'SERVER_RESULTS'); return; }
      const disconnected=r.players.filter(p=>!p.socket?.connected);
      if(disconnected.length===2) { void this.finish(r,'BOTH_DISCONNECTED',undefined,true); return; }
      const gone=disconnected.find(p=>p.state==='ACTIVE'&&p.disconnectedAt!==null&&now-p.disconnectedAt>(this.options.reconnectMs??10000));
      if(gone) {
        const opponent=r.players.find(p=>p!==gone)!;
        const healthy=opponent.state==='COMPLETED'||now-opponent.controls.lastInput<1000;
        void this.finish(r,healthy?'RECONNECT_EXPIRED':'NETWORK_UNCERTAIN',healthy?gone.userId:undefined,!healthy);return;
      }
    }
    if(now-r.lastSnapshot>=50) {
      r.metrics.maxSnapshotGapMs=Math.max(r.metrics.maxSnapshotGapMs,now-(r.lastSnapshotPublished??r.created));
      r.lastSnapshotPublished=now;
      // Keep the 20Hz schedule anchored. Resetting to now on coarse timers
      // accumulated drift and reduced actual publication to roughly 16Hz.
      r.lastSnapshot+=Math.floor((now-r.lastSnapshot)/50)*50;
      r.players.forEach(p=>this.snapshot(r,p));
    }
  }
  async finish(r:Run,reason:string,forfeitUser?:string,systemVoid=false) {
    if(r.stopped)return;
    console.info('[authority] terminal reason:',reason);
    const finished=performance.now();
    let receiptWaitMs=0, decisionAndApplyMs=0, notificationEmitMs=0;
    r.stopped=true; clearInterval(r.timer);
    try {
      if(forfeitUser&&!systemVoid) for(const p of r.players) if(p.state==='ACTIVE') {
        p.state=p.userId===forfeitUser?'FORFEITED':'COMPLETED';
        p.pending=p.pending.then(()=>this.persistResult(r,p,p.userId===forfeitUser?'FORFEIT':'OPPONENT_FORFEIT'));
      }
      for(const p of r.players){if(systemVoid)p.state='VOIDED';this.snapshot(r,p,true);}
      const receiptsStarted=performance.now();
      await Promise.all(r.players.map(p=>p.pending));
      receiptWaitMs=performance.now()-receiptsStarted;
      const decisionStarted=performance.now();
      const outcome=await this.store.decide(r.id,reason,forfeitUser,systemVoid);
      decisionAndApplyMs=performance.now()-decisionStarted;
      const notificationStarted=performance.now();
      r.players.forEach(p=>p.socket?.emit('authority:outcome',{...outcome,yourScore:p.engine.score}));
      notificationEmitMs=performance.now()-notificationStarted;
    } catch {
      // No speculative winner: durable decisions retry; lost state expires to recovery/refund.
      r.players.forEach(p=>p.socket?.emit('authority:error',{code:'RESULT_PENDING_RECOVERY'}));
    } finally {
      // Bounded operational evidence; never includes controls, session nonces or account identifiers.
      console.info('[authority] run metrics',JSON.stringify({instanceId:r.instanceId,reason,ticks:r.ticks,activeMs:r.startMono===null?0:Math.max(0,finished-r.startMono),settlementMs:performance.now()-finished,receiptWaitMs,decisionAndApplyMs,notificationEmitMs,...r.metrics,delivery:r.delivery}));
      this.runs.delete(r.instanceId);
    }
  }
  private closed=false;
  close() {
    if(this.closed)return;this.closed=true;
    console.info('[authority] runtime metrics',JSON.stringify({...this.metrics,averageRunTickMs:this.metrics.ticks?this.metrics.tickMs/this.metrics.ticks:0}));
    clearInterval(this.recoveryTimer);clearInterval(this.leaseTimer);
    for(const r of this.runs.values()){r.stopped=true;clearInterval(r.timer);}
    this.runs.clear();void this.store.close().catch(()=>{});
  }
}
