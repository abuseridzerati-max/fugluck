import { useEffect, useId, useState, type CSSProperties, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'
import { CoinIcon } from './icons'

type AuthModalMode = 'login' | 'signup' | 'forgot-password'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type AuthModalProps = {
  initialMode: 'login' | 'signup'
  onClose: () => void
}

export default function AuthModal({ initialMode, onClose }: AuthModalProps) {
  const { t } = useTranslation()
  const passwordFieldId=useId()
  const { signUp, logIn, forgotPassword, error } = useAuth()
  const [mode, setMode] = useState<AuthModalMode>(initialMode)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')
  const [recoveryIdentifier, setRecoveryIdentifier] = useState('')
  const [agreeToTerms, setAgreeToTerms] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [infoMessage, setInfoMessage] = useState<string | null>(null)

  useEffect(() => {
    const prevTitle = document.title
    if (mode === 'signup') document.title = t('meta.titleSignup')
    else if (mode === 'login') document.title = t('meta.titleLogin')
    return () => {
      document.title = prevTitle
    }
  }, [mode, t])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setInfoMessage(null)
    try {
      if (mode === 'signup') {
        const trimmedEmail = email.trim()
        if (!trimmedEmail || !EMAIL_PATTERN.test(trimmedEmail)) {
          setInfoMessage(t('auth.emailRequired'))
          setSubmitting(false)
          return
        }
        if (!agreeToTerms) {
          setInfoMessage('You must agree to the Terms of Service and Privacy Policy.')
          setSubmitting(false)
          return
        }
        await signUp(username, password, trimmedEmail)
        onClose()
      } else if (mode === 'login') {
        await logIn(username, password)
        onClose()
      } else if (mode === 'forgot-password') {
        const msg = await forgotPassword(recoveryIdentifier.trim())
        setInfoMessage(msg || 'Password reset link sent if an account exists.')
      }
    } catch {
      // error is surfaced via useAuth().error
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={mode === 'signup' ? t('auth.signupTitle') : t('auth.loginTitle')}
      className="ac-modal-backdrop ac-modal-backdrop--high"
      onClick={onClose}
    >
      <div className="ac-panel ac-modal-panel" style={{ maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
        {mode === 'forgot-password' ? (
          <div>
            <h2 style={{ margin: '0 0 var(--space-2)' }}>Reset Password</h2>
            <p className="ac-text-muted" style={{ fontSize: 'var(--font-size-sm)', margin: '0 0 var(--space-4)' }}>
              Enter your email or username and we'll send you a link to reset your password.
            </p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <span className="ac-text-muted" style={{ fontSize: 'var(--font-size-sm)' }}>
                  Email or Username
                </span>
                <input
                  type="text"
                  value={recoveryIdentifier}
                  onChange={(e) => setRecoveryIdentifier(e.target.value)}
                  required
                  autoFocus
                  style={inputStyle}
                />
              </label>

              {infoMessage && (
                <p style={{ color: 'var(--color-success, #00ff88)', fontSize: 'var(--font-size-sm)', margin: 0 }}>
                  {infoMessage}
                </p>
              )}

              {error && (
                <p style={{ color: 'var(--color-danger, #ff4444)', fontSize: 'var(--font-size-sm)', margin: 0 }}>
                  {error}
                </p>
              )}

              <button
                type="submit"
                className="ac-btn ac-btn--primary"
                disabled={submitting || !recoveryIdentifier.trim()}
                style={{ padding: 'var(--space-3)' }}
              >
                {submitting ? t('common.pleaseWait') : 'Send Reset Link'}
              </button>
            </form>

            <button
              type="button"
              onClick={() => {
                setMode('login')
                setInfoMessage(null)
              }}
              className="ac-link--secondary"
              style={{ background: 'none', border: 'none', cursor: 'pointer', marginTop: 'var(--space-4)', padding: 0 }}
            >
              ← Back to Log In
            </button>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: mode === 'signup' ? 'var(--space-3)' : 'var(--space-5)' }}>
              <h2 style={{ margin: 0 }}>
                {mode === 'signup' ? t('auth.signupTitle') : t('auth.loginTitle')}
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label={t('common.close', { defaultValue: 'Close' })}
                className="ac-btn ac-btn--ghost"
                style={{ padding: 0, minWidth: 44, minHeight: 44, flexShrink: 0 }}
              >
                ×
              </button>
            </div>

            {mode === 'signup' && (
              <div className="ac-guest-coins-callout" style={{ marginBottom: 'var(--space-4)' }} role="note">
                <div className="ac-guest-coins-callout__text">
                  <CoinIcon size={15} />
                  <span>{t('onboarding.guestCoinsCallout', { defaultValue: 'Sign up free — start with 1,000 COINS' })}</span>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <span className="ac-text-muted" style={{ fontSize: 'var(--font-size-sm)' }}>
                  {t('auth.username')}
                </span>
                <input
                  name="username"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  minLength={3}
                  maxLength={20}
                  autoFocus
                  style={inputStyle}
                />
              </label>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label htmlFor={passwordFieldId} className="ac-text-muted" style={{ fontSize: 'var(--font-size-sm)' }}>
                    {t('auth.password')}
                  </label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => {
                        setMode('forgot-password')
                        setInfoMessage(null)
                      }}
                      className="ac-link--secondary"
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: 'var(--font-size-xs)',
                        padding: 0,
                        color: 'var(--color-secondary)',
                      }}
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <input
                  id={passwordFieldId}
                  name="password"
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  style={inputStyle}
                />
              </div>

              {mode === 'signup' && (
                <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  <span className="ac-text-muted" style={{ fontSize: 'var(--font-size-sm)' }}>
                    {t('auth.email')}
                  </span>
                  <input
                    name="email"
                    autoComplete="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    required
                    maxLength={255}
                    style={inputStyle}
                  />
                </label>
              )}

              {mode === 'signup' && (
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)', cursor: 'pointer', marginTop: 'var(--space-1)' }}>
                  <input
                    type="checkbox"
                    checked={agreeToTerms}
                    onChange={(e) => setAgreeToTerms(e.target.checked)}
                    required
                    style={{ marginTop: 3, accentColor: 'var(--color-primary, #00f0ff)', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                    I agree to the{' '}
                    <a
                      href="/terms"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'var(--color-accent, #2de2ff)', textDecoration: 'underline' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      Terms of Service
                    </a>{' '}
                    and acknowledge the{' '}
                    <a
                      href="/privacy"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'var(--color-accent, #2de2ff)', textDecoration: 'underline' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      Privacy Policy
                    </a>.
                  </span>
                </label>
              )}

              {infoMessage && (
                <p style={{ color: 'var(--color-accent, #2de2ff)', fontSize: 'var(--font-size-sm)', margin: 0 }}>
                  {infoMessage}
                </p>
              )}

              {error && (
                <p style={{ color: 'var(--color-danger, #ff4444)', fontSize: 'var(--font-size-sm)', margin: 0 }}>
                  {error}
                </p>
              )}

              <button
                type="submit"
                className="ac-btn ac-btn--primary"
                disabled={submitting || (mode === 'signup' && (!agreeToTerms || !email.trim()))}
                style={{
                  opacity: submitting || (mode === 'signup' && (!agreeToTerms || !email.trim())) ? 0.45 : 1,
                  cursor: submitting || (mode === 'signup' && (!agreeToTerms || !email.trim())) ? 'not-allowed' : 'pointer',
                }}
              >
                {submitting
                  ? t('common.pleaseWait')
                  : mode === 'signup'
                    ? t('auth.submitSignup')
                    : t('auth.submitLogin')}
              </button>
            </form>

            <button
              type="button"
              onClick={() => {
                setMode(mode === 'signup' ? 'login' : 'signup')
                setInfoMessage(null)
              }}
              className="ac-link--secondary"
              style={{ background: 'none', border: 'none', cursor: 'pointer', marginTop: 'var(--space-4)', padding: 0 }}
            >
              {mode === 'signup' ? t('auth.alreadyHaveAccount') : t('auth.dontHaveAccount')}
            </button>
          </div>
        )}
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
  width: '100%',
  boxSizing: 'border-box',
}
