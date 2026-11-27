import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'
import { canViewSandboxGelUi } from '../lib/sandboxVisibility'
import AuthModal from './AuthModal'
import Avatar from './Avatar'
import LanguageSwitcher from './LanguageSwitcher'
import { BrandMarkIcon, CoinIcon, GamepadIcon, HistoryIcon, TrophyIcon } from './icons'

type NavbarProps = {
  onNavigateHome: () => void
  onNavigateProfile: () => void
  onNavigateFriends?: () => void
  onNavigateWallet?: () => void
  onNavigateCompetitions?: () => void
  onNavigateLeaderboards?: () => void
  onNavigateHistory?: () => void
  activePage?: 'home' | 'competitions' | 'leaderboards' | 'wallet' | 'profile' | 'friends' | 'history'
}

export default function Navbar({
  onNavigateHome,
  onNavigateProfile,
  onNavigateFriends,
  onNavigateWallet,
  onNavigateCompetitions,
  onNavigateLeaderboards,
  onNavigateHistory,
  activePage,
}: NavbarProps) {
  const { t } = useTranslation()
  const { user, logOut } = useAuth()
  const showSandboxGel = canViewSandboxGelUi(user)
  const [menuOpen, setMenuOpen] = useState(false)
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup' | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    function handleOutside(e: MouseEvent | TouchEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('touchstart', handleOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('touchstart', handleOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [menuOpen])

  return (
    <header className="ac-nav">
      <nav className="ac-nav__inner" aria-label="Primary navigation">
        <div className="ac-nav__left">
          <button type="button" className="ac-nav__brand" onClick={onNavigateHome}>
            <span className="ac-nav__brand-mark" aria-hidden="true">
              <BrandMarkIcon size={16} />
            </span>
            <span>Fugluck</span>
          </button>

          <div className="ac-nav__links">
            <button
              type="button"
              className={`ac-nav__link${activePage === 'home' ? ' ac-nav__link--active' : ''}`}
              onClick={onNavigateHome}
            >
              <GamepadIcon size={15} />
              <span>{t('navigation.home')}</span>
            </button>

            {onNavigateCompetitions && (
              <button
                type="button"
                className={`ac-nav__link ac-nav__link--accent${activePage === 'competitions' ? ' ac-nav__link--active' : ''}`}
                onClick={onNavigateCompetitions}
              >
                <TrophyIcon size={15} />
                <span>{t('competition.title')}</span>
              </button>
            )}

            {onNavigateLeaderboards && (
              <button
                type="button"
                className={`ac-nav__link${activePage === 'leaderboards' ? ' ac-nav__link--active' : ''}`}
                onClick={onNavigateLeaderboards}
              >
                <span>{t('leaderboards.title', { defaultValue: 'Leaderboards' })}</span>
              </button>
            )}
          </div>
        </div>

        <div className="ac-nav__right">
          {user && (
            <button
              type="button"
              className="ac-nav__balances"
              onClick={onNavigateWallet}
              disabled={!onNavigateWallet}
              title={t('navigation.coinsTooltip')}
            >
              <span className="ac-nav__balance-chip">
                <CoinIcon size={14} />
                <span>{user.balances.coins.toLocaleString()}</span>
                <span className="ac-nav__balance-unit">{t('common.coins').toLowerCase()}</span>
              </span>

              {showSandboxGel && (
                <span
                  className="ac-nav__sandbox-chip"
                  title="TEST / SANDBOX GEL — Simulated test funds, no real money used"
                  aria-label={`TEST / SANDBOX GEL: TEST ₾${((user.balances.sandboxGelMinor ?? 0) / 100).toFixed(2)}`}
                >
                  TEST ₾{((user.balances.sandboxGelMinor ?? 0) / 100).toFixed(2)}
                </span>
              )}
            </button>
          )}

          <LanguageSwitcher />

          {user ? (
            <div ref={menuRef} style={{ position: 'relative' }}>
              <button
                type="button"
                className="ac-nav__avatar-btn"
                aria-label={t('navigation.accountMenu')}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                onClick={() => setMenuOpen((open) => !open)}
              >
                <Avatar username={user.username} size={34} />
              </button>

              {menuOpen && (
                <div className="ac-nav__dropdown" role="menu">
                  <div className="ac-nav__dropdown-header">
                    <div className="ac-nav__dropdown-name">{user.username}</div>
                  </div>
                  <MenuItem
                    label={t('navigation.profile')}
                    onClick={() => {
                      setMenuOpen(false)
                      onNavigateProfile()
                    }}
                  />
                  <MenuItem
                    label={t('navigation.history')}
                    icon={<HistoryIcon size={14} />}
                    onClick={() => {
                      setMenuOpen(false)
                      if (onNavigateHistory) {
                        onNavigateHistory()
                      } else {
                        window.history.pushState(null, '', '/history')
                        window.dispatchEvent(new PopStateEvent('popstate'))
                      }
                    }}
                  />
                  {onNavigateWallet && (
                    <MenuItem
                      label={t('navigation.wallet', { defaultValue: 'Wallet & Sandbox' })}
                      onClick={() => {
                        setMenuOpen(false)
                        onNavigateWallet()
                      }}
                    />
                  )}
                  {onNavigateCompetitions && (
                    <MenuItem
                      label={t('competition.title')}
                      onClick={() => {
                        setMenuOpen(false)
                        onNavigateCompetitions()
                      }}
                    />
                  )}
                  {onNavigateFriends && (
                    <MenuItem
                      label={t('navigation.friends')}
                      onClick={() => {
                        setMenuOpen(false)
                        onNavigateFriends()
                      }}
                    />
                  )}
                  <MenuItem
                    label={t('navigation.logout')}
                    danger
                    onClick={() => {
                      setMenuOpen(false)
                      logOut()
                    }}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="ac-nav__auth">
              <button
                type="button"
                className="ac-btn ac-btn--ghost ac-btn--sm"
                onClick={() => setAuthModalMode('login')}
              >
                {t('navigation.login')}
              </button>
              <button
                type="button"
                className="ac-btn ac-btn--primary ac-btn--sm"
                onClick={() => setAuthModalMode('signup')}
              >
                {t('navigation.signup')}
              </button>
            </div>
          )}
        </div>
      </nav>

      {authModalMode && <AuthModal initialMode={authModalMode} onClose={() => setAuthModalMode(null)} />}
    </header>
  )
}

function MenuItem({
  label,
  icon,
  onClick,
  danger = false,
}: {
  label: string
  icon?: ReactNode
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className={`ac-nav__menu-item${danger ? ' ac-nav__menu-item--danger' : ''}`}
      style={icon ? { display: 'flex', alignItems: 'center', gap: 8 } : undefined}
      onClick={onClick}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}
