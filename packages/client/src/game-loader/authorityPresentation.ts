import type { AuthoritySnapshot } from '@fugluck/shared'

export function distribution(values: number[]) {
  const a=[...values].sort((x,y)=>x-y)
  const percentile=(p:number)=>a.length ? a[Math.max(0,Math.ceil(a.length*p)-1)] : 0
  return {count:a.length,p50:percentile(.5),p95:percentile(.95),p99:percentile(.99),max:a.at(-1)??0}
}

/** Bounded client-only presentation diagnostics. No credentials or control history. */
export class AuthorityPresentation {
  latest:AuthoritySnapshot|null=null
  previous:AuthoritySnapshot|null=null
  receivedAt=0
  appliedAt=0
  renderedAt=0
  rejected=0
  missing=0
  hiddenReceives=0
  received=0
  rendered=0
  maxBytes=0
  private lastRender=0
  private arrival:number[]=[]
  private generation:number[]=[]
  private emit:number[]=[]
  private processing:number[]=[]
  private frame:number[]=[]
  private creationToEmit:number[]=[]
  private activeArrival:number[]=[]
  private activeFrame:number[]=[]
  private activeGeneration:number[]=[]
  private activeEmit:number[]=[]
  private longTasks:number[]=[]
  private activeFirst=0
  private activeLast=0
  private activeFirstTick=0
  private activeLastTick=0
  activeReceived=0
  activeRendered=0
  private push(a:number[],n:number){a.push(n);if(a.length>3600)a.shift()}
  accept(p:AuthoritySnapshot,sessionId:string,epoch:number,now:number,hidden=false) {
    const prev=this.latest
    if(p.sessionId!==sessionId||p.epoch!==epoch||!Number.isSafeInteger(p.seq)||
      !Number.isFinite(p.createdAt)||!Number.isFinite(p.emittedAt)||
      (prev&&(p.seq<=prev.seq||p.tickCount<prev.tickCount))) {this.rejected++;return false}
    if(prev){
      this.missing+=Math.max(0,p.seq-prev.seq-1)
      this.push(this.arrival,now-this.receivedAt)
      this.push(this.generation,p.createdAt-prev.createdAt)
      this.push(this.emit,p.emittedAt-prev.emittedAt)
    }
    this.previous=prev;this.latest=p;this.receivedAt=now;this.received++
    if(p.state==='ACTIVE'&&p.startAt!==null&&p.serverTime>=p.startAt){
      if(this.activeReceived){this.push(this.activeArrival,now-this.activeLast);if(prev){this.push(this.activeGeneration,p.createdAt-prev.createdAt);this.push(this.activeEmit,p.emittedAt-prev.emittedAt)}}
      else{this.activeFirst=now;this.activeFirstTick=p.tickCount}
      this.activeReceived++;this.activeLast=now;this.activeLastTick=p.tickCount
    }
    if(hidden)this.hiddenReceives++
    this.push(this.creationToEmit,p.emittedAt-p.createdAt)
    this.maxBytes=Math.max(this.maxBytes,new TextEncoder().encode(JSON.stringify(p)).length)
    return true
  }
  applied(now:number){this.appliedAt=now;this.push(this.processing,now-this.receivedAt)}
  frameAt(now:number){
    if(this.lastRender){this.push(this.frame,now-this.lastRender);if(this.latest?.state==='ACTIVE'&&this.activeReceived){this.push(this.activeFrame,now-this.lastRender);this.activeRendered++}}
    this.lastRender=now;this.renderedAt=now;this.rendered++
  }
  longTask(duration:number){this.push(this.longTasks,duration)}
  report(){return {received:this.received,rendered:this.rendered,missing:this.missing,rejected:this.rejected,
    hiddenReceives:this.hiddenReceives,maxPayloadBytes:this.maxBytes,receiveTimestamp:this.receivedAt,
    applicationTimestamp:this.appliedAt,renderTimestamp:this.renderedAt,
    sessionId:this.latest?.sessionId,tick:this.latest?.tickCount,sequence:this.latest?.seq,
    serverCreatedAt:this.latest?.createdAt,serverEmittedAt:this.latest?.emittedAt,
    interArrivalMs:distribution(this.arrival),serverGenerationGapMs:distribution(this.generation),
    serverEmitGapMs:distribution(this.emit),creationToEmitMs:distribution(this.creationToEmit),
    applicationDelayMs:distribution(this.processing),renderGapMs:distribution(this.frame),longTaskMs:distribution(this.longTasks),
    active:{received:this.activeReceived,rendered:this.activeRendered,durationMs:this.activeLast-this.activeFirst,
      tickHz:(this.activeLastTick-this.activeFirstTick)*1000/Math.max(1,this.activeLast-this.activeFirst),
      receiveHz:Math.max(0,this.activeReceived-1)*1000/Math.max(1,this.activeLast-this.activeFirst),
      renderHz:this.activeFrame.length*1000/Math.max(1,this.activeFrame.reduce((a,b)=>a+b,0)),
      serverGenerationHz:this.activeGeneration.length*1000/Math.max(1,this.activeGeneration.reduce((a,b)=>a+b,0)),
      serverEmitHz:this.activeEmit.length*1000/Math.max(1,this.activeEmit.reduce((a,b)=>a+b,0)),
      interArrivalMs:distribution(this.activeArrival),renderGapMs:distribution(this.activeFrame),
      serverGenerationGapMs:distribution(this.activeGeneration),serverEmitGapMs:distribution(this.activeEmit)}}}
  /** One snapshot interval of interpolation, no extrapolation or simulated physics.
   * A long delivery gap snaps to the latest state instead of hiding missing data. */
  visual(now:number):AuthoritySnapshot|null {
    const b=this.latest,a=this.previous
    if(!b||!a||b.state!=='ACTIVE'||a.state!=='ACTIVE'||b.createdAt-a.createdAt>150||now-this.receivedAt>150)return b
    const t=Math.min(1,Math.max(0,(now-this.receivedAt)/Math.max(1,b.createdAt-a.createdAt)))
    const lerp=(x:number,y:number)=>x+(y-x)*t
    const positions=<T extends {id:number;x:number;y:number}>(old:T[],current:T[])=>current.map(v=>{
      const previous=old.find(x=>x.id===v.id);return previous?{...v,x:lerp(previous.x,v.x),y:lerp(previous.y,v.y)}:{...v}
    })
    return {...b,shipX:lerp(a.shipX,b.shipX),shipY:lerp(a.shipY,b.shipY),
      bullets:positions(a.bullets,b.bullets),asteroids:positions(a.asteroids,b.asteroids)}
  }
}
