import { useState } from 'react'
import type { GameEngine } from '@fugluck/games'
import { categoryColors } from '@fugluck/theme'
import { engineLabel } from '../lib/format'
import GameArtwork from './GameArtwork'
import LaunchModal from './LaunchModal'
import { TrophyIcon } from './icons'

type GameCardProps = {
  gameId: string
  title: string
  engine: GameEngine
  tagline?: string
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
  certified = false,
  onPlay,
  onFindOpponent,
  onLaunchGuestInvite,
  onOpenCompetitions,
  loading,
}: GameCardProps) {
  const [showModal, setShowModal] = useState(false)
  const tagColor = categoryColors[engine]

  return (
    <>
      <article className={`ac-game-card${certified ? ' ac-game-card--certified' : ''}`}>
        <div className="ac-game-card__media">
          <GameArtwork gameId={gameId} />
          <div className="ac-game-card__badges">
            <span
              className="ac-tag"
              style={{ ['--tag-color' as string]: tagColor, background: 'rgba(7, 10, 16, 0.82)' }}
            >
              {engineLabel(engine)}
            </span>
            {certified && (
              <span className="ac-certified-badge">
                <TrophyIcon size={12} />
                <span>Tournament Certified</span>
              </span>
            )}
          </div>
        </div>

        <div className="ac-game-card__body">
          <div>
            <h3 className="ac-game-card__title">{title}</h3>
            {tagline && <p className="ac-game-card__tagline">{tagline}</p>}
          </div>

          <div className="ac-game-card__actions">
            <button
              type="button"
              className="ac-btn ac-btn--primary"
              disabled={loading}
              onClick={() => setShowModal(true)}
              style={{
                flex: 1,
                height: '40px',
                minHeight: '40px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
              }}
            >
              ▶ Play
            </button>

            {certified && onOpenCompetitions && (
              <button
                type="button"
                className="ac-btn ac-btn--ghost"
                onClick={onOpenCompetitions}
                style={{
                  height: '40px',
                  minHeight: '40px',
                  whiteSpace: 'nowrap',
                }}
              >
                <TrophyIcon size={14} />
                <span>Enter Tournament</span>
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
