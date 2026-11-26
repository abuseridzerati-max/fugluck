import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getGameManifest, type GameGenre } from '@fugluck/shared'
import { categoryColors } from '@fugluck/theme'
import { engineLabel } from '../lib/format'
import GameArtwork from './GameArtwork'
import LaunchModal from './LaunchModal'
import { TrophyIcon } from './icons'

type GameCardProps = {
  gameId: string
  title: string
  engine: GameGenre
  tagline?: string
  thumbnailKey?: string
  certified?: boolean
  onPlay?: () => void
  onFindOpponent?: (stake?: number, currency?: 'COINS') => void
  onLaunchGuestInvite?: () => void
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
  onPlay,
  onFindOpponent,
  onLaunchGuestInvite,
  onOpenCompetitions,
  loading,
}: GameCardProps) {
  const { t } = useTranslation()
  const [showModal, setShowModal] = useState(false)
  const manifest = getGameManifest(gameId)
  const isCertified = certified ?? manifest?.certified ?? false
  const tagColor = categoryColors[engine]

  return (
    <>
      <article className={`ac-game-card${isCertified ? ' ac-game-card--certified' : ''}`}>
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
            <h3 className="ac-game-card__title" title={title}>{title}</h3>
            {tagline && <p className="ac-game-card__tagline" title={tagline}>{tagline}</p>}
          </div>

          <div className="ac-game-card__actions">
            <button
              type="button"
              className="ac-btn ac-btn--primary ac-btn--sm ac-game-card__play-btn"
              disabled={loading}
              onClick={() => setShowModal(true)}
            >
              ▶ {t('common.play')}
            </button>

            {isCertified && onOpenCompetitions && (
              <button
                type="button"
                className="ac-btn ac-btn--ghost ac-btn--sm ac-game-card__tourney-btn"
                onClick={onOpenCompetitions}
                title={t('home.enterTournament')}
                aria-label={`${t('home.enterTournament')} — ${title}`}
              >
                <TrophyIcon size={13} />
                <span className="ac-game-card__tourney-label">{t('home.competeBtn')}</span>
              </button>
            )}
          </div>
        </div>
      </article>

      {showModal && (
        <LaunchModal
          gameId={gameId}
          gameTitle={title}
          onClose={() => setShowModal(false)}
          onLaunchPractice={() => {
            onPlay?.()
          }}
          onLaunchInviteLink={() => {
            onLaunchGuestInvite?.()
          }}
          onLaunchCoinsMatch={(stake) => {
            onFindOpponent?.(stake, 'COINS')
          }}
          onOpenCompetitions={onOpenCompetitions}
        />
      )}
    </>
  )
}
