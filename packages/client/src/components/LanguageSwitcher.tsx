import { useTranslation } from 'react-i18next'
import { SUPPORTED_LANGUAGES, type SupportedLanguageCode } from '../i18n'

export default function LanguageSwitcher() {
  const { i18n } = useTranslation()
  const currentLang = (i18n.language || 'en').slice(0, 2) as SupportedLanguageCode

  function handleLanguageChange(code: SupportedLanguageCode) {
    void i18n.changeLanguage(code)
  }

  return (
    <div
      aria-label="Select language"
      role="region"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        background: 'var(--color-surface-raised, rgba(255, 255, 255, 0.05))',
        padding: '3px 4px',
        borderRadius: 'var(--radius-full, 9999px)',
        border: '1px solid var(--color-border)',
      }}
    >
      {SUPPORTED_LANGUAGES.map((lang) => {
        const isActive = currentLang === lang.code
        return (
          <button
            key={lang.code}
            type="button"
            onClick={() => handleLanguageChange(lang.code)}
            aria-pressed={isActive}
            className={`ac-pill${isActive ? ' ac-pill--active' : ''}`}
            style={{
              padding: '2px 8px',
              fontSize: 'var(--font-size-xs, 12px)',
              fontWeight: isActive ? 'var(--font-weight-bold, 700)' : 'normal',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              border: isActive ? '1px solid var(--color-primary)' : '1px solid transparent',
              background: isActive ? 'var(--color-primary-hover, rgba(124, 58, 237, 0.3))' : 'transparent',
              color: isActive ? '#fff' : 'var(--color-text-muted)',
            }}
          >
            {lang.label}
          </button>
        )
      })}
    </div>
  )
}
