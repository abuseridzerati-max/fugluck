import React, { useEffect, useState, useCallback } from 'react'
import { apiFetch, ApiError } from '../lib/api'
import type {
  Tab,
  AdminUser,
  Metrics,
  UserItem,
  MatchItem,
  LedgerItem,
  AuditItem,
  UserDetail,
  MatchDetail,
  CompetitionOverviewMetrics,
  CompetitionTemplateAdmin,
  CompetitionInstanceAdmin,
  CompetitionInstanceAdminDetail,
  SandboxAccountingSummary,
  SandboxLedgerEntryAdmin,
  SandboxFundingGrantAdmin,
  GameEligibilityAdminItem,
  AdminOperationsData,
} from './adminTypes'
import { GrantTestFundsModal, TestFundingHistoryView, UserDetailDrawer } from './AdminFirstIncrementViews'
import './adminConsole.css'
import {
  ActionConfirmModal,
  GrantCurrencyModal,
  MatchDetailModal,
  type ConfirmModalConfig,
} from './AdminModals'
import {
  CreateTemplateModal,
  EditTemplateModal,
  InstanceDetailModal,
  CancelCompetitionModal,
  VoidCompetitionModal,
} from './CompetitionAdminModals'
import {
  CompetitionOverviewView,
  CompetitionTemplatesView,
  CompetitionInstancesView,
  CompetitionAccountingView,
  CompetitionEligibilityView,
  formatGEL,
} from './CompetitionAdminViews'
import type { AdminPermission } from '@fugluck/shared'
import AdminOperationsView from './AdminOperationsView'

const GAME_OPTIONS = [
  { id: '', label: 'All Games' },
  { id: 'neon-runner', label: 'Neon Runner' },
  { id: 'pixel-ninja-dash', label: 'Pixel Ninja Dash' },
  { id: 'space-blaster', label: 'Space Blaster' },
  { id: 'cyber-hopper', label: 'Cyber Hopper' },
  { id: 'speed-trivia', label: 'Speed Trivia Clash' },
  { id: 'tf-sprint', label: 'True / False Sprint' },
]

