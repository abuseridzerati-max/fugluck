/** Read-only player projections. Queue selection and all financial decisions stay in the domain. */
import { pool } from '../db/client'
import { instanceService } from './instanceService'
import { isMockTemplate } from '../config/stagingMockCommercial'
import type { CompetitionTemplate, TournamentCardInfo, PlayerTournamentView, BracketMatchView, TournamentCapacity } from '@fugluck/shared'
import { cycleFromRow } from './tournamentPersistence'
import { qualificationView } from './tournamentQualification'
import { roundName } from './tournamentRules'

export async function readTournamentCatalog(templates:CompetitionTemplate[],viewerId?:string,now=Date.now()) {
  const rows=(await pool.query(`SELECT p.*,row_to_json(cy) AS cycle FROM competition_products p LEFT JOIN competition_special_cycles cy ON cy.id=p.cycle_id WHERE p.template_id=ANY($1::text[]) AND p.provenance='SANDBOX'`,[templates.map(t=>t.id)])).rows;
  const tracks=new Map(await Promise.all([...new Set(rows.map(r=>r.game_id as string))].map(async game=>[game,await qualificationView(viewerId,game,now)] as const)));
  const productOrder={STANDARD:0,PROMO:1,GIFT:2};
  return templates.filter(t=>rows.some(r=>r.template_id===t.id)).map(template=>{
    const row=rows.find(r=>r.template_id===template.id)!,progress=tracks.get(row.game_id)!,cycle=row.cycle?cycleFromRow(row.cycle):null;
    const ticket=row.product==='GIFT'?progress.gift:progress.promo;
    const eligibility:TournamentCardInfo['eligibility']=!viewerId?'SIGN_IN':row.product==='STANDARD'?'AVAILABLE':
      !cycle||now<new Date(cycle.opensAt).getTime()||now>=new Date(cycle.cutoffAt).getTime()?'CLOSED':ticket.targetCycleId===cycle.id&&ticket.ticketStatus==='CONSUMED'?'USED':ticket.targetCycleId===cycle.id&&ticket.ticketStatus==='AVAILABLE'?'AVAILABLE':'QUALIFY';
    const next=(product:string)=>{const c=rows.find(r=>r.game_id===row.game_id&&r.product===product)?.cycle;return c?cycleFromRow(c):null};
    return {...template,participantCapacity:row.terms.capacity,entryFeeMinor:row.terms.entryMinor,currency:'GEL',
      prizes:[{id:`public_${template.id}`,templateId:template.id,placement:1,amountMinor:row.terms.prizeMinor,currency:'GEL'}],
      tournament:{product:row.product,cycle,eligibility,...progress,nextPromoCycle:next('PROMO'),nextGiftCycle:next('GIFT')}} as CompetitionTemplate;
  }).sort((a,b)=>['space-blaster','cyber-hopper'].indexOf(a.gameId)-['space-blaster','cyber-hopper'].indexOf(b.gameId)||productOrder[a.tournament!.product]-productOrder[b.tournament!.product]||a.participantCapacity-b.participantCapacity);
}

export async function readCatalogRooms(templateIds: string[], viewerId?: string) {
  if (!templateIds.length) return []
  const rows = await pool.query<{id:string}>(`SELECT DISTINCT ON (ci.template_id) ci.id
    FROM competition_instances ci LEFT JOIN competition_tournaments t ON t.instance_id=ci.id WHERE ci.template_id = ANY($1::text[])
    AND ((ci.status='PENDING_ENTRANTS' AND ci.current_participants<ci.participant_capacity) OR (t.cycle_id IS NOT NULL AND ci.status IN ('LOCKED','ACTIVE')))
    ORDER BY ci.template_id, ci.created_at ASC`, [templateIds])
  const instances = await Promise.all(rows.rows.map(row => instanceService.getPublicInstanceSummary(row.id)))
  return instances.filter(Boolean).map(instance => ({ id:instance!.id,templateId:instance!.templateId,
    currentParticipants:instance!.currentParticipants,participantCapacity:instance!.participantCapacity,
    status:instance!.status,entryFeeMinor:instance!.entryFeeMinor,currency:instance!.currency,prizes:instance!.prizes,
    viewerJoined:Boolean(viewerId&&instance!.participants.some((p:{userId:string})=>p.userId===viewerId)) }))
}

