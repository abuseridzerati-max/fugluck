import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
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
  onNavigateCompetitions?: () => void
  onNavigatePolicy?: (path: string) => void
}

export default function WalletPage({
  onNavigateHome,
  onNavigateProfile,
  onNavigateFriends,
  onNavigateCompetitions,
  onNavigatePolicy,
}: WalletPageProps) {
  const { t, i18n } = useTranslation()
  const { user, refreshUser } = useAuth()
  const [history, setHistory] = useState<LedgerHistoryItem[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [faucetLoading, setFaucetLoading] = useState(false)
  const [faucetMessage, setFaucetMessage] = useState<string | null>(null)
  const [faucetError, setFaucetError] = useState<string | null>(null)

  const currentLang = i18n.language || 'en'

  function loadHistory() {
    if (!user) {
      setLoadingHistory(false)
      setHistoryError(null)
      setHistory([])
      return
    }
    setLoadingHistory(true)
    setHistoryError(null)
    apiFetch<{ history: LedgerHistoryItem[] }>('/api/wallet/history')
      .then((res) => {
        setHistory(res.history)
      })
      .catch((err) => {
        setHistoryError(err instanceof ApiError ? err.message : 'Failed to load transaction history.')
      })
      .finally(() => {
        setLoadingHistory(false)
      })
  }

  useEffect(() => {
    loadHistory()
  }, [user])

  async function handleAddTestFunds() {
    setFaucetLoading(true)
    setFaucetError(null)
    setFaucetMessage(null)
    try {
      await apiFetch('/api/competitions/sandbox-faucet', {
        method: 'POST',
        body: JSON.stringify({ amountMinor: 10000 }), // +TEST ₾100.00
      })
      await refreshUser()
      setFaucetMessage('Added +TEST ₾100.00 sandbox test funds successfully.')
    } catch (e) {
      setFaucetError(e instanceof ApiError ? e.message : 'Failed to grant test funds.')
    } finally {
      setFaucetLoading(false)
    }
  }

  function formatTimestamp(iso: string): string {
    try {
      const d = new Date(iso)
      const dateStr = d.toLocaleDateString(currentLang, { month: 'short', day: 'numeric', year: 'numeric' })
      const timeStr = d.toLocaleTimeString(currentLang, { hour: '2-digit', minute: '2-digit' })
      return `${dateStr} • ${timeStr}`
    } catch {
      return iso
    }
  }

  const userBalanceMinor = user?.balances.sandboxGelMinor ?? 0
  const userReservedMinor = user?.balances.sandboxGelReservedMinor ?? 0

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar
        onNavigateHome={onNavigateHome}
        onNavigateProfile={onNavigateProfile ?? onNavigateHome}
        onNavigateFriends={onNavigateFriends}
        onNavigateCompetitions={onNavigateCompetitions}
      />
      <main style={{ flex: 1, maxWidth: 1200, width: '100%', margin: '0 auto', padding: 'var(--space-6) var(--space-4)', boxSizing: 'border-box' }}>
        <h1 style={{ marginBottom: 'var(--space-4)', fontSize: 'var(--font-size-2xl)' }}>
          Wallet & Balances
        </h1>

        {/* Live Balance Summary Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 'var(--space-4)',
            marginBottom: 'var(--space-6)',
          }}
        >
          {/* Virtual COINS Card */}
          <div className="ac-card" style={{ padding: 'var(--space-5)' }}>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-2)' }}>
              {t('wallet.coinsLabel', { defaultValue: 'COINS Balance' })}
            </div>
            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'bold', color: 'var(--color-secondary, #fbbf24)' }}>
              🪙 {user?.balances.coins.toLocaleString() ?? '0'}
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 'var(--space-2)' }}>
              Free virtual tokens for casual play and social friend matches.
            </div>
          </div>

          {/* SANDBOX TEST GEL Card */}
          <div
            className="ac-card"
            style={{
              padding: 'var(--space-5)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              background: 'linear-gradient(180deg, rgba(16, 185, 129, 0.06) 0%, var(--color-surface) 100%)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                SANDBOX TEST BALANCE
              </div>
              <span
                style={{
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: '#10b981',
                  border: '1px solid #10b981',
                  borderRadius: '4px',
                  fontSize: '10px',
                  fontWeight: 'bold',
                  padding: '2px 6px',
                  letterSpacing: '0.5px',
                }}
              >
                TEST ONLY
              </span>
            </div>

            <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'bold', color: '#10b981' }}>
              TEST ₾{(userBalanceMinor / 100).toFixed(2)}
            </div>

          {userReservedMinor > 0 && (
              <div style={{ fontSize: 'var(--font-size-xs)', color: '#fbbf24', marginTop: 4 }}>
                (TEST ₾{(userReservedMinor / 100).toFixed(2)} reserved in active queue)
              </div>
            )}

            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 'var(--space-2)', lineHeight: 1.4 }}>
              TEST GEL is simulated, has no real-world value, and cannot be deposited, withdrawn, or redeemed.
            </div>

            <div style={{ marginTop: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <button
                type="button"
                className="ac-btn ac-btn--secondary"
                disabled={!user || faucetLoading}
                onClick={handleAddTestFunds}
                title={!user ? 'Sign in to access sandbox test funds.' : undefined}
                style={{ fontSize: '11px', padding: '4px 12px', whiteSpace: 'nowrap' }}
              >
                {faucetLoading ? 'Adding…' : user ? '[ ADD TEST FUNDS ]' : 'SIGN IN TO ACCESS TEST FUNDS'}
              </button>
              <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                {user ? 'Adds simulated sandbox funds. No real money is charged.' : 'Sign in to view balances, history, and test-fund options.'}
              </span>
            </div>

            {faucetMessage && (
              <div style={{ marginTop: 'var(--space-2)', fontSize: '11px', color: '#10b981' }}>
                {faucetMessage}
              </div>
            )}
            {faucetError && (
              <div style={{ marginTop: 'var(--space-2)', fontSize: '11px', color: '#f87171' }}>
                {faucetError}
              </div>
            )}
          </div>
        </div>

        {/* Ledger Transaction History Section */}
        <section className="ac-card" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
            <h2 style={{ fontSize: 'var(--font-size-lg)', margin: 0 }}>
              {t('wallet.historyTitle', { defaultValue: 'Transaction History' })}
            </h2>
            <button
              type="button"
              onClick={loadHistory}
              disabled={loadingHistory}
              className="ac-btn ac-btn--ghost"
              style={{ fontSize: 'var(--font-size-xs)', padding: 'var(--space-1) var(--space-3)' }}
            >
              🔄 {t('common.refresh', { defaultValue: 'Refresh' })}
            </button>
          </div>

          {!user ? (
            <p className="ac-text-muted" style={{ padding: 'var(--space-4) 0' }}>
              Sign in to view your transaction history.
            </p>
          ) : loadingHistory ? (
            <p className="ac-text-muted" style={{ padding: 'var(--space-4) 0' }}>
              {t('wallet.loadingHistory', { defaultValue: 'Loading transaction ledger…' })}
            </p>
          ) : historyError ? (
            <div style={{ padding: 'var(--space-4) 0', color: 'var(--color-danger, #f87171)' }}>
              <p style={{ margin: '0 0 var(--space-3)' }}>{historyError}</p>
              <button type="button" onClick={loadHistory} className="ac-btn ac-btn--primary">
                🔄 {t('common.retry', { defaultValue: 'Retry' })}
              </button>
            </div>
          ) : history.length === 0 ? (
            <p className="ac-text-muted" style={{ padding: 'var(--space-4) 0' }}>
              {t('wallet.noHistory', { defaultValue: 'No transactions recorded yet.' })}
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--font-size-sm)' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>
                    <th style={{ padding: 'var(--space-3) var(--space-2)' }}>Type / Description</th>
                    <th style={{ padding: 'var(--space-3) var(--space-2)' }}>Amount</th>
                    <th style={{ padding: 'var(--space-3) var(--space-2)' }}>Currency</th>
                    <th style={{ padding: 'var(--space-3) var(--space-2)' }}>Date & Time</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((tx) => {
                    const isCredit = tx.amount > 0
                    const isZero = tx.amount === 0
                    const sign = isCredit ? '+' : ''
                    const amountColor = isZero ? 'var(--color-text-muted)' : isCredit ? '#22c55e' : '#f87171'

                    return (
                      <tr key={tx.id} style={{ borderBottom: '1px solid color-mix(in srgb, var(--color-border) 40%, transparent)' }}>
                        <td style={{ padding: 'var(--space-3) var(--space-2)', fontWeight: 500 }}>{tx.label}</td>
                        <td style={{ padding: 'var(--space-3) var(--space-2)', color: amountColor, fontWeight: 'bold' }}>
                          {sign}{tx.amount.toLocaleString()}
                        </td>
                        <td style={{ padding: 'var(--space-3) var(--space-2)' }}>
                          {tx.currency === 'COINS' ? (
                            '🪙 COINS'
                          ) : tx.currency === 'DIAMONDS' ? (
                            <span style={{ color: 'var(--color-text-muted)' }}>
                              💎 DIAMONDS <span style={{ fontSize: '10px', background: 'rgba(255,255,255,0.06)', padding: '1px 4px', borderRadius: '3px' }}>(RETIRED)</span>
                            </span>
                          ) : (
                            <span style={{ color: '#10b981' }}>TEST ₾ (SANDBOX)</span>
                          )}
                        </td>
                        <td style={{ padding: 'var(--space-3) var(--space-2)', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>
                          {formatTimestamp(tx.createdAt)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
      <Footer onNavigate={onNavigatePolicy ?? onNavigateHome} />
    </div>
  )
}
