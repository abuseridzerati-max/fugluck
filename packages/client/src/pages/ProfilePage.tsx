import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DIAMOND_PACKS } from '@arcadeclash/shared'
import Avatar from '../components/Avatar'
import Navbar from '../components/Navbar'
import { useAuth } from '../auth/AuthContext'
import { apiFetch, ApiError } from '../lib/api'

type MatchHistoryItem = {
  id: string
  gameId: string
  opponentUsername: string
  outcome: string
  currency: string
  stake: number
  userScore: number
  opponentScore: number
  seed: number
  inputLog: Array<{ tick: number; action: string }>
  createdAt: string
}

type ProfilePageProps = {
  onNavigateHome: () => void
  onNavigateFriends?: () => void
}

export default function ProfilePage({ onNavigateHome, onNavigateFriends }: ProfilePageProps) {
  const { t, i18n } = useTranslation()
  const { user, refreshUser } = useAuth()
  const [shopError, setShopError] = useState<string | null>(null)
  const [buyingId, setBuyingId] = useState<string | null>(null)
  const [matches, setMatches] = useState<MatchHistoryItem[]>([])
  const [loadingMatches, setLoadingMatches] = useState(true)

  const currentLang = i18n.language || 'en'

  useEffect(() => {
    if (!user) return
    apiFetch<{ matches: MatchHistoryItem[] }>('/api/matches/history')
      .then((res) => setMatches(res.matches))
      .catch(() => setMatches([]))
      .finally(() => setLoadingMatches(false))
  }, [user])

  if (!user) {
    return (
      <>
        <Navbar onNavigateHome={onNavigateHome} onNavigateProfile={() => {}} onNavigateFriends={onNavigateFriends} />
        <main style={{ maxWidth: 640, margin: '0 auto', padding: 'var(--space-8) var(--space-5)' }}>
          <p className="ac-text-muted">{t('auth.notLoggedIn')}</p>
        </main>
      </>
    )
  }

  const winRate = user.gamesPlayed > 0 ? `${Math.round((user.gamesWon / user.gamesPlayed) * 100)}%` : '—'

  async function buyPack(packId: string) {
    setShopError(null)
    setBuyingId(packId)
    try {
      await apiFetch('/api/wallet/purchase-diamonds', {
        method: 'POST',
        body: JSON.stringify({ packId }),
      })
      await refreshUser()
    } catch (e) {
      setShopError(e instanceof ApiError ? e.message : t('wallet.purchaseFailed'))
    } finally {
      setBuyingId(null)
    }
  }

  return (
    <>
      <Navbar onNavigateHome={onNavigateHome} onNavigateProfile={() => {}} onNavigateFriends={onNavigateFriends} />
      <main style={{ maxWidth: 640, margin: '0 auto', padding: 'var(--space-8) var(--space-5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-5)', marginBottom: 'var(--space-8)' }}>
          <Avatar username={user.username} size={72} />
          <div>
            <h1 style={{ margin: 0, fontSize: 'var(--font-size-3xl)' }}>{user.username}</h1>
            <p className="ac-text-muted" style={{ margin: 'var(--space-1) 0 0' }}>
              Joined {new Date(user.createdAt).toLocaleDateString(currentLang)}
            </p>
          </div>
        </div>

        <div
          className="ac-panel"
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-5)', marginBottom: 'var(--space-5)' }}
        >
          <div>
            <div className="ac-text-muted" style={{ fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-2)' }}>
              {t('wallet.coinsLabel')}
            </div>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)' }}>
              {user.balances.coins.toLocaleString(currentLang)}
            </div>
          </div>
          <div>
            <div className="ac-text-muted" style={{ fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-2)' }}>
              {t('wallet.diamondsLabel')}
            </div>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)' }}>
              {user.balances.diamonds.toLocaleString(currentLang)}
            </div>
          </div>
          <div>
            <div className="ac-text-muted" style={{ fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-2)' }}>
              {t('wallet.gamesPlayed')}
            </div>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)' }}>
              {user.gamesPlayed.toLocaleString(currentLang)}
            </div>
          </div>
          <div>
            <div className="ac-text-muted" style={{ fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-2)' }}>
              {t('wallet.winRate')}
            </div>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)' }}>{winRate}</div>
          </div>
        </div>

        <p className="ac-text-muted" style={{ fontSize: 'var(--font-size-xs)', marginBottom: 'var(--space-6)' }}>
          {t('wallet.startingGrantInfo')}
        </p>

        {/* Match History Section */}
        <section style={{ marginBottom: 'var(--space-8)' }}>
          <h2 style={{ margin: '0 0 var(--space-3)', fontSize: 'var(--font-size-xl)' }}>{t('game.matchHistoryTitle')}</h2>
          {loadingMatches ? (
            <p className="ac-text-muted">{t('game.loadingHistory')}</p>
          ) : matches.length === 0 ? (
            <p className="ac-text-muted" style={{ fontSize: 'var(--font-size-sm)' }}>
              {t('game.noMatchesRecorded')}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {matches.map((m) => (
                <div
                  key={m.id}
                  className="ac-panel"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 'var(--space-3) var(--space-4)',
                  }}
                >
                  <div>
                    <strong style={{ color: m.outcome === 'win' ? '#22c55e' : m.outcome === 'loss' ? '#f87171' : '#fbbf24' }}>
                      {(t(`game.${m.outcome}`) || m.outcome).toUpperCase()}
                    </strong>{' '}
                    — {m.gameId} vs <strong>{m.opponentUsername}</strong>
                    <div className="ac-text-muted" style={{ fontSize: '11px', marginTop: '2px' }}>
                      {t('game.scoreLine', {
                        userScore: m.userScore,
                        opponentScore: m.opponentScore,
                        date: new Date(m.createdAt).toLocaleDateString(currentLang),
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {onNavigateFriends && (
          <div className="ac-panel" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-6)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 'var(--font-size-lg)' }}>{t('friends.friendsAndInvitesPanelTitle')}</h3>
              <p className="ac-text-muted" style={{ margin: '4px 0 0', fontSize: 'var(--font-size-xs)' }}>
                {t('friends.friendsAndInvitesDesc')}
              </p>
            </div>
            <button
              type="button"
              className="ac-btn ac-btn--primary"
              onClick={onNavigateFriends}
            >
              👥 {t('friends.openFriendsList')}
            </button>
          </div>
        )}

        <h2 style={{ margin: '0 0 var(--space-3)', fontSize: 'var(--font-size-xl)' }}>{t('wallet.diamondShopTitle')}</h2>
        <p className="ac-text-muted" style={{ fontSize: 'var(--font-size-sm)', margin: '0 0 var(--space-4)' }}>
          {t('wallet.stubNotice')}
        </p>
        {shopError && (
          <p style={{ color: 'var(--color-danger, #f87171)', marginBottom: 'var(--space-3)' }}>{shopError}</p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {DIAMOND_PACKS.map((pack) => (
            <button
              key={pack.id}
              type="button"
              className="ac-btn ac-btn--ghost"
              disabled={buyingId === pack.id}
              onClick={() => buyPack(pack.id)}
              style={{ justifyContent: 'space-between', display: 'flex' }}
            >
              <span>{pack.label}</span>
              <span>{buyingId === pack.id ? t('wallet.granting') : t('wallet.packGrant', { count: pack.diamonds })}</span>
            </button>
          ))}
        </div>
      </main>
    </>
  )
}
