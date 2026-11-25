import { useState, useEffect } from 'react'
import { GAME_COMPETITION_CERTIFICATIONS } from '@fugluck/shared'
import { useAuth } from '../auth/AuthContext'
import { CoinIcon, GamepadIcon, TrophyIcon } from './icons'

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

  const isEligibleForSandboxCompetitions =
    GAME_COMPETITION_CERTIFICATIONS[gameId]?.testGelCompetition === 'LEVEL_3_CERTIFIED'

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
        background: 'rgba(4, 7, 12, 0.8)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-4)',
        zIndex: 50,
      }}
      onClick={onClose}
    >
      <div
        className="ac-panel"
        style={{
          width: '100%',
          maxWidth: 500,
          padding: 'var(--space-6)',
          border: '1px solid var(--color-border-strong)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-elevate-hover)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
          <h2 style={{ margin: 0, fontSize: 'var(--font-size-xl)' }}>
            {showCoinsLobby ? `Casual Coins — ${gameTitle}` : gameTitle}
          </h2>
          <button
            type="button"
            className="ac-btn ac-btn--ghost ac-btn--sm"
            onClick={onClose}
            style={{ minWidth: 36, padding: 0 }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {showCoinsLobby ? (
          <div>
            <p className="ac-text-muted" style={{ margin: '0 0 var(--space-4)', fontSize: 'var(--font-size-sm)' }}>
              Play casual multiplayer matches with free virtual COINS.
            </p>

            <div
              style={{
                background: 'var(--color-surface-raised)',
                border: '1px solid var(--color-border)',
                padding: 'var(--space-3) var(--space-4)',
                borderRadius: 'var(--radius-sm)',
                marginBottom: 'var(--space-4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                Available COINS Balance:
              </span>
              <strong
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  color: 'var(--color-secondary-hover)',
                  fontFamily: 'var(--font-mono)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                <CoinIcon size={15} />
                {currentCoinBalance.toLocaleString()} COINS
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
                      flexDirection: 'column',
                      gap: 2,
                      padding: 'var(--space-2)',
                      minHeight: 44,
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    <span>{amount === 0 ? 'Free (0)' : `${amount.toLocaleString()}`}</span>
                    {!canAfford && <span style={{ fontSize: '10px', color: 'var(--color-danger)' }}>Too low</span>}
                  </button>
                )
              })}
            </div>

            <div style={{ marginBottom: 'var(--space-5)' }}>
              <label
                htmlFor="custom-coins-input"
                style={{ fontSize: 'var(--font-size-xs)', display: 'block', color: 'var(--color-text-muted)', marginBottom: 6 }}
              >
                Custom COINS Amount
              </label>
              <input
                id="custom-coins-input"
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
                  padding: '0.625rem 0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--color-bg)',
                  border: isCustomExceeding ? '1px solid var(--color-danger)' : '1px solid var(--color-border)',
                  color: 'var(--color-text)',
                  fontSize: 'var(--font-size-sm)',
                  fontFamily: 'var(--font-mono)',
                }}
              />
              {isCustomExceeding && (
                <span style={{ fontSize: '12px', color: 'var(--color-danger)', display: 'block', marginTop: 6 }}>
                  Amount exceeds your current balance of {currentCoinBalance.toLocaleString()} COINS.
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
                style={{ flex: 2 }}
              >
                {selectedCoinStake === 0
                  ? 'Enter Free Queue'
                  : `Queue for ${selectedCoinStake.toLocaleString()} COINS`}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
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
                gap: 'var(--space-3)',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ flex: '1 1 200px' }}>
                <strong style={{ fontSize: 'var(--font-size-base)', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <GamepadIcon size={15} />
                  <span>PRACTICE</span>
                </strong>
                <span className="ac-text-muted" style={{ fontSize: 'var(--font-size-xs)', display: 'block', lineHeight: 1.45 }}>
                  Play solo rush. No opponent or funds needed.
                </span>
              </div>
              <button
                type="button"
                className="ac-btn ac-btn--ghost"
                onClick={() => {
                  onLaunchPractice()
                  onClose()
                }}
                style={{ minWidth: 112 }}
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
                gap: 'var(--space-3)',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ flex: '1 1 200px' }}>
                <strong style={{ fontSize: 'var(--font-size-base)', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <CoinIcon size={15} />
                  <span>CASUAL</span>
                </strong>
                <span className="ac-text-muted" style={{ fontSize: 'var(--font-size-xs)', display: 'block', lineHeight: 1.45 }}>
                  1v1 matchmaking with free virtual COINS or friend invites.
                </span>
              </div>
              <button
                type="button"
                className="ac-btn ac-btn--secondary"
                onClick={() => setShowCoinsLobby(true)}
                style={{ minWidth: 132 }}
              >
                PLAY CASUAL
              </button>
            </div>

            {/* Friend Invite Shortcut */}
            <button
              type="button"
              className="ac-btn ac-btn--ghost"
              onClick={() => {
                onLaunchInviteLink()
                onClose()
              }}
              style={{ fontSize: 'var(--font-size-xs)', width: '100%', borderStyle: 'dashed' }}
            >
              Create Instant Friend Challenge Link
            </button>

            {/* Mode C: COMPETITIONS (Level 3 Certified Games Only) */}
            {isEligibleForSandboxCompetitions && (
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.14) 0%, rgba(14, 20, 32, 0.96) 100%)',
                  border: '1px solid var(--color-primary-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-4)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  flexWrap: 'wrap',
                  marginTop: 'var(--space-1)',
                }}
              >
                <div style={{ flex: '1 1 210px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                    <span className="ac-certified-badge">
                      <TrophyIcon size={11} />
                      <span>COINS KNOCKOUT</span>
                    </span>
                    <strong style={{ fontSize: 'var(--font-size-base)' }}>
                      COMPETITIONS
                    </strong>
                  </div>
                  <span className="ac-text-muted" style={{ fontSize: 'var(--font-size-xs)', display: 'block', lineHeight: 1.45 }}>
                    Coins Knockout Tournaments with server-authoritative brackets &amp; predetermined prizes. No real money.
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
                    minWidth: 170,
                    padding: '0 1rem',
                    minHeight: 42,
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
