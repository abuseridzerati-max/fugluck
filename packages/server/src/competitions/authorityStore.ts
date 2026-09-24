import { randomInt, randomUUID, createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { Pool, type PoolClient } from 'pg';
import { AUTHORITY_VERSION, AUTHORITY_CAP_TICKS, createMoney, type ISO4217Currency, type AuthorityOutcome } from '@fugluck/shared';
import { pool } from '../db/client';
import { SandboxAccountingAdapter } from '../accounting/sandboxAdapter';
import type { CompetitionAccountingPort } from '../accounting/port';

export const nonceHash = (nonce: string) => createHash('sha256').update(nonce).digest('hex');
export class AuthorityStore {
  // A warm, bounded channel keeps lease heartbeats independent of accounting pool traffic.
  private leasePool=new Pool({...pool.options,max:1,connectionTimeoutMillis:5000,statement_timeout:1000});
  constructor(readonly ownerId = randomUUID(), readonly accounting: CompetitionAccountingPort = new SandboxAccountingAdapter()) {}
  async transaction<T>(fn: (c: PoolClient) => Promise<T>, stage = 'authority') : Promise<T> {
    const requested=performance.now();
    const c = await pool.connect();
    const acquired=performance.now();
    try { await c.query('BEGIN'); const v = await fn(c); await c.query('COMMIT'); return v; }
    catch(e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); console.info('[authority] database transaction metrics',JSON.stringify({stage,acquisitionMs:acquired-requested,transactionMs:performance.now()-acquired})); }
  }
  async lock(c: PoolClient, id: string, requireLease = true) {
    const r = (await c.query(`SELECT *, lease_until > clock_timestamp() AS healthy FROM competition_authority_runs WHERE id=$1 FOR UPDATE`, [id])).rows[0];
    if (!r || (requireLease && (r.owner_id !== this.ownerId || !r.healthy || r.terminal_at))) throw Error('AUTHORITY_FENCED');
    return r;
  }
  async create(instanceId: string, capTicks=AUTHORITY_CAP_TICKS, seed=randomInt(1,2147483647)) {
    if(!Number.isSafeInteger(seed)||seed<1||seed>=2147483647)throw Error('INVALID_SERVER_SEED');
    await this.leasePool.query('SELECT 1');
    return this.transaction(async c => {
      const inst = (await c.query('SELECT * FROM competition_instances WHERE id=$1 FOR UPDATE', [instanceId])).rows[0];
      const existing = (await c.query('SELECT * FROM competition_authority_runs WHERE instance_id=$1', [instanceId])).rows[0];
      if (existing) throw Error('AUTHORITY_ALREADY_EXISTS');
      if (!inst || inst.status !== 'LOCKED' || inst.game_id !== 'space-blaster' || inst.participant_capacity !== 2) throw Error('AUTHORITY_UNSUPPORTED');
      const players = (await c.query('SELECT user_id FROM competition_participants WHERE instance_id=$1 ORDER BY seat_index', [instanceId])).rows;
      if (players.length !== 2) throw Error('AUTHORITY_CAPACITY');
      const id = randomUUID(), matchId = `comp_match_${randomUUID()}`;
      await c.query(`INSERT INTO matches_history(id,game_id,player1_id,player2_id,competition_instance_id,currency,stake,seed,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'ACTIVE')`, [matchId,inst.game_id,players[0].user_id,players[1].user_id,instanceId,inst.currency,inst.entry_fee_minor,seed]);
      await c.query('UPDATE competition_instances SET match_id=$2 WHERE id=$1', [instanceId,matchId]);
      await c.query(`INSERT INTO competition_authority_runs(id,instance_id,match_id,game_id,version,seed,owner_id,lease_until,cap_ticks) VALUES($1,$2,$3,$4,$5,$6,$7,clock_timestamp()+interval '2 seconds',$8)`, [id,instanceId,matchId,inst.game_id,AUTHORITY_VERSION,seed,this.ownerId,capTicks]);
      const sessions = [];
      for (const p of players) {
        const sessionId = randomUUID();
        await c.query('INSERT INTO competition_authority_sessions(id,run_id,user_id) VALUES($1,$2,$3)', [sessionId,id,p.user_id]);
        sessions.push({ sessionId, userId: p.user_id as string });
      }
      await c.query(`UPDATE competition_authority_runs SET lease_until=clock_timestamp()+interval '2 seconds' WHERE id=$1`, [id]);
      return { id, instanceId, matchId, seed, sessions };
    });
  }
  async renew(ids: string[]) {
    if(!ids.length)return new Set<string>();
    const r = await this.leasePool.query(`UPDATE competition_authority_runs SET lease_until=clock_timestamp()+interval '2 seconds' WHERE id=ANY($1::text[]) AND owner_id=$2 AND lease_until>clock_timestamp() AND terminal_at IS NULL RETURNING id`, [ids,this.ownerId]);
    return new Set<string>(r.rows.map(row=>row.id));
  }
  close() { return this.leasePool.end(); }
  async bind(id: string, sessionId: string, socketId: string, nonce: string) {
    const s=await pool.query(`WITH leased AS (SELECT id FROM competition_authority_runs WHERE id=$2 AND owner_id=$5 AND lease_until>clock_timestamp() AND terminal_at IS NULL FOR UPDATE)
      UPDATE competition_authority_sessions SET controller_id=$3,nonce_hash=$4,epoch=epoch+1 WHERE id=$1 AND run_id IN (SELECT id FROM leased) RETURNING epoch`,[sessionId,id,socketId,nonceHash(nonce),this.ownerId]);
    if(!s.rowCount)throw Error('AUTHORITY_FENCED');
    return Number(s.rows[0].epoch);
  }
  async ready(id: string, sessionId: string, controllerId: string, epoch: number) {
    const r=await pool.query(`WITH leased AS (SELECT id FROM competition_authority_runs WHERE id=$2 AND owner_id=$3 AND lease_until>clock_timestamp() AND terminal_at IS NULL FOR UPDATE)
      UPDATE competition_authority_sessions SET status='READY' WHERE id=$1 AND run_id IN (SELECT id FROM leased) AND status='CREATED' AND controller_id=$4 AND epoch=$5 RETURNING id`,[sessionId,id,this.ownerId,controllerId,epoch]);
    if(!r.rowCount)throw Error('ILLEGAL_READY');
  }
  async start(id: string, countdown: number, capTicks: number) {
    // The durable run exists before capture. Any interrupted capture is recovered by a VOID decision.
    const r=(await pool.query('SELECT * FROM competition_authority_runs WHERE id=$1 AND owner_id=$2 AND lease_until>clock_timestamp() AND terminal_at IS NULL',[id,this.ownerId])).rows[0];
    if(!r)throw Error('AUTHORITY_FENCED');
    if(r.cap_ticks!==capTicks)throw Error('RULES_MISMATCH');
    const sessions = (await pool.query('SELECT * FROM competition_authority_sessions WHERE run_id=$1', [id])).rows;
    if (sessions.length !== 2 || sessions.some(s => s.status !== 'READY')) throw Error('NOT_READY');
    for (const s of sessions) {
      const cap = await this.accounting.captureEntry({competitionInstanceId:r.instance_id,userId:s.user_id,idempotencyKey:`authority_capture:${s.id}`});
      if (!cap.success) throw Error('CAPTURE_FAILED');
    }
      const t = (await pool.query(`WITH run AS (
        UPDATE competition_authority_runs SET status='ACTIVE',start_at=clock_timestamp()+$2*interval '1 millisecond',deadline=clock_timestamp()+($2+$3)*interval '1 millisecond' WHERE id=$1 AND owner_id=$5 AND status='CREATED' AND lease_until>clock_timestamp() AND terminal_at IS NULL RETURNING id,start_at,deadline
      ), sessions AS (UPDATE competition_authority_sessions SET status='ACTIVE' WHERE run_id IN (SELECT id FROM run) AND status='READY'),
      instance AS (UPDATE competition_instances SET status='ACTIVE',started_at=(SELECT start_at FROM run) WHERE id=$4 AND EXISTS(SELECT 1 FROM run)),
      participants AS (UPDATE competition_participants SET status='PLAYING' WHERE instance_id=$4 AND EXISTS(SELECT 1 FROM run))
      SELECT start_at,deadline FROM run`, [id,countdown,capTicks/60*1000,r.instance_id,this.ownerId])).rows[0];
      if(!t)throw Error('ILLEGAL_START');
      return { startAt: new Date(t.start_at).getTime(), deadline: new Date(t.deadline).getTime() };
  }
  async result(id: string, sessionId: string, score: number, ticks: number, reason: string) {
      const result = await pool.query(`WITH leased AS (SELECT id,instance_id FROM competition_authority_runs WHERE id=$2 AND owner_id=$7 AND lease_until>clock_timestamp() AND terminal_at IS NULL FOR UPDATE), session AS (
        UPDATE competition_authority_sessions SET status=CASE WHEN $6='FORFEIT' THEN 'FORFEITED' ELSE 'COMPLETED' END,terminal_at=clock_timestamp() WHERE id=$1 AND run_id IN (SELECT id FROM leased) AND status='ACTIVE' RETURNING id,user_id
      ), receipt AS (INSERT INTO competition_authority_results(id,session_id,score,ticks,reason) SELECT $3,id,$4,$5,$6 FROM session RETURNING id),
      participant AS (UPDATE competition_participants SET status=CASE WHEN $6='FORFEIT' THEN 'FORFEITED' ELSE 'SUBMITTED' END,score=$4 WHERE instance_id=(SELECT instance_id FROM leased) AND user_id=(SELECT user_id FROM session)),
      instance AS (UPDATE competition_instances SET status='VERIFYING' WHERE id=(SELECT instance_id FROM leased) AND status='ACTIVE') SELECT id FROM receipt`, [sessionId,id,randomUUID(),score,ticks,reason,this.ownerId]);
      if(!result.rowCount)throw Error('ILLEGAL_RESULT');
  }
  async decide(id: string, reason: string, forfeitUser?: string, systemVoid = false, recovery = false, administrativeVoid = false) {
    const began=performance.now();
    await this.transaction(async c => {
      const r = await this.lock(c,id,false);
      if ((await c.query('SELECT 1 FROM competition_authority_decisions WHERE run_id=$1', [id])).rowCount) return;
      if (!(administrativeVoid && systemVoid) && (recovery ? r.healthy : (r.owner_id !== this.ownerId || !r.healthy))) throw Error('AUTHORITY_FENCED');
      const s = (await c.query(`SELECT s.*,v.id AS result_id,v.score FROM competition_authority_sessions s LEFT JOIN competition_authority_results v ON v.session_id=s.id WHERE run_id=$1 ORDER BY s.id`, [id])).rows;
      let kind = 'VOID', winner: string | null = null;
      if (!systemVoid) {
        if (forfeitUser) {
          if (s.length !== 2 || !s.some(p => p.user_id === forfeitUser) || s.some(p=>!p.result_id)) throw Error('INVALID_FORFEITER');
          kind='FORFEIT'; winner=s.find(p=>p.user_id!==forfeitUser).user_id;
        } else {
          if (s.length !== 2 || s.some(p=>!p.result_id)) throw Error('RESULTS_PENDING');
          kind=s[0].score===s[1].score?'DRAW':'WIN';
          if (kind==='WIN') winner=(s[0].score>s[1].score?s[0]:s[1]).user_id;
        }
      }
      await c.query(`INSERT INTO competition_authority_decisions(run_id,kind,winner_user_id,reason,result_ids) VALUES($1,$2,$3,$4,$5)`, [id,kind,winner,reason,JSON.stringify(s.map(p=>p.result_id).filter(Boolean))]);
      await c.query(`UPDATE competition_authority_runs SET status=$2,terminal_at=clock_timestamp(),fence=fence+1 WHERE id=$1`, [id,kind==='VOID'?'VOIDED':'COMPLETED']);
      await c.query(`UPDATE competition_authority_sessions SET status=CASE WHEN $3='READY_EXPIRED' THEN 'EXPIRED' WHEN user_id=$2 THEN 'FORFEITED' ELSE 'VOIDED' END,terminal_at=clock_timestamp() WHERE run_id=$1 AND status NOT IN ('COMPLETED','FORFEITED','VOIDED','EXPIRED')`, [id,forfeitUser??null,reason]);
    },'terminal_decision');
    console.info('[authority] terminal persistence metrics',JSON.stringify({terminalWriteMs:performance.now()-began}));
    return this.apply(id);
  }
  async apply(id: string): Promise<AuthorityOutcome> {
    const lookupStarted=performance.now();
    const d = (await pool.query('SELECT d.*,r.instance_id,r.match_id FROM competition_authority_decisions d JOIN competition_authority_runs r ON r.id=d.run_id WHERE run_id=$1', [id])).rows[0];
    if (!d) throw Error('DECISION_PENDING');
    const status = d.winner_user_id ? 'SETTLED':'VOIDED';
    if (!d.applied_at) {
      const began=performance.now();
      const decisionLookupMs=performance.now()-lookupStarted;
      const prizes = d.winner_user_id ? (await pool.query('SELECT * FROM competition_instance_prizes WHERE instance_id=$1 ORDER BY placement', [d.instance_id])).rows : [];
      const prize = prizes.find(p=>p.placement===1);
      const amount = Number(prize?.amount_minor??0);
      const ledgerStarted=performance.now();
      const result = d.winner_user_id
        ? await this.accounting.settleCompetition({competitionInstanceId:d.instance_id,prizes:[{placement:1,userId:d.winner_user_id,amount:createMoney(amount,(prize?.currency??'GEL') as ISO4217Currency)}],idempotencyKey:`authority_decision:${id}`})
        : await this.accounting.refundCompetition({competitionInstanceId:d.instance_id,reason:d.reason,idempotencyKey:`authority_decision:${id}`});
      if (!result.success) throw Error('ACCOUNTING_PENDING');
      const ledgerMs=performance.now()-ledgerStarted, lifecycleStarted=performance.now();
      await this.transaction(async c => {
        await this.lock(c,id,false);
        if ((await c.query('SELECT applied_at FROM competition_authority_decisions WHERE run_id=$1',[id])).rows[0].applied_at) return;
        await c.query('UPDATE competition_instances SET status=$2,winner_user_id=$3,settled_at=now() WHERE id=$1', [d.instance_id,status,d.winner_user_id]);
        await c.query(`UPDATE competition_participants SET
          status=CASE WHEN $2::text IS NULL THEN 'VOIDED' WHEN status='FORFEITED' THEN 'FORFEITED' ELSE 'SUBMITTED' END,
          rank=CASE WHEN $2::text IS NULL THEN NULL WHEN user_id=$2 THEN 1 ELSE 2 END,
          prize_won_minor=CASE WHEN user_id=$2 THEN $3 ELSE 0 END WHERE instance_id=$1`, [d.instance_id,d.winner_user_id,amount]);
        if (d.winner_user_id) await c.query('UPDATE competition_instance_prizes SET awarded_user_id=$2 WHERE instance_id=$1 AND placement=1', [d.instance_id,d.winner_user_id]);
        await c.query(`UPDATE matches_history m SET status=$2,winner_id=$3,status_reason=$4,ended_at=now(),score_p1=COALESCE((SELECT score FROM competition_participants WHERE instance_id=$5 AND user_id=m.player1_id),0),score_p2=COALESCE((SELECT score FROM competition_participants WHERE instance_id=$5 AND user_id=m.player2_id),0) WHERE id=$1`, [d.match_id,d.winner_user_id?'COMPLETED':d.kind==='DRAW'?'DRAW':'VOIDED',d.winner_user_id,d.reason,d.instance_id]);
        await c.query('UPDATE competition_authority_decisions SET applied_at=COALESCE(applied_at,now()) WHERE run_id=$1', [id]);
      },'terminal_application');
      console.info('[authority] accounting application metrics',JSON.stringify({instanceId:d.instance_id,decisionLookupMs,ledgerMs,lifecycleMs:performance.now()-lifecycleStarted,applicationMs:performance.now()-began}));
    }
    return {instanceId:d.instance_id,status,reason:d.reason,winnerUserId:d.winner_user_id};
  }
  async recover() {
    const runs = (await pool.query(`SELECT r.id,d.run_id AS decision FROM competition_authority_runs r LEFT JOIN competition_authority_decisions d ON d.run_id=r.id WHERE (d.run_id IS NOT NULL AND d.applied_at IS NULL) OR (r.terminal_at IS NULL AND r.lease_until<=clock_timestamp())`)).rows;
    for (const r of runs) {
      if (r.decision) await this.apply(r.id);
      else {
        const receipts=(await pool.query('SELECT v.reason,s.user_id FROM competition_authority_results v JOIN competition_authority_sessions s ON s.id=v.session_id WHERE s.run_id=$1',[r.id])).rows;
        const forfeiter=receipts.find(p=>p.reason==='FORFEIT')?.user_id;
        await this.decide(r.id,receipts.length===2?'SERVER_RESULTS':'OWNER_STATE_LOST',forfeiter,receipts.length!==2,true);
      }
    }
  }
  async resumeOutcome(instanceId:string,userId:string) {
    const r=(await pool.query(`SELECT r.id,v.score FROM competition_authority_runs r JOIN competition_authority_sessions s ON s.run_id=r.id JOIN competition_authority_decisions d ON d.run_id=r.id LEFT JOIN competition_authority_results v ON v.session_id=s.id WHERE r.instance_id=$1 AND s.user_id=$2`,[instanceId,userId])).rows[0];
    return r?{...await this.apply(r.id),yourScore:r.score??undefined}:null;
  }
}
