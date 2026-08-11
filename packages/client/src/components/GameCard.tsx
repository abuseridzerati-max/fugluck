import { useState } from 'react'
import type { GameEngine } from '@arcadeclash/games'
import { categoryColors } from '@arcadeclash/theme'
import { engineLabel, formatPlays } from '../lib/format'
import LaunchModal from './LaunchModal'
import StarRating from './StarRating'

type GameCardProps = {
  title: string
  engine: GameEngine
  plays: number
  rating: number
  onPlay?: () => void
  onFindOpponent?: (stake?: number, currency?: 'COINS' | 'DIAMONDS') => void
  loading?: boolean
}

export default function GameCard({ title, engine, plays, rating, onPlay, onFindOpponent, loading }: GameCardProps) {
  const [showModal, setShowModal] = useState(false)
  const tagColor = categoryColors[engine]

  return (
    <>
      <div
        className="ac-card"
        role="button"
        tabIndex={0}
        onClick={() => setShowModal(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setShowModal(true)
          }
        }}
        style={{ cursor: 'pointer' }}
      >
        <div
          style={{
            position: 'relative',
            aspectRatio: '16 / 10',
            background: `linear-gradient(135deg, color-mix(in srgb, ${tagColor} 30%, var(--color-surface)) 0%, var(--color-surface) 100%)`,
          }}
        >
          <span
            className="ac-tag"
            style={{ position: 'absolute', top: 'var(--space-3)', left: 'var(--space-3)', ['--tag-color' as string]: tagColor }}
          >
            {engineLabel(engine)}
          </span>
        </div>
        <div style={{ padding: 'var(--space-4)' }}>
          <div style={{ fontWeight: 'var(--font-weight-medium)', marginBottom: 'var(--space-2)' }}>{title}</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
            <StarRating rating={rating} />
            <span className="ac-text-muted ac-text-mono" style={{ fontSize: 'var(--font-size-xs)' }}>
              {loading ? 'Loading…' : `${formatPlays(plays)} PLAYS`}
            </span>
          </div>

          {/* Prominent Play Button under every game card */}
          <button
            type="button"
            className="ac-btn ac-btn--primary"
            onClick={(e) => {
              e.stopPropagation()
              setShowModal(true)
            }}
            style={{
              width: '100%',
              height: '40px',
              justifyContent: 'center',
              fontWeight: 'bold',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
            }}
          >
            ▶ Play
          </button>
        </div>
      </div>

      {showModal && (
        <LaunchModal
          gameTitle={title}
          onClose={() => setShowModal(false)}
          onLaunchPractice={() => {
            onPlay?.()
          }}
          onLaunchInviteLink={() => {
            void navigator.clipboard.writeText('http://localhost:5173')
            alert(`Instant invite link for ${title} copied to clipboard! Share with anyone to play instantly.`)
          }}
          onLaunchCoinsMatch={(stake) => {
            onFindOpponent?.(stake, 'COINS')
          }}
          onLaunchDiamondsMatch={(stake) => {
            onFindOpponent?.(stake, 'DIAMONDS')
          }}
        />
      )}
    </>
  )
}
