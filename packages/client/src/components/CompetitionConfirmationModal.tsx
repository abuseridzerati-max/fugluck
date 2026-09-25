import { useState, useEffect } from 'react'
import type { CompetitionTemplate } from '@fugluck/shared'
import { useAuth } from '../auth/AuthContext'
import { apiFetch, ApiError } from '../lib/api'

type CompetitionConfirmationModalProps = {
  template: CompetitionTemplate
  gameTitle: string
  onClose: () => void
  onConfirm: () => void
}

export default function CompetitionConfirmationModal({
  template,
  gameTitle,
  onClose,
  onConfirm,
}: CompetitionConfirmationModalProps) {
  const { user, refreshUser } = useAuth()
  const [faucetLoading, setFaucetLoading] = useState(false)
  const [faucetMessage, setFaucetMessage] = useState<string | null>(null)
  const [faucetError, setFaucetError] = useState<string | null>(null)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const isFree = template.entryFeeMinor === 0
  const entryFeeDisplay = isFree
    ? 'FREE'
    : `TEST ₾${(template.entryFeeMinor / 100).toFixed(2)}`

  const firstPrize = template.prizes?.[0]?.amountMinor ?? 0
  const prizeDisplay = firstPrize > 0
    ? `TEST ₾${(firstPrize / 100).toFixed(2)}`
    : 'None'

  const userBalanceMinor = user?.balances.sandboxGelMinor ?? 0
  const hasEnoughFunds = isFree || userBalanceMinor >= template.entryFeeMinor

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
      setFaucetMessage('Added +TEST ₾100.00 sandbox test funds!')
    } catch (err) {
      setFaucetError(err instanceof ApiError ? err.message : 'Failed to add test funds.')
    } finally {
      setFaucetLoading(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${template.title} Confirmation`}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'color-mix(in srgb, var(--color-bg) 80%, transparent)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 60,
      }}
      onClick={onClose}
    >
      <div
        className="ac-panel"
        style={{
          width: '90%',
          maxWidth: 460,
          maxHeight: 'calc(100dvh - 32px)',
          overflowY: 'auto',
          padding: 'clamp(16px, 4vw, 32px)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg, 12px)',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sandbox Badge */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '3px 10px',
              borderRadius: 'var(--radius-full)',
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid #10b981',
              color: '#10b981',
              fontSize: '11px',
              fontWeight: 'bold',
              letterSpacing: '1px',
            }}
          >
            TEST / SANDBOX COMPETITION
          </span>
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

        <h2 style={{ margin: '0 0 var(--space-1)', fontSize: 'var(--font-size-xl)' }}>
          {template.title}
        </h2>
        <p className="ac-text-muted" style={{ margin: '0 0 var(--space-4)', fontSize: 'var(--font-size-xs)' }}>
          {gameTitle} • Format: {template.format.replace(/_/g, ' ')} • Capacity: {template.participantCapacity} players • Rules: {template.rulesVersion}
        </p>

        {/* Financial Terms Summary (from server) */}
        {(template.gameId === 'space-blaster' || template.gameId === 'cyber-hopper') && <p>Maximum run: 180 seconds. Scores and collisions are calculated by the server. Equal scores void the competition and refund entry. Leaving an active run can forfeit it.</p>}
        <div
          style={{
            background: 'var(--color-surface-raised, #1e293b)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-4)',
            marginBottom: 'var(--space-4)',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 'var(--space-3)',
            textAlign: 'center',
          }}
        >
          <div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginBottom: 2 }}>
              Entry Fee
            </div>
            <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'bold', color: 'var(--color-text)' }}>
              {entryFeeDisplay}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginBottom: 2 }}>
              Predetermined Prize
            </div>
            <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'bold', color: '#10b981' }}>
              {prizeDisplay}
            </div>
          </div>
        </div>

        {/* Unmistakable Sandbox Disclaimer */}
        <div
          style={{
            background: 'rgba(56, 189, 248, 0.08)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            borderRadius: 'var(--radius-sm)',
            padding: 'var(--space-3)',
            marginBottom: 'var(--space-4)',
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-text-muted)',
            lineHeight: 1.4,
          }}
        >
          <strong style={{ color: 'var(--color-text)' }}>TEST / SANDBOX GEL Competition:</strong> This competition uses simulated TEST / SANDBOX GEL with zero real-world value. No real money is deposited, withdrawn, or awarded. These values are used only for development and skill assessment.
        </div>

        {/* Sandbox Test Balance & Faucet */}
        {user ? (
          <div
            style={{
              background: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              padding: 'var(--space-3)',
              marginBottom: 'var(--space-5)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                Your Sandbox Test Balance:
              </span>
              <strong style={{ color: '#10b981', fontSize: 'var(--font-size-sm)' }}>
                TEST ₾{(userBalanceMinor / 100).toFixed(2)}
              </strong>
            </div>

            {!hasEnoughFunds && (
              <div style={{ marginTop: 'var(--space-2)', fontSize: '11px', color: '#f87171' }}>
                You do not have enough Sandbox Test GEL to enter this competition.
              </div>
            )}

            <div style={{ marginTop: 'var(--space-3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                Adds simulated sandbox funds. No real money is charged.
              </span>
              <button
                type="button"
                className="ac-btn ac-btn--secondary"
                disabled={faucetLoading}
                onClick={handleAddTestFunds}
                style={{ fontSize: '11px', padding: '4px 10px', whiteSpace: 'nowrap' }}
              >
                {faucetLoading ? 'Adding…' : '[ ADD TEST FUNDS ]'}
              </button>
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
        ) : (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 'var(--radius-sm)',
              padding: 'var(--space-3)',
              marginBottom: 'var(--space-5)',
              fontSize: 'var(--font-size-xs)',
              color: '#f87171',
            }}
          >
            🔒 Free entry costs no Test GEL, but an account is required to enter any competition. Sign in or create an account to enter; paid sandbox competitions also require enough Test GEL.
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <button
            type="button"
            className="ac-btn ac-btn--ghost"
            onClick={onClose}
            style={{ flex: 1 }}
          >
            CANCEL
          </button>
          <button
            type="button"
            className="ac-btn ac-btn--primary"
            disabled={!user || !hasEnoughFunds}
            onClick={onConfirm}
            style={{
              flex: 2,
              fontWeight: 'bold',
              background: hasEnoughFunds ? '#10b981' : undefined,
              borderColor: hasEnoughFunds ? '#10b981' : undefined,
              opacity: user && hasEnoughFunds ? 1 : 0.4,
              cursor: user && hasEnoughFunds ? 'pointer' : 'not-allowed',
            }}
          >
            {isFree ? 'ENTER FREE' : 'ENTER COMPETITION'}
          </button>
        </div>
      </div>
    </div>
  )
}
