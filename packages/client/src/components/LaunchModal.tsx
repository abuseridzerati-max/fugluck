import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { getGameManifest } from '@fugluck/shared'
import { useAuth } from '../auth/AuthContext'
import AuthModal from './AuthModal'
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

const DEFAULT_CONTROLS_HINT: Record<string, string> = {
  'space-blaster': 'WASD / Arrows to steer · Space to shoot · Survive & destroy waves (3 min cap)',
  'cyber-hopper': 'WASD / Arrows to hop lanes · Dodge hovercars · Reach the top zone to score',
  'neon-runner': 'Space / Up Arrow to jump · Time leaps over neon obstacles for distance score',
  'pixel-ninja-dash': 'Space / Up Arrow to jump & double-jump · Chain rooftop gaps cleanly',
  'speed-trivia': 'Click or press 1–4 to answer · 10 questions · Faster correct answers score more',
  'tf-sprint': 'Click or press T / F (Left / Right) · Rapid-fire True or False sprint',
}

export default function LaunchModal({
  gameId,
  gameTitle,
  onClose,
  onLaunchPractice,
  onLaunchInviteLink,
  onLaunchCoinsMatch,
  onOpenCompetitions,
}: LaunchModalProps) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [showCoinsLobby, setShowCoinsLobby] = useState(false)
  const [showSignUpModal, setShowSignUpModal] = useState(false)
  const [selectedCoinStake, setSelectedCoinStake] = useState<number>(user ? 100 : 0)
  const [customInput, setCustomInput] = useState<string>('')

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !showSignUpModal) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, showSignUpModal])

  const manifest = getGameManifest(gameId)
  const isEligibleForSandboxCompetitions = Boolean(manifest?.certified && manifest.modes.includes('tournament'))

  const currentCoinBalance = user?.balances.coins ?? 0
  const controlsHint = t(`launch.controls.${gameId}`, {
    defaultValue: DEFAULT_CONTROLS_HINT[gameId] ?? '',
  })

  const parsedCustom = customInput ? parseInt(customInput, 10) : NaN
  const isCustomExceeding = !isNaN(parsedCustom) && parsedCustom > currentCoinBalance
  const canSubmit = selectedCoinStake >= 0 && selectedCoinStake <= currentCoinBalance && !isCustomExceeding

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${gameTitle} Launch Options`}
        className="ac-modal-backdrop"
        onClick={onClose}
      >
        <div
          className="ac-panel ac-modal-panel"
          style={{
            maxWidth: 520,
            padding: 'var(--space-5)',
            border: '1px solid var(--color-border-strong)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-elevate-hover)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
            <h2 style={{ margin: 0, fontSize: 'var(--font-size-xl)', minWidth: 0, overflowWrap: 'anywhere' }}>
              {showCoinsLobby ? `${t('launch.casualTitle', { defaultValue: 'CASUAL' })} — ${gameTitle}` : gameTitle}
            </h2>
            <button
              type="button"
              className="ac-btn ac-btn--ghost ac-btn--sm"
              onClick={onClose}
              style={{ minWidth: 44, minHeight: 44, padding: 0, flexShrink: 0 }}
              aria-label={t('common.close', { defaultValue: 'Close' })}
            >
              ✕
            </button>
          </div>

          {controlsHint && (
            <div className="ac-launch-controls">
              <strong>{t('launch.howToPlayLabel', { defaultValue: 'Controls:' })}</strong>{' '}
              <span>{controlsHint}</span>
            </div>
          )}

          {showCoinsLobby ? (
            <div>
              <p className="ac-text-muted" style={{ margin: '0 0 var(--space-3)', fontSize: 'var(--font-size-sm)' }}>
                {t('launch.casualDesc', { defaultValue: '1v1 matchmaking with free virtual COINS or friend invites.' })}
              </p>

              {!user && (
                <div className="ac-guest-coins-callout" role="note">
                  <div className="ac-guest-coins-callout__text">
                    <CoinIcon size={15} />
                    <span>{t('onboarding.guestCoinsCallout', { defaultValue: 'Sign up free — start with 1,000 COINS' })}</span>
                  </div>
                  <button
                    type="button"
                    className="ac-btn ac-btn--primary ac-btn--sm"
                    onClick={() => setShowSignUpModal(true)}
                  >
                    {t('navigation.signup', { defaultValue: 'Sign up' })}
                  </button>
                </div>
              )}

              <div
                style={{
                  background: 'var(--color-surface-raised)',
                  border: '1px solid var(--color-border)',
                  padding: 'var(--space-3) var(--space-4)',
                  borderRadius: 'var(--radius-sm)',
                  marginBottom: 'var(--space-4)',
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 'var(--space-2)',
                }}
              >
                <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                  {t('launch.availableCoins', { defaultValue: 'Available COINS Balance:' })}
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

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                {COIN_STAKE_OPTIONS.map((amount) => {
                  const canAfford = amount === 0 || (Boolean(user) && currentCoinBalance >= amount)
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
                        minWidth: 0,
                        whiteSpace: 'normal',
                        textAlign: 'center',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      <span>{amount === 0 ? 'Free (0)' : `${amount.toLocaleString()}`}</span>
                      {!canAfford && (
                        <span style={{ fontSize: '10px', lineHeight: 1.15, overflowWrap: 'anywhere', color: 'var(--color-danger)' }}>
                          {user ? t('game.tooLow', { defaultValue: 'Too low' }) : t('launch.signUpRequired', { defaultValue: 'Sign up' })}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>

              <div style={{ marginBottom: 'var(--space-4)' }}>
                <label
                  htmlFor="custom-coins-input"
                  style={{ fontSize: 'var(--font-size-xs)', display: 'block', color: 'var(--color-text-muted)', marginBottom: 6 }}
                >
                  {t('launch.customCoins', { defaultValue: 'Custom COINS Amount' })}
                </label>
                <input
                  id="custom-coins-input"
                  type="number"
                  min={0}
                  max={currentCoinBalance}
                  disabled={!user}
                  placeholder={user ? 'Enter custom coins amount' : t('onboarding.guestCoinsCallout', { defaultValue: 'Sign up free — start with 1,000 COINS' })}
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

              <div className="ac-modal-footer">
                <button
                  type="button"
                  className="ac-btn ac-btn--ghost"
                  onClick={() => {
                    setShowCoinsLobby(false)
                    setCustomInput('')
                  }}
                  style={{ flex: '1 1 110px', minHeight: 44 }}
                >
                  ← {t('common.back', { defaultValue: 'Back' })}
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
                  style={{ flex: '2 1 180px', minHeight: 44 }}
                >
                  {selectedCoinStake === 0
                    ? t('launch.queueFree', { defaultValue: 'Enter Free Queue' })
                    : t('launch.queueCoins', { amount: selectedCoinStake.toLocaleString(), defaultValue: `Queue for ${selectedCoinStake.toLocaleString()} COINS` })}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {/* Mode A: PRACTICE */}
              <div className="ac-launch-row">
                <div className="ac-launch-row__copy">
                  <strong style={{ fontSize: 'var(--font-size-base)', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <GamepadIcon size={15} />
                    <span>{t('launch.practiceTitle', { defaultValue: 'PRACTICE' })}</span>
                  </strong>
                  <span className="ac-text-muted" style={{ fontSize: 'var(--font-size-xs)', display: 'block', lineHeight: 1.45 }}>
                    {t('launch.practiceDesc', { defaultValue: 'Play solo rush. No opponent or funds needed.' })}
                  </span>
                </div>
                <button
                  type="button"
                  className="ac-btn ac-btn--ghost ac-launch-row__cta"
                  onClick={() => {
                    onLaunchPractice()
                    onClose()
                  }}
                >
                  {t('launch.playBtn', { defaultValue: 'PLAY' })}
                </button>
              </div>

              {/* Mode B: CASUAL / COINS */}
              <div className="ac-launch-row">
                <div className="ac-launch-row__copy">
                  <strong style={{ fontSize: 'var(--font-size-base)', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <CoinIcon size={15} />
                    <span>{t('launch.casualTitle', { defaultValue: 'CASUAL' })}</span>
                  </strong>
                  <span className="ac-text-muted" style={{ fontSize: 'var(--font-size-xs)', display: 'block', lineHeight: 1.45 }}>
                    {t('launch.casualDesc', { defaultValue: '1v1 matchmaking with free virtual COINS or friend invites.' })}
                  </span>
                </div>
                <button
                  type="button"
                  className="ac-btn ac-btn--secondary ac-launch-row__cta"
                  onClick={() => setShowCoinsLobby(true)}
                >
                  {t('launch.playCasualBtn', { defaultValue: 'PLAY CASUAL' })}
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
                style={{
                  fontSize: 'var(--font-size-xs)',
                  width: '100%',
                  minHeight: 44,
                  borderStyle: 'dashed',
                  whiteSpace: 'normal',
                  textAlign: 'center',
                  lineHeight: 1.3,
                }}
              >
                {t('launch.friendLinkBtn', { defaultValue: 'Create Instant Friend Challenge Link' })}
              </button>

              {/* Mode C: COMPETITIONS (Level 3 Certified Games Only) */}
              {isEligibleForSandboxCompetitions && (
                <div className="ac-launch-row ac-launch-row--certified">
                  <div className="ac-launch-row__copy">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                      <span className="ac-certified-badge">
                        <TrophyIcon size={11} />
                        <span>{t('launch.competitionsBadge', { defaultValue: 'COINS KNOCKOUT' })}</span>
                      </span>
                      <strong style={{ fontSize: 'var(--font-size-base)' }}>
                        {t('launch.competitionsTitle', { defaultValue: 'COMPETITIONS' })}
                      </strong>
                    </div>
                    <span className="ac-text-muted" style={{ fontSize: 'var(--font-size-xs)', display: 'block', lineHeight: 1.45 }}>
                      {t('launch.competitionsDesc', { defaultValue: 'Coins Knockout Tournaments with server-authoritative brackets & predetermined prizes. No real money.' })}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="ac-btn ac-btn--primary ac-launch-row__cta"
                    onClick={() => {
                      onOpenCompetitions?.()
                      onClose()
                    }}
                  >
                    {t('launch.viewCompetitionsBtn', { defaultValue: 'VIEW COMPETITIONS' })}
                  </button>
                </div>
              )}

              {!user && (
                <div className="ac-guest-coins-callout" role="note">
                  <div className="ac-guest-coins-callout__text">
                    <CoinIcon size={15} />
                    <span>{t('onboarding.guestCoinsCallout', { defaultValue: 'Sign up free — start with 1,000 COINS' })}</span>
                  </div>
                  <button
                    type="button"
                    className="ac-btn ac-btn--primary ac-btn--sm"
                    onClick={() => setShowSignUpModal(true)}
                  >
                    {t('navigation.signup', { defaultValue: 'Sign up' })}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showSignUpModal && (
        <AuthModal initialMode="signup" onClose={() => setShowSignUpModal(false)} />
      )}
    </>
  )
}
