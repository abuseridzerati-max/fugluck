import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DIAMOND_PACKS } from '@arcadeclash/shared'
import Navbar from '../components/Navbar'
import { useAuth } from '../auth/AuthContext'
import { apiFetch, ApiError } from '../lib/api'

export type LedgerHistoryItem = {
  id: string
  currency: string
  amount: number
  reason: string
  label: string
  createdAt: string
}

type WalletPageProps = {
  onNavigateHome: () => void
  onNavigateProfile?: () => void
  onNavigateFriends?: () => void
}

export default function WalletPage({ onNavigateHome, onNavigateProfile, onNavigateFriends }: WalletPageProps) {
  const { t, i18n } = useTranslation()
  const { user, refreshUser } = useAuth()
  const [history, setHistory] = useState<LedgerHistoryItem[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [shopError, setShopError] = useState<string | null>(null)
  const [shopSuccess, setShopSuccess] = useState<string | null>(null)
  const [buyingId, setBuyingId] = useState<string | null>(null)

  const currentLang = i18n.language || 'en'

  function loadHistory() {
    if (!user) return
    setLoadingHistory(true)
    setHistoryError(null)
    apiFetch<{ history: LedgerHistoryItem[] }>('/api/wallet/history')
      .then((res) => {
        setHistory(res.history)
      })
      .catch((err) => {
        const msg = err instanceof ApiError ? err.message : t('wallet.loadHistoryError', { defaultValue: 'Failed to load transaction history.' })
        setHistoryError(msg)
      })
      .finally(() => setLoadingHistory(false))
  }

  useEffect(() => {
    loadHistory()
  }, [user])

  async function buyPack(packId: string) {
    setShopError(null)
    setShopSuccess(null)
    setBuyingId(packId)
    try {
      await apiFetch('/api/wallet/purchase-diamonds', {
        method: 'POST',
        body: JSON.stringify({ packId }),
      })
      await refreshUser()
      loadHistory()
      setShopSuccess(t('wallet.purchaseSuccess', { defaultValue: 'Diamonds granted successfully (Test Mode).' }))
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : t('wallet.purchaseFailed', { defaultValue: 'Failed to complete transaction.' })
      setShopError(msg)
    } finally {
      setBuyingId(null)
    }
  }

  return (
    <>
      <Navbar
        onNavigateHome={onNavigateHome}
        onNavigateProfile={onNavigateProfile || onNavigateHome}
        onNavigateFriends={onNavigateFriends}
      />
      <main style={{ maxWidth: 840, margin: '0 auto', padding: 'var(--space-6) var(--space-4)' }}>
        <h1 style={{ margin: '0 0 var(--space-4)', fontSize: 'var(--font-size-2xl)' }}>
          💳 {t('wallet.title', { defaultValue: 'Wallet & Finances' })}
        </h1>

        {/* Balance Overview Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
          <div className="ac-panel" style={{ padding: 'var(--space-4)' }}>
            <div className="ac-text-muted" style={{ fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {t('common.coins', { defaultValue: 'COINS' })}
            </div>
            <div style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 'bold', color: 'var(--color-secondary, #fbbf24)', marginTop: '4px' }}>
              {user?.balances.coins ?? 0}
            </div>
            <p className="ac-text-muted" style={{ fontSize: 'var(--font-size-xs)', margin: 'var(--space-2) 0 0' }}>
              {t('wallet.coinsDesc', { defaultValue: 'Used for Free Play and 0% rake in-game fun matches.' })}
            </p>
          </div>

          <div className="ac-panel" style={{ padding: 'var(--space-4)' }}>
            <div className="ac-text-muted" style={{ fontSize: 'var(--space-xs)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {t('common.diamonds', { defaultValue: 'DIAMONDS' })}
            </div>
            <div style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 'bold', color: 'var(--color-primary, #38bdf8)', marginTop: '4px' }}>
              {user?.balances.diamonds ?? 0}
            </div>
            <p className="ac-text-muted" style={{ fontSize: 'var(--font-size-xs)', margin: 'var(--space-2) 0 0' }}>
              {t('wallet.diamondsDesc', { defaultValue: 'Used for competitive staking matches (5% platform rake).' })}
            </p>
          </div>
        </div>

        {/* Transaction History Section */}
        <section style={{ marginBottom: 'var(--space-8)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
            <h2 style={{ margin: 0, fontSize: 'var(--font-size-xl)' }}>
              📜 {t('wallet.historyTitle', { defaultValue: 'Transaction History' })}
            </h2>
            <button
              type="button"
              className="ac-btn ac-btn--ghost"
              onClick={loadHistory}
              disabled={loadingHistory}
              style={{ fontSize: 'var(--font-size-xs)' }}
            >
              🔄 {t('common.refresh', { defaultValue: 'Refresh' })}
            </button>
          </div>

          {loadingHistory ? (
            <p className="ac-text-muted">{t('wallet.loadingHistory', { defaultValue: 'Loading transaction ledger…' })}</p>
          ) : historyError ? (
            <div className="ac-panel" style={{ padding: 'var(--space-4)', borderColor: 'var(--color-danger, #f87171)' }}>
              <p style={{ color: 'var(--color-danger, #f87171)', margin: '0 0 var(--space-3)' }}>{historyError}</p>
              <button type="button" className="ac-btn ac-btn--primary" onClick={loadHistory}>
                🔄 {t('common.retry', { defaultValue: 'Retry' })}
              </button>
            </div>
          ) : history.length === 0 ? (
            <p className="ac-text-muted">{t('wallet.noHistory', { defaultValue: 'No transactions recorded yet.' })}</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {history.map((item) => {
                const isPositive = item.amount > 0
                return (
                  <div
                    key={item.id}
                    className="ac-panel"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 'var(--space-3) var(--space-4)',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 'var(--font-weight-medium)', fontSize: 'var(--font-size-sm)' }}>
                        {item.label}
                      </div>
                      <div className="ac-text-muted" style={{ fontSize: '11px', marginTop: '2px' }}>
                        {new Date(item.createdAt).toLocaleString(currentLang)} · {item.reason}
                      </div>
                    </div>

                    <div
                      style={{
                        fontWeight: 'bold',
                        fontSize: 'var(--font-size-sm)',
                        color: isPositive ? '#22c55e' : 'var(--color-danger, #f87171)',
                        textAlign: 'right',
                      }}
                    >
                      {isPositive ? `+${item.amount}` : item.amount} {item.currency}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Diamond Shop (Test / Dev Mode) */}
        <section>
          <h2 style={{ margin: '0 0 var(--space-2)', fontSize: 'var(--font-size-xl)' }}>
            💎 {t('wallet.diamondShopTitle', { defaultValue: 'Diamond Shop' })}
          </h2>
          <div
            className="ac-panel"
            style={{
              padding: 'var(--space-3) var(--space-4)',
              background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)',
              borderColor: 'var(--color-primary)',
              marginBottom: 'var(--space-4)',
              fontSize: 'var(--font-size-xs)',
            }}
          >
            ⚠️ <strong>{t('wallet.devNoticeTitle', { defaultValue: 'Development Sandbox' })}:</strong>{' '}
            {t('wallet.devNoticeDesc', {
              defaultValue: 'No real payments are integrated. Clicking grant issues test diamonds for platform verification.',
            })}
          </div>

          {shopError && <p style={{ color: 'var(--color-danger, #f87171)', marginBottom: 'var(--space-3)' }}>{shopError}</p>}
          {shopSuccess && <p style={{ color: '#22c55e', marginBottom: 'var(--space-3)' }}>{shopSuccess}</p>}

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
                <span>{buyingId === pack.id ? t('wallet.granting', { defaultValue: 'Granting…' }) : t('wallet.packGrant', { count: pack.diamonds, defaultValue: `Grant +${pack.diamonds} 💎` })}</span>
              </button>
            ))}
          </div>
        </section>
      </main>
    </>
  )
}
