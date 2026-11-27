import { useTranslation } from 'react-i18next'
import { getAvailableGenres } from '@fugluck/shared'
import { useAuth } from '../auth/AuthContext'
import { CLIENT_GAME_PLUGIN_LIST } from '../games/registry'
import { engineLabel } from '../lib/format'
import { usePersonalBests } from '../lib/usePersonalBests'
import GameCard from './GameCard'
import { GamepadIcon, SearchIcon, TrophyIcon } from './icons'

type TrendingArenaProps = {
  onPlayGame: (id: string, title: string) => void
  onFindOpponent: (id: string, title: string, stake?: number, currency?: 'COINS') => void
  onLaunchGuestInvite?: (id: string, title: string) => void
  onOpenCompetitions?: (id: string, title: string) => void
  onNavigateCompetitions?: () => void
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
  const { bests } = usePersonalBests()

  const trimmedQuery = searchQuery.trim().toLowerCase()

  const genreFilters = [
    { label: 'All', genre: 'all' as const },
    ...getAvailableGenres().map((genre) => ({ label: engineLabel(genre), genre })),
  ]

  const filteredPlugins = CLIENT_GAME_PLUGIN_LIST.filter(({ manifest }) => {
    const categoryMatches =
      !selectedCategory ||
      selectedCategory.toLowerCase() === 'all' ||
      manifest.genre.toLowerCase() === selectedCategory.toLowerCase()
    if (!categoryMatches) return false

    if (trimmedQuery) {
      const titleMatches = manifest.title.toLowerCase().includes(trimmedQuery)
      const genreMatches = manifest.genre.toLowerCase().includes(trimmedQuery)
      const taglineMatches = manifest.tagline.toLowerCase().includes(trimmedQuery)
      return Boolean(titleMatches || genreMatches || taglineMatches)
    }

    return true
  })

  const certifiedPlugins = filteredPlugins.filter(({ manifest }) => manifest.certified)
  const casualPlugins = filteredPlugins.filter(({ manifest }) => !manifest.certified)

  return (
    <section id="arena-games" style={{ margin: '0 0 var(--space-8)' }}>
      {(onSelectCategory || onSearchChange) && (
        <div className="ac-arena-toolbar" role="region" aria-label="Filter and search games">
          {onSelectCategory && (
            <div className="ac-arena-toolbar__filters" role="group" aria-label="Game genres">
              {genreFilters.map((f) => {
                const isActive = selectedCategory.toLowerCase() === f.genre.toLowerCase()
                return (
                  <button
                    key={f.genre}
                    type="button"
                    aria-pressed={isActive}
                    className={`ac-pill${isActive ? ' ac-pill--active' : ''}`}
                    onClick={() => onSelectCategory(f.genre)}
                  >
                    {t(`home.filters.${f.genre}`, { defaultValue: f.label })}
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
          <h2 className="ac-section-title">{t('home.searchResults', { query: searchQuery })}</h2>
          {onClearSearch && (
            <button type="button" className="ac-btn ac-btn--ghost ac-btn--sm" onClick={onClearSearch}>
              {t('common.clearSearch')}
            </button>
          )}
        </div>
      )}

      {filteredPlugins.length === 0 ? (
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
              <p style={{ margin: '0 0 var(--space-3)' }}>{t('home.noSearchResults', { query: searchQuery })}</p>
              {onClearSearch && (
                <button type="button" className="ac-btn ac-btn--primary" onClick={onClearSearch}>
                  {t('common.clearSearch')}
                </button>
              )}
            </div>
          ) : (
            <p style={{ margin: 0 }}>{t('home.noCategoryResults')}</p>
          )}
        </div>
      ) : (
        <>
          {certifiedPlugins.length > 0 && (
            <div style={{ marginBottom: casualPlugins.length > 0 ? 'var(--space-6)' : 0 }}>
              <div className="ac-section-head">
                <div className="ac-section-title-group">
                  <TrophyIcon size={16} />
                  <h2 className="ac-section-title">{t('home.tournamentCertified')}</h2>
                  <span className="ac-badge ac-badge--sandbox">{t('home.fairPlayVerified')}</span>
                </div>
                <p className="ac-section-sub">
                  {t('home.certifiedSubtitle')}
                </p>
              </div>

              <div className="ac-game-grid ac-game-grid--certified">
                {certifiedPlugins.map(({ manifest }) => (
                  <GameCard
                    key={manifest.id}
                    gameId={manifest.id}
                    title={manifest.title}
                    engine={manifest.genre}
                    tagline={manifest.tagline}
                    thumbnailKey={manifest.thumbnail}
                    certified
                    personalBest={bests[manifest.id]}
                    loading={loadingGameId === manifest.id}
                    onPlay={() => onPlayGame(manifest.id, manifest.title)}
                    onFindOpponent={
                      user
                        ? (stake, currency) => onFindOpponent(manifest.id, manifest.title, stake, currency)
                        : undefined
                    }
                    onLaunchGuestInvite={() => onLaunchGuestInvite?.(manifest.id, manifest.title)}
                    onOpenCompetitions={
                      onOpenCompetitions ? () => onOpenCompetitions(manifest.id, manifest.title) : undefined
                    }
                  />
                ))}
              </div>
            </div>
          )}

          {casualPlugins.length > 0 && (
            <div>
              <div className="ac-section-head">
                <div className="ac-section-title-group">
                  <GamepadIcon size={18} />
                  <h2 className="ac-section-title">{t('home.practiceCasual')}</h2>
                </div>
                <p className="ac-section-sub">
                  {t('home.casualSubtitle')}
                </p>
              </div>

              <div className="ac-game-grid">
                {casualPlugins.map(({ manifest }) => (
                  <GameCard
                    key={manifest.id}
                    gameId={manifest.id}
                    title={manifest.title}
                    engine={manifest.genre}
                    tagline={manifest.tagline}
                    thumbnailKey={manifest.thumbnail}
                    personalBest={bests[manifest.id]}
                    loading={loadingGameId === manifest.id}
                    onPlay={() => onPlayGame(manifest.id, manifest.title)}
                    onFindOpponent={
                      user
                        ? (stake, currency) => onFindOpponent(manifest.id, manifest.title, stake, currency)
                        : undefined
                    }
                    onLaunchGuestInvite={() => onLaunchGuestInvite?.(manifest.id, manifest.title)}
                    onOpenCompetitions={
                      onOpenCompetitions ? () => onOpenCompetitions(manifest.id, manifest.title) : undefined
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
