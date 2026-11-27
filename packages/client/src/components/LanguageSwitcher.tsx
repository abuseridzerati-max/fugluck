import { useEffect, useRef, useState, useId } from 'react'
import { useTranslation } from 'react-i18next'
import { SUPPORTED_LANGUAGES, type SupportedLanguageCode } from '../i18n'
import { LanguageFlag } from './FlagIcons'

export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation()
  const currentLang = (i18n.language || 'en').slice(0, 2) as SupportedLanguageCode
  const [isOpen, setIsOpen] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState<number>(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLUListElement>(null)
  const listboxId = useId()

  const currentOption = SUPPORTED_LANGUAGES.find((lang) => lang.code === currentLang) || SUPPORTED_LANGUAGES[0]

  function handleLanguageChange(code: SupportedLanguageCode) {
    void i18n.changeLanguage(code)
    setIsOpen(false)
    buttonRef.current?.focus()
  }

  // Handle outside clicks to close dropdown
  useEffect(() => {
    if (!isOpen) return

    function handlePointerDown(e: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
    }
  }, [isOpen])

  // Keyboard navigation
  function handleKeyDown(e: React.KeyboardEvent) {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        setIsOpen(true)
        const currentIndex = SUPPORTED_LANGUAGES.findIndex((lang) => lang.code === currentLang)
        setFocusedIndex(currentIndex >= 0 ? currentIndex : 0)
      }
      return
    }

    switch (e.key) {
      case 'Escape':
        e.preventDefault()
        setIsOpen(false)
        buttonRef.current?.focus()
        break
      case 'ArrowDown':
        e.preventDefault()
        setFocusedIndex((prev) => (prev + 1) % SUPPORTED_LANGUAGES.length)
        break
      case 'ArrowUp':
        e.preventDefault()
        setFocusedIndex((prev) => (prev - 1 + SUPPORTED_LANGUAGES.length) % SUPPORTED_LANGUAGES.length)
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        if (focusedIndex >= 0 && focusedIndex < SUPPORTED_LANGUAGES.length) {
          handleLanguageChange(SUPPORTED_LANGUAGES[focusedIndex].code)
        }
        break
      case 'Tab':
        setIsOpen(false)
        break
    }
  }

  return (
    <div
      ref={containerRef}
      onKeyDown={handleKeyDown}
      className="ac-lang"
    >
      <button
        ref={buttonRef}
        type="button"
        className="ac-lang__btn"
        onClick={() => {
          setIsOpen((prev) => !prev)
          if (!isOpen) {
            const currentIndex = SUPPORTED_LANGUAGES.findIndex((lang) => lang.code === currentLang)
            setFocusedIndex(currentIndex >= 0 ? currentIndex : 0)
          }
        }}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listboxId : undefined}
        aria-label={t('navigation.selectLanguage', { defaultValue: 'Select language' })}
        title={currentOption.label}
      >
        <LanguageFlag code={currentLang} width={18} height={12} />
        <svg
          width="10"
          height="6"
          viewBox="0 0 10 6"
          fill="none"
          aria-hidden="true"
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s ease',
            color: 'var(--color-text-muted)',
          }}
        >
          <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {isOpen && (
        <ul
          id={listboxId}
          ref={menuRef}
          role="listbox"
          className="ac-lang__menu"
          aria-label={t('navigation.selectLanguage', { defaultValue: 'Select language' })}
        >
          {SUPPORTED_LANGUAGES.map((lang, index) => {
            const isSelected = currentLang === lang.code
            const isFocused = focusedIndex === index

            return (
              <li
                key={lang.code}
                role="option"
                aria-selected={isSelected}
                onClick={() => handleLanguageChange(lang.code)}
                onMouseEnter={() => setFocusedIndex(index)}
                className={`ac-lang__option${isSelected ? ' ac-lang__option--selected' : isFocused ? ' ac-lang__option--focused' : ''}`}
              >
                <LanguageFlag code={lang.code} width={18} height={12} />
                <span style={{ flex: 1, whiteSpace: 'nowrap' }}>{lang.label}</span>
                {isSelected && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M20 6L9 17L4 12"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
