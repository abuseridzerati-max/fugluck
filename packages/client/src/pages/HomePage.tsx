import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import AuthModal from '../components/AuthModal'
import LiveQueueList from '../components/LiveQueueList'
import Navbar from '../components/Navbar'
import TrendingArena from '../components/TrendingArena'

type HomePageProps = {
  onPlayGame: (id: string, title: string) => void
  onFindOpponent: (id: string, title: string, stake?: number, currency?: 'COINS' | 'DIAMONDS') => void
  onLaunchGuestInvite?: (id: string, title: string) => void
  loadingGameId: string | null
  onNavigateProfile: () => void
  onNavigateFriends: () => void
  initialAuthModalMode?: 'login' | 'signup'
}

export default function HomePage({
  onPlayGame,
  onFindOpponent,
  onLaunchGuestInvite,
  loadingGameId,
  onNavigateProfile,
  onNavigateFriends,
  initialAuthModalMode,
}: HomePageProps) {
  const { user } = useAuth()
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup' | null>(initialAuthModalMode ?? null)

  useEffect(() => {
    if (user) setAuthModalMode(null)
  }, [user])

  return (
    <>
      <Navbar
        onNavigateHome={() => setSelectedCategory('all')}
        onNavigateProfile={onNavigateProfile}
        onNavigateFriends={onNavigateFriends}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
      />
      <main style={{ maxWidth: 1400, margin: '0 auto', padding: 'var(--space-6) var(--space-4)' }}>
        <LiveQueueList onFindOpponent={onFindOpponent} />
        <TrendingArena
          onPlayGame={onPlayGame}
          onFindOpponent={onFindOpponent}
          onLaunchGuestInvite={onLaunchGuestInvite}
          loadingGameId={loadingGameId}
          selectedCategory={selectedCategory}
        />
      </main>
      {authModalMode && <AuthModal initialMode={authModalMode} onClose={() => setAuthModalMode(null)} />}
    </>
  )
}