export async function readPlayerInstance(id: string,viewerId?:string) {
  const instance = await instanceService.getPublicInstanceSummary(id)
  if (!instance) return null
  const [decision, returned] = await Promise.all([
    pool.query(`SELECT d.kind FROM competition_authority_decisions d JOIN competition_authority_runs r ON r.id=d.run_id
      WHERE r.instance_id=$1 AND d.applied_at IS NOT NULL LIMIT 1`, [id]),
    pool.query<{user_id:string}>(`SELECT user_id FROM sandbox_entry_reservations WHERE competition_instance_id=$1
      AND status IN ('RELEASED','REFUNDED') UNION SELECT user_id FROM commercial_operations
      WHERE competition_instance_id=$1 AND kind='ENTRY' AND status IN ('RELEASED','REFUNDED')`, [id]),
  ])
  const tournament=instance.format==='TOURNAMENT_BRACKET'?await readTournamentInstance(id,viewerId):undefined;
  return {...instance,...tournament?{tournament}:{}, resultKind:tournament?(instance.status==='SETTLED'?'WIN':instance.status==='VOIDED'?'VOID':null):decision.rows[0]?.kind ?? null,
    participants:instance.participants.map((p:{userId:string}) => ({...p,
      entryReturned:instance.entryFeeMinor===0 || returned.rows.some(r=>r.user_id===p.userId)}))}
}

export async function readMyCompetitions(userId: string) {
  const rows=await pool.query<{id:string;template_id:string}>(`SELECT ci.id,ci.template_id FROM competition_instances ci
    JOIN competition_participants cp ON cp.instance_id=ci.id WHERE cp.user_id=$1
    ORDER BY ci.created_at DESC LIMIT 20`, [userId])
  // Operator-only mock competitions never become normal player discovery.
  return (await Promise.all(rows.rows.filter(r=>!isMockTemplate(r.template_id)).map(r=>readPlayerInstance(r.id,userId)))).filter(Boolean)
}

async function readTournamentInstance(id:string,userId?:string):Promise<PlayerTournamentView|undefined>{
  const root=(await pool.query('SELECT t.state,t.terms,t.winner_user_id,row_to_json(cy) AS cycle FROM competition_tournaments t LEFT JOIN competition_special_cycles cy ON cy.id=t.cycle_id WHERE instance_id=$1',[id])).rows[0];if(!root)return;
  const rows=(await pool.query(`SELECT b.*,u1.username AS name1,u2.username AS name2 FROM competition_bracket_matches b LEFT JOIN users u1 ON u1.id=b.player1_id LEFT JOIN users u2 ON u2.id=b.player2_id WHERE b.instance_id=$1 ORDER BY round,position`,[id])).rows;
  const matches:BracketMatchView[]=rows.map(b=>({id:b.id,round:b.round,roundName:roundName(root.terms.capacity as TournamentCapacity,b.round),position:b.position,players:[b.player1_id,b.player2_id],playerNames:[b.name1,b.name2],winnerUserId:b.winner_user_id,status:b.state,attempt:b.attempt}));
  const own=matches.filter(m=>userId&&m.players.includes(userId));
  const current=own.find(m=>['READY','ACTIVE','WAITING'].includes(m.status))??null;
  const lost=own.some(m=>m.status==='COMPLETE'&&m.winnerUserId!==userId);
  const last=(await pool.query(`SELECT v.score,op.score AS opponent_score FROM competition_authority_runs r JOIN competition_authority_sessions s ON s.run_id=r.id AND s.user_id=$2
    JOIN competition_authority_results v ON v.session_id=s.id JOIN competition_authority_sessions other ON other.run_id=r.id AND other.user_id<>s.user_id
    LEFT JOIN competition_authority_results op ON op.session_id=other.id WHERE r.instance_id=$1 ORDER BY r.created_at DESC LIMIT 1`,[id,userId??null])).rows[0];
  const state:PlayerTournamentView['playerState']=['VOIDED','CANCELLED','REFUNDING'].includes(root.state)?'REFUNDED':root.state==='SETTLED'&&root.winner_user_id===userId?'CHAMPION':lost?'ELIMINATED':current?.status==='ACTIVE'?'PLAYING':current?.status==='READY'?'READY':'WAITING';
  return {product:root.terms.product,cycle:root.cycle?cycleFromRow(root.cycle):null,state:root.state,matches,currentMatch:current,playerState:state,yourScore:last?.score??null,opponentScore:last?.opponent_score??null};
}
