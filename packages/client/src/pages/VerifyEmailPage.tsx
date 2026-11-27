import { useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'

type VerifyEmailPageProps = {
  onNavigateHome: () => void
  onNavigateLogin: () => void
}

export default function VerifyEmailPage({ onNavigateHome, onNavigateLogin }: VerifyEmailPageProps) {
  const { t } = useTranslation()
  const { verifyEmail, resendVerification, user } = useAuth()
  const [status, setStatus] = useState<'verifying' | 'success' | 'error' | 'idle'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [resendEmail, setResendEmail] = useState('')
  const [resendSuccessMessage, setResendSuccessMessage] = useState<string | null>(null)
  const [resending, setResending] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const urlToken = params.get('token')
    if (urlToken && urlToken.trim().length > 0) {
      setStatus('verifying')
      verifyEmail(urlToken.trim())
        .then(() => {
          setStatus('success')
        })
        .catch((err: any) => {
          setStatus('error')
          setErrorMessage(err?.message || t('verifyEmail.invalidToken'))
        })
    } else {
      setStatus('idle')
    }
  }, [])

  async function handleResend(e: FormEvent) {
    e.preventDefault()
    setResending(true)
    setResendSuccessMessage(null)
    setErrorMessage(null)
    try {
      const emailToUse = resendEmail.trim() || user?.email || undefined
      const msg = await resendVerification(emailToUse)
      setResendSuccessMessage(msg || t('verifyEmail.resendSent'))
    } catch (err: any) {
      setErrorMessage(err?.message || t('verifyEmail.resendFailed'))
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="ac-fullscreen-center">
      <div
        className="ac-panel"
        style={{
          width: '100%',
          maxWidth: 480,
          textAlign: 'center',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        }}
      >
        <h1 style={{ fontSize: 'var(--font-size-2xl)', margin: '0 0 var(--space-3)' }}>
          {status === 'success'
            ? t('verifyEmail.titleSuccess')
            : status === 'verifying'
              ? t('verifyEmail.titleVerifying')
              : status === 'error'
                ? t('verifyEmail.titleError')
                : t('verifyEmail.titleIdle')}
        </h1>

        {status === 'verifying' && (
          <p className="ac-text-muted" style={{ margin: 'var(--space-4) 0' }}>
            {t('verifyEmail.verifyingBody')}
          </p>
        )}

        {status === 'success' && (
          <div>
            <p style={{ color: 'var(--color-success, #00ff88)', margin: 'var(--space-4) 0 var(--space-6)' }}>
              {t('verifyEmail.successBody')}
            </p>
            <button
              onClick={onNavigateHome}
              className="ac-btn ac-btn--primary"
              style={{ width: '100%', padding: 'var(--space-3)' }}
            >
              {t('verifyEmail.enterArena')}
            </button>
          </div>
        )}

        {status === 'error' && (
          <div>
            <p style={{ color: 'var(--color-danger, #ff4444)', margin: 'var(--space-3) 0 var(--space-6)' }}>
              {errorMessage}
            </p>

            <div
              style={{
                borderTop: '1px solid var(--color-border)',
                paddingTop: 'var(--space-5)',
                marginTop: 'var(--space-4)',
                textAlign: 'left',
              }}
            >
              <h3 style={{ margin: '0 0 var(--space-3)', fontSize: 'var(--font-size-base)' }}>
                {t('verifyEmail.requestNewTitle')}
              </h3>
              <form onSubmit={handleResend} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                <input
                  type="email"
                  placeholder={t('verifyEmail.emailPlaceholder')}
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  defaultValue={user?.email || ''}
                  style={inputStyle}
                  required
                />
                <button type="submit" className="ac-btn ac-btn--secondary" disabled={resending}>
                  {resending ? t('verifyEmail.sending') : t('verifyEmail.resendBtn')}
                </button>
              </form>
              {resendSuccessMessage && (
                <p style={{ color: 'var(--color-success, #00ff88)', fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-3)' }}>
                  {resendSuccessMessage}
                </p>
              )}
            </div>

            <div style={{ marginTop: 'var(--space-6)' }}>
              <button
                onClick={onNavigateHome}
                className="ac-link--secondary"
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                {t('verifyEmail.returnHome')}
              </button>
            </div>
          </div>
        )}

        {status === 'idle' && (
          <div>
            <p className="ac-text-muted" style={{ margin: 'var(--space-4) 0 var(--space-6)' }}>
              {t('verifyEmail.idlePrompt')}
            </p>

            <form onSubmit={handleResend} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <input
                type="email"
                placeholder={t('verifyEmail.emailPlaceholder')}
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                defaultValue={user?.email || ''}
                style={inputStyle}
                required
              />
              <button type="submit" className="ac-btn ac-btn--primary" disabled={resending}>
                {resending ? t('verifyEmail.sending') : t('verifyEmail.sendBtn')}
              </button>
            </form>

            {resendSuccessMessage && (
              <p style={{ color: 'var(--color-success, #00ff88)', fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-3)' }}>
                {resendSuccessMessage}
              </p>
            )}

            <div style={{ marginTop: 'var(--space-6)', display: 'flex', justifyContent: 'center', gap: 'var(--space-4)' }}>
              <button
                onClick={onNavigateHome}
                className="ac-link--secondary"
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                {t('verifyEmail.returnHome')}
              </button>
              <button
                onClick={onNavigateLogin}
                className="ac-link--secondary"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-accent, #2de2ff)' }}
              >
                {t('verifyEmail.logIn')}
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
