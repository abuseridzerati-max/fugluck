import type { CSSProperties } from 'react'
import { GAME_MANIFESTS } from '@fugluck/shared'
import type { AdminLiveSnapshot, LiveActiveMatch, LiveUserStatus } from './adminTypes'

const GAME_TITLES = new Map<string, string>(GAME_MANIFESTS.map((m) => [m.id, m.title]))

function getGameTitle(gameId: string | null): string {
  if (!gameId) return '—'
  return GAME_TITLES.get(gameId) ?? gameId
}

function formatElapsed(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds))
  const hrs = Math.floor(safe / 3600)
  const mins = Math.floor((safe % 3600) / 60)
  const secs = safe % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return hrs > 0 ? `${hrs}:${pad(mins)}:${pad(secs)}` : `${pad(mins)}:${pad(secs)}`
}

function formatWaitDuration(queuedAtIso: string, snapshotIso: string): string {
  const queuedMs = Date.parse(queuedAtIso)
  const snapshotMs = Date.parse(snapshotIso)
  if (!Number.isFinite(queuedMs) || !Number.isFinite(snapshotMs)) return '00:00'
  return formatElapsed(Math.max(0, Math.floor((snapshotMs - queuedMs) / 1000)))
}

const cardStyle: CSSProperties = {
  background: '#12131c',
  border: '1px solid #25283a',
  borderRadius: 10,
  padding: 16,
  minWidth: 0,
}

const kpiLabelStyle: CSSProperties = {
  color: '#94a3b8',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '.06em',
  textTransform: 'uppercase',
}

const kpiValueStyle: CSSProperties = {
  fontSize: 28,
  fontWeight: 800,
  marginTop: 6,
  lineHeight: 1.1,
}

const sectionHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  marginBottom: 12,
}

const thStyle: CSSProperties = {
  textAlign: 'left',
  padding: '10px 12px',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '.05em',
  textTransform: 'uppercase',
  color: '#94a3b8',
  borderBottom: '1px solid #25283a',
  whiteSpace: 'nowrap',
}

const tdStyle: CSSProperties = {
  padding: '10px 12px',
  fontSize: 13,
  color: '#e2e8f0',
  borderBottom: '1px solid #1d2030',
  verticalAlign: 'middle',
}

function statusBadgeStyle(status: LiveUserStatus): CSSProperties {
  if (status === 'in_match') {
    return {
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 999,
      fontSize: 11,
      fontWeight: 700,
      background: 'rgba(59, 130, 246, 0.18)',
      border: '1px solid rgba(96, 165, 250, 0.45)',
      color: '#93c5fd',
    }
  }
  if (status === 'queued') {
    return {
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 999,
      fontSize: 11,
      fontWeight: 700,
      background: 'rgba(245, 158, 11, 0.16)',
      border: '1px solid rgba(251, 191, 36, 0.45)',
      color: '#fcd34d',
    }
  }
  return {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
    background: 'rgba(16, 185, 129, 0.14)',
    border: '1px solid rgba(52, 211, 153, 0.4)',
    color: '#6ee7b7',
  }
}

function statusLabel(status: LiveUserStatus): string {
  if (status === 'in_match') return 'In Match'
  if (status === 'queued') return 'Queued'
  return 'Idle'
}

function modeBadgeStyle(mode: LiveActiveMatch['mode']): CSSProperties {
  if (mode === 'Tournament' || mode === 'Competition') {
    return {
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 999,
      fontSize: 11,
      fontWeight: 700,
      background: 'rgba(168, 85, 247, 0.18)',
      border: '1px solid rgba(192, 132, 252, 0.45)',
      color: '#d8b4fe',
    }
  }
  if (mode === 'Friend') {
    return {
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 999,
      fontSize: 11,
      fontWeight: 700,
      background: 'rgba(16, 185, 129, 0.16)',
      border: '1px solid rgba(52, 211, 153, 0.4)',
      color: '#6ee7b7',
    }
  }
  return {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
    background: 'rgba(59, 130, 246, 0.16)',
    border: '1px solid rgba(96, 165, 250, 0.4)',
    color: '#93c5fd',
  }
}

