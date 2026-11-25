import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'
import AuthModal from '../components/AuthModal'
import Footer from '../components/Footer'
import LiveQueueList from '../components/LiveQueueList'
import Navbar from '../components/Navbar'
import TrendingArena from '../components/TrendingArena'
import { TrophyIcon } from '../components/icons'

type HomePageProps = {
  onPlayGame: (id: string, title: string) => void
  onFindOpponent: (id: string, title: string, stake?: number, currency?: 'COINS') => void
  onLaunchGuestInvite?: (id: string, title: string) => void
  onOpenCompetitions?: (id: string, title: string) => void
  loadingGameId: string | null
  onNavigateProfile: () => void
  onNavigateFriends: () => void
  onNavigateWallet?: () => void
  onNavigateCompetitions?: () => void
  onNavigatePolicy?: (path: string) => void
  initialAuthModalMode?: 'login' | 'signup'
}

export default function HomePage({
  onPlayGame,
  onFindOpponent,
  onLaunchGuestInvite,
  onOpenCompetitions,
  loadingGameId,
  onNavigateProfile,
  onNavigateFriends,
  onNavigateWallet,
  onNavigateCompetitions,
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
        onNavigateCompetitions={onNavigateCompetitions}
      />
      <main className="ac-main">
        <section className="ac-hero" aria-label="Fugluck Arena overview">
          <div className="ac-hero__content">
            <span className="ac-hero__eyebrow">Skill-Based Competitive Arena</span>
            <h1 className="ac-hero__title">Play Fast. Outscore Everyone.</h1>
            <p className="ac-hero__subtitle">
              Jump into server-authoritative Coins Knockout Tournaments or sharpen your reflexes in instant 1v1 and solo practice games.
            </p>
          </div>
          <div className="ac-hero__actions">
            {onNavigateCompetitions && (
              <button
                type="button"
                className="ac-btn ac-btn--primary"
                onClick={onNavigateCompetitions}
              >
                <TrophyIcon size={15} />
                <span>{t('competition.title')}</span>
              </button>
            )}
            <a href="#arena-games" className="ac-btn ac-btn--ghost" style={{ textDecoration: 'none' }}>
              Browse Games
            </a>
          </div>
        </section>

        <LiveQueueList onFindOpponent={onFindOpponent} />
        <TrendingArena
          onPlayGame={onPlayGame}
          onFindOpponent={onFindOpponent}
          onLaunchGuestInvite={onLaunchGuestInvite}
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
