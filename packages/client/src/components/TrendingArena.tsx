import { useTranslation } from 'react-i18next'
import { GAME_COMPETITION_CERTIFICATIONS } from '@fugluck/shared'
import { useAuth } from '../auth/AuthContext'
import { gameFactories } from '../game-loader/gameFactories'
import { activeGames, navFilters } from '../mock/homeData'
import GameCard from './GameCard'
import { GamepadIcon, SearchIcon, TrophyIcon } from './icons'

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

  const certifiedGames = filteredGames.filter(
    (game) => GAME_COMPETITION_CERTIFICATIONS[game.id]?.testGelCompetition === 'LEVEL_3_CERTIFIED',
  )
  const casualGames = filteredGames.filter(
    (game) => GAME_COMPETITION_CERTIFICATIONS[game.id]?.testGelCompetition !== 'LEVEL_3_CERTIFIED',
  )

  return (
    <section id="arena-games" style={{ margin: '0 0 var(--space-8)' }}>
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

      {trimmedQuery && (
        <div className="ac-section-head">
          <h2 className="ac-section-title">Search Results: "{searchQuery}"</h2>
          {onClearSearch && (
            <button type="button" className="ac-btn ac-btn--ghost ac-btn--sm" onClick={onClearSearch}>
              Clear Search
            </button>
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
        <>
          {certifiedGames.length > 0 && (
            <div style={{ marginBottom: casualGames.length > 0 ? 'var(--space-8)' : 0 }}>
              <div className="ac-section-head">
                <div className="ac-section-title-group">
                  <TrophyIcon size={18} />
                  <h2 className="ac-section-title">Tournament Certified</h2>
                  <span className="ac-badge ac-badge--sandbox">Server-Authoritative</span>
                </div>
                <p className="ac-section-sub">
                  Eligible for Coins Knockout Tournaments &amp; live bracket competitions
                </p>
              </div>

              <div className="ac-spotlight-grid">
                {certifiedGames.map((game) => (
                  <GameCard
                    key={game.id}
                    gameId={game.id}
                    title={game.title}
                    engine={game.engine}
                    tagline={game.tagline}
                    certified
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
            </div>
          )}

          {casualGames.length > 0 && (
            <div>
              <div className="ac-section-head">
                <div className="ac-section-title-group">
                  <GamepadIcon size={18} />
                  <h2 className="ac-section-title">Practice &amp; Casual</h2>
                </div>
                <p className="ac-section-sub">
                  Solo practice, instant friend links, and casual Coins matchmaking
                </p>
              </div>

              <div className="ac-casual-grid">
                {casualGames.map((game) => (
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
            </div>
          )}
        </>
      )}
    </section>
  )
}
