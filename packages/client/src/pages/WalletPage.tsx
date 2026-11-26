import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { CoinIcon } from '../components/icons'
import { useAuth } from '../auth/AuthContext'
import { apiFetch, ApiError } from '../lib/api'
import { canViewSandboxGelUi } from '../lib/sandboxVisibility'

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
  const showSandboxGel = canViewSandboxGelUi(user)
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
      return `${dateStr} · ${timeStr}`
    } catch {
      return iso
    }
  }

  const userBalanceMinor = user?.balances.sandboxGelMinor ?? 0
  const userReservedMinor = user?.balances.sandboxGelReservedMinor ?? 0

  return (
    <div className="ac-shell">
      <Navbar
        activePage="wallet"
        onNavigateHome={onNavigateHome}
        onNavigateProfile={onNavigateProfile ?? onNavigateHome}
        onNavigateFriends={onNavigateFriends}
        onNavigateCompetitions={onNavigateCompetitions}
      />
      <main className="ac-main">
        <header style={{ marginBottom: 'var(--space-5)' }}>
          <h1 style={{ margin: '0 0 var(--space-1)', fontSize: 'var(--font-size-2xl)' }}>
            {t('walletUi.title', { defaultValue: 'Wallet & Balances' })}
          </h1>
          <p className="ac-text-muted" style={{ margin: 0, fontSize: 'var(--font-size-sm)' }}>
            {t('walletUi.subtitle', { defaultValue: 'Track your virtual COINS balance, monthly top-up schedule, and ledger history.' })}
          </p>
        </header>

        {/* Live Balance Summary Cards */}
        <div className="ac-wallet-grid">
          {/* Virtual COINS Hero Card */}
          <section className="ac-wallet-hero" aria-label="COINS balance">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>
                {t('wallet.coinsLabel', { defaultValue: 'COINS Balance' })}
              </span>
              <span className="ac-badge ac-badge--coins">
                <CoinIcon size={12} />
                <span>{t('walletUi.freeVirtualPoints', { defaultValue: 'FREE VIRTUAL POINTS' })}</span>
              </span>
            </div>

            <div className="ac-wallet-amount" style={{ color: 'var(--color-secondary-hover)' }}>
              {(user?.balances.coins ?? 0).toLocaleString()} <span style={{ fontSize: '0.5em', color: 'var(--color-text-secondary)' }}>COINS</span>
            </div>

            <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
              {t('walletUi.coinsUse', { defaultValue: 'Use COINS for casual 1v1 matches, friend challenges, and Coins Knockout Tournaments.' })}
            </p>

            <div className="ac-wallet-refill-note">
              <strong style={{ color: 'var(--color-secondary-hover)', whiteSpace: 'nowrap' }}>
                {t('walletUi.monthlyTopUpLabel', { defaultValue: 'Monthly Top-Up:' })}
              </strong>
              <span>{t('walletUi.monthlyTopUpBody')}</span>
            </div>
          </section>

          {/* SANDBOX TEST GEL Card (Admin / Operator Sandbox View) */}
          {showSandboxGel && (
            <section className="ac-wallet-sandbox" aria-label="Sandbox Test GEL balance">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>
                  SANDBOX TEST BALANCE
                </span>
                <span className="ac-badge ac-badge--sandbox">TEST ONLY</span>
              </div>

              <div className="ac-wallet-amount" style={{ color: 'var(--color-primary-hover)' }}>
                TEST ₾{(userBalanceMinor / 100).toFixed(2)}
              </div>

              {userReservedMinor > 0 && (
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-secondary-hover)', fontFamily: 'var(--font-mono)' }}>
                  (TEST ₾{(userReservedMinor / 100).toFixed(2)} reserved in active queue)
                </div>
              )}

              <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                TEST GEL is simulated, has no real-world value, and cannot be deposited, withdrawn, or redeemed.
              </p>

              <div style={{ marginTop: 'auto', paddingTop: 'var(--space-2)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-3)' }}>
                <button
                  type="button"
                  className="ac-btn ac-btn--primary ac-btn--sm"
                  disabled={!user || faucetLoading}
                  onClick={handleAddTestFunds}
                  title={!user ? 'Sign in to access sandbox test funds.' : undefined}
                >
                  {faucetLoading ? 'Adding…' : user ? 'Add Test Funds' : 'Sign in to access test funds'}
                </button>
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                  {user ? 'Adds +TEST ₾100.00 simulated sandbox funds.' : 'Sign in to view balances, history, and test-fund options.'}
                </span>
              </div>

              {faucetMessage && (
                <div style={{ fontSize: '12px', color: 'var(--color-primary-hover)' }}>
                  {faucetMessage}
                </div>
              )}
              {faucetError && (
                <div style={{ fontSize: '12px', color: 'var(--color-danger)' }}>
                  {faucetError}
                </div>
              )}
            </section>
          )}
        </div>

        {/* Ledger Transaction History Section */}
        <section className="ac-panel" style={{ marginBottom: 'var(--space-6)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
            <h2 style={{ fontSize: 'var(--font-size-lg)', margin: 0 }}>
              {t('wallet.historyTitle', { defaultValue: 'Transaction History' })}
            </h2>
            <button
              type="button"
              onClick={loadHistory}
              disabled={loadingHistory}
              className="ac-btn ac-btn--ghost ac-btn--sm"
            >
              {t('common.refresh', { defaultValue: 'Refresh' })}
            </button>
          </div>

          {!user ? (
            <p className="ac-text-muted" style={{ padding: 'var(--space-4) 0', margin: 0 }}>
              {t('walletUi.signInHistory', { defaultValue: 'Sign in to view your transaction history.' })}
            </p>
          ) : loadingHistory ? (
            <p className="ac-text-muted" style={{ padding: 'var(--space-4) 0', margin: 0 }}>
              {t('wallet.loadingHistory', { defaultValue: 'Loading transaction ledger…' })}
            </p>
          ) : historyError ? (
            <div style={{ padding: 'var(--space-4) 0', color: 'var(--color-danger)' }}>
              <p style={{ margin: '0 0 var(--space-3)' }}>{historyError}</p>
              <button type="button" onClick={loadHistory} className="ac-btn ac-btn--primary ac-btn--sm">
                {t('common.retry', { defaultValue: 'Retry' })}
              </button>
            </div>
          ) : history.length === 0 ? (
            <p className="ac-text-muted" style={{ padding: 'var(--space-4) 0', margin: 0 }}>
              {t('wallet.noHistory', { defaultValue: 'No transactions recorded yet.' })}
            </p>
          ) : (
            <div className="ac-table-wrap">
              <table className="ac-table">
                <thead>
                  <tr>
                    <th>{t('walletUi.colType')}</th>
                    <th>{t('walletUi.colAmount')}</th>
                    <th>{t('walletUi.colCurrency')}</th>
                    <th>{t('walletUi.colDate')}</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((tx) => {
                    const isCredit = tx.amount > 0
                    const isZero = tx.amount === 0
                    const sign = isCredit ? '+' : ''
                    const amountColor = isZero
                      ? 'var(--color-text-muted)'
                      : isCredit
                      ? 'var(--color-success)'
                      : 'var(--color-danger)'

                    return (
                      <tr key={tx.id}>
                        <td style={{ fontWeight: 500, color: 'var(--color-text)' }}>{tx.label}</td>
                        <td className="ac-table__mono" style={{ color: amountColor, fontWeight: 700 }}>
                          {sign}{tx.amount.toLocaleString()}
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          {tx.currency === 'COINS' ? (
                            <span className="ac-badge ac-badge--coins">COINS</span>
                          ) : (
                            <span className="ac-badge ac-badge--sandbox">TEST ₾</span>
                          )}
                        </td>
                        <td className="ac-table__mono" style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>
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
