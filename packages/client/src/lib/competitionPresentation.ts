import { getGameTitle, type CompetitionTemplate, type CompetitionStatus } from '@fugluck/shared'

export type PlayerCompetition = {
  id: string; templateId: string; gameId: string; format: CompetitionTemplate['format'];
  participantCapacity: number; currentParticipants: number; currency: CompetitionTemplate['currency'];
  entryFeeMinor: number; status: CompetitionStatus; winnerUserId?: string | null;
  rulesVersion: string; skillAssessmentVersion: string; jurisdiction: string; createdAt: string;
  prizes: Array<{ placement: number; amountMinor: number; currency: CompetitionTemplate['currency'] }>;
  resultKind?: string | null;
  participants: Array<{ userId: string; score?: number | null; prizeWonMinor: number; status: string; entryReturned?: boolean }>;
}
export type CatalogRoom = Pick<PlayerCompetition, 'id'|'templateId'|'currentParticipants'|'participantCapacity'|'status'|'entryFeeMinor'|'currency'|'prizes'> & {viewerJoined?:boolean}
export type PublicStatus = 'open'|'full'|'starting'|'live'|'finished'|'canceled'|'voided'|'unavailable'
export function publicCompetitionStatus(status: string, joined = 0, capacity = 2): PublicStatus {
  switch (status) {
    case 'PENDING_ENTRANTS': return joined >= capacity ? 'full' : 'open'
    case 'LOCKED': return 'starting'
    case 'ACTIVE': return 'live'
    case 'VERIFYING': case 'SETTLED': return 'finished'
    case 'CANCELLED': return 'canceled'
    case 'VOIDED': return 'voided'
    default: return 'unavailable'
  }
}
export function competitionAction(status: string, participant: boolean, joined = 0, capacity = 2) {
  const publicStatus = publicCompetitionStatus(status, joined, capacity)
  if (participant) {
    if (publicStatus === 'open' || publicStatus === 'full') return 'view' as const
    if (publicStatus === 'starting') return 'getReady' as const
    if (publicStatus === 'live') return 'returnToGame' as const
    return 'viewResult' as const
  }
  return publicStatus === 'open' ? 'join' as const : 'unavailable' as const
}
export function joinBlockReason({ signedIn, balanceMinor, entryMinor, status, joined, capacity, participant = false, sandbox = true }:
  {signedIn:boolean;balanceMinor:number;entryMinor:number;status:string;joined:number;capacity:number;participant?:boolean;sandbox?:boolean}) {
  if (!sandbox) return 'unavailable'
  if (participant) return 'alreadyJoined'
  if (publicCompetitionStatus(status, joined, capacity) !== 'open') return 'unavailable'
  if (!signedIn) return 'signIn'
  if (balanceMinor < entryMinor) return 'insufficient'
  return null
}
export function competitionErrorKey(code: string): string {
  if (['INSUFFICIENT_FUNDS','INSUFFICIENT_BALANCE'].includes(code)) return 'insufficient'
  if (['DUPLICATE_USER_IN_INSTANCE','ALREADY_JOINED'].includes(code)) return 'alreadyJoined'
  if (['GUEST_NOT_ALLOWED','AUTH_REQUIRED'].includes(code)) return 'signIn'
  if (['IDENTITY_UNVERIFIED','IDENTITY_VERIFICATION_REQUIRED'].includes(code)) return 'identity'
  if (['LIMIT_EXCEEDED','ENTRY_LIMIT_EXCEEDED'].includes(code)) return 'limit'
  if (['JURISDICTION_UNAPPROVED','RISK_REVIEW_REQUIRED','ACCOUNT_INACTIVE'].includes(code)) return 'account'
  if (code === 'RATE_LIMITED') return 'retryLater'
  if (code === 'CANCEL_REJECTED') return 'cannotLeave'
  return 'unavailable'
}
export function moneyLabel(minor: number, currency = 'GEL') { return `${(minor / 100).toFixed(2)} ${currency}` }
export function catalogPresentation(template: CompetitionTemplate, room?: CatalogRoom) {
  // Existing open rooms own snapshotted terms; never derive a prize from entry fees.
  const terms = room ?? template
  const joined = room?.currentParticipants ?? 0
  const capacity = terms.participantCapacity
  const prizeMinor = terms.prizes?.find(p => p.placement === 1)?.amountMinor ?? 0
  return { gameName:getGameTitle(template.gameId), entryMinor:terms.entryFeeMinor, prizeMinor,
    currency:terms.currency, joined, capacity, status:room?.status ?? 'PENDING_ENTRANTS',
    isFree:terms.entryFeeMinor === 0, isPromo:terms.entryFeeMinor > 0 && /promo/i.test(template.title) }
}
export function templateForInstance(instance: PlayerCompetition): CompetitionTemplate {
  return { ...instance, id:instance.templateId, title:getGameTitle(instance.gameId), enabled:true,
    updatedAt:instance.createdAt, prizes:instance.prizes.map((p,i)=>({...p,id:`display_${i}`,templateId:instance.templateId})) }
}
export function competitionResult(instance: PlayerCompetition | null, userId?: string) {
  if (!instance || !userId) return {kind:'pending' as const}
  const you=instance.participants.find(p=>p.userId===userId)
  if (!you) return {kind:'pending' as const}
  const opponent=instance.participants.find(p=>p.userId!==userId)
  if (instance.status === 'VOIDED' || instance.status === 'CANCELLED')
    return {kind:instance.resultKind==='DRAW'?'draw' as const:instance.status==='VOIDED'?'void' as const:you.entryReturned?'refund' as const:'canceled' as const,
      returnedMinor:you.entryReturned ? instance.entryFeeMinor : undefined,
      yourScore:you.score, opponentScore:opponent?.score, currency:instance.currency}
  if (instance.status !== 'SETTLED' || !instance.winnerUserId) return {kind:'pending' as const}
  return {kind:instance.winnerUserId===userId?'win' as const:'loss' as const,
    yourScore:you.score,opponentScore:opponent?.score,prizeMinor:you.prizeWonMinor,currency:instance.currency}
}
