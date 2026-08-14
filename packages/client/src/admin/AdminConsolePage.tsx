import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import AuthModal from '../components/AuthModal'
import { apiFetch, ApiError } from '../lib/api'

type Tab = 'dashboard' | 'users' | 'matches' | 'ledger' | 'audit'

type Metrics = {
  registeredUsers: number
  activeMatchesCount: number
  completedMatchesTotal: number
  matchesCompletedToday: number
  matchesVoidedToday: number
  coinsCirculation: number
  diamondsCirculation: number
}

type UserItem = {
  id: string
  username: string
  email: string | null
  role: string
  status: string
  statusReason: string | null
  balances: { coins: number; diamonds: number }
  createdAt: string
}

type MatchItem = {
  id: string
  gameId: string
  player1Id: string
  player2Id: string
  winnerId: string | null
  currency: string
  stake: number
  status: string
  createdAt: string
}

type LedgerItem = {
  id: string
  userId: string
  currency: string
  amount: number
  reason: string
  createdAt: string
}

type AuditItem = {
  id: string
  adminUserId: string
  action: string
  targetType: string
  targetId: string | null
  amount: number | null
  currency: string | null
  reason: string
  createdAt: string
}

export default function AdminConsolePage({ onNavigateHome }: { onNavigateHome: () => void }) {
  const { user } = useAuth()
  const [showAuthModal, setShowAuthModal] = useState(false)

  const [activeTab, setActiveTab] = useState<Tab>('dashboard')
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [recentAuditLogs, setRecentAuditLogs] = useState<AuditItem[]>([])

  // User management state
  const [userQuery, setUserQuery] = useState('')
  const [usersList, setUsersList] = useState<UserItem[]>([])
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null)

  // Match management state
  const [matchQuery, setMatchQuery] = useState('')
  const [matchesList, setMatchesList] = useState<MatchItem[]>([])

  // Ledger state
  const [ledgerList, setLedgerList] = useState<LedgerItem[]>([])

  // Audit state
  const [auditList, setAuditList] = useState<AuditItem[]>([])

  // Modal / Action states
  const [actionReason, setActionReason] = useState('')
  const [grantAmount, setGrantAmount] = useState(100)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    document.title = 'ArcadeClash — Admin Console'
    if (user) {
      fetchDashboard()
    }
  }, [user])

  async function fetchDashboard() {
    try {
      setErrorMessage(null)
      const res = await apiFetch<{ metrics: Metrics; recentAuditLogs: AuditItem[] }>('/api/admin/dashboard')
      setMetrics(res.metrics)
      setRecentAuditLogs(res.recentAuditLogs)
    } catch (e) {
      setErrorMessage(e instanceof ApiError ? e.message : 'Failed to load admin dashboard.')
    }
  }

  async function fetchUsers() {
    try {
      setErrorMessage(null)
      const res = await apiFetch<{ users: UserItem[] }>(`/api/admin/users?query=${encodeURIComponent(userQuery)}`)
      setUsersList(res.users)
    } catch (e) {
      setErrorMessage(e instanceof ApiError ? e.message : 'Failed to load users.')
    }
  }

  async function fetchMatches() {
    try {
      setErrorMessage(null)
      const res = await apiFetch<{ matches: MatchItem[] }>(`/api/admin/matches?gameId=${encodeURIComponent(matchQuery)}`)
      setMatchesList(res.matches)
    } catch (e) {
      setErrorMessage(e instanceof ApiError ? e.message : 'Failed to load matches.')
    }
  }

  async function fetchLedger() {
    try {
      setErrorMessage(null)
      const res = await apiFetch<{ ledger: LedgerItem[] }>('/api/admin/ledger')
      setLedgerList(res.ledger)
    } catch (e) {
      setErrorMessage(e instanceof ApiError ? e.message : 'Failed to load ledger.')
    }
  }

  async function fetchAudit() {
    try {
      setErrorMessage(null)
      const res = await apiFetch<{ auditLogs: AuditItem[] }>('/api/admin/audit-logs')
      setAuditList(res.auditLogs)
    } catch (e) {
      setErrorMessage(e instanceof ApiError ? e.message : 'Failed to load audit logs.')
    }
  }

  async function handleUserAction(userId: string, action: 'suspend' | 'ban' | 'unban') {
    const effectiveReason = actionReason.trim() || `Administrative action: ${action}`
    try {
      setErrorMessage(null)
      const res = await apiFetch<{ success: boolean; status: string }>(`/api/admin/users/${userId}/${action}`, {
        method: 'POST',
        body: JSON.stringify({ reason: effectiveReason }),
      })
      setStatusMessage(`User action [${action}] succeeded.`)
      if (selectedUser && selectedUser.id === userId) {
        setSelectedUser((prev) => (prev ? { ...prev, status: res.status } : null))
      }
      setActionReason('')
      fetchUsers()
    } catch (e) {
      setErrorMessage(e instanceof ApiError ? e.message : 'Action failed.')
    }
  }

  async function handleGrantCurrency(userId: string, currency: 'coins' | 'diamonds') {
    const effectiveReason = actionReason.trim() || 'Operational grant by administrator'
    const idempotencyKey = `ui_grant_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    try {
      setErrorMessage(null)
      const res = await apiFetch<{ success: boolean; balances: { coins: number; diamonds: number } }>(
        `/api/admin/wallet/grant-${currency}`,
        {
          method: 'POST',
          body: JSON.stringify({
            targetUserId: userId,
            amount: Number(grantAmount),
            reason: effectiveReason,
            idempotencyKey,
          }),
        },
      )

      if (res.balances) {
        if (selectedUser && selectedUser.id === userId) {
          setSelectedUser((prev) => (prev ? { ...prev, balances: res.balances } : null))
        }
        setUsersList((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, balances: res.balances } : u)),
        )
      }

      setStatusMessage(
        `Granted ${grantAmount} ${currency.toUpperCase()} to user ${selectedUser?.username || userId}. New balance: ${res.balances ? res.balances[currency] : 'updated'} ${currency.toUpperCase()}.`,
      )
      setActionReason('')
      fetchUsers()
      if (activeTab === 'ledger') fetchLedger()
      if (activeTab === 'dashboard') fetchDashboard()
    } catch (e) {
      setErrorMessage(e instanceof ApiError ? e.message : 'Grant failed.')
    }
  }

  async function handleVoidMatch(matchId: string) {
    const effectiveReason = actionReason.trim() || 'Administrative match void'
    const idempotencyKey = `ui_void_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    try {
      setErrorMessage(null)
      await apiFetch(`/api/admin/matches/${matchId}/void`, {
        method: 'POST',
        body: JSON.stringify({ reason: effectiveReason, idempotencyKey }),
      })
      setStatusMessage(`Match [${matchId}] voided successfully.`)
      setActionReason('')
      fetchMatches()
    } catch (e) {
      setErrorMessage(e instanceof ApiError ? e.message : 'Void match failed.')
    }
  }

  async function handleReverseLedger(originalLedgerId: string) {
    const effectiveReason = actionReason.trim() || 'Administrative ledger entry reversal'
    const idempotencyKey = `ui_rev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    try {
      setErrorMessage(null)
      await apiFetch('/api/admin/wallet/reverse', {
        method: 'POST',
        body: JSON.stringify({ originalLedgerId, reason: effectiveReason, idempotencyKey }),
      })
      setStatusMessage(`Ledger entry [${originalLedgerId}] reversed successfully.`)
      setActionReason('')
      fetchLedger()
      fetchUsers()
    } catch (e) {
      setErrorMessage(e instanceof ApiError ? e.message : 'Reversal failed.')
    }
  }

  const [adminUsernameInput, setAdminUsernameInput] = useState('')
  const [adminPasswordInput, setAdminPasswordInput] = useState('')
  const [adminAuthError, setAdminAuthError] = useState<string | null>(null)
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false)

  async function handleAdminLogin(e: React.FormEvent) {
    e.preventDefault()
    setAdminAuthError(null)
    try {
      await apiFetch('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({ username: adminUsernameInput, password: adminPasswordInput }),
      })
      setIsAdminAuthenticated(true)
      fetchDashboard()
    } catch (err) {
      setAdminAuthError(err instanceof ApiError ? err.message : 'Admin authentication failed.')
    }
  }

  async function handleAdminLogout() {
    try {
      await apiFetch('/api/admin/logout', { method: 'POST' })
    } catch {
      // Ignore cleanup error
    }
    setIsAdminAuthenticated(false)
    onNavigateHome()
  }

  if (!user || !isAdminAuthenticated) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0f', color: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
        <div style={{ background: '#12131c', border: '1px solid #1e2030', borderRadius: '12px', padding: '32px', maxWidth: '440px', width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔒</div>
          <h2 style={{ fontSize: '20px', color: '#fbbf24', margin: '0 0 8px 0' }}>Private Owner Admin Console</h2>
          <p style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.5, marginBottom: '20px' }}>
            Owner operator authentication required. 5 failed login attempts will lock admin access for 1 hour.
          </p>

          {adminAuthError && (
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#fca5a5', padding: '10px', borderRadius: '6px', fontSize: '13px', marginBottom: '16px', textAlign: 'left' }}>
              {adminAuthError}
            </div>
          )}

          <form onSubmit={handleAdminLogin} style={{ display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Owner Username</label>
              <input
                type="text"
                value={adminUsernameInput}
                onChange={(e) => setAdminUsernameInput(e.target.value)}
                placeholder="Owner username"
                required
                style={{ width: '100%', background: '#1e2030', border: '1px solid #334155', color: '#fff', padding: '8px 12px', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Owner Password</label>
              <input
                type="password"
                value={adminPasswordInput}
                onChange={(e) => setAdminPasswordInput(e.target.value)}
                placeholder="Owner password"
                required
                style={{ width: '100%', background: '#1e2030', border: '1px solid #334155', color: '#fff', padding: '8px 12px', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }}
              />
            </div>
            <button type="submit" style={{ background: '#d97706', color: '#fff', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px', marginTop: '4px' }}>
              Authenticate Owner Console
            </button>
          </form>

          <button type="button" onClick={onNavigateHome} style={{ background: 'transparent', color: '#64748b', border: 'none', cursor: 'pointer', fontSize: '12px', textDecoration: 'underline' }}>
            Return to Player App
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', color: '#e2e8f0', fontFamily: 'sans-serif' }}>
      {/* Header Bar */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', background: '#12131c', borderBottom: '1px solid #1e2030' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#fbbf24', letterSpacing: '0.05em' }}>ARCADECLASH OPERATIONAL CONSOLE</span>
          <span style={{ fontSize: '12px', background: '#1e293b', color: '#94a3b8', padding: '2px 8px', borderRadius: '4px' }}>SERVER AUTHORIZED</span>
          <span style={{ fontSize: '12px', color: '#64748b' }}>User: {user.username} ({user.role || 'user'})</span>
        </div>
        <button type="button" onClick={handleAdminLogout} style={{ background: '#1e2030', border: '1px solid #334155', color: '#f8fafc', padding: '6px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
          Exit Console & Logout
        </button>
      </header>

      {/* Status Notifications */}
      {statusMessage && (
        <div style={{ background: '#064e3b', color: '#6ee7b7', padding: '10px 24px', fontSize: '14px', borderBottom: '1px solid #047857' }}>
          {statusMessage}
        </div>
      )}
      {errorMessage && (
        <div style={{ background: '#7f1d1d', color: '#fca5a5', padding: '10px 24px', fontSize: '14px', borderBottom: '1px solid #b91c1c' }}>
          {errorMessage}
        </div>
      )}

      {/* Navigation Tabs */}
      <nav style={{ display: 'flex', gap: '4px', padding: '12px 24px', background: '#0f1017', borderBottom: '1px solid #1e2030' }}>
        {(['dashboard', 'users', 'matches', 'ledger', 'audit'] as Tab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => {
              setActiveTab(tab)
              setStatusMessage(null)
              setErrorMessage(null)
              if (tab === 'dashboard') fetchDashboard()
              if (tab === 'users') fetchUsers()
              if (tab === 'matches') fetchMatches()
              if (tab === 'ledger') fetchLedger()
              if (tab === 'audit') fetchAudit()
            }}
            style={{
              background: activeTab === tab ? '#1e2030' : 'transparent',
              border: activeTab === tab ? '1px solid #334155' : '1px solid transparent',
              color: activeTab === tab ? '#fbbf24' : '#94a3b8',
              padding: '8px 16px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: activeTab === tab ? 'bold' : 'normal',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {tab}
          </button>
        ))}
      </nav>

      {/* Main Content Area */}
      <main style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
        {/* TAB 1: DASHBOARD */}
        {activeTab === 'dashboard' && metrics && (
          <div>
            <h2 style={{ fontSize: '16px', color: '#94a3b8', marginBottom: '16px', textTransform: 'uppercase' }}>Operational Metrics</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '32px' }}>
              <MetricCard title="REGISTERED USERS" value={metrics.registeredUsers} />
              <MetricCard title="ACTIVE MATCHES NOW" value={metrics.activeMatchesCount} highlight />
              <MetricCard title="COMPLETED MATCHES TOTAL" value={metrics.completedMatchesTotal} />
              <MetricCard title="MATCHES COMPLETED TODAY" value={metrics.matchesCompletedToday} />
              <MetricCard title="MATCHES VOIDED TODAY" value={metrics.matchesVoidedToday} danger={metrics.matchesVoidedToday > 0} />
              <MetricCard title="CIRCULATING COINS" value={metrics.coinsCirculation.toLocaleString()} />
              <MetricCard title="CIRCULATING DIAMONDS" value={metrics.diamondsCirculation.toLocaleString()} />
            </div>

            <h2 style={{ fontSize: '16px', color: '#94a3b8', marginBottom: '16px', textTransform: 'uppercase' }}>Recent Administrative Audit Log</h2>
            <div style={{ background: '#12131c', border: '1px solid #1e2030', borderRadius: '8px', overflow: 'hidden' }}>
              <AuditTable logs={recentAuditLogs} />
            </div>
          </div>
        )}

        {/* TAB 2: USERS */}
        {activeTab === 'users' && (
          <div>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
              <input
                type="text"
                placeholder="Search by username, email, or user ID..."
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                style={{ flex: 1, padding: '8px 14px', background: '#12131c', border: '1px solid #1e2030', color: '#fff', borderRadius: '6px' }}
              />
              <button type="button" onClick={fetchUsers} style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: '6px', cursor: 'pointer' }}>
                Search Users
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '20px' }}>
              <div style={{ background: '#12131c', border: '1px solid #1e2030', borderRadius: '8px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#0f1017', borderBottom: '1px solid #1e2030', color: '#94a3b8', textAlign: 'left' }}>
                      <th style={{ padding: '12px' }}>User ID / Username</th>
                      <th style={{ padding: '12px' }}>Role</th>
                      <th style={{ padding: '12px' }}>Status</th>
                      <th style={{ padding: '12px' }}>Balances</th>
                      <th style={{ padding: '12px' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersList.map((u) => (
                      <tr key={u.id} style={{ borderBottom: '1px solid #1e2030' }}>
                        <td style={{ padding: '12px' }}>
                          <div style={{ fontWeight: 'bold' }}>{u.username}</div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>{u.id}</div>
                        </td>
                        <td style={{ padding: '12px' }}><span style={{ background: '#1e293b', padding: '2px 6px', borderRadius: '4px', fontSize: '11px' }}>{u.role}</span></td>
                        <td style={{ padding: '12px' }}>
                          <span style={{ color: u.status === 'banned' ? '#f87171' : u.status === 'suspended' ? '#fbbf24' : '#34d399' }}>{u.status.toUpperCase()}</span>
                        </td>
                        <td style={{ padding: '12px' }}>
                          <div>{u.balances.coins} Coins</div>
                          <div style={{ color: '#fbbf24' }}>{u.balances.diamonds} Diamonds</div>
                        </td>
                        <td style={{ padding: '12px' }}>
                          <button type="button" onClick={() => setSelectedUser(u)} style={{ background: '#1e2030', border: '1px solid #334155', color: '#fff', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
                            Inspect
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Selected User Action Box */}
              <div style={{ background: '#12131c', border: '1px solid #1e2030', borderRadius: '8px', padding: '16px' }}>
                <h3 style={{ fontSize: '14px', color: '#fbbf24', marginTop: 0 }}>ADMINISTRATION CONTROLS</h3>
                {selectedUser ? (
                  <div>
                    <div style={{ marginBottom: '12px', fontSize: '13px' }}>
                      <strong>{selectedUser.username}</strong> ({selectedUser.status})
                    </div>
                    <div style={{ marginBottom: '12px' }}>
                      <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>ACTION REASON (REQUIRED)</label>
                      <input
                        type="text"
                        placeholder="State clear operational reason..."
                        value={actionReason}
                        onChange={(e) => setActionReason(e.target.value)}
                        style={{ width: '100%', padding: '6px 10px', background: '#0b0c10', border: '1px solid #1e2030', color: '#fff', borderRadius: '4px', fontSize: '12px' }}
                      />
                    </div>
                    <div style={{ marginBottom: '12px' }}>
                      <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>GRANT AMOUNT</label>
                      <input
                        type="number"
                        value={grantAmount}
                        onChange={(e) => setGrantAmount(Number(e.target.value))}
                        style={{ width: '100%', padding: '6px 10px', background: '#0b0c10', border: '1px solid #1e2030', color: '#fff', borderRadius: '4px', fontSize: '12px' }}
                      />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                      <button type="button" onClick={() => handleGrantCurrency(selectedUser.id, 'coins')} style={{ background: '#047857', color: '#fff', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>
                        + Grant Coins
                      </button>
                      <button type="button" onClick={() => handleGrantCurrency(selectedUser.id, 'diamonds')} style={{ background: '#b45309', color: '#fff', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>
                        + Grant Diamonds
                      </button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                      <button type="button" onClick={() => handleUserAction(selectedUser.id, 'suspend')} style={{ background: '#d97706', color: '#fff', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>
                        Suspend
                      </button>
                      <button type="button" onClick={() => handleUserAction(selectedUser.id, 'ban')} style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>
                        Ban
                      </button>
                      <button type="button" onClick={() => handleUserAction(selectedUser.id, 'unban')} style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>
                        Unban
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Select a user from table to issue grants or moderation actions.</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: MATCHES */}
        {activeTab === 'matches' && (
          <div>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
              <input
                type="text"
                placeholder="Filter by game ID..."
                value={matchQuery}
                onChange={(e) => setMatchQuery(e.target.value)}
                style={{ flex: 1, padding: '8px 14px', background: '#12131c', border: '1px solid #1e2030', color: '#fff', borderRadius: '6px' }}
              />
              <button type="button" onClick={fetchMatches} style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: '6px', cursor: 'pointer' }}>
                Search Matches
              </button>
            </div>

            <div style={{ background: '#12131c', border: '1px solid #1e2030', borderRadius: '8px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#0f1017', borderBottom: '1px solid #1e2030', color: '#94a3b8', textAlign: 'left' }}>
                    <th style={{ padding: '12px' }}>Match ID / Game</th>
                    <th style={{ padding: '12px' }}>Players</th>
                    <th style={{ padding: '12px' }}>Stake</th>
                    <th style={{ padding: '12px' }}>Status</th>
                    <th style={{ padding: '12px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {matchesList.map((m) => (
                    <tr key={m.id} style={{ borderBottom: '1px solid #1e2030' }}>
                      <td style={{ padding: '12px' }}>
                        <div style={{ fontWeight: 'bold' }}>{m.gameId}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>{m.id}</div>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <div>P1: {m.player1Id}</div>
                        <div>P2: {m.player2Id}</div>
                      </td>
                      <td style={{ padding: '12px' }}>{m.stake} {m.currency}</td>
                      <td style={{ padding: '12px' }}>
                        <span style={{ color: m.status === 'VOIDED' ? '#f87171' : '#34d399' }}>{m.status}</span>
                      </td>
                      <td style={{ padding: '12px' }}>
                        {m.status !== 'VOIDED' && (
                          <button type="button" onClick={() => handleVoidMatch(m.id)} style={{ background: '#7f1d1d', color: '#fca5a5', border: '1px solid #991b1b', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>
                            Void Match
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: LEDGER */}
        {activeTab === 'ledger' && (
          <div style={{ background: '#12131c', border: '1px solid #1e2030', borderRadius: '8px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#0f1017', borderBottom: '1px solid #1e2030', color: '#94a3b8', textAlign: 'left' }}>
                  <th style={{ padding: '12px' }}>Entry ID / Date</th>
                  <th style={{ padding: '12px' }}>User ID</th>
                  <th style={{ padding: '12px' }}>Currency / Amount</th>
                  <th style={{ padding: '12px' }}>Reason</th>
                  <th style={{ padding: '12px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {ledgerList.map((l) => (
                  <tr key={l.id} style={{ borderBottom: '1px solid #1e2030' }}>
                    <td style={{ padding: '12px' }}>
                      <div style={{ fontWeight: 'bold' }}>{l.id}</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>{new Date(l.createdAt).toLocaleString()}</div>
                    </td>
                    <td style={{ padding: '12px' }}>{l.userId}</td>
                    <td style={{ padding: '12px' }}>
                      <span style={{ color: l.amount >= 0 ? '#34d399' : '#f87171', fontWeight: 'bold' }}>
                        {l.amount >= 0 ? `+${l.amount}` : l.amount} {l.currency}
                      </span>
                    </td>
                    <td style={{ padding: '12px' }}>{l.reason}</td>
                    <td style={{ padding: '12px' }}>
                      {!l.reason.includes('admin_reversal_') && (
                        <button
                          type="button"
                          onClick={() => handleReverseLedger(l.id)}
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
                          Reverse Entry
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 5: AUDIT */}
        {activeTab === 'audit' && (
          <div style={{ background: '#12131c', border: '1px solid #1e2030', borderRadius: '8px', overflow: 'hidden' }}>
            <AuditTable logs={auditList} />
          </div>
        )}
      </main>
    </div>
  )
}

function MetricCard({ title, value, highlight, danger }: { title: string; value: number | string; highlight?: boolean; danger?: boolean }) {
  return (
    <div style={{ background: '#12131c', border: `1px solid ${danger ? '#991b1b' : highlight ? '#2563eb' : '#1e2030'}`, borderRadius: '8px', padding: '16px' }}>
      <div style={{ fontSize: '11px', color: '#94a3b8', letterSpacing: '0.05em', marginBottom: '8px' }}>{title}</div>
      <div style={{ fontSize: '24px', fontWeight: 'bold', color: danger ? '#fca5a5' : highlight ? '#60a5fa' : '#f8fafc' }}>{value}</div>
    </div>
  )
}

function AuditTable({ logs }: { logs: AuditItem[] }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
      <thead>
        <tr style={{ background: '#0f1017', borderBottom: '1px solid #1e2030', color: '#94a3b8', textAlign: 'left' }}>
          <th style={{ padding: '12px' }}>Timestamp</th>
          <th style={{ padding: '12px' }}>Admin ID</th>
          <th style={{ padding: '12px' }}>Action</th>
          <th style={{ padding: '12px' }}>Target</th>
          <th style={{ padding: '12px' }}>Reason</th>
        </tr>
      </thead>
      <tbody>
        {logs.map((log) => (
          <tr key={log.id} style={{ borderBottom: '1px solid #1e2030' }}>
            <td style={{ padding: '12px', fontSize: '11px', color: '#64748b' }}>{new Date(log.createdAt).toLocaleString()}</td>
            <td style={{ padding: '12px' }}>{log.adminUserId}</td>
            <td style={{ padding: '12px' }}>
              <span style={{ background: '#1e293b', color: '#fbbf24', padding: '2px 6px', borderRadius: '4px', fontSize: '11px' }}>{log.action}</span>
            </td>
            <td style={{ padding: '12px' }}>{log.targetType}: {log.targetId ?? 'N/A'}</td>
            <td style={{ padding: '12px', color: '#cbd5e1' }}>{log.reason}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
