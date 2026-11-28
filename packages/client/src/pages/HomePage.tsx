import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'
import AuthModal from '../components/AuthModal'
import Footer from '../components/Footer'
import LiveQueueList from '../components/LiveQueueList'
import Navbar from '../components/Navbar'
import RecentWinnersFeed from '../components/RecentWinnersFeed'
import TrendingArena from '../components/TrendingArena'
import { CoinIcon } from '../components/icons'

type HomePageProps = {
  onFindOpponent: (id: string, title: string, stake?: number, currency?: 'COINS') => void
  onOpenCompetitions: (id: string, title: string) => void
  loadingGameId: string | null
  onNavigateProfile: () => void
  onNavigateFriends: () => void
  onNavigateWallet?: () => void
  onNavigateLeaderboards?: () => void
  onNavigatePolicy?: (path: string) => void
  initialAuthModalMode?: 'login' | 'signup'
}

export default function HomePage({
  onFindOpponent,
  onOpenCompetitions,
  loadingGameId,
  onNavigateProfile,
  onNavigateFriends,
  onNavigateWallet,
  onNavigateLeaderboards,
  onNavigatePolicy,
  initialAuthModalMode,
}: HomePageProps) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup' | null>(initialAuthModalMode ?? null)

  useEffect(() => {
    if (user) setAuthModalMode(null)
  }, [user])

  return (
    <div className="ac-shell">
      <Navbar
        activePage="home"
        onNavigateHome={() => {
          setSelectedCategory('all')
          setSearchQuery('')
        }}
        onNavigateProfile={onNavigateProfile}
        onNavigateFriends={onNavigateFriends}
        onNavigateWallet={onNavigateWallet}
        onNavigateLeaderboards={onNavigateLeaderboards}
      />
      <main className="ac-main">
        {!user && (
          <div className="ac-guest-banner" role="region" aria-label={t('onboarding.guestCoinsCallout', { defaultValue: 'Sign up free — start with 1,000 COINS' })}>
            <div className="ac-guest-banner__copy">
              <span className="ac-badge ac-badge--coins">
                <CoinIcon size={13} />
                <span>{t('onboarding.guestCoinsCallout', { defaultValue: 'Sign up free — start with 1,000 COINS' })}</span>
              </span>
            </div>
            <div className="ac-guest-banner__actions">
              <button
                type="button"
                className="ac-btn ac-btn--primary ac-btn--sm"
                onClick={() => setAuthModalMode('signup')}
              >
                {t('navigation.signup', { defaultValue: 'Sign up' })}
              </button>
              <a href="#arena-games" className="ac-btn ac-btn--ghost ac-btn--sm" style={{ textDecoration: 'none' }}>
                {t('home.browseGames', { defaultValue: 'Browse Games' })}
              </a>
            </div>
          </div>
        )}
        <LiveQueueList onFindOpponent={onFindOpponent} />
        <RecentWinnersFeed limit={6} hideWhenEmpty />
        <TrendingArena
          onOpenCompetitions={onOpenCompetitions}
          loadingGameId={loadingGameId}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onClearSearch={() => setSearchQuery('')}
        />
      </main>
      <Footer onNavigate={onNavigatePolicy ?? (() => {})} />
      {authModalMode && <AuthModal initialMode={authModalMode} onClose={() => setAuthModalMode(null)} />}
    </div>
  )
}
