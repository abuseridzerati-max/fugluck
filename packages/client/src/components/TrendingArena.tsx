import { useAuth } from '../auth/AuthContext'
import { gameFactories } from '../game-loader/gameFactories'
import { trendingGames } from '../mock/homeData'
import GameCard from './GameCard'
import { TrendingIcon } from './icons'

type TrendingArenaProps = {
  onPlayGame: (id: string, title: string) => void
  onFindOpponent: (id: string, title: string, stake?: number, currency?: 'COINS' | 'DIAMONDS') => void
  loadingGameId: string | null
  selectedCategory?: string
}

export default function TrendingArena({
  onPlayGame,
  onFindOpponent,
  loadingGameId,
  selectedCategory = 'all',
}: TrendingArenaProps) {
  const { user } = useAuth()

  const filteredGames =
    !selectedCategory || selectedCategory.toLowerCase() === 'all' || selectedCategory.toLowerCase() === 'hot'
      ? trendingGames
      : trendingGames.filter((game) => game.engine.toLowerCase() === selectedCategory.toLowerCase())

  return (
    <section style={{ margin: '0 var(--space-6) var(--space-8)' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--space-5)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <TrendingIcon className="ac-text-muted" />
          <h2 style={{ fontSize: 'var(--font-size-xl)', margin: 0 }}>Trending Arena</h2>
        </div>
      </div>

      {filteredGames.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: 'var(--space-8)',
            background: 'var(--color-bg-subtle)',
            border: '1px dashed var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            color: 'var(--color-text-muted)',
            fontSize: 'var(--font-size-md)',
          }}
        >
          No active games found in this category. Click "All" to view all games!
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 'var(--space-5)',
          }}
        >
          {filteredGames.map((game) => (
            <GameCard
              key={game.id}
              title={game.title}
              engine={game.engine}
              plays={game.plays}
              rating={game.rating}
              loading={loadingGameId === game.id}
              onPlay={game.id in gameFactories ? () => onPlayGame(game.id, game.title) : undefined}
              onFindOpponent={
                user && game.id in gameFactories
                  ? (stake, currency) => onFindOpponent(game.id, game.title, stake, currency)
                  : undefined
              }
            />
          ))}
        </div>
      )}
    </section>
  )
}
