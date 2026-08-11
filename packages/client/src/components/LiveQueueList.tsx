import { useEffect, useState } from 'react'
import type { QueueStateEntry, ServerToClientEvents, ClientToServerEvents } from '@arcadeclash/shared'
import { io, type Socket } from 'socket.io-client'
import { getStoredAuthToken, useAuth } from '../auth/AuthContext'
import { API_URL } from '../lib/api'

const GAME_TITLES: Record<string, string> = {
  'neon-runner': 'Neon Runner',
  'pixel-ninja-dash': 'Pixel Ninja Dash',
  'sky-dodge': 'Sky Dodge',
  'space-blaster': 'Space Blaster',
  'game-3': 'Space Blaster (Game #3)',
  'cyber-hopper': 'Cyber Hopper',
  'game-4': 'Cyber Hopper (Game #4)',
}

type LiveQueueListProps = {
  onFindOpponent: (id: string, title: string, stake?: number, currency?: 'COINS' | 'DIAMONDS') => void
}

export default function LiveQueueList({ onFindOpponent }: LiveQueueListProps) {
  const { user } = useAuth()
  const [entries, setEntries] = useState<QueueStateEntry[]>([])
  const [now, setNow] = useState(Date.now())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const token = getStoredAuthToken()
    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(API_URL, {
      withCredentials: true,
      auth: { token: token || undefined },
    })

    socket.on('queueStateUpdate', (payload) => {
      setEntries(payload.entries || [])
    })

    return () => {
      socket.disconnect()
    }
  }, [user])

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  function formatTime(queuedAt: number): string {
    const elapsedSec = Math.max(0, Math.floor((now - queuedAt) / 1000))
    const mins = Math.floor(elapsedSec / 60)
      .toString()
      .padStart(2, '0')
    const secs = (elapsedSec % 60).toString().padStart(2, '0')
    return `${mins}:${secs}`
  }

  function handleDirectMatch(entry: QueueStateEntry) {
    setError(null)
    const gameTitle = GAME_TITLES[entry.gameId] ?? entry.gameId

    // Guest enforcement guard
    if (!user && entry.stake > 0) {
      setError('Guests cannot join wager matches. Please sign up or log in.')
      return
    }

    // Balance check
    if (user && entry.stake > 0) {
      const userBalance = entry.currency === 'COINS' ? user.balances.coins : user.balances.diamonds
      if (userBalance < entry.stake) {
        setError(`Insufficient ${entry.currency} balance (${userBalance} available, ${entry.stake} required).`)
        return
      }
    }

    onFindOpponent(entry.gameId, gameTitle, entry.stake, entry.currency)
  }

  return (
    <section className="ac-card" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-8)' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--space-4)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <span style={{ fontSize: 'var(--font-size-xl)' }}>⚡</span>
          <div>
            <h2 style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)' }}>
              Live Matchmaking Lobby
            </h2>
            <p className="ac-text-muted" style={{ margin: 0, fontSize: 'var(--font-size-xs)' }}>
              Real-time public queue — click Match to instantly join and play
            </p>
          </div>
        </div>
        <span
          className="ac-badge"
          style={{
            background: entries.length > 0 ? 'var(--color-success-bg, rgba(34, 197, 94, 0.15))' : 'var(--color-bg-subtle)',
            color: entries.length > 0 ? 'var(--color-success, #22c55e)' : 'var(--color-text-muted)',
            padding: 'var(--space-1) var(--space-3)',
            borderRadius: 'var(--radius-full)',
            fontSize: 'var(--font-size-xs)',
            fontWeight: 'var(--font-weight-semibold)',
          }}
        >
          ● {entries.length} {entries.length === 1 ? 'player waiting' : 'players waiting'}
        </span>
      </div>

      {error && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#ef4444',
            padding: 'var(--space-3) var(--space-4)',
            borderRadius: 'var(--radius-md)',
            marginBottom: 'var(--space-4)',
            fontSize: 'var(--font-size-sm)',
          }}
        >
          {error}
        </div>
      )}

      {entries.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: 'var(--space-6) var(--space-4)',
            border: '1px dashed var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            color: 'var(--color-text-muted)',
            fontSize: 'var(--font-size-sm)',
          }}
        >
          No players currently searching in public queue. Select a game below to start a queue!
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 'var(--space-4)' }}>
          {entries.map((entry) => {
            const isSelf = user?.id === entry.userId
            const gameTitle = GAME_TITLES[entry.gameId] ?? entry.gameId

            return (
              <div
                key={entry.socketId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'var(--color-bg-subtle)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-4)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      background: 'var(--color-primary-bg, rgba(99, 102, 241, 0.2))',
                      color: 'var(--color-primary, #6366f1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 'var(--font-weight-bold)',
                      fontSize: 'var(--font-size-md)',
                    }}
                  >
                    {entry.username.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 'var(--font-weight-bold)', fontSize: 'var(--font-size-sm)' }}>
                      {entry.username} {isSelf && <span className="ac-text-muted">(You)</span>}
                    </div>
                    <div className="ac-text-muted" style={{ fontSize: 'var(--font-size-xs)' }}>
                      {gameTitle} · Searching {formatTime(entry.queuedAt)}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <span
                    style={{
                      padding: 'var(--space-1) var(--space-2)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: 'var(--font-weight-semibold)',
                      background:
                        entry.stake === 0
                          ? 'rgba(148, 163, 184, 0.2)'
                          : entry.currency === 'COINS'
                          ? 'rgba(234, 179, 8, 0.2)'
                          : 'rgba(6, 182, 212, 0.2)',
                      color:
                        entry.stake === 0
                          ? '#94a3b8'
                          : entry.currency === 'COINS'
                          ? '#eab308'
                          : '#06b6d4',
                    }}
                  >
                    {entry.stake === 0 ? 'Free Play' : `${entry.stake} ${entry.currency}`}
                  </span>

                  {!isSelf && (
                    <button
                      type="button"
                      className="ac-btn ac-btn--primary"
                      style={{ padding: 'var(--space-1) var(--space-3)', fontSize: 'var(--font-size-xs)' }}
                      onClick={() => handleDirectMatch(entry)}
                    >
                      Match
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
