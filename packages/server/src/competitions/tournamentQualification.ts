import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import type { QualificationTrackView } from '@fugluck/shared';
import { pool } from '../db/client';
import { currentTournamentConfig, ensureSpecialCycle, tournamentTx, type ProductRow } from './tournamentPersistence';

async function lockTracks(c:PoolClient,userId:string,gameId:string,now:number) {
  await c.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`qualification:${userId}:${gameId}`]);
  for(const product of ['PROMO','GIFT'])await c.query(`INSERT INTO competition_qualification_tracks(user_id,game_id,product) VALUES($1,$2,$3) ON CONFLICT DO NOTHING`,[userId,gameId,product]);
  await c.query(`UPDATE competition_qualification_tickets t SET state='EXPIRED' FROM competition_special_cycles cy
    WHERE t.cycle_id=cy.id AND t.user_id=$1 AND t.game_id=$2 AND t.state IN ('AVAILABLE','CONSUMED') AND cy.ends_at<=$3`,[userId,gameId,new Date(now)]);
  await c.query(`UPDATE competition_qualification_tracks tr SET progress=0,contributions='[]',target_cycle_id=NULL FROM competition_special_cycles cy
    WHERE tr.target_cycle_id=cy.id AND tr.user_id=$1 AND tr.game_id=$2 AND cy.ends_at<=$3`,[userId,gameId,new Date(now)]);
}
/** Invoked only after final settlement. Provenance/receipts come from persisted server state. */
export async function recordStandardQualification(instanceId:string,now=Date.now()) {
  const row=(await pool.query(`SELECT t.*,ci.game_id,ci.status,ci.settled_at FROM competition_tournaments t
    JOIN competition_instances ci ON ci.id=t.instance_id WHERE t.instance_id=$1
    AND EXISTS(SELECT 1 FROM competition_authority_runs r JOIN competition_authority_decisions d ON d.run_id=r.id
      JOIN competition_bracket_matches b ON b.id=r.bracket_match_id WHERE r.id=t.final_run_id AND r.instance_id=t.instance_id
      AND b.instance_id=t.instance_id AND b.state='COMPLETE' AND b.round=log(2,(t.terms->>'capacity')::numeric)
      AND d.kind IN ('WIN','FORFEIT') AND d.applied_at IS NOT NULL AND d.winner_user_id=t.winner_user_id)`,[instanceId])).rows[0];
  if(!row||row.provenance!=='LIVE'||row.terms.product!=='STANDARD'||row.invalidated||row.state!=='SETTLED'||row.status!=='SETTLED')return;
  const users=(await pool.query(`SELECT DISTINCT s.user_id FROM competition_authority_runs r
    JOIN competition_authority_sessions s ON s.run_id=r.id JOIN competition_authority_results v ON v.session_id=s.id
    JOIN competition_authority_decisions d ON d.run_id=r.id JOIN competition_participants p ON p.instance_id=r.instance_id AND p.user_id=s.user_id
    WHERE r.instance_id=$1 AND v.ticks>0 AND d.kind IN ('WIN','FORFEIT') AND d.applied_at IS NOT NULL`,[instanceId])).rows;
  for(const user of users)await tournamentTx(async c=>{
    await lockTracks(c,user.user_id,row.game_id,now);
    const event=(await c.query(`INSERT INTO competition_qualification_events(instance_id,user_id,game_id,outcome,completed_at)
      SELECT $1,$2,$3,$4,$5 WHERE NOT EXISTS(SELECT 1 FROM competition_tournaments WHERE instance_id=$1 AND invalidated)
      ON CONFLICT DO NOTHING RETURNING *`,[instanceId,user.user_id,row.game_id,row.winner_user_id===user.user_id?'WIN':'LOSS',row.settled_at])).rows[0];
    if(!event)return;
    const {config}=await currentTournamentConfig(row.game_id,c);
    for(const product of ['PROMO','GIFT'] as const){
      const track=(await c.query('SELECT * FROM competition_qualification_tracks WHERE user_id=$1 AND game_id=$2 AND product=$3 FOR UPDATE',[user.user_id,row.game_id,product])).rows[0];
      if(track.target_cycle_id)continue;
      // Earlier invalidated play is removed before determining a new entitlement.
      const valid=(await c.query('SELECT instance_id FROM competition_tournaments WHERE instance_id=ANY($1::text[]) AND NOT invalidated',[track.contributions])).rows.map(r=>r.instance_id as string);
      valid.push(instanceId);const threshold=product==='PROMO'?config.promoThreshold:config.giftThreshold;
      let target:string|null=null;
      if(valid.length>=threshold){
        const cycle=await ensureSpecialCycle(c,row.game_id,product,now);target=cycle.id;
        await c.query(`INSERT INTO competition_qualification_tickets(id,user_id,game_id,product,cycle_id,state,qualified_at,source_instances)
          VALUES($1,$2,$3,$4,$5,'AVAILABLE',$6,$7)`,[randomUUID(),user.user_id,row.game_id,product,target,new Date(now),JSON.stringify(valid)]);
      }
      await c.query(`UPDATE competition_qualification_tracks SET progress=$4,contributions=$5,target_cycle_id=$6 WHERE user_id=$1 AND game_id=$2 AND product=$3`,
        [user.user_id,row.game_id,product,Math.min(threshold,valid.length),JSON.stringify(valid),target]);
    }
    await c.query('UPDATE competition_qualification_events SET applied_at=$3 WHERE instance_id=$1 AND user_id=$2',[instanceId,user.user_id,new Date(now)]);
  });
}
export async function ticketForJoin(c:PoolClient,product:ProductRow,userId:string,now:number) {
  if(product.product==='STANDARD')return null;
  await lockTracks(c,userId,product.game_id,now);
  const cycle=(await c.query('SELECT * FROM competition_special_cycles WHERE id=$1',[product.cycle_id])).rows[0];
  if(!cycle||now<new Date(cycle.opens_at).getTime()||now>=new Date(cycle.cutoff_at).getTime())throw Error('CYCLE_CLOSED');
  const ticket=(await c.query(`SELECT * FROM competition_qualification_tickets WHERE user_id=$1 AND game_id=$2 AND product=$3 AND cycle_id=$4 AND state='AVAILABLE' FOR UPDATE`,
    [userId,product.game_id,product.product,product.cycle_id])).rows[0];
  if(!ticket)throw Error('QUALIFICATION_REQUIRED');
  const invalid=await c.query('SELECT 1 FROM competition_tournaments WHERE instance_id=ANY($1::text[]) AND invalidated LIMIT 1',[ticket.source_instances]);
  if(invalid.rowCount)throw Error('QUALIFICATION_INVALIDATED');
  return ticket.id as string;
}
export async function consumeTournamentTicket(c:PoolClient,ticketId:string|null,instanceId:string,userId:string,now:number) {
  if(!ticketId)return;
  const result=await c.query(`UPDATE competition_qualification_tickets SET state='CONSUMED',consumed_at=$4,consumed_instance_id=$2
    WHERE id=$1 AND user_id=$3 AND state='AVAILABLE' RETURNING id`,[ticketId,instanceId,userId,new Date(now)]);
  if(!result.rowCount)throw Error('TICKET_ALREADY_USED');
}
/** Before-play platform failure preserves entitlement as one replacement, with a linked audit trail. */
export async function replaceTournamentTickets(instanceId:string,now=Date.now(),excludedUserId?:string) {
  const played=await pool.query(`SELECT 1 FROM competition_authority_runs r JOIN competition_authority_sessions s ON s.run_id=r.id
    JOIN competition_authority_results v ON v.session_id=s.id WHERE r.instance_id=$1 AND v.ticks>0 LIMIT 1`,[instanceId]);
  if(played.rowCount)return;
  const rows=(await pool.query(`SELECT * FROM competition_qualification_tickets WHERE consumed_instance_id=$1 AND state IN ('CONSUMED','EXPIRED') AND ($2::text IS NULL OR user_id<>$2) ORDER BY user_id`,[instanceId,excludedUserId??null])).rows;
  for(const old of rows)await tournamentTx(async c=>{
    await lockTracks(c,old.user_id,old.game_id,now);
    const ticket=(await c.query('SELECT * FROM competition_qualification_tickets WHERE id=$1 FOR UPDATE',[old.id])).rows[0];
    if(!ticket||!['CONSUMED','EXPIRED'].includes(ticket.state)||ticket.replaced_by)return;
    const active=(await c.query("SELECT * FROM competition_qualification_tickets WHERE user_id=$1 AND game_id=$2 AND product=$3 AND id<>$4 AND state IN ('AVAILABLE','CONSUMED')",[old.user_id,old.game_id,old.product,old.id])).rows[0];
    if(active?.state==='CONSUMED')throw Error('REPLACEMENT_PENDING_ACTIVE_TICKET');
    if(active){await c.query("UPDATE competition_qualification_tickets SET state='REPLACED',replaced_by=$2 WHERE id=$1",[old.id,active.id]);return;}
    const oldCycle=(await c.query('SELECT cutoff_at FROM competition_special_cycles WHERE id=$1',[old.cycle_id])).rows[0];
    const next=await ensureSpecialCycle(c,old.game_id,old.product,Math.max(now,new Date(oldCycle.cutoff_at).getTime()));
    const id=randomUUID();await c.query("UPDATE competition_qualification_tickets SET state='REPLACED' WHERE id=$1",[old.id]);
    await c.query(`INSERT INTO competition_qualification_tickets(id,user_id,game_id,product,cycle_id,state,qualified_at,source_instances)
      VALUES($1,$2,$3,$4,$5,'AVAILABLE',$6,$7)`,[id,old.user_id,old.game_id,old.product,next.id,new Date(now),JSON.stringify(old.source_instances)]);
    await c.query('UPDATE competition_qualification_tickets SET replaced_by=$2 WHERE id=$1',[old.id,id]);
    await c.query('UPDATE competition_qualification_tracks SET target_cycle_id=$4,progress=$5,contributions=$6 WHERE user_id=$1 AND game_id=$2 AND product=$3',[old.user_id,old.game_id,old.product,next.id,old.source_instances.length,JSON.stringify(old.source_instances)]);
  });
}
export async function qualificationView(userId:string|undefined,gameId:string,now=Date.now()):Promise<{promo:QualificationTrackView;gift:QualificationTrackView}> {
  const {config}=await currentTournamentConfig(gameId);
  const view=(threshold:number):QualificationTrackView=>({progress:0,threshold,ticketStatus:null,targetCycleId:null,expiresAt:null});
  const result={promo:view(config.promoThreshold),gift:view(config.giftThreshold)};
  if(!userId)return result;
  // Read-only projection: expired tracks display zero; expiry writes happen in join/completion transactions.
  const rows=(await pool.query(`SELECT tr.*,cy.ends_at,cy.terms AS cycle_terms,t.state AS ticket_state,
    (SELECT count(*)::int FROM jsonb_array_elements_text(tr.contributions) source(id) JOIN competition_tournaments ct ON ct.instance_id=source.id WHERE ct.invalidated) AS invalid_count
    FROM competition_qualification_tracks tr
    LEFT JOIN competition_special_cycles cy ON cy.id=tr.target_cycle_id LEFT JOIN competition_qualification_tickets t
    ON t.user_id=tr.user_id AND t.game_id=tr.game_id AND t.product=tr.product AND t.cycle_id=tr.target_cycle_id
    WHERE tr.user_id=$1 AND tr.game_id=$2`,[userId,gameId])).rows;
  for(const row of rows){const key=row.product==='PROMO'?'promo':'gift';
    if(row.ends_at&&new Date(row.ends_at).getTime()<=now)continue;
    const threshold=row.cycle_terms?.config?.[key==='promo'?'promoThreshold':'giftThreshold']??result[key].threshold;
    result[key]={...result[key],threshold,progress:Math.max(0,row.progress-row.invalid_count),targetCycleId:row.target_cycle_id,
      ticketStatus:!row.invalid_count&&['AVAILABLE','CONSUMED'].includes(row.ticket_state)?row.ticket_state:null,expiresAt:row.ends_at?new Date(row.ends_at).toISOString():null};
  }
  return result;
}
