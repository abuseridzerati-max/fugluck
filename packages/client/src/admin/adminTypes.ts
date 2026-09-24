export type { AdminRole, AdminPermission } from '@fugluck/shared'
import type { AdminRole } from '@fugluck/shared'

export type Tab =
  | 'dashboard'
  | 'users'
  | 'matches'
  | 'ledger'
  | 'audit'
  | 'competitions_overview'
  | 'competitions_templates'
  | 'competitions_instances'
  | 'competitions_accounting'
  | 'competitions_eligibility'

export type AdminUser = {
  id: string
  username: string
  email: string | null
  role: AdminRole
  status: string
}

export type Metrics = {
  registeredUsers: number
  activeUsers: number
  suspendedUsers: number
  bannedUsers: number
  activeMatchesCount: number
  completedMatchesTotal: number
  matchesCompletedToday: number
  matchesVoidedToday: number
  totalMatchesVoided: number
  coinsCirculation: number
  diamondsCirculation: number
  platformRakeDiamonds: number
}

export type UserItem = {
  id: string
  username: string
  email: string | null
  role: AdminRole
  status: 'active' | 'suspended' | 'banned'
  statusReason: string | null
  gamesPlayed?: number
  gamesWon?: number
  balances: { coins: number; diamonds: number }
  createdAt: string
}

export type MatchItem = {
  id: string
  gameId: string
  player1Id: string
  player2Id: string
  winnerId: string | null
  currency: string
  stake: number
  status: string
  scoreP1?: number | null
  scoreP2?: number | null
  statusReason?: string | null
  startedAt?: string | null
  endedAt?: string | null
  createdAt: string
}

export type LedgerItem = {
  id: string
  userId: string
  currency: string
  amount: number
  reason: string
  createdAt: string
}

export type AuditItem = {
  id: string
  adminUserId: string
  action: string
  targetType: string
  targetId: string | null
  amount: number | null
  currency: string | null
  reason: string
  idempotencyKey?: string | null
  details?: any
  createdAt: string
}

export type MatchDetail = {
  match: MatchItem
  settlement: {
    matchId: string
    status: string
    currency: string
    stake: number
    settledAt: string
  } | null
  relatedLedger: LedgerItem[]
  relatedAuditLogs: AuditItem[]
}

export type UserDetail = {
  user: UserItem
  recentMatches: MatchItem[]
  recentLedger: LedgerItem[]
  userAuditLogs: AuditItem[]
}

export type CompetitionOverviewMetrics = {
  totalTemplatesCount: number
  enabledTemplatesCount: number
  waitingInstancesCount: number
  lockedInstancesCount: number
  activeInstancesCount: number
  verifyingInstancesCount: number
  settledTodayCount: number
  cancelledTodayCount: number
  voidedTodayCount: number
  totalInstancesCount: number
  entriesReservedMinor: number
  entriesCapturedMinor: number
  prizesAwardedMinor: number
  platformMarginMinor: number
  promotionalSubsidiesMinor: number
  systemLedgerSumMinor: number
  reconciliationDiscrepancyMinor: number
}

export type SandboxAccountingSummary = {
  totalFundingGrantsMinor: number
  availableUserTestFundsMinor: number
  reservedEntryFundsMinor: number
  capturedEntryFundsMinor: number
  prizeAwardsMinor: number
  refundsMinor: number
  platformFeesMinor: number
  promotionalSubsidiesMinor: number
  systemLedgerSumMinor: number
  discrepancyMinor: number
}

export type CompetitionDashboardMetrics = {
  templates: {
    total: number
    enabled: number
  }
  instances: {
    waiting: number
    locked: number
    active: number
    verifying: number
    settledToday: number
    cancelledToday: number
    voidedToday: number
    total: number
  }
  accounting: {
    totalGrantsMinor: number
    availableUserFundsMinor: number
    reservedEntryFundsMinor: number
    capturedEscrowFundsMinor: number
    totalPrizeAwardsMinor: number
    totalRefundsMinor: number
    platformFeesRetainedMinor: number
    promotionalSubsidiesMinor: number
    totalLedgerSum: number
    systemReconciled: boolean
  }
  currency: string
  isSandbox: boolean
}

export type CompetitionTemplateAdmin = {
  id: string
  gameId: string
  title: string
  format: string
  participantCapacity: number
  currency: string
  entryFeeMinor: number
  rulesVersion: string
  skillAssessmentVersion: string
  enabled: boolean
  jurisdiction: string
  createdAt: string
  updatedAt: string
  prizes: Array<{
    id?: string
    placement: number
    amountMinor: number
    currency: string
  }>
  economics: {
    expectedEntriesMinor: number
    predeterminedPrizesMinor: number
    expectedPlatformMarginMinor: number
    expectedPromotionalSubsidyMinor: number
  }
}

export type CompetitionInstanceAdmin = {
  id: string
  templateId: string
  templateTitle: string
  gameId: string
  format: string
  status: string
  currentParticipants: number
  participantCapacity: number
  entryFeeMinor: number
  currency: string
  matchId: string | null
  winnerUserId: string | null
  createdAt: string
  lockedAt: string | null
  startedAt: string | null
  settledAt: string | null
  totalPrizeMinor: number
}

export type CompetitionParticipantAdmin = {
  id: string
  userId: string
  username: string
  seatIndex: number
  status: string
  score: number | null
  rank: number | null
  prizeWonMinor: number
  registeredAt: string
  entryFeeMinor: number
}

export type CompetitionInstanceAdminDetail = {
  instance: {
    id: string
    templateId: string
    gameId: string
    format: string
    status: string
    currentParticipants: number
    participantCapacity: number
    entryFeeMinor: number
    currency: string
    rulesVersion: string
    skillAssessmentVersion: string
    jurisdiction: string
    matchId: string | null
    winnerUserId: string | null
    createdAt: string
    lockedAt: string | null
    startedAt: string | null
    settledAt: string | null
    prizes: Array<{
      id: string
      placement: number
      amountMinor: number
      currency: string
      awardedUserId?: string | null
    }>
  }
  currentTemplate: {
    id: string
    title: string
    gameId: string
    format: string
    participantCapacity: number
    entryFeeMinor: number
    currency: string
    rulesVersion: string
    jurisdiction: string
    enabled: boolean
    prizes: Array<{
      placement: number
      amountMinor: number
      currency: string
    }>
  } | null
  participants: CompetitionParticipantAdmin[]
  reconciliation: {
    reconciled: boolean
    totalCapturedMinor: number
    totalPrizesMinor: number
    totalRefundedMinor: number
    platformMarginMinor: number
    promotionalSubsidyMinor: number
    discrepancyMinor: number
  }
}

export type SandboxLedgerEntryAdmin = {
  id: string
  accountingReferenceId: string
  idempotencyKey: string
  userId: string | null
  accountId: string
  competitionInstanceId: string | null
  eventType: string
  currency: string
  amountMinor: number
  balanceType: string
  description: string | null
  createdAt: string
}

export type GameEligibilityAdminItem = {
  gameId: string
  status: string
  isCandidate: boolean
  isCoinOnly: boolean
  technicalNotes: string
}
