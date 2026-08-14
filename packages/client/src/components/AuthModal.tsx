import { useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'

type AuthModalProps = {
  initialMode: 'login' | 'signup'
  onClose: () => void
}

export default function AuthModal({ initialMode, onClose }: AuthModalProps) {
  const { t } = useTranslation()
  const { signUp, logIn, error } = useAuth()
  const [mode, setMode] = useState(initialMode)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const prevTitle = document.title
    document.title = mode === 'signup' ? t('meta.titleSignup') : t('meta.titleLogin')
    return () => {
      document.title = prevTitle
    }
  }, [mode, t])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      if (mode === 'signup') {
        await signUp(username, password, email || undefined)
      } else {
        await logIn(username, password)
      }
      onClose()
    } catch {
      // error is surfaced via useAuth().error below
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(10,10,15,0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
      onClick={onClose}
    >
      <div className="ac-panel" style={{ width: 340 }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ margin: '0 0 var(--space-5)' }}>
          {mode === 'signup' ? t('auth.signupTitle') : t('auth.loginTitle')}
        </h2>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <span className="ac-text-muted" style={{ fontSize: 'var(--font-size-sm)' }}>
              {t('auth.username')}
            </span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={3}
              maxLength={20}
              autoFocus
              style={inputStyle}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <span className="ac-text-muted" style={{ fontSize: 'var(--font-size-sm)' }}>
              {t('auth.password')}
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              style={inputStyle}
            />
          </label>

          {mode === 'signup' && (
            <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <span className="ac-text-muted" style={{ fontSize: 'var(--font-size-sm)' }}>
                {t('auth.emailOptional')}
              </span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
            </label>
          )}

          {error && (
            <p style={{ color: 'var(--color-danger)', fontSize: 'var(--font-size-sm)', margin: 0 }}>{error}</p>
          )}

          <button type="submit" className="ac-btn ac-btn--primary" disabled={submitting}>
            {submitting
              ? t('common.pleaseWait')
              : mode === 'signup'
                ? t('auth.submitSignup')
                : t('auth.submitLogin')}
          </button>
        </form>

        <button
          type="button"
          onClick={() => setMode(mode === 'signup' ? 'login' : 'signup')}
          className="ac-link--secondary"
          style={{ background: 'none', border: 'none', cursor: 'pointer', marginTop: 'var(--space-4)', padding: 0 }}
        >
          {mode === 'signup' ? t('auth.alreadyHaveAccount') : t('auth.dontHaveAccount')}
        </button>
      </div>
    </div>
  )
}

const inputStyle: CSSProperties = {
  background: 'var(--color-surface-raised)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-sm)',
  padding: 'var(--space-3)',
  color: 'var(--color-text)',
  fontFamily: 'var(--font-sans)',
  fontSize: 'var(--font-size-base)',
}
