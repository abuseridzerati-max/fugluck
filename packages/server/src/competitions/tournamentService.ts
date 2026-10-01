import { logger } from '../utils/safeLogger';
import { createHash, randomUUID } from 'node:crypto';
import { createMoney, type AuthorityOutcome, type TournamentTerms } from '@fugluck/shared';
import { pool } from '../db/client';
import type { CompetitionAccountingPort } from '../accounting/port';
import { StagingMockAccountingRouter } from '../accounting/stagingMockRouter';
import { evaluateEligibility } from '../payments/eligibility';
import { createTournamentInstance, currentTournamentConfig, knockoutEnabled, readProduct, tournamentLock, tournamentTx, type ProductRow } from './tournamentPersistence';
import { consumeTournamentTicket, recordStandardQualification, replaceTournamentTickets, ticketForJoin } from './tournamentQualification';
import { seedBracket } from './tournamentRules';
import { allowedMockUser, isMockTemplate, stagingMockAction } from '../config/stagingMockCommercial';

function domainError(code:string){return Object.assign(new Error(code),{code});}
const recoveryWarnings=new Set<string>();
export class TournamentService {
  constructor(readonly accounting:CompetitionAccountingPort=new StagingMockAccountingRouter()){}
  private async eligible(userId:string,product:ProductRow){
    // Production financial qualification is deliberately unavailable until a separately approved provider/policy rollout.
    if(product.provenance==='LIVE')throw domainError('REAL_MONEY_DISABLED');
    if(product.provenance==='STAGING_MOCK'&&(!stagingMockAction('competitions')||!allowedMockUser(userId)||!isMockTemplate(product.template_id)))throw domainError('MOCK_AUTHORIZATION_REQUIRED');
    const template=(await pool.query('SELECT enabled FROM competition_templates WHERE id=$1',[product.template_id])).rows[0];
    if(!template?.enabled)throw domainError('TEMPLATE_DISABLED');
    const user=(await pool.query('SELECT status FROM users WHERE id=$1',[userId])).rows[0];
    const risk=await pool.query(`SELECT 1 FROM commercial_risk_cases WHERE user_id=$1 AND status='RESTRICTED' AND enforcement_action IN ('BLOCK_ALL','BLOCK_COMPETITIONS') LIMIT 1`,[userId]);
    const decision=evaluateEligibility({enabled:{DEPOSIT:false,WITHDRAWAL:false,COMPETITION:true},maxSingleMinor:{COMPETITION:1000000},
      requireVerifiedIdentity:{COMPETITION:false},allowedJurisdictions:{COMPETITION:['GE']}},
      {action:'COMPETITION',amountMinor:product.terms.entryMinor,accountActive:user?.status==='active',identityVerified:false,jurisdiction:'GE',riskSignals:risk.rowCount?['PROMOTION_ABUSE']:[]});
    if(!decision.allowed)throw domainError(decision.reasons[0]);
  }
  async join(templateId:string,userId:string,now=Date.now()) {
    if(!knockoutEnabled())throw domainError('TOURNAMENT_DISABLED');
    const value=await tournamentLock(`tournament-join:${templateId}`,async()=>{
      const product=await readProduct(templateId);if(!product)throw domainError('TEMPLATE_NOT_FOUND');
      await this.eligible(userId,product);
      // Resume/compensate interrupted reservations before allocating another seat.
      const pending=(await pool.query(`SELECT e.instance_id,e.user_id FROM competition_entry_intents e JOIN competition_instances ci ON ci.id=e.instance_id
        WHERE ci.template_id=$1 AND e.state IN ('PENDING','COMPENSATING') ORDER BY e.created_at`,[templateId])).rows;
      for(const intent of pending)await this.finishEntry(intent.instance_id,intent.user_id,product,now);
      const owned=(await pool.query(`SELECT ci.id FROM competition_instances ci JOIN competition_participants cp ON cp.instance_id=ci.id
        WHERE ci.template_id=$1 AND cp.user_id=$2 AND ci.status IN ('PENDING_ENTRANTS','LOCKED','ACTIVE','VERIFYING') LIMIT 1`,[templateId,userId])).rows[0];
      if(owned)return this.joinReceipt(owned.id,userId);
      const id=await tournamentTx(async c=>{
        const ticket=await ticketForJoin(c,product,userId,now);
        let target=(await c.query(`SELECT ci.id FROM competition_instances ci JOIN competition_tournaments t ON t.instance_id=ci.id
          WHERE ci.template_id=$1 AND t.state='WAITING' AND ci.current_participants<ci.participant_capacity
          AND (t.cycle_id IS NOT NULL OR t.created_at+(t.terms->'config'->>'waitingMs')::bigint*interval '1 millisecond'>$2)
          ORDER BY ci.created_at LIMIT 1 FOR UPDATE OF ci`,[templateId,new Date(now)])).rows[0]?.id;
        if(!target){
          if(product.cycle_id&&(await c.query('SELECT 1 FROM competition_tournaments WHERE cycle_id=$1',[product.cycle_id])).rowCount)throw domainError('CYCLE_FULL');
          if(product.product==='STANDARD'&&product.terms.configRevision!==(await currentTournamentConfig(product.game_id,c)).revision)throw domainError('TEMPLATE_RETIRED');
          target=await createTournamentInstance(c,product);
        }
        const previous=(await c.query('SELECT state FROM competition_entry_intents WHERE instance_id=$1 AND user_id=$2',[target,userId])).rows[0];
        if(previous?.state==='REJECTED'){
          const financial=await c.query(`SELECT 1 FROM sandbox_entry_reservations WHERE competition_instance_id=$1 AND user_id=$2
            UNION ALL SELECT 1 FROM commercial_operations WHERE competition_instance_id=$1 AND user_id=$2 AND kind='ENTRY'`,[target,userId]);
          if(financial.rowCount)throw domainError('ENTRY_PREVIOUSLY_RELEASED');
          await c.query("UPDATE competition_entry_intents SET state='PENDING',ticket_id=$3,updated_at=now() WHERE instance_id=$1 AND user_id=$2",[target,userId,ticket]);
        }
        await c.query(`INSERT INTO competition_entry_intents(instance_id,user_id,ticket_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING`,[target,userId,ticket]);
        return target as string;
      });
      await this.finishEntry(id,userId,product,now);
      return this.joinReceipt(id,userId);
    });
    return value!;
  }
  private async joinReceipt(id:string,userId:string){
    const r=(await pool.query(`SELECT ci.*,cp.seat_index FROM competition_instances ci JOIN competition_participants cp ON cp.instance_id=ci.id WHERE ci.id=$1 AND cp.user_id=$2`,[id,userId])).rows[0];
    if(!r)throw domainError('ENTRY_REJECTED');
    return {instanceId:id,templateId:r.template_id,gameId:r.game_id,seatIndex:r.seat_index,currentParticipants:r.current_participants,
      participantCapacity:r.participant_capacity,status:r.status,isLocked:r.status==='LOCKED',entryFeeMinor:r.entry_fee_minor,currency:r.currency};
  }
  private async compensate(id:string,userId:string,amount:number){
    await pool.query("UPDATE competition_entry_intents SET state='COMPENSATING',updated_at=now() WHERE instance_id=$1 AND user_id=$2 AND state<>'ACCEPTED'",[id,userId]);
    if(amount>0){const r=await this.accounting.releaseEntry({competitionInstanceId:id,userId,idempotencyKey:`tournament-release:${id}:${userId}`});
      if(!r.success&&r.errorCode!=='RESERVATION_NOT_FOUND')throw domainError('ACCOUNTING_PENDING');}
    await pool.query("UPDATE competition_entry_intents SET state='REJECTED',updated_at=now() WHERE instance_id=$1 AND user_id=$2 AND state='COMPENSATING'",[id,userId]);
  }
  private async finishEntry(id:string,userId:string,product:ProductRow,now:number){
    const intent=(await pool.query('SELECT * FROM competition_entry_intents WHERE instance_id=$1 AND user_id=$2',[id,userId])).rows[0];
    if(!intent||intent.state==='REJECTED')throw domainError('ENTRY_REJECTED');
    if(intent.state==='ACCEPTED')return;
    const entry=product.terms.entryMinor;
    if(intent.state==='COMPENSATING'){await this.compensate(id,userId,entry);return;}
    try{
      if(entry>0){const reserved=await this.accounting.reserveEntry({competitionInstanceId:id,userId,entryFee:createMoney(entry,'GEL'),idempotencyKey:`tournament-reserve:${id}:${userId}`});
        if(!reserved.success)throw domainError(reserved.errorCode??'RESERVATION_FAILED');}
      await tournamentTx(async c=>{
        const inst=(await c.query('SELECT * FROM competition_instances WHERE id=$1 FOR UPDATE',[id])).rows[0];
        const root=(await c.query('SELECT * FROM competition_tournaments WHERE instance_id=$1 FOR UPDATE',[id])).rows[0];
        if(root.state!=='WAITING'||inst.status!=='PENDING_ENTRANTS'||inst.current_participants>=inst.participant_capacity)throw domainError('CYCLE_FULL');
        if(!root.cycle_id&&now-new Date(root.created_at).getTime()>=root.terms.config.waitingMs)throw domainError('CYCLE_CLOSED');
        if(product.product!=='STANDARD'){
          const fresh=await ticketForJoin(c,product,userId,now);if(fresh!==intent.ticket_id)throw domainError('QUALIFICATION_REQUIRED');
        }
        await consumeTournamentTicket(c,intent.ticket_id,id,userId,now);
        const seat=inst.current_participants,full=seat+1===inst.participant_capacity;
        await c.query(`INSERT INTO competition_participants(id,instance_id,user_id,seat_index,entry_fee_minor,status) VALUES($1,$2,$3,$4,$5,'REGISTERED')`,[`part_${randomUUID()}`,id,userId,seat,entry]);
        await c.query(`UPDATE competition_instances SET current_participants=current_participants+1,status=$2,locked_at=CASE WHEN $3 THEN now() ELSE NULL END WHERE id=$1`,[id,full?'LOCKED':'PENDING_ENTRANTS',full]);
        if(full)await c.query("UPDATE competition_tournaments SET state='CAPTURING' WHERE instance_id=$1",[id]);
        await c.query("UPDATE competition_entry_intents SET state='ACCEPTED',updated_at=now() WHERE instance_id=$1 AND user_id=$2",[id,userId]);
      });
    }catch(e){
      // A failed/ambiguous COMMIT must not release an entry already durably admitted.
      const committed=(await pool.query('SELECT state FROM competition_entry_intents WHERE instance_id=$1 AND user_id=$2',[id,userId])).rows[0];
      if(committed?.state==='ACCEPTED')return;
      const reason=(e as Error).message;
      if(['INSUFFICIENT_FUNDS','INSUFFICIENT_BALANCE','CYCLE_FULL','CYCLE_CLOSED','QUALIFICATION_REQUIRED','QUALIFICATION_INVALIDATED','TICKET_ALREADY_USED','DUPLICATE_ENTRY'].includes(reason))await this.compensate(id,userId,entry);
      // Unknown failures leave the intent pending: recovery retries the same reservation key.
      throw e;
    }
  }
  async cancel(id:string,actorId?:string){
    const row=(await pool.query('SELECT template_id FROM competition_instances WHERE id=$1',[id])).rows[0];
    if(!row)return false;
    return Boolean(await tournamentLock(`tournament:${id}`,async()=>{
      const changed=await pool.query(`UPDATE competition_tournaments SET state='REFUNDING',void_reason='USER_CANCELLED',cancellation_actor_id=$2 WHERE instance_id=$1 AND state='WAITING'
        AND ($2::text IS NULL OR EXISTS(SELECT 1 FROM competition_participants WHERE instance_id=$1 AND user_id=$2)) RETURNING instance_id`,[id,actorId??null]);
      if(!changed.rowCount){
        const previous=(await pool.query('SELECT state,void_reason,cancellation_actor_id FROM competition_tournaments WHERE instance_id=$1',[id])).rows[0];
        if(!previous||!['REFUNDING','CANCELLED'].includes(previous.state)||previous.void_reason!=='USER_CANCELLED'||actorId&&previous.cancellation_actor_id!==actorId)return false;
      }
      await this.processUnlocked(id);return true;
    }));
  }
  async requestVoid(id:string,reason:string,expectedState?:string){
    return tournamentTx(async c=>{
      const t=(await c.query('SELECT * FROM competition_tournaments WHERE instance_id=$1 FOR UPDATE',[id])).rows[0];
      if(!t||['SETTLED','FINALIZING','VOIDED','CANCELLED'].includes(t.state)||expectedState&&t.state!==expectedState)return false;
      await c.query("UPDATE competition_tournaments SET state='REFUNDING',void_reason=$2 WHERE instance_id=$1",[id,reason]);
      return true;
    });
  }
  async process(id:string,now=Date.now()){return tournamentLock(`tournament:${id}`,()=>this.processUnlocked(id,now),true);}
  private async processUnlocked(id:string,now=Date.now()){
    let root=(await pool.query(`SELECT t.*,ci.status,ci.current_participants,ci.game_id,cy.starts_at,cy.cutoff_at FROM competition_tournaments t
      JOIN competition_instances ci ON ci.id=t.instance_id LEFT JOIN competition_special_cycles cy ON cy.id=t.cycle_id WHERE instance_id=$1`,[id])).rows[0];
    if(!root)return;
    const terms=root.terms as TournamentTerms;
    if(root.state==='WAITING'&&(root.cycle_id?now>=new Date(root.cutoff_at).getTime():now-new Date(root.created_at).getTime()>=terms.config.waitingMs)){
      const reason=root.cycle_id?'REGISTRATION_UNFILLED':'WAITING_TIMEOUT';
      if(await this.requestVoid(id,reason,'WAITING')){root.state='REFUNDING';root.void_reason=reason;}
      else root.state=(await pool.query('SELECT state FROM competition_tournaments WHERE instance_id=$1',[id])).rows[0].state;
    }
    if(root.state==='CAPTURING'){
      const players=(await pool.query('SELECT user_id FROM competition_participants WHERE instance_id=$1 ORDER BY seat_index',[id])).rows.map(r=>r.user_id as string);
      if(players.length!==terms.capacity)throw domainError('CAPACITY_MISMATCH');
      if(terms.entryMinor>0)for(const userId of players){const result=await this.accounting.captureEntry({competitionInstanceId:id,userId,idempotencyKey:`tournament-capture:${id}:${userId}`});
        if(!result.success){await this.requestVoid(id,'CAPTURE_FAILED');return;}}
      const draw=seedBracket(players),commitment=createHash('sha256').update(JSON.stringify(draw)).digest('hex');
      await tournamentTx(async c=>{
        const t=(await c.query('SELECT state FROM competition_tournaments WHERE instance_id=$1 FOR UPDATE',[id])).rows[0];if(t.state!=='CAPTURING')return;
        await c.query("UPDATE competition_tournaments SET state='PLAYING',seed=$2,seeded_order=$3,seed_commitment=$4,captured_at=now() WHERE instance_id=$1",[id,draw.seed,JSON.stringify(draw.order),commitment]);
        for(let round=1,count=terms.capacity/2;count>=1;round++,count/=2)for(let position=0;position<count;position++)
          await c.query(`INSERT INTO competition_bracket_matches(id,instance_id,round,position,player1_id,player2_id,state) VALUES($1,$2,$3,$4,$5,$6,$7)`,
            [randomUUID(),id,round,position,round===1?draw.order[position*2]:null,round===1?draw.order[position*2+1]:null,round===1?'READY':'WAITING']);
      });
      root.state='PLAYING';
    }
    if(root.state==='FINALIZING'){
      const result=await this.accounting.settleCompetition({competitionInstanceId:id,prizes:[{placement:1,userId:root.winner_user_id,amount:createMoney(terms.prizeMinor,'GEL')}],idempotencyKey:`tournament-final:${id}`});
      if(!result.success)throw domainError('ACCOUNTING_PENDING');
      await tournamentTx(async c=>{
        await c.query("UPDATE competition_tournaments SET state='SETTLED',completed_at=COALESCE(completed_at,now()) WHERE instance_id=$1 AND state='FINALIZING'",[id]);
        await c.query("UPDATE competition_instances SET status='SETTLED',winner_user_id=$2,settled_at=COALESCE(settled_at,now()) WHERE id=$1",[id,root.winner_user_id]);
        await c.query("UPDATE competition_participants SET rank=CASE WHEN user_id=$2 THEN 1 ELSE rank END,prize_won_minor=CASE WHEN user_id=$2 THEN $3 ELSE 0 END,status=CASE WHEN status='FORFEITED' THEN status ELSE 'SUBMITTED' END WHERE instance_id=$1",[id,root.winner_user_id,terms.prizeMinor]);
        await c.query('UPDATE competition_instance_prizes SET awarded_user_id=$2 WHERE instance_id=$1 AND placement=1',[id,root.winner_user_id]);
      });root.state='SETTLED';
    }
    if(root.state==='REFUNDING'){
      // All admissions hold the same queue lock; do not race a reservation still in flight.
      const pending=await pool.query("SELECT 1 FROM competition_entry_intents WHERE instance_id=$1 AND state IN ('PENDING','COMPENSATING')",[id]);
      if(pending.rowCount)return;
      const refund=await this.accounting.refundCompetition({competitionInstanceId:id,reason:root.void_reason??'PLATFORM_VOID',idempotencyKey:`tournament-refund:${id}`});
      if(!refund.success)throw domainError('ACCOUNTING_PENDING');
      const status=root.void_reason==='USER_CANCELLED'?'CANCELLED':'VOIDED';
      await tournamentTx(async c=>{
        await c.query('UPDATE competition_tournaments SET state=$2,completed_at=COALESCE(completed_at,now()) WHERE instance_id=$1',[id,status]);
        await c.query('UPDATE competition_instances SET status=$2,settled_at=COALESCE(settled_at,now()) WHERE id=$1',[id,status]);
        await c.query('UPDATE competition_participants SET status=$2,rank=NULL,prize_won_minor=0 WHERE instance_id=$1',[id,status]);
        await c.query("UPDATE competition_bracket_matches SET state='VOIDED' WHERE instance_id=$1 AND state<>'COMPLETE'",[id]);
      });root.state=status;
    }
    if(['SETTLED','VOIDED','CANCELLED'].includes(root.state)&&!root.completion_processed_at){
      if(root.state==='SETTLED')await recordStandardQualification(id,now);
      else await replaceTournamentTickets(id,now,root.void_reason==='USER_CANCELLED'?root.cancellation_actor_id??undefined:undefined);
      await pool.query('UPDATE competition_tournaments SET completion_processed_at=now() WHERE instance_id=$1',[id]);
    }
  }
  async recover(now=Date.now()){
    const pending=(await pool.query(`SELECT DISTINCT ci.template_id FROM competition_entry_intents e JOIN competition_instances ci ON ci.id=e.instance_id WHERE e.state IN ('PENDING','COMPENSATING')`)).rows;
    for(const {template_id} of pending)await tournamentLock(`tournament-join:${template_id}`,async()=>{
      const product=await readProduct(template_id);if(!product)return;
      const entries=(await pool.query(`SELECT e.* FROM competition_entry_intents e JOIN competition_instances ci ON ci.id=e.instance_id WHERE ci.template_id=$1 AND e.state IN ('PENDING','COMPENSATING')`,[template_id])).rows;
      for(const e of entries)try{await this.finishEntry(e.instance_id,e.user_id,product,now);}catch{/* Durable compensation remains retryable. */}
    },true);
    const roots=(await pool.query(`SELECT instance_id FROM competition_tournaments WHERE state NOT IN ('SETTLED','VOIDED','CANCELLED') OR completion_processed_at IS NULL ORDER BY created_at LIMIT 100`)).rows;
    for(const root of roots)try{await this.process(root.instance_id,now);recoveryWarnings.delete(root.instance_id);}
      catch{if(!recoveryWarnings.has(root.instance_id)){logger.warn('[tournament] Recovery pending for',root.instance_id);recoveryWarnings.add(root.instance_id);}}
  }
  async applyDecision(runId:string):Promise<AuthorityOutcome>{
    const instanceId=await tournamentTx(async c=>{
      const d=(await c.query(`SELECT d.*,r.instance_id,r.bracket_match_id,r.match_id,r.bracket_attempt FROM competition_authority_decisions d JOIN competition_authority_runs r ON r.id=d.run_id WHERE d.run_id=$1`,[runId])).rows[0];
      if(!d?.bracket_match_id)throw domainError('BRACKET_DECISION_REQUIRED');
      const root=(await c.query('SELECT * FROM competition_tournaments WHERE instance_id=$1 FOR UPDATE',[d.instance_id])).rows[0];
      const match=(await c.query('SELECT * FROM competition_bracket_matches WHERE id=$1 FOR UPDATE',[d.bracket_match_id])).rows[0];
      if(d.applied_at)return d.instance_id as string;
      if(root.state!=='PLAYING'||match.attempt!==d.bracket_attempt||match.state!=='ACTIVE'){
        await c.query('UPDATE competition_authority_decisions SET applied_at=COALESCE(applied_at,now()) WHERE run_id=$1',[runId]);return d.instance_id as string;
      }
      const results=(await c.query(`SELECT s.user_id,v.score FROM competition_authority_sessions s LEFT JOIN competition_authority_results v ON v.session_id=s.id WHERE s.run_id=$1`,[runId])).rows;
      await c.query(`UPDATE matches_history SET status=$2,winner_id=$3,status_reason=$4,ended_at=now(),score_p1=$5,score_p2=$6 WHERE id=$1`,
        [d.match_id,d.winner_user_id?'COMPLETED':d.kind==='DRAW'?'DRAW':'VOIDED',d.winner_user_id,d.reason,results.find(r=>r.user_id===match.player1_id)?.score??0,results.find(r=>r.user_id===match.player2_id)?.score??0]);
      if(d.kind==='DRAW')await c.query("UPDATE competition_bracket_matches SET state='READY',ready_deadline=NULL WHERE id=$1",[match.id]);
      else if(d.kind==='VOID'){
        const recoverable=!['READY_EXPIRED','BOTH_DISCONNECTED','ADMINISTRATIVE_VOID','NETWORK_UNCERTAIN'].includes(d.reason)&&match.failures<root.terms.config.recoveryAttempts;
        if(recoverable)await c.query("UPDATE competition_bracket_matches SET state='READY',failures=failures+1,ready_deadline=NULL WHERE id=$1",[match.id]);
        else await c.query("UPDATE competition_tournaments SET state='REFUNDING',void_reason=$2 WHERE instance_id=$1",[d.instance_id,d.reason]);
      }else{
        if(![match.player1_id,match.player2_id].includes(d.winner_user_id))throw domainError('INVALID_BRACKET_WINNER');
        await c.query("UPDATE competition_bracket_matches SET state='COMPLETE',winner_user_id=$2,completed_at=now() WHERE id=$1",[match.id,d.winner_user_id]);
        const loser=match.player1_id===d.winner_user_id?match.player2_id:match.player1_id;
        await c.query('UPDATE competition_participants SET rank=$3 WHERE instance_id=$1 AND user_id=$2',[d.instance_id,loser,root.terms.capacity/2**match.round+1]);
        const final=match.round===Math.log2(root.terms.capacity);
        if(final)await c.query("UPDATE competition_tournaments SET state='FINALIZING',winner_user_id=$2,final_run_id=$3 WHERE instance_id=$1",[d.instance_id,d.winner_user_id,runId]);
        else{
          const column=match.position%2===0?'player1_id':'player2_id';
          await c.query(`UPDATE competition_bracket_matches SET ${column}=$4 WHERE instance_id=$1 AND round=$2 AND position=$3 AND ${column} IS NULL`,[d.instance_id,match.round+1,Math.floor(match.position/2),d.winner_user_id]);
          await c.query("UPDATE competition_bracket_matches SET state='READY' WHERE instance_id=$1 AND state='WAITING' AND player1_id IS NOT NULL AND player2_id IS NOT NULL",[d.instance_id]);
        }
      }
      await c.query('UPDATE competition_authority_decisions SET applied_at=COALESCE(applied_at,now()) WHERE run_id=$1',[runId]);
      return d.instance_id as string;
    });
    await this.process(instanceId);
    const root=(await pool.query('SELECT state,winner_user_id,void_reason FROM competition_tournaments WHERE instance_id=$1',[instanceId])).rows[0];
    const terminal=['SETTLED','VOIDED','CANCELLED'].includes(root.state);
    return {instanceId,status:terminal?root.state:'ROUND_COMPLETE',reason:root.void_reason??'BRACKET_PROGRESS',winnerUserId:terminal?root.winner_user_id:null};
  }
}
