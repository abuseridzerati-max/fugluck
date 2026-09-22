import { useState, useEffect } from 'react'
import { GAME_COMPETITION_ELIGIBILITY_REGISTRY } from '@fugluck/shared'
import { useAuth } from '../auth/AuthContext'

type LaunchModalProps = {
  gameId: string
  gameTitle: string
  onClose: () => void
  onLaunchPractice: () => void
  onLaunchInviteLink: () => void
  onLaunchCoinsMatch?: (stake: number) => void
  onOpenCompetitions?: () => void
}

const COIN_STAKE_OPTIONS = [0, 25, 50, 100, 250, 500]

export default function LaunchModal({
  gameId,
  gameTitle,
  onClose,
  onLaunchPractice,
  onLaunchInviteLink,
  onLaunchCoinsMatch,
  onOpenCompetitions,
}: LaunchModalProps) {
  const { user } = useAuth()
  const [showCoinsLobby, setShowCoinsLobby] = useState(false)
  const [selectedCoinStake, setSelectedCoinStake] = useState<number>(100)
  const [customInput, setCustomInput] = useState<string>('')

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Authoritative eligibility check from @fugluck/shared
  const eligibility = GAME_COMPETITION_ELIGIBILITY_REGISTRY[gameId] ?? 'COIN_COMPETITIVE'
  const isEligibleForSandboxCompetitions =
    eligibility === 'PAID_COMPETITIVE_CANDIDATE' || eligibility === 'PAID_COMPETITIVE_APPROVED'

  const currentCoinBalance = user?.balances.coins ?? 0

  const parsedCustom = customInput ? parseInt(customInput, 10) : NaN
  const isCustomExceeding = !isNaN(parsedCustom) && parsedCustom > currentCoinBalance
  const canSubmit = selectedCoinStake >= 0 && selectedCoinStake <= currentCoinBalance && !isCustomExceeding

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${gameTitle} Launch Options`}
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
          maxWidth: 480,
          padding: 'var(--space-6)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg, 12px)',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
          <h2 style={{ margin: 0, fontSize: 'var(--font-size-xl)' }}>
            {showCoinsLobby
              ? `Casual Coins — ${gameTitle}`
              : gameTitle}
          </h2>
          <button
            type="button"
            className="ac-btn ac-btn--ghost"
            onClick={onClose}
            style={{ padding: 'var(--space-1) var(--space-2)' }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {showCoinsLobby ? (
          /* Casual Coins Matchmaking Step */
          <div>
            <p className="ac-text-muted" style={{ margin: '0 0 var(--space-3)', fontSize: 'var(--font-size-sm)' }}>
              Play casual multiplayer matches with virtual COINS.
            </p>

            <div
              style={{
                background: 'var(--color-surface-raised, #1e293b)',
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-sm)',
                marginBottom: 'var(--space-4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                Available COINS Balance:
              </span>
              <strong style={{ color: '#fbbf24' }}>
                🪙 {currentCoinBalance.toLocaleString()}
              </strong>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
              {COIN_STAKE_OPTIONS.map((amount) => {
                const canAfford = currentCoinBalance >= amount
                const isSelected = selectedCoinStake === amount && !customInput

                return (
                  <button
                    key={amount}
                    type="button"
                    disabled={!canAfford}
                    onClick={() => {
                      setCustomInput('')
                      setSelectedCoinStake(amount)
                    }}
                    className={`ac-btn ${isSelected ? 'ac-btn--primary' : 'ac-btn--ghost'}`}
                    style={{
                      justifyContent: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      padding: 'var(--space-2)',
                      border: isSelected ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                      opacity: canAfford ? 1 : 0.4,
                      cursor: canAfford ? 'pointer' : 'not-allowed',
                    }}
                  >
                    <span>{amount === 0 ? 'Free (0)' : `${amount} 🪙`}</span>
                    {!canAfford && <span style={{ fontSize: '9px', color: '#f87171' }}>Too low</span>}
                  </button>
                )
              })}
            </div>

            {/* Custom Amount Input Field */}
            <div style={{ marginBottom: 'var(--space-5)' }}>
              <label style={{ fontSize: 'var(--font-size-xs)', display: 'block', color: 'var(--color-text-muted)', marginBottom: 4 }}>
                Custom COINS Amount:
              </label>
              <input
                type="number"
                min={0}
                max={currentCoinBalance}
                placeholder="Enter custom coins amount"
                value={customInput}
                onChange={(e) => {
                  const val = e.target.value
                  setCustomInput(val)
                  const num = parseInt(val, 10)
                  if (!isNaN(num) && num >= 0) {
                    setSelectedCoinStake(num)
                  }
                }}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: 'var(--space-2) var(--space-3)',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--color-bg)',
                  border: isCustomExceeding ? '1px solid #f87171' : '1px solid var(--color-border)',
                  color: 'var(--color-text)',
                  fontSize: 'var(--font-size-sm)',
                }}
              />
              {isCustomExceeding && (
                <span style={{ fontSize: '11px', color: '#f87171', display: 'block', marginTop: 4 }}>
                  Amount exceeds your current balance of {currentCoinBalance} COINS.
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <button
                type="button"
                className="ac-btn ac-btn--ghost"
                onClick={() => {
                  setShowCoinsLobby(false)
                  setCustomInput('')
                }}
                style={{ flex: 1 }}
              >
                ← Back
              </button>
              <button
                type="button"
                className="ac-btn ac-btn--primary"
                disabled={!canSubmit}
                onClick={() => {
                  if (!canSubmit) return
                  onLaunchCoinsMatch?.(selectedCoinStake)
                  onClose()
                }}
                style={{ flex: 2, fontWeight: 'bold', opacity: canSubmit ? 1 : 0.4 }}
              >
                {selectedCoinStake === 0 ? 'Enter Free Queue' : `Queue for ${selectedCoinStake} Coins`}
              </button>
            </div>
          </div>
        ) : (
          /* Redesigned 3-Mode Selection Step per Section 3 */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {/* Mode A: PRACTICE */}
            <div
              style={{
                background: 'var(--color-surface-raised)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-4)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <strong style={{ fontSize: 'var(--font-size-base)', display: 'block' }}>
                  🕹️ PRACTICE
                </strong>
                <span className="ac-text-muted" style={{ fontSize: 'var(--font-size-xs)' }}>
                  Play solo rush. No opponent or test funds needed.
                </span>
              </div>
              <button
                type="button"
                className="ac-btn ac-btn--secondary"
                onClick={() => {
                  onLaunchPractice()
                  onClose()
                }}
                style={{ minWidth: 90, justifyContent: 'center' }}
              >
                PLAY
              </button>
            </div>

            {/* Mode B: CASUAL / COINS */}
            <div
              style={{
                background: 'var(--color-surface-raised)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-4)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <strong style={{ fontSize: 'var(--font-size-base)', display: 'block' }}>
                  🪙 CASUAL
                </strong>
                <span className="ac-text-muted" style={{ fontSize: 'var(--font-size-xs)' }}>
                  Play with free virtual COINS or invite a friend.
                </span>
              </div>
              <button
                type="button"
                className="ac-btn ac-btn--secondary"
                onClick={() => setShowCoinsLobby(true)}
                style={{ minWidth: 120, justifyContent: 'center' }}
              >
                PLAY CASUAL
              </button>
            </div>

            {/* Friend Invite Shortcut */}
            <div style={{ textAlign: 'center' }}>
              <button
                type="button"
                className="ac-btn ac-btn--ghost"
                onClick={() => {
                  onLaunchInviteLink()
                  onClose()
                }}
                style={{ fontSize: 'var(--font-size-xs)', width: '100%', border: '1px dashed var(--color-border)' }}
              >
                🔗 Create Instant Friend Challenge Link
              </button>
            </div>

            {/* Mode C: SANDBOX COMPETITIONS (Candidate Games Only) */}
            {isEligibleForSandboxCompetitions && (
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(56, 189, 248, 0.08) 100%)',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-4)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span
                      style={{
                        background: '#10b981',
                        color: '#000',
                        fontSize: '9px',
                        fontWeight: 'bold',
                        padding: '1px 5px',
                        borderRadius: '3px',
                        letterSpacing: '0.5px',
                      }}
                    >
                      TEST GEL
                    </span>
                    <strong style={{ fontSize: 'var(--font-size-base)' }}>
                      SANDBOX COMPETITIONS
                    </strong>
                  </div>
                  <span className="ac-text-muted" style={{ fontSize: 'var(--font-size-xs)', display: 'block' }}>
                    Fixed entry fees & predetermined prizes. No real money.
                  </span>
                </div>
                <button
                  type="button"
                  className="ac-btn ac-btn--primary"
                  onClick={() => {
                    onOpenCompetitions?.()
                    onClose()
                  }}
                  style={{
                    background: '#10b981',
                    borderColor: '#10b981',
                    color: '#fff',
                    fontWeight: 'bold',
                    minWidth: 160,
                    justifyContent: 'center',
                    whiteSpace: 'nowrap',
                  }}
                >
                  VIEW COMPETITIONS
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
