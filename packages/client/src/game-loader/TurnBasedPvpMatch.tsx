import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  VIRTUAL_VIEWPORT,
  type MatchedPayload,
  type TurnMatchEndedPayload,
  type TurnMatchErrorPayload,
  type TurnMatchStatePayload,
} from '@fugluck/shared'
import { BlitzChessEngine, chessSounds } from '@fugluck/games/blitz-chess/engine'
import { clientPointToSquare, clientPointToVirtual } from '@fugluck/games/blitz-chess/constants'

type TurnBasedPvpMatchProps = {
  match: MatchedPayload
  state: TurnMatchStatePayload | null
  ended: TurnMatchEndedPayload | null
  error: TurnMatchErrorPayload | null
  onSendMove: (matchId: string, move: Record<string, unknown>) => void
  onResign: (matchId: string) => void
  onSync: (matchId: string) => void
}

function msToTicks(ms: number): number {
  return Math.max(0, Math.round((ms / 1000) * 60))
}

export function TurnBasedPvpMatch({
  match,
  state,
  ended,
  error,
  onSendMove,
  onResign,
  onSync,
}: TurnBasedPvpMatchProps) {
  const { t } = useTranslation()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const engineRef = useRef<BlitzChessEngine | null>(null)
  const latestStateRef = useRef<TurnMatchStatePayload | null>(null)
  const syncedAtLocalMsRef = useRef<number>(Date.now())
  const pointerDragRef = useRef<{
    pointerId: number
    from: string
    pieceColor: 'w' | 'b'
    pieceType: string
    startX: number
    startY: number
    wasAlreadySelected: boolean
    dragging: boolean
  } | null>(null)
  const [confirmResign, setConfirmResign] = useState(false)
  const [muted, setMuted] = useState(() => chessSounds.isMuted())

  useEffect(() => {
    if (!state) {
      onSync(match.matchId)
    }
  }, [match.matchId, state, onSync])

  useEffect(() => {
    if (!confirmResign) return
    const timer = window.setTimeout(() => setConfirmResign(false), 4_000)
    return () => window.clearTimeout(timer)
  }, [confirmResign])

  // Sync authoritative server state into the BlitzChessEngine renderer
  useEffect(() => {
    if (!state) return
    latestStateRef.current = state
    syncedAtLocalMsRef.current = Date.now()

    const engine = engineRef.current
    if (!engine) return

    const boardState = state.boardState as {
      fen?: string
      capturedByWhite?: string[]
      capturedByBlack?: string[]
    }
    const lastMove = state.lastMove as { from?: string; to?: string; san?: string } | null

    engine.pvpMode = true
    engine.orientation = state.yourSeat === 'p1' ? 'w' : 'b'
    engine.whiteLabel = state.p1Username
    engine.blackLabel = state.p2Username

    engine.hydrateFromSnapshot({
      tickCount: state.turnNumber,
      score: 0,
      gameOver: Boolean(state.ended || ended),
      chessFen: boardState.fen,
      whiteClockTicks: msToTicks(state.p1ClockMs),
      blackClockTicks: msToTicks(state.p2ClockMs),
      lastMoveFrom: lastMove?.from ?? null,
      lastMoveTo: lastMove?.to ?? null,
      lastMoveSan: lastMove?.san ?? null,
      capturedByWhite: Array.isArray(boardState.capturedByWhite) ? boardState.capturedByWhite : [],
      capturedByBlack: Array.isArray(boardState.capturedByBlack) ? boardState.capturedByBlack : [],
      inCheck: Boolean(state.inCheck),
      turnNumber: state.turnNumber,
    })
  }, [state, ended])

  // Mount canvas + 60fps render loop (smoothly ticks active clock between server syncs)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(VIRTUAL_VIEWPORT.width * dpr)
    canvas.height = Math.round(VIRTUAL_VIEWPORT.height * dpr)
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const engine = new BlitzChessEngine(match.seed)
    engine.pvpMode = true
    engine.resize(VIRTUAL_VIEWPORT.width, VIRTUAL_VIEWPORT.height)
    engineRef.current = engine

    // Hydrate immediately if state already arrived before canvas mounted
    if (latestStateRef.current) {
      const s = latestStateRef.current
      const boardState = s.boardState as {
        fen?: string
        capturedByWhite?: string[]
        capturedByBlack?: string[]
      }
      const lastMove = s.lastMove as { from?: string; to?: string; san?: string } | null
      engine.orientation = s.yourSeat === 'p1' ? 'w' : 'b'
      engine.whiteLabel = s.p1Username
      engine.blackLabel = s.p2Username
      engine.hydrateFromSnapshot({
        tickCount: s.turnNumber,
        score: 0,
        gameOver: Boolean(s.ended),
        chessFen: boardState.fen,
        whiteClockTicks: msToTicks(s.p1ClockMs),
        blackClockTicks: msToTicks(s.p2ClockMs),
        lastMoveFrom: lastMove?.from ?? null,
        lastMoveTo: lastMove?.to ?? null,
        lastMoveSan: lastMove?.san ?? null,
        capturedByWhite: Array.isArray(boardState.capturedByWhite) ? boardState.capturedByWhite : [],
        capturedByBlack: Array.isArray(boardState.capturedByBlack) ? boardState.capturedByBlack : [],
        inCheck: Boolean(s.inCheck),
        turnNumber: s.turnNumber,
      })
    }

    let rafId = 0
    const renderFrame = () => {
      const s = latestStateRef.current
      if (s && !s.ended) {
        const elapsedMs = Math.max(0, Date.now() - syncedAtLocalMsRef.current)
        const p1Ms = s.activeTurn === 'p1' ? Math.max(0, s.p1ClockMs - elapsedMs) : s.p1ClockMs
        const p2Ms = s.activeTurn === 'p2' ? Math.max(0, s.p2ClockMs - elapsedMs) : s.p2ClockMs
        engine.whiteClockTicks = msToTicks(p1Ms)
        engine.blackClockTicks = msToTicks(p2Ms)
      }
      engine.render(ctx)
      rafId = window.requestAnimationFrame(renderFrame)
    }

    rafId = window.requestAnimationFrame(renderFrame)

    return () => {
      window.cancelAnimationFrame(rafId)
      engineRef.current = null
    }
  }, [match.seed])

  const isEnded = Boolean(state?.ended || ended)
  const isMyTurn = Boolean(state && !isEnded && state.activeTurn === state.yourSeat)
  const orientation: 'w' | 'b' = state?.yourSeat === 'p2' ? 'b' : 'w'

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!state || !isMyTurn) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const engine = engineRef.current
    const canvas = canvasRef.current
    if (!engine || !canvas) return

    const sq = clientPointToSquare(canvas.getBoundingClientRect(), e.clientX, e.clientY, orientation)
    if (!sq) {
      engine.selectedSquare = null
      engine.legalTargets = []
      engine.dragState = null
      pointerDragRef.current = null
      return
    }

    // Click-to-move: execute if tapping a legal destination square
    if (engine.selectedSquare && engine.legalTargets.includes(sq)) {
      const from = engine.selectedSquare
      engine.selectedSquare = null
      engine.legalTargets = []
      engine.dragState = null
      pointerDragRef.current = null
      onSendMove(match.matchId, { from, to: sq, promotion: 'q' })
      return
    }

    const targets = engine.getLegalTargetsForSquare(sq, orientation)
    const piece = engine.getPieceAt(sq)
    if (targets.length > 0 && piece && piece.color === orientation) {
      const wasAlreadySelected = engine.selectedSquare === sq
      engine.selectedSquare = sq
      engine.legalTargets = targets
      pointerDragRef.current = {
        pointerId: e.pointerId,
        from: sq,
        pieceColor: piece.color,
        pieceType: piece.type,
        startX: e.clientX,
        startY: e.clientY,
        wasAlreadySelected,
        dragging: false,
      }
      try {
        canvas.setPointerCapture(e.pointerId)
      } catch {
        // Ignore capture errors
      }
    } else {
      engine.selectedSquare = null
      engine.legalTargets = []
      engine.dragState = null
      pointerDragRef.current = null
    }
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const drag = pointerDragRef.current
    const engine = engineRef.current
    const canvas = canvasRef.current
    if (!drag || drag.pointerId !== e.pointerId || !engine || !canvas) return

    if (!drag.dragging && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < 6) return
    drag.dragging = true

    const pt = clientPointToVirtual(canvas.getBoundingClientRect(), e.clientX, e.clientY)
    if (pt) {
      engine.dragState = {
        from: drag.from,
        pieceColor: drag.pieceColor,
        pieceType: drag.pieceType,
        vx: pt.vx,
        vy: pt.vy,
      }
    }
  }

  function handlePointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    const drag = pointerDragRef.current
    const engine = engineRef.current
    const canvas = canvasRef.current
    if (!drag || drag.pointerId !== e.pointerId || !engine || !canvas) return
    pointerDragRef.current = null

    try {
      canvas.releasePointerCapture(e.pointerId)
    } catch {
      // Ignore release errors
    }

    const wasDragging = drag.dragging
    engine.dragState = null

    if (!wasDragging) {
      if (drag.wasAlreadySelected) {
        engine.selectedSquare = null
        engine.legalTargets = []
      }
      return
    }

    const targetSq = clientPointToSquare(canvas.getBoundingClientRect(), e.clientX, e.clientY, orientation)
    if (targetSq && targetSq !== drag.from && engine.legalTargets.includes(targetSq)) {
      engine.skipNextAnimation = true
      engine.selectedSquare = null
      engine.legalTargets = []
      onSendMove(match.matchId, { from: drag.from, to: targetSq, promotion: 'q' })
    }
  }

  function handlePointerCancel() {
    pointerDragRef.current = null
    if (engineRef.current) engineRef.current.dragState = null
  }

  function handleToggleMute() {
    const nextMuted = chessSounds.toggleMute()
    setMuted(nextMuted)
  }

  function handleResignClick() {
    if (isEnded) return
    if (!confirmResign) {
      setConfirmResign(true)
      return
    }
    setConfirmResign(false)
    onResign(match.matchId)
  }

  const endOutcomeText = ended
    ? ended.winnerSeat === null
      ? t('turnPvp.outcomes.draw')
      : ended.winnerSeat === state?.yourSeat
        ? t('turnPvp.outcomes.win')
        : t('turnPvp.outcomes.loss')
    : null

  const endReasonText = ended ? t(`turnPvp.reasons.${ended.reason}`, { defaultValue: ended.reason }) : null

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        background: '#070a10',
        overflow: 'hidden',
      }}
    >
      {/* Top PvP Turn Status & Resign Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-2)',
          padding: 'var(--space-2) var(--space-3)',
          background: 'rgba(13, 20, 34, 0.95)',
          borderBottom: '1px solid rgba(56, 189, 248, 0.25)',
          flexWrap: 'wrap',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          {state ? (
            <>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  padding: '3px 10px',
                  borderRadius: '999px',
                  background: state.yourSeat === 'p1' ? 'rgba(226, 232, 240, 0.14)' : 'rgba(236, 72, 153, 0.16)',
                  border: state.yourSeat === 'p1' ? '1px solid #38bdf8' : '1px solid #ec4899',
                  color: '#f8fafc',
                }}
              >
                {state.yourSeat === 'p1' ? t('turnPvp.playingAsWhite') : t('turnPvp.playingAsBlack')}
              </span>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  padding: '3px 10px',
                  borderRadius: '999px',
                  background: state.inCheck
                    ? 'rgba(244, 63, 94, 0.2)'
                    : isMyTurn
                      ? 'rgba(16, 185, 129, 0.2)'
                      : 'rgba(245, 158, 11, 0.18)',
                  border: state.inCheck
                    ? '1px solid #f43f5e'
                    : isMyTurn
                      ? '1px solid #10b981'
                      : '1px solid #f59e0b',
                  color: state.inCheck ? '#fda4af' : isMyTurn ? '#34d399' : '#fbbf24',
                }}
              >
                {state.inCheck ? `${t('turnPvp.check')} · ` : ''}
                {isMyTurn ? t('turnPvp.yourTurn') : t('turnPvp.opponentTurn')}
              </span>
              <span className="ac-text-muted" style={{ fontSize: '12px' }}>
                {state.p1Username} vs {state.p2Username}
              </span>
            </>
          ) : (
            <span className="ac-text-muted" style={{ fontSize: '12px' }}>
              {t('turnPvp.waitingBoard')}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <button
            type="button"
            className="ac-btn ac-btn--ghost"
            onClick={handleToggleMute}
            title={muted ? t('turnPvp.unmuteAudio') : t('turnPvp.muteAudio')}
            aria-label={muted ? t('turnPvp.unmuteAudio') : t('turnPvp.muteAudio')}
            style={{
              padding: '4px 10px',
              fontSize: '14px',
              minWidth: 36,
            }}
          >
            {muted ? '🔇' : '🔊'}
          </button>
          <button
            type="button"
            className="ac-btn ac-btn--ghost"
            disabled={isEnded}
            onClick={handleResignClick}
            style={{
              padding: '4px 12px',
              fontSize: '12px',
              borderColor: confirmResign ? '#f43f5e' : 'rgba(244, 63, 94, 0.45)',
              color: confirmResign ? '#fff' : '#fda4af',
              background: confirmResign ? '#e11d48' : 'transparent',
              opacity: isEnded ? 0.5 : 1,
            }}
          >
            {confirmResign ? t('turnPvp.resignConfirm') : t('turnPvp.resign')}
          </button>
        </div>
      </div>

      {/* Board Stage */}
      <div
        style={{
          position: 'relative',
          flex: 1,
          minHeight: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--space-2)',
        }}
      >
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          style={{
            width: '100%',
            height: '100%',
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            aspectRatio: '16 / 9',
            touchAction: 'none',
            userSelect: 'none',
            overscrollBehavior: 'none',
            cursor: isMyTurn ? 'pointer' : 'default',
            display: 'block',
          }}
        />

        {error && !isEnded && (
          <div
            role="status"
            style={{
              position: 'absolute',
              bottom: 'var(--space-4)',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(225, 29, 72, 0.92)',
              color: '#fff',
              padding: '6px 14px',
              borderRadius: '999px',
              fontSize: '13px',
              fontWeight: 600,
              pointerEvents: 'none',
            }}
          >
            {error.message}
          </div>
        )}

        {ended && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(7, 10, 16, 0.68)',
              pointerEvents: 'none',
            }}
          >
            <div
              className="ac-panel"
              style={{
                textAlign: 'center',
                padding: 'var(--space-5) var(--space-6)',
                border: '1px solid rgba(56, 189, 248, 0.45)',
              }}
            >
              <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 800, marginBottom: 'var(--space-1)' }}>
                {endOutcomeText}
              </div>
              <div className="ac-text-muted" style={{ fontSize: 'var(--font-size-sm)' }}>
                {endReasonText}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
