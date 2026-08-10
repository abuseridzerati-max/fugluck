import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'

type LaunchModalProps = {
  gameTitle: string
  onClose: () => void
  onLaunchPractice: () => void
  onLaunchInviteLink: () => void
  onLaunchCoinsMatch?: (stake: number) => void
  onLaunchDiamondsMatch?: (stake: number) => void
}

const COIN_STAKE_OPTIONS = [25, 50, 100, 250, 500]
const DIAMOND_STAKE_OPTIONS = [5, 10, 25, 50, 100]

export default function LaunchModal({
  gameTitle,
  onClose,
  onLaunchPractice,
  onLaunchInviteLink,
  onLaunchCoinsMatch,
  onLaunchDiamondsMatch,
}: LaunchModalProps) {
  const { user } = useAuth()
  const [stakeCurrency, setStakeCurrency] = useState<'COINS' | 'DIAMONDS' | null>(null)
  const [selectedStake, setSelectedStake] = useState<number>(100)

  const currentBalance = stakeCurrency === 'COINS' ? (user?.balances.coins ?? 0) : (user?.balances.diamonds ?? 0)
  const stakeOptions = stakeCurrency === 'COINS' ? COIN_STAKE_OPTIONS : DIAMOND_STAKE_OPTIONS

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'color-mix(in srgb, var(--color-bg) 80%, transparent)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
      }}
      onClick={onClose}
    >
      <div
        className="ac-panel"
        style={{
          width: '90%',
          maxWidth: 440,
          padding: 'var(--space-6)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg, 12px)',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
          <h2 style={{ margin: 0, fontSize: 'var(--font-size-xl)' }}>
            {stakeCurrency ? `Select ${stakeCurrency} Stake` : `Launch ${gameTitle}`}
          </h2>
          <button
            type="button"
            className="ac-btn ac-btn--ghost"
            onClick={onClose}
            style={{ padding: 'var(--space-1) var(--space-2)' }}
          >
            ✕
          </button>
        </div>

        {stakeCurrency ? (
          /* Stake Selection Step */
          <div>
            <p className="ac-text-muted" style={{ margin: '0 0 var(--space-3)', fontSize: 'var(--font-size-sm)' }}>
              Choose your wager amount for <strong>{gameTitle}</strong>.
            </p>

            <div
              style={{
                background: 'var(--color-surface-raised, #1e293b)',
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-sm)',
                marginBottom: 'var(--space-4)',
                display: 'flex',
                alignItems: 'center',
                justify: 'space-between',
              }}
            >
              <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>Available Balance:</span>
              <strong style={{ color: stakeCurrency === 'COINS' ? '#fbbf24' : '#a855f7' }}>
                {currentBalance} {stakeCurrency}
              </strong>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)', marginBottom: 'var(--space-5)' }}>
              {stakeOptions.map((amount) => {
                const canAfford = currentBalance >= amount
                const isSelected = selectedStake === amount

                return (
                  <button
                    key={amount}
                    type="button"
                    disabled={!canAfford}
                    onClick={() => setSelectedStake(amount)}
                    className={`ac-btn ${isSelected ? 'ac-btn--primary' : 'ac-btn--ghost'}`}
                    style={{
                      justify: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      padding: 'var(--space-3)',
                      border: isSelected ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                      opacity: canAfford ? 1 : 0.4,
                      cursor: canAfford ? 'pointer' : 'not-allowed',
                    }}
                  >
                    <span>
                      {amount} {stakeCurrency === 'COINS' ? '🪙' : '💎'}
                    </span>
                    {!canAfford && <span style={{ fontSize: '9px', color: '#f87171' }}>Too low</span>}
                  </button>
                )
              })}
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <button
                type="button"
                className="ac-btn ac-btn--ghost"
                onClick={() => setStakeCurrency(null)}
                style={{ flex: 1 }}
              >
                ← Back
              </button>
              <button
                type="button"
                className="ac-btn ac-btn--primary"
                onClick={() => {
                  if (stakeCurrency === 'COINS') onLaunchCoinsMatch?.(selectedStake)
                  else onLaunchDiamondsMatch?.(selectedStake)
                  onClose()
                }}
                style={{ flex: 2, fontWeight: 'bold' }}
              >
                Enter Queue ({selectedStake} {stakeCurrency})
              </button>
            </div>
          </div>
        ) : (
          /* Mode Selection Step */
          <>
            <p className="ac-text-muted" style={{ margin: '0 0 var(--space-5)', fontSize: 'var(--font-size-sm)' }}>
              {user
                ? 'Select your match mode below to start playing or wagering.'
                : 'You are playing as a Guest. Choose Solo Rush or send an instant invite link to a friend.'}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {/* Mode 1: Solo Rush */}
              <button
                type="button"
                className="ac-btn ac-btn--secondary"
                onClick={() => {
                  onLaunchPractice()
                  onClose()
                }}
                style={{ width: '100%', justifyContent: 'flex-start', padding: 'var(--space-3)' }}
              >
                🕹️ <strong style={{ marginLeft: 8 }}>Solo Rush</strong> — Practice Mode (Offline)
              </button>

              {/* Mode 2: Instant Invite Link */}
              <button
                type="button"
                className="ac-btn ac-btn--ghost"
                onClick={() => {
                  onLaunchInviteLink()
                  onClose()
                }}
                style={{
                  width: '100%',
                  justify: 'flex-start',
                  padding: 'var(--space-3)',
                  border: '1px dashed var(--color-border)',
                }}
              >
                🔗 <strong style={{ marginLeft: 8 }}>Instant Invite Link</strong> — Share Free-Play Link
              </button>

              {/* Mode 3 & 4: Only for Authenticated Users */}
              {user ? (
                <>
                  <button
                    type="button"
                    className="ac-btn ac-btn--primary"
                    onClick={() => {
                      setStakeCurrency('COINS')
                      setSelectedStake(100)
                    }}
                    style={{ width: '100%', justifyContent: 'flex-start', padding: 'var(--space-3)' }}
                  >
                    🪙 <strong style={{ marginLeft: 8 }}>Play with COINS</strong> — Fun Match (0% Rake Fee)
                  </button>

                  <button
                    type="button"
                    className="ac-btn"
                    onClick={() => {
                      setStakeCurrency('DIAMONDS')
                      setSelectedStake(10)
                    }}
                    style={{
                      width: '100%',
                      justify: 'flex-start',
                      padding: 'var(--space-3)',
                      background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)',
                      color: '#fff',
                      border: 'none',
                    }}
                  >
                    💎 <strong style={{ marginLeft: 8 }}>Play with DIAMONDS</strong> — Competitive (5% Rake Fee)
                  </button>
                </>
              ) : (
                <div
                  style={{
                    marginTop: 'var(--space-2)',
                    padding: 'var(--space-3)',
                    background: 'var(--color-surface-raised, #1e293b)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--color-text-muted)',
                  }}
                >
                  🔒 Log in or Sign up to unlock COIN and DIAMOND wagering matches with real balance tracking!
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
