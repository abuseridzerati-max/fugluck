/** Read-only player projections. Queue selection and all financial decisions stay in the domain. */
import { pool } from '../db/client'
import { instanceService } from './instanceService'
import { isMockTemplate } from '../config/stagingMockCommercial'

export async function readCatalogRooms(templateIds: string[], viewerId?: string) {
  if (!templateIds.length) return []
  const rows = await pool.query<{id:string}>(`SELECT DISTINCT ON (template_id) id
    FROM competition_instances WHERE template_id = ANY($1::text[])
    AND status='PENDING_ENTRANTS' AND current_participants < participant_capacity
    ORDER BY template_id, created_at ASC`, [templateIds])
  const instances = await Promise.all(rows.rows.map(row => instanceService.getPublicInstanceSummary(row.id)))
  return instances.filter(Boolean).map(instance => ({ id:instance!.id,templateId:instance!.templateId,
    currentParticipants:instance!.currentParticipants,participantCapacity:instance!.participantCapacity,
    status:instance!.status,entryFeeMinor:instance!.entryFeeMinor,currency:instance!.currency,prizes:instance!.prizes,
    viewerJoined:Boolean(viewerId&&instance!.participants.some((p:{userId:string})=>p.userId===viewerId)) }))
}

export async function readPlayerInstance(id: string) {
  const instance = await instanceService.getPublicInstanceSummary(id)
  if (!instance) return null
  const [decision, returned] = await Promise.all([
    pool.query(`SELECT d.kind FROM competition_authority_decisions d JOIN competition_authority_runs r ON r.id=d.run_id
      WHERE r.instance_id=$1 AND d.applied_at IS NOT NULL LIMIT 1`, [id]),
    pool.query<{user_id:string}>(`SELECT user_id FROM sandbox_entry_reservations WHERE competition_instance_id=$1
      AND status IN ('RELEASED','REFUNDED') UNION SELECT user_id FROM commercial_operations
      WHERE competition_instance_id=$1 AND kind='ENTRY' AND status IN ('RELEASED','REFUNDED')`, [id]),
  ])
  return {...instance, resultKind:decision.rows[0]?.kind ?? null,
    participants:instance.participants.map((p:{userId:string}) => ({...p,
      entryReturned:instance.entryFeeMinor===0 || returned.rows.some(r=>r.user_id===p.userId)}))}
}

export async function readMyCompetitions(userId: string) {
  const rows=await pool.query<{id:string;template_id:string}>(`SELECT ci.id,ci.template_id FROM competition_instances ci
    JOIN competition_participants cp ON cp.instance_id=ci.id WHERE cp.user_id=$1
    ORDER BY ci.created_at DESC LIMIT 20`, [userId])
  // Operator-only mock competitions never become normal player discovery.
  return (await Promise.all(rows.rows.filter(r=>!isMockTemplate(r.template_id)).map(r=>readPlayerInstance(r.id)))).filter(Boolean)
}