export default function AdminLiveView({
  data,
  loading,
  onRefresh,
}: {
  data: AdminLiveSnapshot | null
  loading: boolean
  onRefresh: () => void
}) {
  if (loading && !data) {
    return (
      <section aria-live="polite" style={cardStyle}>
        <h2 style={{ marginTop: 0, color: '#f8fafc' }}>Live Now</h2>
        <p style={{ color: '#94a3b8', marginBottom: 0 }}>Loading real-time platform snapshot…</p>
      </section>
    )
  }

  if (!data) {
    return (
      <section style={cardStyle}>
        <h2 style={{ marginTop: 0, color: '#f8fafc' }}>Live Now</h2>
        <p style={{ color: '#fca5a5' }}>Real-time activity snapshot is currently unavailable.</p>
        <button type="button" className="admin-refresh" onClick={onRefresh}>
          ↻ Retry
        </button>
      </section>
    )
  }

  const lastUpdatedText = new Date(data.timestamp).toLocaleTimeString()

  return (
    <section aria-label="Live Now monitor" style={{ display: 'grid', gap: 16 }}>
      <header
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="admin-live-dot" aria-hidden="true" />
            <h2 style={{ margin: 0, color: '#f8fafc', fontSize: 22 }}>Live Now</h2>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#6ee7b7',
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                borderRadius: 999,
                padding: '2px 8px',
              }}
            >
              Auto-refresh: 5s
            </span>
          </div>
          <p style={{ margin: '5px 0 0', color: '#94a3b8', fontSize: 13 }}>
            Read-only real-time presence, matchmaking queues, and active matches. Last updated: {lastUpdatedText}.
          </p>
        </div>

        <button
          type="button"
          className="admin-refresh"
          onClick={onRefresh}
          disabled={loading}
          style={{ opacity: loading ? 0.65 : 1 }}
        >
          {loading ? 'Refreshing…' : '↻ Refresh'}
        </button>
      </header>

      {/* Top Summary Counters */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',
          gap: 12,
        }}
      >
        <div style={{ ...cardStyle, borderColor: '#065f46' }}>
          <div style={kpiLabelStyle}>Online Users</div>
          <div style={{ ...kpiValueStyle, color: '#34d399' }}>
            {data.summary.onlineUsersCount}
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
            Active socket connections
          </div>
        </div>

        <div style={{ ...cardStyle, borderColor: '#1d4ed8' }}>
          <div style={kpiLabelStyle}>Active Matches</div>
          <div style={{ ...kpiValueStyle, color: '#60a5fa' }}>
            {data.summary.activeMatchesCount}
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
            Games currently in progress
          </div>
        </div>

        <div style={{ ...cardStyle, borderColor: '#92400e' }}>
          <div style={kpiLabelStyle}>In Queue</div>
          <div style={{ ...kpiValueStyle, color: '#fbbf24' }}>
            {data.summary.queuedPlayersCount}
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
            Players waiting for an opponent
          </div>
        </div>
      </div>

      {/* Active Matches */}
      <div style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <h3 style={{ margin: 0, fontSize: 15, color: '#f8fafc' }}>
            Active Matches ({data.activeMatches.length})
          </h3>
        </div>
        {data.activeMatches.length === 0 ? (
          <p style={{ margin: 0, color: '#94a3b8', fontSize: 13 }}>
            No active matches right now.
          </p>
        ) : (
          <div className="admin-live-table-wrap">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Game</th>
                  <th style={thStyle}>Players</th>
                  <th style={thStyle}>Mode</th>
                  <th style={thStyle}>Elapsed</th>
                  <th style={thStyle}>Match ID</th>
                </tr>
              </thead>
              <tbody>
                {data.activeMatches.map((match) => (
                  <tr key={match.matchId}>
                    <td style={{ ...tdStyle, fontWeight: 700, color: '#f8fafc' }}>
                      {getGameTitle(match.gameId)}
                    </td>
                    <td style={tdStyle}>
                      {match.players.map((p) => p.username).join(' vs ')}
                    </td>
                    <td style={tdStyle}>
                      <span style={modeBadgeStyle(match.mode)}>{match.mode}</span>
                    </td>
                    <td style={{ ...tdStyle, fontFamily: 'monospace', color: '#93c5fd' }}>
                      {formatElapsed(match.elapsedSeconds)}
                    </td>
                    <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 12, color: '#94a3b8' }}>
                      {match.matchId}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Matchmaking Queue & Online Users */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))',
          gap: 14,
          alignItems: 'start',
        }}
      >
        <div style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <h3 style={{ margin: 0, fontSize: 15, color: '#f8fafc' }}>
              Matchmaking Queue ({data.queuedPlayers.length})
            </h3>
          </div>
          {data.queuedPlayers.length === 0 ? (
            <p style={{ margin: 0, color: '#94a3b8', fontSize: 13 }}>
              No players waiting in matchmaking queues.
            </p>
          ) : (
            <div className="admin-live-table-wrap">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Player</th>
                    <th style={thStyle}>Game</th>
                    <th style={thStyle}>Waiting</th>
                  </tr>
                </thead>
                <tbody>
                  {data.queuedPlayers.map((entry) => (
                    <tr key={`${entry.userId}-${entry.gameId}-${entry.queuedAt}`}>
                      <td style={{ ...tdStyle, fontWeight: 600, color: '#f8fafc' }}>
                        {entry.username}
                      </td>
                      <td style={tdStyle}>{getGameTitle(entry.gameId)}</td>
                      <td style={{ ...tdStyle, fontFamily: 'monospace', color: '#fcd34d' }}>
                        {formatWaitDuration(entry.queuedAt, data.timestamp)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={cardStyle}>
          <div style={sectionHeaderStyle}>
            <h3 style={{ margin: 0, fontSize: 15, color: '#f8fafc' }}>
              Online Users ({data.onlineUsers.length})
            </h3>
          </div>
          {data.onlineUsers.length === 0 ? (
            <p style={{ margin: 0, color: '#94a3b8', fontSize: 13 }}>
              No users currently connected.
            </p>
          ) : (
            <div className="admin-live-table-wrap">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Username</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Game</th>
                  </tr>
                </thead>
                <tbody>
                  {data.onlineUsers.map((user) => (
                    <tr key={user.userId}>
                      <td style={{ ...tdStyle, fontWeight: 600, color: '#f8fafc' }}>
                        {user.username}
                      </td>
                      <td style={tdStyle}>
                        <span style={statusBadgeStyle(user.status)}>
                          {statusLabel(user.status)}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, color: user.gameId ? '#e2e8f0' : '#64748b' }}>
                        {getGameTitle(user.gameId)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
