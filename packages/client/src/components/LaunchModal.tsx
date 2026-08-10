import { useAuth } from '../auth/AuthContext'

type LaunchModalProps = {
  gameTitle: string
  onClose: () => void
  onLaunchPractice: () => void
  onLaunchInviteLink: () => void
  onLaunchCoinsMatch?: () => void
  onLaunchDiamondsMatch?: () => void
}

export default function LaunchModal({
  gameTitle,
  onClose,
  onLaunchPractice,
  onLaunchInviteLink,
  onLaunchCoinsMatch,
  onLaunchDiamondsMatch,
}: LaunchModalProps) {
  const { user } = useAuth()

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
          <h2 style={{ margin: 0, fontSize: 'var(--font-size-xl)' }}>Launch {gameTitle}</h2>
          <button
            type="button"
            className="ac-btn ac-btn--ghost"
            onClick={onClose}
            style={{ padding: 'var(--space-1) var(--space-2)' }}
          >
            ✕
          </button>
        </div>

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
                  onLaunchCoinsMatch?.()
                  onClose()
                }}
                style={{ width: '100%', justifyContent: 'flex-start', padding: 'var(--space-3)' }}
              >
                🪙 <strong style={{ marginLeft: 8 }}>Play with COINS</strong> — Fun Match (0% Rake Fee)
              </button>

              <button
                type="button"
                className="ac-btn"
                onClick={() => {
                  onLaunchDiamondsMatch?.()
                  onClose()
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
      </div>
    </div>
  )
}
