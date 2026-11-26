import { useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'

type ResetPasswordPageProps = {
  onNavigateHome: () => void
  onNavigateLogin: () => void
}

export default function ResetPasswordPage({ onNavigateHome, onNavigateLogin }: ResetPasswordPageProps) {
  const { t } = useTranslation()
  const { resetPassword, forgotPassword } = useAuth()
  const [token, setToken] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Recovery request fallback if token is missing/expired
  const [requestEmail, setRequestEmail] = useState('')
  const [requestMessage, setRequestMessage] = useState<string | null>(null)
  const [requesting, setRequesting] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const urlToken = params.get('token')
    if (urlToken && urlToken.trim().length > 0) {
      setToken(urlToken.trim())
    } else {
      setToken(null)
    }
  }, [])

  const hasMinLength = password.length >= 8
  const hasLetter = /[a-zA-Z]/.test(password)
  const hasNumber = /[0-9]/.test(password)
  const passwordsMatch = password.length > 0 && password === confirmPassword
  const isPolicyValid = hasMinLength && hasLetter && hasNumber && passwordsMatch

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!token) {
      setError(t('resetPassword.missingToken'))
      return
    }
    if (!passwordsMatch) {
      setError(t('resetPassword.mismatch'))
      return
    }
    if (!hasMinLength || !hasLetter || !hasNumber) {
      setError(t('resetPassword.policyError'))
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      await resetPassword(token, password)
      setSuccess(true)
    } catch (err: any) {
      setError(err?.message || t('resetPassword.resetFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRequestNewLink(e: FormEvent) {
    e.preventDefault()
    if (!requestEmail.trim()) return
    setRequesting(true)
    setRequestMessage(null)
    try {
      const msg = await forgotPassword(requestEmail.trim())
      setRequestMessage(msg || t('resetPassword.linkSent'))
    } catch (err: any) {
      setError(err?.message || t('resetPassword.requestFailed'))
    } finally {
      setRequesting(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-6)',
        background: 'var(--color-bg)',
      }}
    >
      <div
        className="ac-panel"
        style={{
          width: '100%',
          maxWidth: 440,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        }}
      >
        {success ? (
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: 'var(--font-size-2xl)', margin: '0 0 var(--space-3)' }}>
              {t('resetPassword.completeTitle')}
            </h1>
            <p style={{ color: 'var(--color-success, #00ff88)', margin: 'var(--space-4) 0 var(--space-6)' }}>
              {t('resetPassword.completeBody')}
            </p>
            <button
              onClick={onNavigateLogin}
              className="ac-btn ac-btn--primary"
              style={{ width: '100%', padding: 'var(--space-3)' }}
            >
              {t('resetPassword.logInNow')}
            </button>
          </div>
        ) : token ? (
          <div>
            <h1 style={{ fontSize: 'var(--font-size-2xl)', margin: '0 0 var(--space-2)' }}>
              {t('resetPassword.chooseTitle')}
            </h1>
            <p className="ac-text-muted" style={{ margin: '0 0 var(--space-5)', fontSize: 'var(--font-size-sm)' }}>
              {t('resetPassword.chooseSubtitle')}
            </p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <span className="ac-text-muted" style={{ fontSize: 'var(--font-size-sm)' }}>
                  {t('resetPassword.newPassword')}
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoFocus
                  style={inputStyle}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <span className="ac-text-muted" style={{ fontSize: 'var(--font-size-sm)' }}>
                  {t('resetPassword.confirmPassword')}
                </span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  style={inputStyle}
                />
              </label>

              {/* Password Policy Hints */}
              <div
                style={{
                  background: 'var(--color-surface-sunken, rgba(0,0,0,0.2))',
                  padding: 'var(--space-3)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 'var(--font-size-xs)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                <div style={{ color: hasMinLength ? 'var(--color-success, #00ff88)' : 'var(--color-text-muted)' }}>
                  {hasMinLength ? '✓' : '○'} {t('resetPassword.ruleLength')}
                </div>
                <div style={{ color: hasLetter ? 'var(--color-success, #00ff88)' : 'var(--color-text-muted)' }}>
                  {hasLetter ? '✓' : '○'} {t('resetPassword.ruleLetter')}
                </div>
                <div style={{ color: hasNumber ? 'var(--color-success, #00ff88)' : 'var(--color-text-muted)' }}>
                  {hasNumber ? '✓' : '○'} {t('resetPassword.ruleNumber')}
                </div>
                <div style={{ color: passwordsMatch ? 'var(--color-success, #00ff88)' : 'var(--color-text-muted)' }}>
                  {passwordsMatch ? '✓' : '○'} {t('resetPassword.ruleMatch')}
                </div>
              </div>

              {error && (
                <p style={{ color: 'var(--color-danger, #ff4444)', fontSize: 'var(--font-size-sm)', margin: 0 }}>
                  {error}
                </p>
              )}

              <button
                type="submit"
                className="ac-btn ac-btn--primary"
                disabled={submitting || !isPolicyValid}
                style={{ padding: 'var(--space-3)' }}
              >
                {submitting ? t('resetPassword.updating') : t('resetPassword.saveBtn')}
              </button>
            </form>

            <div style={{ marginTop: 'var(--space-5)', textAlign: 'center' }}>
              <button
                onClick={onNavigateHome}
                className="ac-link--secondary"
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                {t('resetPassword.returnHome')}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: 'var(--font-size-2xl)', margin: '0 0 var(--space-2)' }}>
              {t('resetPassword.requestTitle')}
            </h1>
            <p className="ac-text-muted" style={{ margin: '0 0 var(--space-5)', fontSize: 'var(--font-size-sm)' }}>
              {t('resetPassword.requestSubtitle')}
            </p>

            <form
              onSubmit={handleRequestNewLink}
              style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', textAlign: 'left' }}
            >
              <input
                type="text"
                placeholder={t('resetPassword.emailOrUsername')}
                value={requestEmail}
                onChange={(e) => setRequestEmail(e.target.value)}
                required
                autoFocus
                style={inputStyle}
              />
              <button
                type="submit"
                className="ac-btn ac-btn--primary"
                disabled={requesting || !requestEmail.trim()}
                style={{ padding: 'var(--space-3)' }}
              >
                {requesting ? t('resetPassword.sending') : t('resetPassword.sendLinkBtn')}
              </button>
            </form>

            {requestMessage && (
              <p style={{ color: 'var(--color-success, #00ff88)', fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-4)' }}>
                {requestMessage}
              </p>
            )}

            {error && (
              <p style={{ color: 'var(--color-danger, #ff4444)', fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-4)' }}>
                {error}
              </p>
            )}

            <div style={{ marginTop: 'var(--space-6)' }}>
              <button
                onClick={onNavigateLogin}
                className="ac-link--secondary"
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                {t('resetPassword.backToLogin')}
              </button>
            </div>
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
}
