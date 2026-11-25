import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'
import { gameFactories } from '../game-loader/gameFactories'
import { activeGames, navFilters } from '../mock/homeData'
import GameCard from './GameCard'
import { SearchIcon, TrendingIcon } from './icons'

type TrendingArenaProps = {
  onPlayGame: (id: string, title: string) => void
  onFindOpponent: (id: string, title: string, stake?: number, currency?: 'COINS') => void
  onLaunchGuestInvite?: (id: string, title: string) => void
  onOpenCompetitions?: (id: string, title: string) => void
  loadingGameId: string | null
  selectedCategory?: string
  onSelectCategory?: (category: string) => void
  searchQuery?: string
  onSearchChange?: (query: string) => void
  onClearSearch?: () => void
}

export default function TrendingArena({
  onPlayGame,
  onFindOpponent,
  onLaunchGuestInvite,
  onOpenCompetitions,
  loadingGameId,
  selectedCategory = 'all',
  onSelectCategory,
  searchQuery = '',
  onSearchChange,
  onClearSearch,
}: TrendingArenaProps) {
  const { t } = useTranslation()
  const { user } = useAuth()

  const trimmedQuery = searchQuery.trim().toLowerCase()

  const filteredGames = activeGames.filter((game) => {
    const categoryMatches =
      !selectedCategory ||
      selectedCategory.toLowerCase() === 'all' ||
      game.engine.toLowerCase() === selectedCategory.toLowerCase()
    if (!categoryMatches) return false

    if (trimmedQuery) {
      const titleMatches = game.title.toLowerCase().includes(trimmedQuery)
      const engineMatches = game.engine.toLowerCase().includes(trimmedQuery)
      const taglineMatches = game.tagline?.toLowerCase().includes(trimmedQuery)
      return Boolean(titleMatches || engineMatches || taglineMatches)
    }

    return true
  })

  return (
    <section style={{ margin: '0 0 var(--space-8)' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-3)',
          marginBottom: 'var(--space-4)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <TrendingIcon className="ac-text-muted" />
          <h2 style={{ fontSize: 'var(--font-size-xl)', margin: 0 }}>
            {trimmedQuery ? `Search Results: "${searchQuery}"` : 'Active Arena Games'}
          </h2>
        </div>
        {trimmedQuery && onClearSearch && (
          <button
            type="button"
            className="ac-btn ac-btn--ghost ac-btn--sm"
            onClick={onClearSearch}
          >
            Clear Search
          </button>
        )}
      </div>

      {(onSelectCategory || onSearchChange) && (
        <div className="ac-arena-toolbar" role="region" aria-label="Filter and search games">
          {onSelectCategory && (
            <div className="ac-arena-toolbar__filters" role="group" aria-label="Game genres">
              {navFilters.map((f) => {
                const isActive = selectedCategory.toLowerCase() === f.engine.toLowerCase()
                return (
                  <button
                    key={f.label}
                    type="button"
                    aria-pressed={isActive}
                    className={`ac-pill${isActive ? ' ac-pill--active' : ''}`}
                    onClick={() => onSelectCategory(f.engine)}
                  >
                    {f.label}
                  </button>
                )
              })}
            </div>
          )}

          {onSearchChange && (
            <label className="ac-search ac-arena-toolbar__search">
              <SearchIcon size={15} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={t('common.search', { defaultValue: 'Search games…' })}
                style={{ paddingRight: searchQuery ? '28px' : undefined }}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="ac-arena-toolbar__clear"
                  onClick={() => onSearchChange('')}
                  title={t('common.clearSearch', { defaultValue: 'Clear search' })}
                  aria-label={t('common.clearSearch', { defaultValue: 'Clear search' })}
                >
                  ✕
                </button>
              )}
            </label>
          )}
        </div>
      )}

      {filteredGames.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: 'var(--space-8)',
            background: 'var(--color-surface)',
            border: '1px dashed var(--color-border-strong)',
            borderRadius: 'var(--radius-lg)',
            color: 'var(--color-text-muted)',
            fontSize: 'var(--font-size-md)',
          }}
        >
          {trimmedQuery ? (
            <div>
              <p style={{ margin: '0 0 var(--space-3)' }}>No games found matching "{searchQuery}".</p>
              {onClearSearch && (
                <button type="button" className="ac-btn ac-btn--primary" onClick={onClearSearch}>
                  Clear Search
                </button>
              )}
            </div>
          ) : (
            <p style={{ margin: 0 }}>No active games found in this category.</p>
          )}
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))',
            gap: 'var(--space-5)',
          }}
        >
          {filteredGames.map((game) => (
            <GameCard
              key={game.id}
              gameId={game.id}
              title={game.title}
              engine={game.engine}
              tagline={game.tagline}
              loading={loadingGameId === game.id}
              onPlay={game.id in gameFactories ? () => onPlayGame(game.id, game.title) : undefined}
              onFindOpponent={
                user && game.id in gameFactories
                  ? (stake, currency) => onFindOpponent(game.id, game.title, stake, currency)
                  : undefined
              }
              onLaunchGuestInvite={
                game.id in gameFactories
                  ? () => onLaunchGuestInvite?.(game.id, game.title)
                  : undefined
              }
              onOpenCompetitions={
                onOpenCompetitions ? () => onOpenCompetitions(game.id, game.title) : undefined
              }
            />
          ))}
        </div>
      )}
    </section>
  )
}
