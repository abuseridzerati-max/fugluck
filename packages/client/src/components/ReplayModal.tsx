import { useEffect, useRef, useState } from 'react'
import { MAX_REPLAY_TICKS, replayEngine } from '@arcadeclash/shared'
import { replayAdapters } from '@arcadeclash/games/replayAdapters'

type ReplayModalProps = {
  gameId: string
  opponentUsername: string
  seed: number
  inputLog: Array<{ tick: number; action: string }>
  userScore: number
  opponentScore: number
  outcome: string
  onClose: () => void
}

export default function ReplayModal({
  gameId,
  opponentUsername,
  seed,
  inputLog,
  userScore,
  opponentScore,
  outcome,
  onClose,
}: ReplayModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(true)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [replayState, setReplayState] = useState<{ finalScore: number; totalTicks: number } | null>(null)
  const animFrameRef = useRef<number | null>(null)

  useEffect(() => {
    const adapter = replayAdapters[gameId]
    if (!adapter) return

    try {
      const outcome = replayEngine(adapter, seed, inputLog, { width: 1280, height: 720 }, MAX_REPLAY_TICKS)
      setReplayState({ finalScore: outcome.score, totalTicks: outcome.totalTicks })
    } catch (e) {
      console.error('Replay calculation failed:', e)
    }
  }, [gameId, seed, inputLog])

  useEffect(() => {
    if (!isPlaying) return
    const adapter = replayAdapters[gameId]
    if (!adapter) return

    const interval = setInterval(() => {
      setCurrentStepIndex((prev) => {
        const total = replayState?.totalTicks ?? 100
        if (prev >= total) {
          setIsPlaying(false)
          return prev
        }
        return prev + 1
      })
    }, 16)

    return () => clearInterval(interval)
  }, [isPlaying, gameId, replayState])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Render retro replay canvas visualization
    ctx.fillStyle = '#0f172a'
    ctx.fillRect(0, 0, 1280, 720)

    ctx.fillStyle = '#38bdf8'
    ctx.font = 'bold 36px monospace'
    ctx.fillText(`REPLAY: ${gameId.toUpperCase()}`, 60, 80)

    ctx.fillStyle = '#94a3b8'
    ctx.font = '20px monospace'
    ctx.fillText(`Seed: ${seed} | VS ${opponentUsername}`, 60, 120)
    ctx.fillText(`Outcome: ${outcome.toUpperCase()} (${userScore} vs ${opponentScore})`, 60, 155)

    // Draw progression timeline
    const total = Math.max(replayState?.totalTicks ?? 100, 1)
    const progressPct = Math.min(currentStepIndex / total, 1)

    ctx.strokeStyle = '#334155'
    ctx.lineWidth = 12
    ctx.beginPath()
    ctx.moveTo(60, 640)
    ctx.lineTo(1220, 640)
    ctx.stroke()

    ctx.strokeStyle = '#22c55e'
    ctx.lineWidth = 12
    ctx.beginPath()
    ctx.moveTo(60, 640)
    ctx.lineTo(60 + 1160 * progressPct, 640)
    ctx.stroke()

    ctx.fillStyle = '#f8fafc'
    ctx.font = 'bold 24px monospace'
    ctx.fillText(`Tick: ${currentStepIndex} / ${total}`, 60, 610)
    ctx.fillText(`Replayed Score: ${Math.round(progressPct * (replayState?.finalScore ?? userScore))}`, 900, 610)
  }, [currentStepIndex, gameId, seed, opponentUsername, outcome, userScore, opponentScore, replayState])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'color-mix(in srgb, var(--color-bg) 85%, transparent)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 60,
      }}
      onClick={onClose}
    >
      <div
        className="ac-panel"
        style={{
          width: '95%',
          maxWidth: 960,
          padding: 'var(--space-6)',
          borderRadius: 'var(--radius-lg, 12px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
          <h2 style={{ margin: 0 }}>📼 Replay match vs {opponentUsername}</h2>
          <button type="button" className="ac-btn ac-btn--ghost" onClick={onClose}>
            ✕
          </button>
        </div>

        <div style={{ width: '100%', aspectRatio: '16/9', position: 'relative', background: '#000', borderRadius: 8 }}>
          <canvas
            ref={canvasRef}
            width={1280}
            height={720}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-4)', width: '100%', justifyContent: 'center' }}>
          <button
            type="button"
            className="ac-btn ac-btn--primary"
            onClick={() => setIsPlaying((p) => !p)}
          >
            {isPlaying ? '⏸ Pause' : '▶ Play'}
          </button>
          <button
            type="button"
            className="ac-btn ac-btn--ghost"
            onClick={() => {
              setCurrentStepIndex(0)
              setIsPlaying(true)
            }}
          >
            🔄 Restart
          </button>
        </div>
      </div>
    </div>
  )
}