export default function AdminConsolePage({ onNavigateHome }: { onNavigateHome: () => void }) {
  // Admin Session State
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean | null>(null)
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null)
  const [permissions, setPermissions] = useState<AdminPermission[]>([])
  const [adminAuthError, setAdminAuthError] = useState<string | null>(null)
  const [adminUsernameInput, setAdminUsernameInput] = useState('')
  const [adminPasswordInput, setAdminPasswordInput] = useState('')
  const [isLoggingIn, setIsLoggingIn] = useState(false)

  // Navigation & General UI
  const [activeTab, setActiveTab] = useState<Tab>('users')
  const [isLoading, setIsLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Competition States
  const [compMetrics, setCompMetrics] = useState<CompetitionOverviewMetrics | null>(null)
  const [compTemplates, setCompTemplates] = useState<CompetitionTemplateAdmin[]>([])
  const [createTemplateModalOpen, setCreateTemplateModalOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<CompetitionTemplateAdmin | null>(null)

  const [compInstances, setCompInstances] = useState<CompetitionInstanceAdmin[]>([])
  const [compInstancePage, setCompInstancePage] = useState(1)
  const [compInstanceTotal, setCompInstanceTotal] = useState(0)
  const [compStatusFilter, setCompStatusFilter] = useState('')
  const [compGameFilter, setCompGameFilter] = useState('')
  const [selectedCompInstanceDetail, setSelectedCompInstanceDetail] = useState<CompetitionInstanceAdminDetail | null>(null)
  const [cancelCompInstanceId, setCancelCompInstanceId] = useState<string | null>(null)
  const [voidCompInstanceId, setVoidCompInstanceId] = useState<string | null>(null)

  const [sandboxSummary, setSandboxSummary] = useState<SandboxAccountingSummary | null>(null)
  const [sandboxLedger, setSandboxLedger] = useState<SandboxLedgerEntryAdmin[]>([])
  const [sandboxLedgerPage, setSandboxLedgerPage] = useState(1)
  const [sandboxLedgerTotal, setSandboxLedgerTotal] = useState(0)
  const [sandboxLedgerAccountFilter, setSandboxLedgerAccountFilter] = useState('')
  const [sandboxLedgerEventFilter, setSandboxLedgerEventFilter] = useState('')
  const [grantSandboxFundsOpen, setGrantSandboxFundsOpen] = useState(false)
  const [grantTestFundsOpen, setGrantTestFundsOpen] = useState(false)
  const [grantTestFundsUser, setGrantTestFundsUser] = useState<UserItem | null>(null)
  const [fundingGrants, setFundingGrants] = useState<SandboxFundingGrantAdmin[]>([])
  const [fundingQuery, setFundingQuery] = useState('')
  const [globalSearch, setGlobalSearch] = useState('')

  const [gameEligibility, setGameEligibility] = useState<GameEligibilityAdminItem[]>([])
  const [operationsData, setOperationsData] = useState<AdminOperationsData | null>(null)

  // Tab 1: Dashboard
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [recentAuditLogs, setRecentAuditLogs] = useState<AuditItem[]>([])

  // Tab 2: Users
  const [userQuery, setUserQuery] = useState('')
  const [userStatusFilter, setUserStatusFilter] = useState('')
  const [userRoleFilter, setUserRoleFilter] = useState('')
  const [userPage, setUserPage] = useState(1)
  const [userTotal, setUserTotal] = useState(0)
  const [usersList, setUsersList] = useState<UserItem[]>([])
  const [selectedUserDetail, setSelectedUserDetail] = useState<UserDetail | null>(null)

  // Tab 3: Matches
  const [matchGameFilter, setMatchGameFilter] = useState('')
  const [matchStatusFilter, setMatchStatusFilter] = useState('')
  const [matchCurrencyFilter, setMatchCurrencyFilter] = useState('')
  const [matchIdQuery, setMatchIdQuery] = useState('')
  const [matchPage, setMatchPage] = useState(1)
  const [matchTotal, setMatchTotal] = useState(0)
  const [matchesList, setMatchesList] = useState<MatchItem[]>([])
  const [selectedMatchDetail, setSelectedMatchDetail] = useState<MatchDetail | null>(null)

  // Tab 4: Ledger
  const [ledgerCurrencyFilter, setLedgerCurrencyFilter] = useState('')
  const [ledgerUserIdQuery, setLedgerUserIdQuery] = useState('')
  const [ledgerPage, setLedgerPage] = useState(1)
  const [ledgerTotal, setLedgerTotal] = useState(0)
  const [ledgerList, setLedgerList] = useState<LedgerItem[]>([])

  // Tab 5: Audit Log
  const [auditActionFilter, setAuditActionFilter] = useState('')
  const [auditTargetTypeFilter, setAuditTargetTypeFilter] = useState('')
  const [auditTargetIdQuery, setAuditTargetIdQuery] = useState('')
  const [auditAdminIdQuery, setAuditAdminIdQuery] = useState('')
  const [auditPage, setAuditPage] = useState(1)
  const [auditTotal, setAuditTotal] = useState(0)
  const [auditList, setAuditList] = useState<AuditItem[]>([])
  const [viewingAuditJson, setViewingAuditJson] = useState<AuditItem | null>(null)

  // Modals state
  const [confirmModalConfig, setConfirmModalConfig] = useState<ConfirmModalConfig | null>(null)
  const [grantModalUser, setGrantModalUser] = useState<UserItem | null>(null)

  // Permission Check Helper
  const hasPerm = useCallback(
    (perm: AdminPermission): boolean => {
      if (!adminUser) return false
      if (adminUser.role === 'OWNER' || adminUser.role === 'SUPER_ADMIN') return true
      if (perm === 'WALLET_GRANT_SANDBOX') return permissions.includes('WALLET_GRANT_SANDBOX') || permissions.includes('WALLET_GRANT_COINS')
      return permissions.includes(perm)
    },
    [adminUser, permissions]
  )

  // ---------------------------------------------------------------------------
  // Check Admin Session on Mount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    document.title = 'Fugluck — Operational Console'
    checkAdminSession()
  }, [])

  async function checkAdminSession() {
    try {
      const res = await apiFetch<{ user: AdminUser; permissions: AdminPermission[] }>('/api/admin/me')
      if (res && res.user) {
        setAdminUser(res.user)
        setPermissions(res.permissions || [])
        setIsAdminAuthenticated(true)
        setAdminAuthError(null)
      } else {
        setIsAdminAuthenticated(false)
      }
    } catch {
      setIsAdminAuthenticated(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Login / Logout Handlers
  // ---------------------------------------------------------------------------
  async function handleAdminLogin(e: React.FormEvent) {
    e.preventDefault()
    setAdminAuthError(null)
    setIsLoggingIn(true)
    try {
      const res = await apiFetch<{ success: boolean; user: AdminUser }>('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({
          username: adminUsernameInput.trim(),
          password: adminPasswordInput,
        }),
      })
      if (res.success && res.user) {
        setAdminUser(res.user)
        setIsAdminAuthenticated(true)
        setAdminAuthError(null)
        setAdminPasswordInput('')
        // Fetch refreshed permissions
        await checkAdminSession()
        fetchDashboard()
      }
    } catch (err: any) {
      setAdminAuthError(err instanceof ApiError ? err.message : 'Admin authentication failed.')
    } finally {
      setIsLoggingIn(false)
    }
  }

  async function handleAdminLogout() {
    try {
      await apiFetch('/api/admin/logout', { method: 'POST' })
    } catch {
      // Ignore cleanup error
    }
    setIsAdminAuthenticated(false)
    setAdminUser(null)
    setPermissions([])
    onNavigateHome()
  }

  // ---------------------------------------------------------------------------
  // Data Fetching Handlers
  // ---------------------------------------------------------------------------
  const fetchDashboard = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage(null)
    try {
      const res = await apiFetch<{ metrics: Metrics; recentAuditLogs: AuditItem[] }>('/api/admin/dashboard')
      setMetrics(res.metrics)
      setRecentAuditLogs(res.recentAuditLogs || [])
    } catch (e: any) {
      setErrorMessage(e instanceof ApiError ? e.message : 'Failed to load dashboard metrics.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const fetchUsers = useCallback(async (page = userPage, queryOverride?: string) => {
    setIsLoading(true)
    setErrorMessage(null)
    try {
      const params = new URLSearchParams()
      const search = queryOverride ?? userQuery
      if (search.trim()) params.append('query', search.trim())
      if (userStatusFilter) params.append('status', userStatusFilter)
      if (userRoleFilter) params.append('role', userRoleFilter)
      params.append('page', String(page))
      params.append('limit', '20')

      const res = await apiFetch<{ users: UserItem[]; pagination: { page: number; total: number } }>(
        `/api/admin/users?${params.toString()}`
      )
      setUsersList(res.users || [])
      setUserTotal(res.pagination?.total ?? 0)
      setUserPage(page)
    } catch (e: any) {
      setErrorMessage(e instanceof ApiError ? e.message : 'Failed to load users list.')
    } finally {
      setIsLoading(false)
    }
  }, [userQuery, userStatusFilter, userRoleFilter, userPage])

  const fetchFundingGrants = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage(null)
    try {
      const params = new URLSearchParams({ page: '1', limit: '50' })
      if (fundingQuery.trim()) params.set('query', fundingQuery.trim())
      const result = await apiFetch<{ grants: SandboxFundingGrantAdmin[] }>(`/api/admin/competitions/accounting/grants?${params}`)
      setFundingGrants(result.grants || [])
    } catch (e) {
      setErrorMessage(e instanceof ApiError ? e.message : 'Failed to load test funding history.')
    } finally {
      setIsLoading(false)
    }
  }, [fundingQuery])

  const fetchMatches = useCallback(async (page = matchPage) => {
    setIsLoading(true)
    setErrorMessage(null)
    try {
      const params = new URLSearchParams()
      if (matchIdQuery.trim()) params.append('matchId', matchIdQuery.trim())
      if (matchGameFilter) params.append('gameId', matchGameFilter)
      if (matchStatusFilter) params.append('status', matchStatusFilter)
      if (matchCurrencyFilter) params.append('currency', matchCurrencyFilter)
      params.append('page', String(page))
      params.append('limit', '20')

      const res = await apiFetch<{ matches: MatchItem[]; pagination: { page: number; total: number } }>(
        `/api/admin/matches?${params.toString()}`
      )
      setMatchesList(res.matches || [])
      setMatchTotal(res.pagination?.total ?? 0)
      setMatchPage(page)
    } catch (e: any) {
      setErrorMessage(e instanceof ApiError ? e.message : 'Failed to load matches list.')
    } finally {
      setIsLoading(false)
    }
  }, [matchIdQuery, matchGameFilter, matchStatusFilter, matchCurrencyFilter, matchPage])

  const fetchLedger = useCallback(async (page = ledgerPage) => {
    setIsLoading(true)
    setErrorMessage(null)
    try {
      const params = new URLSearchParams()
      if (ledgerUserIdQuery.trim()) params.append('userId', ledgerUserIdQuery.trim())
      if (ledgerCurrencyFilter) params.append('currency', ledgerCurrencyFilter)
      params.append('page', String(page))
      params.append('limit', '20')

      const res = await apiFetch<{ ledger: LedgerItem[]; pagination: { page: number; total: number } }>(
        `/api/admin/ledger?${params.toString()}`
      )
      setLedgerList(res.ledger || [])
      setLedgerTotal(res.pagination?.total ?? 0)
      setLedgerPage(page)
    } catch (e: any) {
      setErrorMessage(e instanceof ApiError ? e.message : 'Failed to load ledger records.')
    } finally {
      setIsLoading(false)
    }
  }, [ledgerUserIdQuery, ledgerCurrencyFilter, ledgerPage])

  const fetchAudit = useCallback(async (page = auditPage) => {
    setIsLoading(true)
    setErrorMessage(null)
    try {
      const params = new URLSearchParams()
      if (auditActionFilter) params.append('action', auditActionFilter)
      if (auditTargetTypeFilter) params.append('targetType', auditTargetTypeFilter)
      if (auditTargetIdQuery.trim()) params.append('targetId', auditTargetIdQuery.trim())
      if (auditAdminIdQuery.trim()) params.append('adminUserId', auditAdminIdQuery.trim())
      params.append('page', String(page))
      params.append('limit', '25')

      const res = await apiFetch<{ auditLogs: AuditItem[]; pagination: { page: number; total: number } }>(
        `/api/admin/audit-logs?${params.toString()}`
      )
      setAuditList(res.auditLogs || [])
      setAuditTotal(res.pagination?.total ?? 0)
      setAuditPage(page)
    } catch (e: any) {
      setErrorMessage(e instanceof ApiError ? e.message : 'Failed to load audit logs.')
    } finally {
      setIsLoading(false)
    }
  }, [auditActionFilter, auditTargetTypeFilter, auditTargetIdQuery, auditAdminIdQuery, auditPage])

  // ---------------------------------------------------------------------------
  // Competition Data Fetching Handlers
  // ---------------------------------------------------------------------------
  const fetchCompMetrics = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage(null)
    try {
      const res = await apiFetch<{ metrics: CompetitionOverviewMetrics }>('/api/admin/competitions/overview')
      setCompMetrics(res.metrics)
    } catch (e: any) {
      setErrorMessage(e instanceof ApiError ? e.message : 'Failed to load competition overview.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const fetchCompTemplates = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage(null)
    try {
      const res = await apiFetch<{ templates: CompetitionTemplateAdmin[] }>('/api/admin/competitions/templates')
      setCompTemplates(res.templates || [])
    } catch (e: any) {
      setErrorMessage(e instanceof ApiError ? e.message : 'Failed to load competition templates.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const fetchCompInstances = useCallback(async (page = compInstancePage) => {
    setIsLoading(true)
    setErrorMessage(null)
    try {
      const params = new URLSearchParams()
      if (compStatusFilter) params.append('status', compStatusFilter)
      if (compGameFilter) params.append('gameId', compGameFilter)
      params.append('page', String(page))
      params.append('limit', '20')

      const res = await apiFetch<{ instances: CompetitionInstanceAdmin[]; page: number; total: number }>(
        `/api/admin/competitions/instances?${params.toString()}`
      )
      setCompInstances(res.instances || [])
      setCompInstanceTotal(res.total ?? 0)
      setCompInstancePage(page)
    } catch (e: any) {
      setErrorMessage(e instanceof ApiError ? e.message : 'Failed to load competition instances.')
    } finally {
      setIsLoading(false)
    }
  }, [compStatusFilter, compGameFilter, compInstancePage])

  const inspectCompInstance = useCallback(async (instanceId: string) => {
    setIsLoading(true)
    setErrorMessage(null)
    try {
      const res = await apiFetch<CompetitionInstanceAdminDetail>(`/api/admin/competitions/instances/${instanceId}`)
      setSelectedCompInstanceDetail(res)
    } catch (e: any) {
      setErrorMessage(e instanceof ApiError ? e.message : 'Failed to load competition instance details.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const fetchSandboxSummary = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage(null)
    try {
      const res = await apiFetch<{ summary: SandboxAccountingSummary }>('/api/admin/competitions/accounting/summary')
      setSandboxSummary(res.summary)
    } catch (e: any) {
      setErrorMessage(e instanceof ApiError ? e.message : 'Failed to load sandbox accounting summary.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const fetchSandboxLedger = useCallback(async (page = sandboxLedgerPage) => {
    setIsLoading(true)
    setErrorMessage(null)
    try {
      const params = new URLSearchParams()
      if (sandboxLedgerAccountFilter) params.append('account', sandboxLedgerAccountFilter)
      if (sandboxLedgerEventFilter) params.append('eventType', sandboxLedgerEventFilter)
      params.append('page', String(page))
      params.append('limit', '25')

      const res = await apiFetch<{ ledger: SandboxLedgerEntryAdmin[]; pagination: { page: number; total: number } }>(
        `/api/admin/competitions/accounting/ledger?${params.toString()}`
      )
      setSandboxLedger(res.ledger || [])
      setSandboxLedgerTotal(res.pagination?.total ?? 0)
      setSandboxLedgerPage(page)
    } catch (e: any) {
      setErrorMessage(e instanceof ApiError ? e.message : 'Failed to load sandbox ledger records.')
    } finally {
      setIsLoading(false)
    }
  }, [sandboxLedgerAccountFilter, sandboxLedgerEventFilter, sandboxLedgerPage])

  const fetchGameEligibility = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage(null)
    try {
      const res = await apiFetch<{ registry: GameEligibilityAdminItem[] }>('/api/admin/competitions/eligibility')
      setGameEligibility(res.registry || [])
    } catch (e: any) {
      setErrorMessage(e instanceof ApiError ? e.message : 'Failed to load game eligibility.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const fetchOperations = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage(null)
    try {
      const revision = import.meta.env.VITE_BUILD_REVISION
      const suffix = typeof revision === 'string' && /^[a-f0-9]{7,40}$/i.test(revision) ? `?frontendRevision=${revision}` : ''
      setOperationsData(await apiFetch<AdminOperationsData>(`/api/admin/operations${suffix}`))
    } catch (e: any) {
      setErrorMessage(e instanceof ApiError ? e.message : 'Failed to load operations status.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Competition Action Handlers
  const handleCreateTemplate = async (params: any) => {
    await apiFetch('/api/admin/competitions/templates', {
      method: 'POST',
      body: JSON.stringify(params),
    })
    setStatusMessage('Competition template created successfully.')
    fetchCompTemplates()
  }

  const handleEditTemplate = async (templateId: string, params: any) => {
    await apiFetch(`/api/admin/competitions/templates/${templateId}`, {
      method: 'PUT',
      body: JSON.stringify(params),
    })
    setStatusMessage('Competition template updated successfully (future instances only).')
    fetchCompTemplates()
  }

  const handleToggleTemplate = async (template: CompetitionTemplateAdmin) => {
    try {
      await apiFetch(`/api/admin/competitions/templates/${template.id}/${template.enabled ? 'disable' : 'enable'}`, {
        method: 'POST',
      })
      setStatusMessage(`Template "${template.title}" ${!template.enabled ? 'enabled' : 'disabled'}.`)
      fetchCompTemplates()
    } catch (e: any) {
      setErrorMessage(e instanceof ApiError ? e.message : 'Failed to update template status.')
    }
  }

  const handleCancelCompetition = async (instanceId: string, reason: string) => {
    await apiFetch(`/api/admin/competitions/instances/${instanceId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    })
    setStatusMessage(`Competition instance ${instanceId} cancelled and reservations released.`)
    fetchCompInstances()
    if (selectedCompInstanceDetail?.instance.id === instanceId) {
      inspectCompInstance(instanceId)
    }
  }

  const handleVoidCompetition = async (instanceId: string, reason: string) => {
    await apiFetch(`/api/admin/competitions/instances/${instanceId}/void`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    })
    setStatusMessage(`Competition instance ${instanceId} voided and captured entries refunded.`)
    fetchCompInstances()
    if (selectedCompInstanceDetail?.instance.id === instanceId) {
      inspectCompInstance(instanceId)
    }
  }

  const handleGrantSandboxFunds = async (params: { targetUserId: string; amountMinor: number; reason: string }) => {
    const result = await apiFetch<{ availableMinor: number; accountingReferenceId: string }>('/api/admin/competitions/accounting/grant', {
      method: 'POST',
      body: JSON.stringify(params),
    })
    setStatusMessage(`Granted ${formatGEL(params.amountMinor)} TEST GEL. New available balance: ${formatGEL(result.availableMinor)}. Reference: ${result.accountingReferenceId}.`)
    fetchUsers(1)
    if (selectedUserDetail?.user.id === params.targetUserId) inspectUser(params.targetUserId)
    if (activeTab === 'test_funding') fetchFundingGrants()
    if (activeTab === 'competitions_accounting') {
      fetchSandboxSummary()
      fetchSandboxLedger()
    }
  }

  function startTestFunding(user: UserItem | null = null) {
    if (!hasPerm('WALLET_GRANT_SANDBOX')) return
    setGrantTestFundsUser(user)
    setGrantTestFundsOpen(true)
  }

  // Switch tabs & trigger data loads
  useEffect(() => {
    if (!isAdminAuthenticated) return
    setStatusMessage(null)
    setErrorMessage(null)
    if (activeTab === 'competitions_overview') fetchCompMetrics()
    if (activeTab === 'competitions_templates') fetchCompTemplates()
    if (activeTab === 'competitions_instances') fetchCompInstances(1)
    if (activeTab === 'competitions_accounting') {
      fetchSandboxSummary()
      fetchSandboxLedger(1)
    }
    if (activeTab === 'competitions_eligibility') fetchGameEligibility()
    if (activeTab === 'operations') fetchOperations()
    if (activeTab === 'test_funding') fetchFundingGrants()
    if (activeTab === 'dashboard') fetchDashboard()
    if (activeTab === 'users') fetchUsers(1)
    if (activeTab === 'matches') fetchMatches(1)
    if (activeTab === 'ledger') fetchLedger(1)
    if (activeTab === 'audit') fetchAudit(1)
  }, [activeTab, isAdminAuthenticated])

  // ---------------------------------------------------------------------------
  // Action Handlers
  // ---------------------------------------------------------------------------
  async function inspectUser(userId: string) {
    setIsLoading(true)
    try {
      const res = await apiFetch<UserDetail>(`/api/admin/users/${userId}`)
      setSelectedUserDetail(res)
    } catch (e: any) {
      setErrorMessage(e instanceof ApiError ? e.message : 'Failed to load user details.')
    } finally {
      setIsLoading(false)
    }
  }

  async function inspectMatch(matchId: string) {
    setIsLoading(true)
    try {
      const res = await apiFetch<MatchDetail>(`/api/admin/matches/${matchId}`)
      setSelectedMatchDetail(res)
    } catch (e: any) {
      setErrorMessage(e instanceof ApiError ? e.message : 'Failed to load match details.')
    } finally {
      setIsLoading(false)
    }
  }

  function triggerUserAction(action: 'suspend' | 'ban' | 'unban' | 'role', user: UserItem) {
    if (action === 'suspend') {
      setConfirmModalConfig({
        title: `Suspend Account: ${user.username}`,
        actionLabel: 'Suspend Account',
        intent: 'warning',
        targetDescription: `User ${user.username} (${user.id})`,
        impactWarning: 'Account will be immediately restricted from signing in and starting or joining matches.',
        onConfirm: async (reason) => {
          await apiFetch(`/api/admin/users/${user.id}/suspend`, {
            method: 'POST',
            body: JSON.stringify({ reason }),
          })
          setStatusMessage(`User "${user.username}" suspended successfully.`)
          fetchUsers()
          if (selectedUserDetail) inspectUser(user.id)
        },
        onClose: () => setConfirmModalConfig(null),
      })
    } else if (action === 'ban') {
      setConfirmModalConfig({
        title: `Ban Account: ${user.username}`,
        actionLabel: 'Permanently Ban',
        intent: 'danger',
        targetDescription: `User ${user.username} (${user.id})`,
        impactWarning: 'User will be banned from all platform features. Active sessions and socket connections are terminated.',
        onConfirm: async (reason) => {
          await apiFetch(`/api/admin/users/${user.id}/ban`, {
            method: 'POST',
            body: JSON.stringify({ reason }),
          })
          setStatusMessage(`User "${user.username}" banned successfully.`)
          fetchUsers()
          if (selectedUserDetail) inspectUser(user.id)
        },
        onClose: () => setConfirmModalConfig(null),
      })
    } else if (action === 'unban') {
      setConfirmModalConfig({
        title: `Reactivate Account: ${user.username}`,
        actionLabel: 'Reactivate Account',
        intent: 'primary',
        targetDescription: `User ${user.username} (${user.id})`,
        impactWarning: 'Restores user account status to ACTIVE.',
        onConfirm: async (reason) => {
          await apiFetch(`/api/admin/users/${user.id}/unban`, {
            method: 'POST',
            body: JSON.stringify({ reason }),
          })
          setStatusMessage(`User "${user.username}" reactivated to active status.`)
          fetchUsers()
          if (selectedUserDetail) inspectUser(user.id)
        },
        onClose: () => setConfirmModalConfig(null),
      })
    } else if (action === 'role') {
      setConfirmModalConfig({
        title: `Change Administrative Role: ${user.username}`,
        actionLabel: 'Update Role',
        intent: 'warning',
        roleSelection: true,
        currentRole: user.role,
        targetDescription: `User ${user.username} (Current: ${user.role})`,
        impactWarning: 'Administrative privilege grants or revokes access to the Operational Console and sensitive APIs.',
        onConfirm: async (reason, newRole) => {
          await apiFetch(`/api/admin/users/${user.id}/role`, {
            method: 'POST',
            body: JSON.stringify({ role: newRole, reason }),
          })
          setStatusMessage(`User "${user.username}" role updated to ${newRole}.`)
          fetchUsers()
          if (selectedUserDetail) inspectUser(user.id)
        },
        onClose: () => setConfirmModalConfig(null),
      })
    }
  }

  function triggerVoidMatch(matchId: string, match?: MatchItem) {
    const stakeText = match ? `${match.stake} ${match.currency}` : 'active stakes'
    setConfirmModalConfig({
      title: `Void Match: ${matchId}`,
      actionLabel: 'Confirm Void & Refund',
      intent: 'danger',
      targetDescription: `Match ID: ${matchId}`,
      impactWarning: `Voiding will permanently cancel this match and issue AUTOMATIC COMPENSATING REFUNDS (${stakeText}) to both participating players in the ledger.`,
      onConfirm: async (reason) => {
        const idempotencyKey = `ui_void_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
        await apiFetch(`/api/admin/matches/${matchId}/void`, {
          method: 'POST',
          body: JSON.stringify({ reason, idempotencyKey }),
        })
        setStatusMessage(`Match [${matchId}] voided and compensating refunds issued.`)
        fetchMatches()
        if (selectedMatchDetail) setSelectedMatchDetail(null)
      },
      onClose: () => setConfirmModalConfig(null),
    })
  }

  function triggerReverseLedger(entry: LedgerItem) {
    setConfirmModalConfig({
      title: `Reverse Ledger Entry: ${entry.id}`,
      actionLabel: 'Issue Compensating Reversal',
      intent: 'danger',
      targetDescription: `Entry ${entry.id} | User: ${entry.userId} | Amount: ${entry.amount} ${entry.currency}`,
      impactWarning: `This will insert a new compensating ledger entry of ${-entry.amount} ${entry.currency} into the append-only ledger.`,
      onConfirm: async (reason) => {
        const idempotencyKey = `ui_rev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
        await apiFetch('/api/admin/wallet/reverse', {
          method: 'POST',
          body: JSON.stringify({ originalLedgerId: entry.id, reason, idempotencyKey }),
        })
        setStatusMessage(`Ledger entry [${entry.id}] reversed successfully.`)
        fetchLedger()
      },
      onClose: () => setConfirmModalConfig(null),
    })
  }

  async function handleGrantCurrency(userId: string, amount: number, reason: string) {
    const idempotencyKey = `ui_grant_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    await apiFetch('/api/admin/wallet/grant-coins', {
      method: 'POST',
      body: JSON.stringify({ targetUserId: userId, amount, reason, idempotencyKey }),
    })
    setStatusMessage(`Successfully granted ${amount} COINS to user ${userId}.`)
    fetchUsers()
    if (selectedUserDetail) inspectUser(userId)
    if (activeTab === 'ledger') fetchLedger()
    if (activeTab === 'dashboard') fetchDashboard()
  }

  // ---------------------------------------------------------------------------
  // Render: Loading Admin Auth Session
  // ---------------------------------------------------------------------------
  if (isAdminAuthenticated === null) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0f', color: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '28px', marginBottom: '12px', animation: 'spin 1s linear infinite' }}>⏳</div>
          <div style={{ color: '#94a3b8', fontSize: '14px' }}>Verifying operator credentials...</div>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Render: Admin Login Form (Unauthenticated)
  // ---------------------------------------------------------------------------
  if (!isAdminAuthenticated) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0f', color: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', padding: '16px' }}>
        <div style={{ background: '#12131c', border: '1px solid #1e2030', borderRadius: '12px', padding: '36px', maxWidth: '440px', width: '100%', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)' }}>
          <div style={{ fontSize: '36px', marginBottom: '12px' }}>🔒</div>
          <h2 style={{ fontSize: '20px', color: '#fbbf24', margin: '0 0 8px 0', letterSpacing: '0.05em', fontWeight: 700 }}>
            FUGLUCK OPERATOR CONSOLE
          </h2>
          <p style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.5, marginBottom: '24px' }}>
            Administrative authentication required. Access is protected by server-side IP lockouts and immutable audit logs.
          </p>

          {adminAuthError && (
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#fca5a5', padding: '12px', borderRadius: '6px', fontSize: '13px', marginBottom: '20px', textAlign: 'left', lineHeight: 1.4 }}>
              <strong>Authentication Error: </strong>{adminAuthError}
            </div>
          )}

          <form onSubmit={handleAdminLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'left' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '6px', fontWeight: 600, letterSpacing: '0.05em' }}>
                ADMINISTRATOR USERNAME
              </label>
              <input
                type="text"
                value={adminUsernameInput}
                onChange={(e) => setAdminUsernameInput(e.target.value)}
                placeholder="Enter operator username"
                required
                disabled={isLoggingIn}
                style={{ width: '100%', background: '#0b0c10', border: '1px solid #1e2030', color: '#fff', padding: '10px 12px', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '6px', fontWeight: 600, letterSpacing: '0.05em' }}>
                ADMINISTRATOR PASSWORD
              </label>
              <input
                type="password"
                value={adminPasswordInput}
                onChange={(e) => setAdminPasswordInput(e.target.value)}
                placeholder="Enter operator password"
                required
                disabled={isLoggingIn}
                style={{ width: '100%', background: '#0b0c10', border: '1px solid #1e2030', color: '#fff', padding: '10px 12px', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
              />
            </div>
            <button
              type="submit"
              disabled={isLoggingIn}
              style={{
                background: '#d97706',
                color: '#fff',
                border: 'none',
                padding: '12px',
                borderRadius: '6px',
                fontWeight: 700,
                cursor: isLoggingIn ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                marginTop: '6px',
                letterSpacing: '0.05em',
                opacity: isLoggingIn ? 0.6 : 1,
              }}
            >
              {isLoggingIn ? 'Authenticating...' : 'Authenticate Console Session'}
            </button>
          </form>

          <div style={{ marginTop: '24px', borderTop: '1px solid #1e2030', paddingTop: '16px' }}>
            <button
              type="button"
              onClick={onNavigateHome}
              style={{ background: 'transparent', color: '#64748b', border: 'none', cursor: 'pointer', fontSize: '12px', textDecoration: 'underline' }}
            >
              ← Return to Main Application
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Render: Authenticated Operational Console
  // ---------------------------------------------------------------------------
  return (
      <div className="admin-shell" style={{ minHeight: '100vh', background: '#0a0a0f', color: '#e2e8f0', fontFamily: 'sans-serif' }}>
      {/* Competition Modals */}
      <CreateTemplateModal
        isOpen={createTemplateModalOpen}
        onClose={() => setCreateTemplateModalOpen(false)}
        onSubmit={handleCreateTemplate}
      />
      <EditTemplateModal
        isOpen={editingTemplate !== null}
        template={editingTemplate}
        onClose={() => setEditingTemplate(null)}
        onSubmit={handleEditTemplate}
      />
      <InstanceDetailModal
        isOpen={selectedCompInstanceDetail !== null}
        detail={selectedCompInstanceDetail}
        onClose={() => setSelectedCompInstanceDetail(null)}
        onCancelCompetition={(id) => setCancelCompInstanceId(id)}
        onVoidCompetition={(id) => setVoidCompInstanceId(id)}
      />
      <CancelCompetitionModal
        isOpen={cancelCompInstanceId !== null}
        instanceId={cancelCompInstanceId}
        onClose={() => setCancelCompInstanceId(null)}
        onConfirm={handleCancelCompetition}
      />
      <VoidCompetitionModal
        isOpen={voidCompInstanceId !== null}
        instanceId={voidCompInstanceId}
        onClose={() => setVoidCompInstanceId(null)}
        onConfirm={handleVoidCompetition}
      />
      <GrantTestFundsModal
        isOpen={grantSandboxFundsOpen || grantTestFundsOpen}
        initialUser={grantTestFundsUser}
        onClose={() => { setGrantSandboxFundsOpen(false); setGrantTestFundsOpen(false); setGrantTestFundsUser(null) }}
        onSubmit={handleGrantSandboxFunds}
      />

      {/* Modals */}
      {confirmModalConfig && <ActionConfirmModal config={confirmModalConfig} />}
      {grantModalUser && (
        <GrantCurrencyModal
          user={grantModalUser}
          onClose={() => setGrantModalUser(null)}
          onGrant={handleGrantCurrency}
        />
      )}
      {selectedUserDetail && (
        <UserDetailDrawer
          detail={selectedUserDetail}
          onClose={() => setSelectedUserDetail(null)}
          onGrant={(user) => startTestFunding(user)}
          onOpenAction={(action, user) => {
            if (action === 'grant') {
              setGrantModalUser(user)
            } else {
              triggerUserAction(action as any, user)
            }
          }}
        />
      )}
      {selectedMatchDetail && (
        <MatchDetailModal
          detail={selectedMatchDetail}
          onClose={() => setSelectedMatchDetail(null)}
          onVoidMatch={(matchId) => triggerVoidMatch(matchId, selectedMatchDetail.match)}
        />
      )}
      {viewingAuditJson && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }} onClick={() => setViewingAuditJson(null)}>
          <div style={{ background: '#12131c', border: '1px solid #282a36', borderRadius: '8px', padding: '20px', maxWidth: '600px', width: '100%', maxHeight: '80vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h4 style={{ margin: 0, color: '#fbbf24' }}>Audit Event Details: {viewingAuditJson.action}</h4>
              <button type="button" onClick={() => setViewingAuditJson(null)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '16px' }}>✕</button>
            </div>
            <pre style={{ background: '#0a0a0f', padding: '12px', borderRadius: '6px', color: '#38bdf8', fontSize: '12px', overflowX: 'auto' }}>
              {JSON.stringify(viewingAuditJson, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* Global operations header */}
      <header className="admin-header">
        <div className="admin-brand"><span>FUGLUCK</span><small>OPERATIONS</small></div>
        <form className="admin-global-search" onSubmit={e => { e.preventDefault(); setUserQuery(globalSearch); setActiveTab('users'); void fetchUsers(1, globalSearch) }}>
          <input aria-label="Search users" placeholder="Search username, email, or user ID" value={globalSearch} onChange={e => setGlobalSearch(e.target.value)} />
          <button type="submit">Search</button>
        </form>
        <div className="admin-env-badge">{location.hostname.includes('staging') ? 'STAGING' : ['localhost', '127.0.0.1'].includes(location.hostname) ? 'DEVELOPMENT' : 'PRODUCTION'}</div>
        <div className="admin-sandbox-badge"><strong>TEST / SANDBOX</strong><span>NO REAL MONEY</span></div>
        <div className="admin-identity"><strong>{adminUser?.username}</strong><span>{adminUser?.role}</span></div>

        <div className="admin-header-actions">
          <button
            type="button"
            onClick={() => {
              if (activeTab === 'competitions_overview') fetchCompMetrics()
              if (activeTab === 'competitions_templates') fetchCompTemplates()
              if (activeTab === 'competitions_instances') fetchCompInstances()
              if (activeTab === 'competitions_accounting') {
                fetchSandboxSummary()
                fetchSandboxLedger()
              }
              if (activeTab === 'competitions_eligibility') fetchGameEligibility()
              if (activeTab === 'operations') fetchOperations()
              if (activeTab === 'test_funding') fetchFundingGrants()
              if (activeTab === 'dashboard') fetchDashboard()
              if (activeTab === 'users') fetchUsers()
              if (activeTab === 'matches') fetchMatches()
              if (activeTab === 'ledger') fetchLedger()
              if (activeTab === 'audit') fetchAudit()
            }}
            className="admin-refresh"
          >
            ↻ Refresh
          </button>
          <button
            type="button"
            onClick={handleAdminLogout}
            className="admin-logout"
          >
            Logout & Exit
          </button>
        </div>
      </header>

      {/* Notifications */}
      {statusMessage && (
        <div style={{ background: '#064e3b', color: '#6ee7b7', padding: '10px 24px', fontSize: '13px', borderBottom: '1px solid #047857', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>✓ {statusMessage}</span>
          <button type="button" onClick={() => setStatusMessage(null)} style={{ background: 'transparent', border: 'none', color: '#6ee7b7', cursor: 'pointer' }}>✕</button>
        </div>
      )}
      {errorMessage && (
        <div style={{ background: '#7f1d1d', color: '#fca5a5', padding: '10px 24px', fontSize: '13px', borderBottom: '1px solid #b91c1c', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>⚠️ {errorMessage}</span>
          <button type="button" onClick={() => setErrorMessage(null)} style={{ background: 'transparent', border: 'none', color: '#fca5a5', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      <div className="admin-layout">
        <nav className="admin-sidebar" aria-label="Admin navigation">
          <div className="admin-nav-group"><span>OVERVIEW</span><NavButton id="dashboard" active={activeTab} setActive={setActiveTab} label="Overview" /></div>
          <div className="admin-nav-group"><span>PEOPLE</span><NavButton id="users" active={activeTab} setActive={setActiveTab} label="Users" /></div>
          <div className="admin-nav-group"><span>COMPETITIONS</span>
            <NavButton id="competitions_overview" active={activeTab} setActive={setActiveTab} label="Overview" />
            <NavButton id="competitions_templates" active={activeTab} setActive={setActiveTab} label="Templates" />
            <NavButton id="competitions_instances" active={activeTab} setActive={setActiveTab} label="Live / Recent Instances" />
          </div>
          <div className="admin-nav-group"><span>GAMES</span><NavButton id="competitions_eligibility" active={activeTab} setActive={setActiveTab} label="Eligibility" /></div>
          <div className="admin-nav-group"><span>SANDBOX ECONOMY</span>
            <NavButton id="users" active={activeTab} setActive={setActiveTab} label="User Balances" activeWhen={false} />
            <NavButton id="test_funding" active={activeTab} setActive={setActiveTab} label="Test Funding" />
            <NavButton id="ledger" active={activeTab} setActive={setActiveTab} label="Ledger" />
            <NavButton id="competitions_accounting" active={activeTab} setActive={setActiveTab} label="Reconciliation" />
          </div>
          <div className="admin-nav-group"><span>LIVE OPERATIONS</span><NavButton id="operations" active={activeTab} setActive={setActiveTab} label="Operations / Health" /><NavButton id="competitions_instances" active={activeTab} setActive={setActiveTab} label="Instances" /></div>
          <div className="admin-nav-group"><span>RECORDS</span><NavButton id="audit" active={activeTab} setActive={setActiveTab} label="Audit Log" /><NavButton id="matches" active={activeTab} setActive={setActiveTab} label="Legacy Matches" /></div>
        </nav>
        <main className="admin-main">
        {/* COMPETITION TABS */}
        {activeTab === 'competitions_overview' && (
          <CompetitionOverviewView
            metrics={compMetrics}
            onNavigateTab={(tab) => setActiveTab(tab)}
          />
        )}

        {activeTab === 'competitions_templates' && (
          <CompetitionTemplatesView
            templates={compTemplates}
            onCreateClick={() => setCreateTemplateModalOpen(true)}
            onEditClick={(t) => setEditingTemplate(t)}
            onToggleClick={handleToggleTemplate}
            hasManagePerm={hasPerm('COMPETITIONS_MANAGE')}
          />
        )}

        {activeTab === 'competitions_instances' && (
          <CompetitionInstancesView
            instances={compInstances}
            total={compInstanceTotal}
            page={compInstancePage}
            statusFilter={compStatusFilter}
            gameFilter={compGameFilter}
            onStatusFilterChange={(s) => setCompStatusFilter(s)}
            onGameFilterChange={(g) => setCompGameFilter(g)}
            onSearch={(page) => fetchCompInstances(page)}
            onInspect={inspectCompInstance}
            onCancel={(id) => setCancelCompInstanceId(id)}
            onVoid={(id) => setVoidCompInstanceId(id)}
            hasCancelPerm={hasPerm('COMPETITIONS_CANCEL')}
            hasVoidPerm={hasPerm('COMPETITIONS_VOID')}
          />
        )}

        {activeTab === 'competitions_accounting' && (
          <CompetitionAccountingView
            summary={sandboxSummary}
            ledger={sandboxLedger}
            ledgerTotal={sandboxLedgerTotal}
            ledgerPage={sandboxLedgerPage}
            accountFilter={sandboxLedgerAccountFilter}
            eventFilter={sandboxLedgerEventFilter}
            onAccountFilterChange={(a) => setSandboxLedgerAccountFilter(a)}
            onEventFilterChange={(e) => setSandboxLedgerEventFilter(e)}
            onFilterLedger={(page) => fetchSandboxLedger(page)}
            onGrantClick={() => setGrantSandboxFundsOpen(true)}
            hasGrantPerm={hasPerm('WALLET_GRANT_SANDBOX')}
          />
        )}

        {activeTab === 'competitions_eligibility' && (
          <CompetitionEligibilityView games={gameEligibility} />
        )}

        {activeTab === 'operations' && (
          <AdminOperationsView data={operationsData} loading={isLoading} onRefresh={fetchOperations} />
        )}

        {activeTab === 'test_funding' && (
          <TestFundingHistoryView grants={fundingGrants} query={fundingQuery} setQuery={setFundingQuery} loading={isLoading} onSearch={fetchFundingGrants} onGrant={() => startTestFunding()} />
        )}

        {/* TAB 1: DASHBOARD */}
        {activeTab === 'dashboard' && metrics && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '15px', color: '#94a3b8', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Platform Telemetry & Circulation Overview
              </h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '28px' }}>
              <div style={kpiCardStyle}>
                <div style={kpiLabelStyle}>TOTAL USERS</div>
                <div style={{ fontSize: '26px', fontWeight: 800, color: '#f8fafc' }}>{metrics.registeredUsers.toLocaleString()}</div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                  <span style={{ color: '#34d399' }}>{metrics.activeUsers} active</span> · <span style={{ color: '#fbbf24' }}>{metrics.suspendedUsers} susp</span> · <span style={{ color: '#f87171' }}>{metrics.bannedUsers} ban</span>
                </div>
              </div>

              <div style={{ ...kpiCardStyle, border: '1px solid #2563eb' }}>
                <div style={{ ...kpiLabelStyle, color: '#60a5fa' }}>ACTIVE MATCHES NOW</div>
                <div style={{ fontSize: '26px', fontWeight: 800, color: '#60a5fa' }}>{metrics.activeMatchesCount}</div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>In progress on server</div>
              </div>

              <div style={kpiCardStyle}>
                <div style={kpiLabelStyle}>COMPLETED MATCHES</div>
                <div style={{ fontSize: '26px', fontWeight: 800, color: '#f8fafc' }}>{metrics.completedMatchesTotal.toLocaleString()}</div>
                <div style={{ fontSize: '11px', color: '#34d399', marginTop: '4px' }}>+{metrics.matchesCompletedToday} completed today</div>
              </div>

              <div style={kpiCardStyle}>
                <div style={kpiLabelStyle}>VOIDED MATCHES</div>
                <div style={{ fontSize: '26px', fontWeight: 800, color: metrics.totalMatchesVoided > 0 ? '#fca5a5' : '#f8fafc' }}>
                  {metrics.totalMatchesVoided}
                </div>
                <div style={{ fontSize: '11px', color: '#f87171', marginTop: '4px' }}>{metrics.matchesVoidedToday} voided today</div>
              </div>

              <div style={kpiCardStyle}>
                <div style={kpiLabelStyle}>CIRCULATING COINS</div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: '#34d399' }}>{metrics.coinsCirculation.toLocaleString()}</div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>Free-play aggregate</div>
              </div>

              <div style={kpiCardStyle}>
                <div style={kpiLabelStyle}>CIRCULATING DIAMONDS (LEGACY / RETIRED)</div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: '#fbbf24' }}>{metrics.diamondsCirculation.toLocaleString()}</div>
                <div style={{ fontSize: '11px', color: '#fbbf24', marginTop: '4px' }}>Historical Platform Rake: {metrics.platformRakeDiamonds} 💎</div>
              </div>
            </div>

            <h3 style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Recent Administrative Actions
            </h3>
            <div style={{ background: '#12131c', border: '1px solid #1e2030', borderRadius: '8px', overflow: 'hidden' }}>
              <AuditTable logs={recentAuditLogs} onViewDetails={setViewingAuditJson} />
            </div>
          </div>
        )}

        {/* TAB 2: USERS */}
        {activeTab === 'users' && (
          <div>
            <div style={{ marginBottom: 16 }}><h1 style={{ margin: 0, color: '#f8fafc', fontSize: 24 }}>Users</h1><p style={{ margin: '5px 0 0', color: '#94a3b8', fontSize: 13 }}>Search accounts, inspect sandbox balances, and review account history.</p></div>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Search username, email, or user ID..."
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchUsers(1)}
                style={{ flex: 1, minWidth: '240px', padding: '8px 12px', background: '#12131c', border: '1px solid #1e2030', color: '#fff', borderRadius: '6px', fontSize: '13px' }}
              />
              <select
                value={userStatusFilter}
                onChange={(e) => {
                  setUserStatusFilter(e.target.value)
                }}
                style={{ padding: '8px 12px', background: '#12131c', border: '1px solid #1e2030', color: '#fff', borderRadius: '6px', fontSize: '13px' }}
              >
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="banned">Banned</option>
              </select>
              <select
                value={userRoleFilter}
                onChange={(e) => {
                  setUserRoleFilter(e.target.value)
                }}
                style={{ padding: '8px 12px', background: '#12131c', border: '1px solid #1e2030', color: '#fff', borderRadius: '6px', fontSize: '13px' }}
              >
                <option value="">All Roles</option>
                <option value="user">User</option>
                <option value="SUPPORT">Support</option>
                <option value="MODERATOR">Moderator</option>
                <option value="ADMIN">Admin</option>
                <option value="SUPER_ADMIN">Super Admin</option>
                <option value="OWNER">Owner</option>
              </select>
              <button
                type="button"
                onClick={() => fetchUsers(1)}
                style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '8px 18px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
              >
                Search
              </button>
            </div>

            <div style={{ background: '#12131c', border: '1px solid #1e2030', borderRadius: '8px', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ position: 'sticky', top: 0, zIndex: 1, background: '#0f1017', borderBottom: '1px solid #1e2030', color: '#94a3b8', textAlign: 'left' }}>
                    <th style={{ padding: '12px' }}>User / ID</th>
                    <th style={{ padding: '12px' }}>Role</th>
                    <th style={{ padding: '12px' }}>Status</th>
                    <th style={{ padding: '12px' }}>Balances</th>
                    <th style={{ padding: '12px' }}>TEST GEL · NO REAL MONEY</th>
                    <th style={{ padding: '12px' }}>Registered</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {usersList.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                        No users matching criteria.
                      </td>
                    </tr>
                  ) : (
                    usersList.map((u) => (
                      <tr key={u.id} style={{ borderBottom: '1px solid #1e2030' }}>
                        <td style={{ padding: '12px' }}>
                          <div style={{ fontWeight: 600, color: '#f1f5f9' }}>{u.username}</div>
                          <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>{u.id}</div>
                          {u.email && <div style={{ fontSize: '11px', color: '#94a3b8' }}>{u.email}</div>}
                        </td>
                        <td style={{ padding: '12px' }}>
                          <span style={{ background: '#1e293b', color: '#cbd5e1', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 500 }}>
                            {u.role}
                          </span>
                        </td>
                        <td style={{ padding: '12px' }}>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 600,
                              background: u.status === 'banned' ? '#7f1d1d' : u.status === 'suspended' ? '#78350f' : '#064e3b',
                              color: u.status === 'banned' ? '#fca5a5' : u.status === 'suspended' ? '#fcd34d' : '#6ee7b7',
                            }}
                          >
                            {u.status.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ padding: '12px' }}>
                          <div><span style={{ color: '#34d399', fontWeight: 600 }}>{u.balances.coins.toLocaleString()}</span> Coins</div>
                          {u.balances.diamonds !== 0 && <div style={{ color: '#64748b', fontSize: 11 }}>Historical Diamonds: {u.balances.diamonds.toLocaleString()}</div>}
                        </td>
                        <td style={{ padding: '12px', whiteSpace: 'nowrap' }}>
                          <div><span style={{ color: '#93c5fd', fontWeight: 700 }}>{formatGEL(u.sandboxBalances.availableMinor)}</span> available</div>
                          <div style={{ color: '#94a3b8', fontSize: 11 }}>{formatGEL(u.sandboxBalances.reservedMinor)} reserved</div>
                        </td>
                        <td style={{ padding: '12px', fontSize: '12px', color: '#94a3b8' }}>
                          {new Date(u.createdAt).toLocaleDateString()}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                            <button
                              type="button"
                              onClick={() => inspectUser(u.id)}
                              style={{ background: '#1e2030', border: '1px solid #334155', color: '#fff', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                            >
                              Inspect
                            </button>
                            {hasPerm('WALLET_GRANT_SANDBOX') && (
                              <button
                                type="button"
                                onClick={() => startTestFunding(u)}
                                style={{ background: '#065f46', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                              >
                                Grant TEST GEL
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* User Pagination */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', color: '#94a3b8', fontSize: '13px' }}>
              <div>Total: {userTotal} user(s)</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  disabled={userPage <= 1 || isLoading}
                  onClick={() => fetchUsers(userPage - 1)}
                  style={{ background: '#1e2030', border: '1px solid #334155', color: '#cbd5e1', padding: '4px 12px', borderRadius: '4px', cursor: userPage <= 1 ? 'not-allowed' : 'pointer' }}
                >
                  ← Prev
                </button>
                <span style={{ padding: '4px 8px' }}>Page {userPage}</span>
                <button
                  type="button"
                  disabled={usersList.length < 20 || isLoading}
                  onClick={() => fetchUsers(userPage + 1)}
                  style={{ background: '#1e2030', border: '1px solid #334155', color: '#cbd5e1', padding: '4px 12px', borderRadius: '4px', cursor: usersList.length < 20 ? 'not-allowed' : 'pointer' }}
                >
                  Next →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: MATCHES */}
        {activeTab === 'matches' && (
          <div>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Filter by Match ID..."
                value={matchIdQuery}
                onChange={(e) => setMatchIdQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchMatches(1)}
                style={{ flex: 1, minWidth: '200px', padding: '8px 12px', background: '#12131c', border: '1px solid #1e2030', color: '#fff', borderRadius: '6px', fontSize: '13px' }}
              />
              <select
                value={matchGameFilter}
                onChange={(e) => setMatchGameFilter(e.target.value)}
                style={{ padding: '8px 12px', background: '#12131c', border: '1px solid #1e2030', color: '#fff', borderRadius: '6px', fontSize: '13px' }}
              >
                {GAME_OPTIONS.map((g) => (
                  <option key={g.id} value={g.id}>{g.label}</option>
                ))}
              </select>
              <select
                value={matchStatusFilter}
                onChange={(e) => setMatchStatusFilter(e.target.value)}
                style={{ padding: '8px 12px', background: '#12131c', border: '1px solid #1e2030', color: '#fff', borderRadius: '6px', fontSize: '13px' }}
              >
                <option value="">All Statuses</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="COMPLETED">COMPLETED</option>
                <option value="DISCONNECTED">DISCONNECTED</option>
                <option value="INTERRUPTED">INTERRUPTED</option>
                <option value="VOIDED">VOIDED</option>
              </select>
              <select
                value={matchCurrencyFilter}
                onChange={(e) => setMatchCurrencyFilter(e.target.value)}
                style={{ padding: '8px 12px', background: '#12131c', border: '1px solid #1e2030', color: '#fff', borderRadius: '6px', fontSize: '13px' }}
              >
                <option value="">All Currencies</option>
                <option value="COINS">COINS</option>
                <option value="DIAMONDS">DIAMONDS</option>
              </select>
              <button
                type="button"
                onClick={() => fetchMatches(1)}
                style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '8px 18px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
              >
                Filter Matches
              </button>
            </div>

            <div style={{ background: '#12131c', border: '1px solid #1e2030', borderRadius: '8px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#0f1017', borderBottom: '1px solid #1e2030', color: '#94a3b8', textAlign: 'left' }}>
                    <th style={{ padding: '12px' }}>Game / Match ID</th>
                    <th style={{ padding: '12px' }}>Players & Scores</th>
                    <th style={{ padding: '12px' }}>Stake</th>
                    <th style={{ padding: '12px' }}>Winner</th>
                    <th style={{ padding: '12px' }}>Status</th>
                    <th style={{ padding: '12px' }}>Date</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {matchesList.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                        No matches found.
                      </td>
                    </tr>
                  ) : (
                    matchesList.map((m) => (
                      <tr key={m.id} style={{ borderBottom: '1px solid #1e2030' }}>
                        <td style={{ padding: '12px' }}>
                          <div style={{ fontWeight: 600, color: '#f1f5f9' }}>{m.gameId}</div>
                          <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>{m.id}</div>
                        </td>
                        <td style={{ padding: '12px' }}>
                          <div>P1: <span style={{ color: '#cbd5e1' }}>{m.player1Id}</span> {m.scoreP1 != null && <strong style={{ color: '#38bdf8' }}>({m.scoreP1} pts)</strong>}</div>
                          <div>P2: <span style={{ color: '#cbd5e1' }}>{m.player2Id}</span> {m.scoreP2 != null && <strong style={{ color: '#38bdf8' }}>({m.scoreP2} pts)</strong>}</div>
                        </td>
                        <td style={{ padding: '12px', fontWeight: 600, color: '#fbbf24' }}>
                          {m.stake} {m.currency}
                        </td>
                        <td style={{ padding: '12px', fontSize: '12px', color: '#cbd5e1' }}>
                          {m.winnerId || 'Draw / None'}
                        </td>
                        <td style={{ padding: '12px' }}>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 600,
                              background: m.status === 'VOIDED' ? '#7f1d1d' : m.status === 'ACTIVE' ? '#1e3a8a' : '#064e3b',
                              color: m.status === 'VOIDED' ? '#fca5a5' : m.status === 'ACTIVE' ? '#93c5fd' : '#6ee7b7',
                            }}
                          >
                            {m.status}
                          </span>
                        </td>
                        <td style={{ padding: '12px', fontSize: '11px', color: '#94a3b8' }}>
                          {new Date(m.createdAt).toLocaleString()}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                            <button
                              type="button"
                              onClick={() => inspectMatch(m.id)}
                              style={{ background: '#1e2030', border: '1px solid #334155', color: '#fff', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                            >
                              Inspect
                            </button>
                            {m.status !== 'VOIDED' && hasPerm('MATCHES_VOID') && (
                              <button
                                type="button"
                                onClick={() => triggerVoidMatch(m.id, m)}
                                style={{ background: '#7f1d1d', color: '#fca5a5', border: '1px solid #991b1b', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                              >
                                Void
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Matches Pagination */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', color: '#94a3b8', fontSize: '13px' }}>
              <div>Total: {matchTotal} match(es)</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  disabled={matchPage <= 1 || isLoading}
                  onClick={() => fetchMatches(matchPage - 1)}
                  style={{ background: '#1e2030', border: '1px solid #334155', color: '#cbd5e1', padding: '4px 12px', borderRadius: '4px', cursor: matchPage <= 1 ? 'not-allowed' : 'pointer' }}
                >
                  ← Prev
                </button>
                <span style={{ padding: '4px 8px' }}>Page {matchPage}</span>
                <button
                  type="button"
                  disabled={matchesList.length < 20 || isLoading}
                  onClick={() => fetchMatches(matchPage + 1)}
                  style={{ background: '#1e2030', border: '1px solid #334155', color: '#cbd5e1', padding: '4px 12px', borderRadius: '4px', cursor: matchesList.length < 20 ? 'not-allowed' : 'pointer' }}
                >
                  Next →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: LEDGER */}
        {activeTab === 'ledger' && (
          <div>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Filter by User ID..."
                value={ledgerUserIdQuery}
                onChange={(e) => setLedgerUserIdQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchLedger(1)}
                style={{ flex: 1, minWidth: '200px', padding: '8px 12px', background: '#12131c', border: '1px solid #1e2030', color: '#fff', borderRadius: '6px', fontSize: '13px' }}
              />
              <select
                value={ledgerCurrencyFilter}
                onChange={(e) => setLedgerCurrencyFilter(e.target.value)}
                style={{ padding: '8px 12px', background: '#12131c', border: '1px solid #1e2030', color: '#fff', borderRadius: '6px', fontSize: '13px' }}
              >
                <option value="">All Currencies</option>
                <option value="COINS">COINS</option>
                <option value="DIAMONDS">DIAMONDS</option>
              </select>
              <button
                type="button"
                onClick={() => fetchLedger(1)}
                style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '8px 18px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
              >
                Filter Ledger
              </button>
            </div>

            <div style={{ background: '#12131c', border: '1px solid #1e2030', borderRadius: '8px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#0f1017', borderBottom: '1px solid #1e2030', color: '#94a3b8', textAlign: 'left' }}>
                    <th style={{ padding: '12px' }}>Entry ID / Date</th>
                    <th style={{ padding: '12px' }}>User ID</th>
                    <th style={{ padding: '12px' }}>Amount</th>
                    <th style={{ padding: '12px' }}>Reason</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerList.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                        No ledger entries found.
                      </td>
                    </tr>
                  ) : (
                    ledgerList.map((l) => (
                      <tr key={l.id} style={{ borderBottom: '1px solid #1e2030' }}>
                        <td style={{ padding: '12px' }}>
                          <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>{l.id}</div>
                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>{new Date(l.createdAt).toLocaleString()}</div>
                        </td>
                        <td style={{ padding: '12px', fontFamily: 'monospace', color: '#f1f5f9' }}>{l.userId}</td>
                        <td style={{ padding: '12px' }}>
                          <span
                            style={{
                              fontWeight: 700,
                              color: l.amount >= 0 ? '#34d399' : '#f87171',
                            }}
                          >
                            {l.amount >= 0 ? `+${l.amount.toLocaleString()}` : l.amount.toLocaleString()} {l.currency}
                          </span>
                        </td>
                        <td style={{ padding: '12px', color: '#cbd5e1', fontSize: '12px' }}>{l.reason}</td>
                        <td style={{ padding: '12px', textAlign: 'right' }}>
                          {!l.reason.includes('admin_reversal_') && hasPerm('WALLET_REVERSE_TRANSACTION') && (
                            <button
                              type="button"
                              onClick={() => triggerReverseLedger(l)}
                              style={{
                                background: '#7f1d1d',
                                color: '#fca5a5',
                                border: '1px solid #991b1b',
                                padding: '4px 10px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '11px',
                              }}
                            >
                              Reverse
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Ledger Pagination */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', color: '#94a3b8', fontSize: '13px' }}>
              <div>Total: {ledgerTotal} ledger row(s)</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  disabled={ledgerPage <= 1 || isLoading}
                  onClick={() => fetchLedger(ledgerPage - 1)}
                  style={{ background: '#1e2030', border: '1px solid #334155', color: '#cbd5e1', padding: '4px 12px', borderRadius: '4px', cursor: ledgerPage <= 1 ? 'not-allowed' : 'pointer' }}
                >
                  ← Prev
                </button>
                <span style={{ padding: '4px 8px' }}>Page {ledgerPage}</span>
                <button
                  type="button"
                  disabled={ledgerList.length < 20 || isLoading}
                  onClick={() => fetchLedger(ledgerPage + 1)}
                  style={{ background: '#1e2030', border: '1px solid #334155', color: '#cbd5e1', padding: '4px 12px', borderRadius: '4px', cursor: ledgerList.length < 20 ? 'not-allowed' : 'pointer' }}
                >
                  Next →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: AUDIT LOG */}
        {activeTab === 'audit' && (
          <div>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <select
                value={auditActionFilter}
                onChange={(e) => setAuditActionFilter(e.target.value)}
                style={{ padding: '8px 12px', background: '#12131c', border: '1px solid #1e2030', color: '#fff', borderRadius: '6px', fontSize: '13px' }}
              >
                <option value="">All Action Types</option>
                <option value="ADMIN_BAN_USER">ADMIN_BAN_USER</option>
                <option value="ADMIN_SUSPEND_USER">ADMIN_SUSPEND_USER</option>
                <option value="ADMIN_UNBAN_USER">ADMIN_UNBAN_USER</option>
                <option value="ADMIN_UPDATE_USER_ROLE">ADMIN_UPDATE_USER_ROLE</option>
                <option value="ADMIN_GRANT_COINS">ADMIN_GRANT_COINS</option>
                <option value="ADMIN_GRANT_DIAMONDS">ADMIN_GRANT_DIAMONDS</option>
                <option value="ADMIN_VOID_MATCH">ADMIN_VOID_MATCH</option>
                <option value="ADMIN_REVERSE_LEDGER_ENTRY">ADMIN_REVERSE_LEDGER_ENTRY</option>
              </select>
              <select
                value={auditTargetTypeFilter}
                onChange={(e) => setAuditTargetTypeFilter(e.target.value)}
                style={{ padding: '8px 12px', background: '#12131c', border: '1px solid #1e2030', color: '#fff', borderRadius: '6px', fontSize: '13px' }}
              >
                <option value="">All Target Types</option>
                <option value="user">User</option>
                <option value="match">Match</option>
                <option value="ledger">Ledger</option>
                <option value="system">System</option>
              </select>
              <input
                type="text"
                placeholder="Target ID..."
                value={auditTargetIdQuery}
                onChange={(e) => setAuditTargetIdQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchAudit(1)}
                style={{ width: '160px', padding: '8px 12px', background: '#12131c', border: '1px solid #1e2030', color: '#fff', borderRadius: '6px', fontSize: '13px' }}
              />
              <input
                type="text"
                placeholder="Admin ID..."
                value={auditAdminIdQuery}
                onChange={(e) => setAuditAdminIdQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchAudit(1)}
                style={{ width: '160px', padding: '8px 12px', background: '#12131c', border: '1px solid #1e2030', color: '#fff', borderRadius: '6px', fontSize: '13px' }}
              />
              <button
                type="button"
                onClick={() => fetchAudit(1)}
                style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '8px 18px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
              >
                Filter Logs
              </button>
            </div>

            <div style={{ background: '#12131c', border: '1px solid #1e2030', borderRadius: '8px', overflow: 'hidden' }}>
              <AuditTable logs={auditList} onViewDetails={setViewingAuditJson} />
            </div>

            {/* Audit Pagination */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', color: '#94a3b8', fontSize: '13px' }}>
              <div>Total: {auditTotal} audit event(s)</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  disabled={auditPage <= 1 || isLoading}
                  onClick={() => fetchAudit(auditPage - 1)}
                  style={{ background: '#1e2030', border: '1px solid #334155', color: '#cbd5e1', padding: '4px 12px', borderRadius: '4px', cursor: auditPage <= 1 ? 'not-allowed' : 'pointer' }}
                >
                  ← Prev
                </button>
                <span style={{ padding: '4px 8px' }}>Page {auditPage}</span>
                <button
                  type="button"
                  disabled={auditList.length < 25 || isLoading}
                  onClick={() => fetchAudit(auditPage + 1)}
                  style={{ background: '#1e2030', border: '1px solid #334155', color: '#cbd5e1', padding: '4px 12px', borderRadius: '4px', cursor: auditList.length < 25 ? 'not-allowed' : 'pointer' }}
                >
                  Next →
                </button>
              </div>
            </div>
          </div>
        )}
        </main>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Subcomponents & Helpers
// ---------------------------------------------------------------------------
function NavButton({ id, active, setActive, label, activeWhen }: { id: Tab; active: Tab; setActive: (id: Tab) => void; label: string; activeWhen?: boolean }) {
  const isActive = activeWhen ?? active === id
  return <button type="button" aria-current={isActive ? 'page' : undefined} className={`admin-nav-item${isActive ? ' is-active' : ''}`} onClick={() => setActive(id)}>{label}</button>
}

function AuditTable({ logs, onViewDetails }: { logs: AuditItem[]; onViewDetails?: (log: AuditItem) => void }) {
  if (logs.length === 0) {
    return <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>No audit records found.</div>
  }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
      <thead>
        <tr style={{ background: '#0f1017', borderBottom: '1px solid #1e2030', color: '#94a3b8', textAlign: 'left' }}>
          <th style={{ padding: '12px' }}>Timestamp</th>
          <th style={{ padding: '12px' }}>Admin</th>
          <th style={{ padding: '12px' }}>Action</th>
          <th style={{ padding: '12px' }}>Target</th>
          <th style={{ padding: '12px' }}>Amount</th>
          <th style={{ padding: '12px' }}>Reason</th>
          {onViewDetails && <th style={{ padding: '12px', textAlign: 'right' }}>Details</th>}
        </tr>
      </thead>
      <tbody>
        {logs.map((log) => (
          <tr key={log.id} style={{ borderBottom: '1px solid #1e2030' }}>
            <td style={{ padding: '12px', fontSize: '11px', color: '#94a3b8' }}>
              {new Date(log.createdAt).toLocaleString()}
            </td>
            <td style={{ padding: '12px', fontFamily: 'monospace', color: '#cbd5e1' }}>{log.adminUserId}</td>
            <td style={{ padding: '12px' }}>
              <span style={{ background: '#1e293b', color: '#fbbf24', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                {log.action}
              </span>
            </td>
            <td style={{ padding: '12px' }}>
              <span style={{ color: '#94a3b8', fontSize: '11px' }}>{log.targetType}: </span>
              <span style={{ fontFamily: 'monospace', color: '#f1f5f9' }}>{log.targetId ?? 'N/A'}</span>
            </td>
            <td style={{ padding: '12px' }}>
              {log.amount != null ? (
                <span style={{ color: log.amount >= 0 ? '#34d399' : '#f87171', fontWeight: 600 }}>
                  {log.amount >= 0 ? `+${log.amount}` : log.amount} {log.currency}
                </span>
              ) : (
                <span style={{ color: '#64748b' }}>—</span>
              )}
            </td>
            <td style={{ padding: '12px', color: '#e2e8f0', fontSize: '12px' }}>{log.reason}</td>
            {onViewDetails && (
              <td style={{ padding: '12px', textAlign: 'right' }}>
                <button
                  type="button"
                  onClick={() => onViewDetails(log)}
                  style={{ background: '#1e2030', border: '1px solid #334155', color: '#94a3b8', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
                >
                  Inspect
                </button>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

const kpiCardStyle: React.CSSProperties = {
  background: '#12131c',
  border: '1px solid #1e2030',
  borderRadius: '8px',
  padding: '16px',
}

const kpiLabelStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  color: '#94a3b8',
  letterSpacing: '0.05em',
  marginBottom: '6px',
}
