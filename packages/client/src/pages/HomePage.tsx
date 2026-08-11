import { useState } from 'react'
import Hero from '../components/Hero'
import LiveQueueList from '../components/LiveQueueList'
import Navbar from '../components/Navbar'
import TrendingArena from '../components/TrendingArena'

type HomePageProps = {
  onPlayGame: (id: string, title: string) => void
  onFindOpponent: (id: string, title: string, stake?: number, currency?: 'COINS' | 'DIAMONDS') => void
  loadingGameId: string | null
  onNavigateProfile: () => void
  onNavigateFriends: () => void
}

export default function HomePage({
  onPlayGame,
  onFindOpponent,
  loadingGameId,
  onNavigateProfile,
  onNavigateFriends,
}: HomePageProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  return (
    <>
      <Navbar
        onNavigateHome={() => setSelectedCategory('all')}
        onNavigateProfile={onNavigateProfile}
        onNavigateFriends={onNavigateFriends}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
      />
      <main style={{ maxWidth: 1400, margin: '0 auto', padding: '0 var(--space-4)' }}>
        <Hero onPlayGame={onPlayGame} />
        <LiveQueueList onFindOpponent={onFindOpponent} />
        <TrendingArena
          onPlayGame={onPlayGame}
          onFindOpponent={onFindOpponent}
          loadingGameId={loadingGameId}
          selectedCategory={selectedCategory}
        />
      </main>
    </>
  )
}
