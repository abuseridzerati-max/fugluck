import { useTranslation } from 'react-i18next'
import { getGameManifest, type GameGenre } from '@fugluck/shared'
import { categoryColors } from '@fugluck/theme'
import { engineLabel } from '../lib/format'
import GameArtwork from './GameArtwork'
import { TrophyIcon } from './icons'

type GameCardProps = {
  gameId: string
  title: string
  engine: GameGenre
  tagline?: string
  thumbnailKey?: string
  certified?: boolean
  personalBest?: number
  onOpenCompetitions?: () => void
  loading?: boolean
}

export default function GameCard({
  gameId,
  title,
  engine,
  tagline,
  thumbnailKey,
  certified,
  personalBest,
  onOpenCompetitions,
  loading,
}: GameCardProps) {
  const { t } = useTranslation()
  const manifest = getGameManifest(gameId)
  const isCertified = certified ?? manifest?.certified ?? false
  const tagColor = categoryColors[engine]
  const competitionsHref = `/games/${encodeURIComponent(gameId)}/competitions`

  return (
    <a
      href={competitionsHref}
      className={`ac-game-card ac-game-card--link${isCertified ? ' ac-game-card--certified' : ''}`}
      aria-label={`${title} — ${t('competition.title')}`}
      aria-busy={loading || undefined}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
        e.preventDefault()
        onOpenCompetitions?.()
      }}
    >
      <div className="ac-game-card__media">
        <GameArtwork gameId={gameId} thumbnailKey={thumbnailKey ?? manifest?.thumbnail} />
        <div className="ac-game-card__badges">
          <span
            className="ac-tag"
            style={{ ['--tag-color' as string]: tagColor, background: 'rgba(7, 10, 16, 0.84)' }}
          >
            {t(`home.filters.${engine}`, { defaultValue: engineLabel(engine) })}
          </span>
          {isCertified && (
            <span className="ac-certified-badge" title={t('home.tournamentCertified')}>
              <TrophyIcon size={11} />
              <span>{t('home.certifiedBadge')}</span>
            </span>
          )}
        </div>
      </div>

      <div className="ac-game-card__body">
        <div style={{ minWidth: 0 }}>
          <div className="ac-game-card__title-row">
            <h3 className="ac-game-card__title" title={title}>{title}</h3>
            {typeof personalBest === 'number' && personalBest > 0 && (
              <span className="ac-pb-badge" title={t('leaderboards.personalBest', { defaultValue: 'Personal Best' })}>
                {t('leaderboards.pbShort', { defaultValue: 'PB' })} {personalBest.toLocaleString()}
              </span>
            )}
          </div>
          {tagline && <p className="ac-game-card__tagline" title={tagline}>{tagline}</p>}
        </div>

        <div className="ac-game-card__actions">
          <span className="ac-btn ac-btn--primary ac-btn--sm ac-game-card__play-btn">
            <TrophyIcon size={13} />
            <span>{t('common.play')}</span>
          </span>
        </div>
      </div>
    </a>
  )
}
