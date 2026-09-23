import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import type {
  GameModule,
  GameModuleFactory,
  GameOverPayload,
  MatchedPayload,
  MatchResolvedPayload,
  PlayerResult,
} from '@fugluck/shared'
import { useAuth } from '../auth/AuthContext'
import { canNativeShare, copyTextToClipboard } from '../lib/clipboard'
import { useMatchSocket, type MatchSocketMode, type RematchState } from '../matchmaking/useMatchSocket'
import { apiFetch } from '../lib/api'
import { AuthorityCompetition } from './AuthorityCompetition'

type MatchLoaderProps = {
  createModule: GameModuleFactory
  gameTitle: string
  gameId: string
  onExit: () => void
  matchMode?: MatchSocketMode
  onMatchResolved?: () => void
  onFindNewOpponent?: () => void
  onPlayPractice?: () => void
}

// A separate host from GameLoader (practice mode) rather than a mode branch
// inside it — practice's mount() stays untouched (client-generated seed is
// still correct there: solo, nothing to cheat against). This host owns the
// find-opponent lifecycle end to end: queued -> countdown -> mounts the
// GameModule with the server-issued seed -> awaiting-opponent -> resolved.
// matchResolved is handled from any phase past 'countdown', not just
// 'awaiting-opponent' — a forfeit timeout or a mid-match opponent disconnect
// can resolve the match out from under a still-playing player (see
// PROGRESS.md's forfeit-timeout and disconnect-resolution sections). There
// is no separate "ended" terminal state anymore — a disconnect used to void
// the match with no result; it now resolves via matchResolved like anything
// else (see PROGRESS.md's session log for why voiding was a free escape from
// a losing position).
type Phase =
  | { kind: 'queued' }
  | { kind: 'countdown'; match: MatchedPayload; count: number }
  | { kind: 'playing'; match: MatchedPayload }
  | { kind: 'awaiting-opponent'; match: MatchedPayload; yourScore: number }
  | { kind: 'resolved'; resolution: MatchResolvedPayload }
  | { kind: 'connection-error'; message: string }

const COUNTDOWN_START = 3
const COUNTDOWN_STEP_MS = 800

function isTerminal(phase: Phase): boolean {
  return phase.kind === 'resolved' || phase.kind === 'connection-error'
}

export default function MatchLoader(props: MatchLoaderProps) {
  if (props.matchMode?.kind === 'competition' && props.gameId === 'space-blaster') {
    return <AuthorityCompetition templateId={props.matchMode.templateId} onExit={props.onExit} />
  }
  return <LegacyMatchLoader {...props} />
}

function LegacyMatchLoader({
  createModule,
  gameTitle,
  gameId,
  onExit,
  matchMode = { kind: 'queue' },
  onMatchResolved,
  onFindNewOpponent,
  onPlayPractice,
}: MatchLoaderProps) {
  const {
    connectionState,
    match,
    resolution,
    error,
    waitingLabel,
    guestLinkCode,
    rematchState,
    competitionWaiting,
    cancelCompetition,
    submitScore,
    reportVisibilityHidden,
    requestRematch,
    declineRematch,
    disconnect,
  } = useMatchSocket(gameId, matchMode)
  const [phase, setPhase] = useState<Phase>({ kind: 'queued' })
  const [copied, setCopied] = useState<'idle' | 'copied' | 'failed'>('idle')
  const linkInputRef = useRef<HTMLInputElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const moduleRef = useRef<GameModule | null>(null)

  function destroyModule() {
    moduleRef.current?.destroy()
    moduleRef.current = null
  }

  // Evidence-only, for the whole component lifetime (queued through
  // resolved) — not gated to 'playing', so it keeps reporting after a run
  // has ended while still waiting on the opponent. See PROGRESS.md's
  // freeze-frame Known Gaps entry: this is one signal among several
  // client-side-only ones, not an enforcement mechanism on its own. A ref
  // (not a `match`-dependent effect) so the listener attaches once and
  // always reads the current matchId, rather than re-subscribing on every
  // match change.
  const matchIdRef = useRef<string | null>(null)
  useEffect(() => {
    matchIdRef.current = match?.matchId ?? null
  }, [match])

  useEffect(() => {
    function handleVisibilityChange() {
      if (!document.hidden) return
      const matchId = matchIdRef.current
      if (matchId) reportVisibilityHidden(matchId)
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [reportVisibilityHidden])

  // queued -> countdown, once the server pairs us with an opponent.
  // Also resolved -> countdown when both players accept a rematch.
  useEffect(() => {
    if (!match) return
    setPhase((prev) =>
      prev.kind === 'queued' || prev.kind === 'resolved'
        ? { kind: 'countdown', match, count: COUNTDOWN_START }
        : prev,
    )
  }, [match])

  // countdown -> playing. Mounts the GameModule with the server-issued seed
  // once the count reaches zero — server generates, server sends, client
  // never proposes.
  useEffect(() => {
    if (phase.kind !== 'countdown') return

    if (phase.count <= 0) {
      const container = containerRef.current
      if (!container) return
      const mod = createModule()
      moduleRef.current = mod
      const matchInfo = phase.match
      mod.addEventListener('gameOver', ((e: Event) => {
        const payload = (e as CustomEvent<GameOverPayload>).detail
        // TEMPORARY DIAGNOSTIC — mirrors the server-side log in matches.ts's
        // submitScore. Remove both once the viewport/score-gap investigation
        // is resolved.
        console.log(
          `[match] DIAGNOSTIC gameOver: matchId=${matchInfo.matchId} seed=${matchInfo.seed} ` +
            `viewport=${payload.viewport.width}x${payload.viewport.height} score=${payload.score}`,
        )
        submitScore({
          matchId: matchInfo.matchId,
          score: payload.score,
          reason: payload.reason,
          durationMs: payload.durationMs,
          inputLog: payload.inputLog,
          viewport: payload.viewport,
        })
        setPhase((prev) =>
          prev.kind === 'playing' ? { kind: 'awaiting-opponent', match: prev.match, yourScore: payload.score } : prev,
        )
      }) as EventListener)
      mod.init(container, 'match', null, matchInfo.seed)
      mod.start()
      setPhase({ kind: 'playing', match: matchInfo })
      return
    }

    const timeoutId = setTimeout(() => {
      setPhase((prev) => (prev.kind === 'countdown' ? { ...prev, count: prev.count - 1 } : prev))
    }, COUNTDOWN_STEP_MS)
    return () => clearTimeout(timeoutId)
  }, [phase, createModule, submitScore])

  const { refreshUser } = useAuth()

  // Can arrive from any non-terminal phase — see the Phase type's comment.
  useEffect(() => {
    if (!resolution) return
    onMatchResolved?.()
    void refreshUser()
    setPhase((prev) => {
      if (isTerminal(prev)) return prev
      destroyModule()
      return { kind: 'resolved', resolution }
    })
  }, [resolution, refreshUser, onMatchResolved])

  // Unexpected drop — a real error, or the socket closing before either
  // terminal server event arrived (e.g. a server restart mid-match).
  // Transient Socket.IO reconnects use connectionState 'reconnecting' and
  // must not tear down a waiting invite or an in-progress match.
  useEffect(() => {
    if (!error && connectionState !== 'closed') return
    setPhase((prev) => {
      if (isTerminal(prev)) return prev
      destroyModule()
      return { kind: 'connection-error', message: error ?? 'Connection lost.' }
    })
  }, [error, connectionState])

  useEffect(() => {
    const prevTitle = document.title
    if (phase.kind === 'queued') {
      document.title = `Fugluck — Matchmaking: ${gameTitle}`
    } else {
      document.title = `Fugluck — Match: ${gameTitle}`
    }
    return () => {
      document.title = prevTitle
    }
  }, [phase.kind, gameTitle])

  useEffect(() => {
    return () => destroyModule()
  }, [])

  function handleLeave() {
    disconnect()
    onExit()
  }

  const modeLabel =
    matchMode.kind === 'queue'
      ? 'Find Opponent'
      : matchMode.kind === 'resume'
      ? 'Reconnect'
      : matchMode.kind === 'createGuest'
      ? 'Instant Guest Link'
      : matchMode.kind === 'joinGuest'
      ? 'Guest Match'
      : 'Friend Match'

  // Keyboard shortcut listener for instant Rematch actions
  useEffect(() => {
    if (phase.kind !== 'resolved') return
    const canRematch = phase.resolution.canRematch

    function handleKeyDown(e: KeyboardEvent) {
      if (e.code === 'Space' || e.code === 'KeyR' || e.code === 'Enter') {
        e.preventDefault()
        if (rematchState.kind === 'offered') {
          requestRematch()
        } else if (rematchState.kind === 'idle' && canRematch) {
          requestRematch()
        } else if ((rematchState.kind === 'unavailable' || !canRematch) && onFindNewOpponent) {
          onFindNewOpponent()
        }
      } else if (e.code === 'Escape') {
        e.preventDefault()
        if (rematchState.kind === 'offered') {
          declineRematch()
        } else {
          handleLeave()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [phase, rematchState, requestRematch, declineRematch, onFindNewOpponent])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--color-bg)',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--space-3) var(--space-5)',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <span className="ac-text-muted" style={{ fontSize: 'var(--font-size-sm)' }}>
          {gameTitle} · {modeLabel}
        </span>
        <button
          type="button"
          className="ac-btn ac-btn--ghost"
          onClick={handleLeave}
          style={{ padding: 'var(--space-1) var(--space-4)' }}
        >
          Exit
        </button>
      </div>

      <div style={{ flex: 1, position: 'relative' }}>
        <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />

        {phase.kind === 'queued' && (
          <Overlay>
            <div className="ac-panel" style={{ textAlign: 'center', minWidth: 320, maxWidth: 440, padding: 'var(--space-6)' }}>
              {matchMode.kind === 'competition' ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--space-2)' }}>
                    <span
                      style={{
                        background: 'rgba(16, 185, 129, 0.15)',
                        border: '1px solid #10b981',
                        color: '#10b981',
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-full)',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        letterSpacing: '1px',
                      }}
                    >
                      TEST / SANDBOX COMPETITION
                    </span>
                  </div>

                  <h2 style={{ margin: '0 0 var(--space-1)', fontSize: 'var(--font-size-xl)' }}>
                    {gameTitle} — {matchMode.template?.title ?? 'Standard Duel'}
                  </h2>

                  <div
                    style={{
                      background: 'var(--color-surface-raised)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-sm)',
                      padding: 'var(--space-3)',
                      margin: 'var(--space-4) 0',
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 'var(--space-2)',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Entry Fee</div>
                      <div style={{ fontWeight: 'bold' }}>
                        {matchMode.template?.entryFeeMinor === 0
                          ? 'FREE'
                          : `TEST ₾${((matchMode.template?.entryFeeMinor ?? 500) / 100).toFixed(2)}`}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Prize</div>
                      <div style={{ fontWeight: 'bold', color: '#10b981' }}>
                        TEST ₾{(((matchMode.template?.prizes?.[0]?.amountMinor ?? 900)) / 100).toFixed(2)}
                      </div>
                    </div>
                  </div>

                  <div style={{ margin: 'var(--space-4) 0', textAlign: 'center' }}>
                    <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'bold', marginBottom: 'var(--space-1)' }}>
                      Players: {competitionWaiting ? `${competitionWaiting.currentParticipants} / ${competitionWaiting.participantCapacity}` : '1 / 2'}
                    </div>
                    <p className="ac-text-muted" style={{ margin: 0, fontSize: 'var(--font-size-xs)' }}>
                      {waitingLabel ?? 'Waiting for competitor…'}
                    </p>
                    <p style={{ margin: 'var(--space-2) 0 0', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                      Your entry amount is reserved while you wait.
                    </p>
                  </div>

                  {(!competitionWaiting || !competitionWaiting.isLocked) && (
                    <button
                      type="button"
                      className="ac-btn ac-btn--ghost"
                      onClick={() => {
                        cancelCompetition()
                        handleLeave()
                      }}
                    >
                      CANCEL ENTRY
                    </button>
                  )}
                </>
              ) : matchMode.kind === 'createGuest' ? (
                <>
                  <h2 style={{ margin: '0 0 var(--space-2)', fontSize: 'var(--font-size-xl)' }}>Instant Guest Match</h2>
                  <p className="ac-text-muted" style={{ margin: '0 0 var(--space-4)', fontSize: 'var(--font-size-sm)' }}>
                    Share this link with anyone to play immediately:
                  </p>
                  {guestLinkCode ? (
                    <GuestLinkShare
                      url={`${window.location.origin}/invite/${guestLinkCode}`}
                      copied={copied}
                      inputRef={linkInputRef}
                      reconnecting={connectionState === 'reconnecting'}
                      onCopy={async () => {
                        const url = `${window.location.origin}/invite/${guestLinkCode}`
                        const ok = await copyTextToClipboard(url, linkInputRef.current)
                        setCopied(ok ? 'copied' : 'failed')
                        window.setTimeout(() => setCopied('idle'), 2500)
                      }}
                      onShare={async () => {
                        const url = `${window.location.origin}/invite/${guestLinkCode}`
                        if (canNativeShare()) {
                          try {
                            await navigator.share({ title: `Play ${gameTitle} on Fugluck`, url })
                            return
                          } catch (err) {
                            if (err instanceof DOMException && err.name === 'AbortError') return
                          }
                        }
                        const ok = await copyTextToClipboard(url, linkInputRef.current)
                        setCopied(ok ? 'copied' : 'failed')
                        window.setTimeout(() => setCopied('idle'), 2500)
                      }}
                    />
                  ) : (
                    <p className="ac-text-muted" style={{ margin: '0 0 var(--space-5)', fontSize: 'var(--font-size-sm)' }}>
                      {connectionState === 'reconnecting' ? 'Reconnecting…' : 'Generating invite link…'}
                    </p>
                  )}
                  <button type="button" className="ac-btn ac-btn--ghost" onClick={handleLeave}>
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <h2 style={{ margin: '0 0 var(--space-2)' }}>
                    {matchMode.kind === 'queue'
                      ? 'Finding an opponent...'
                      : matchMode.kind === 'resume'
                      ? 'Restoring match...'
                      : matchMode.kind === 'joinGuest'
                      ? 'Joining guest match...'
                      : 'Friend invite'}
                  </h2>
                  <p className="ac-text-muted" style={{ margin: '0 0 var(--space-5)' }}>
                    {waitingLabel ??
                      (matchMode.kind === 'queue'
                        ? `Waiting for another ${gameTitle} player`
                        : matchMode.kind === 'resume'
                        ? 'Reconnecting to your active match…'
                        : matchMode.kind === 'joinGuest'
                        ? 'Connecting to host…'
                        : 'Setting up your match…')}
                  </p>
                  <button type="button" className="ac-btn ac-btn--ghost" onClick={handleLeave}>
                    Cancel
                  </button>
                </>
              )}
            </div>
          </Overlay>
        )}

        {phase.kind === 'countdown' && (
          <Overlay>
            <div className="ac-panel" style={{ textAlign: 'center', minWidth: 280 }}>
              {matchMode.kind === 'competition' ? (
                <>
                  <div
                    style={{
                      display: 'inline-block',
                      background: '#10b981',
                      color: '#000',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-full)',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      letterSpacing: '1px',
                      marginBottom: 'var(--space-2)',
                    }}
                  >
                    OPPONENT FOUND
                  </div>
                  <h2 style={{ margin: '0 0 var(--space-1)', fontSize: 'var(--font-size-lg)' }}>
                    {gameTitle} — {matchMode.template?.title ?? 'Standard Duel'}
                  </h2>
                  <div style={{ fontSize: 'var(--font-size-sm)', color: '#10b981', fontWeight: 'bold', marginBottom: 'var(--space-2)' }}>
                    Prize: TEST ₾{(((matchMode.template?.prizes?.[0]?.amountMinor ?? 900)) / 100).toFixed(2)}
                  </div>
                  <p className="ac-text-muted" style={{ margin: '0 0 var(--space-3)', fontSize: 'var(--font-size-xs)' }}>
                    Opponent: {phase.match.opponentUsername}
                  </p>
                </>
              ) : (
                <>
                  <p className="ac-text-muted" style={{ margin: '0 0 var(--space-2)' }}>
                    Opponent found: {phase.match.opponentUsername}
                  </p>
                  <p style={{ margin: '0 0 var(--space-4)', fontSize: 'var(--font-size-sm)' }}>
                    Match starting in:
                  </p>
                </>
              )}
              <div style={{ fontSize: 'var(--font-size-4xl)', fontWeight: 'var(--font-weight-bold)' }}>
                {phase.count > 0 ? phase.count : 'GO!'}
              </div>
            </div>
          </Overlay>
        )}

        {phase.kind === 'awaiting-opponent' && (
          <Overlay>
            <div className="ac-panel" style={{ textAlign: 'center', minWidth: 280 }}>
              <h2 style={{ margin: '0 0 var(--space-2)' }}>Your score: {phase.yourScore}</h2>
              <p className="ac-text-muted" style={{ margin: 0 }}>
                Waiting for {phase.match.opponentUsername} to finish...
              </p>
            </div>
          </Overlay>
        )}

        {phase.kind === 'resolved' && (
          <ResolvedPanel
            resolution={phase.resolution}
            rematchState={rematchState}
            matchMode={matchMode}
            gameTitle={gameTitle}
            onRematch={requestRematch}
            onDeclineRematch={declineRematch}
            onFindNewOpponent={onFindNewOpponent}
            onPlayPractice={onPlayPractice}
            onLeave={handleLeave}
          />
        )}

        {phase.kind === 'connection-error' && (
          <Overlay>
            <div className="ac-panel" style={{ textAlign: 'center', minWidth: 280 }}>
              <h2 style={{ margin: '0 0 var(--space-2)' }}>Connection lost</h2>
              <p className="ac-text-muted" style={{ margin: '0 0 var(--space-5)' }}>{phase.message}</p>
              <button type="button" className="ac-btn ac-btn--primary" onClick={handleLeave}>
                Back to Home
              </button>
            </div>
          </Overlay>
        )}
      </div>
    </div>
  )
}

function GuestLinkShare({
  url,
  copied,
  inputRef,
  reconnecting,
  onCopy,
  onShare,
}: {
  url: string
  copied: 'idle' | 'copied' | 'failed'
  inputRef: RefObject<HTMLInputElement | null>
  reconnecting: boolean
  onCopy: () => void
  onShare: () => void
}) {
  const copyLabel = copied === 'copied' ? '✓ Copied' : copied === 'failed' ? 'Select & copy' : 'Copy link'

  return (
    <div style={{ marginBottom: 'var(--space-5)' }}>
      <div
        style={{
          display: 'flex',
          gap: 'var(--space-2)',
          background: 'var(--color-surface-raised, #1e293b)',
          padding: 'var(--space-2) var(--space-3)',
          borderRadius: 'var(--radius-sm)',
          border: copied === 'failed' ? '1px solid #f87171' : '1px solid var(--color-border)',
          alignItems: 'center',
          marginBottom: 'var(--space-3)',
        }}
      >
        <input
          ref={inputRef}
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          onClick={(e) => e.currentTarget.select()}
          aria-label="Invite link"
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            color: 'var(--color-text)',
            fontSize: 'var(--font-size-xs)',
            outline: 'none',
          }}
        />
        <button
          type="button"
          className="ac-btn ac-btn--primary"
          style={{ padding: 'var(--space-1) var(--space-3)', fontSize: 'var(--font-size-xs)', fontWeight: 'bold', whiteSpace: 'nowrap' }}
          onClick={() => void onCopy()}
        >
          {copyLabel}
        </button>
      </div>
      {canNativeShare() && (
        <button
          type="button"
          className="ac-btn ac-btn--secondary"
          style={{ width: '100%', marginBottom: 'var(--space-3)', justifyContent: 'center' }}
          onClick={() => void onShare()}
        >
          Share invite
        </button>
      )}
      <p className="ac-text-muted" style={{ fontSize: 'var(--font-size-xs)', margin: 0 }}>
        {reconnecting
          ? 'Reconnecting — your invite link stays the same.'
          : copied === 'failed'
            ? 'Automatic copy was blocked. Tap the link to select it, then copy.'
            : 'Anyone with this link can join. Keep this tab open until they connect.'}
      </p>
    </div>
  )
}

function Overlay({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'color-mix(in srgb, var(--color-bg) 75%, transparent)',
      }}
    >
      {children}
    </div>
  )
}

function ResolvedPanel({
  resolution,
  rematchState,
  matchMode,
  gameTitle,
  onRematch,
  onDeclineRematch,
  onFindNewOpponent,
  onPlayPractice,
  onLeave,
}: {
  resolution: MatchResolvedPayload
  rematchState: RematchState
  matchMode?: MatchSocketMode
  gameTitle?: string
  onRematch: () => void
  onDeclineRematch: () => void
  onFindNewOpponent?: () => void
  onPlayPractice?: () => void
  onLeave: () => void
}) {
  const { you, opponent, outcome } = resolution
  const { user, refreshUser } = useAuth()
  const [showRematchConfirm, setShowRematchConfirm] = useState(false)
  const [faucetLoading, setFaucetLoading] = useState(false)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (showRematchConfirm) {
          setShowRematchConfirm(false)
        } else {
          onLeave()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showRematchConfirm, onLeave])

  const isCompetition = matchMode?.kind === 'competition'
  const template = isCompetition ? matchMode.template : undefined
  const entryFeeMinor = template?.entryFeeMinor ?? 500
  const prizeMinor = template?.prizes?.[0]?.amountMinor ?? 900
  const isFree = entryFeeMinor === 0

  let message = ''
  let outcomeBadge = { label: 'RESULT', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.15)', border: '#94a3b8' }

  if (isCompetition) {
    if (outcome === 'win') {
      outcomeBadge = { label: 'VICTORY', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', border: '#10b981' }
      message = 'Result verified by Fugluck server replay.'
    } else if (outcome === 'loss') {
      outcomeBadge = { label: 'DEFEAT', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', border: '#ef4444' }
      message = 'Result verified by Fugluck server replay.'
    } else if (outcome === 'draw') {
      outcomeBadge = { label: 'DRAW', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', border: '#f59e0b' }
      message = 'Both verified scores were equal.'
    } else {
      outcomeBadge = { label: 'RESULT INVALID', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.15)', border: '#94a3b8' }
      message = 'The submitted game result could not be verified.'
    }

    if (you.status === 'forfeited') {
      outcomeBadge = { label: 'MATCH FORFEITED', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', border: '#ef4444' }
      message = 'You forfeited — no result submitted in time.'
    } else if (opponent.status === 'forfeited') {
      outcomeBadge = { label: 'OPPONENT FORFEITED', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', border: '#10b981' }
      message = `${opponent.username} forfeited the match.`
    }
  } else {
    message = you.status === 'forfeited'
      ? 'You forfeited — no result submitted in time.'
      : opponent.status === 'forfeited'
        ? `${opponent.username} forfeited — no result submitted in time.`
        : outcome === 'void'
          ? 'Result voided — a submitted score could not be verified.'
          : outcome === 'win'
            ? '🏆 You Won the Match!'
            : outcome === 'loss'
              ? `${opponent.username} took the victory.`
              : "It's a tie!"

    outcomeBadge = outcome === 'win'
      ? { label: 'VICTORY', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', border: '#10b981' }
      : outcome === 'loss'
        ? { label: 'DEFEAT', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', border: '#ef4444' }
        : outcome === 'draw'
          ? { label: 'DRAW', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', border: '#f59e0b' }
          : { label: 'VOID', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.15)', border: '#94a3b8' }
  }

  const handleRematchClick = () => {
    if (isCompetition) {
      setShowRematchConfirm(true)
    } else {
      onRematch()
    }
  }

  return (
    <Overlay>
      <div
        className="ac-panel"
        style={{
          textAlign: 'center',
          minWidth: 340,
          maxWidth: 460,
          padding: 'var(--space-6)',
          boxShadow: 'var(--shadow-elevate-hover)',
          border: `1px solid ${outcomeBadge.border}`,
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--space-1)',
            background: outcomeBadge.bg,
            color: outcomeBadge.color,
            border: `1px solid ${outcomeBadge.border}`,
            padding: 'var(--space-1) var(--space-3)',
            borderRadius: 'var(--radius-full)',
            fontSize: 'var(--font-size-xs)',
            fontWeight: 'bold',
            marginBottom: 'var(--space-3)',
            letterSpacing: '1.5px',
          }}
        >
          {outcomeBadge.label}
        </div>

        {gameTitle && (
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-1)', textTransform: 'uppercase', letterSpacing: '1px' }}>
            {gameTitle}
          </div>
        )}

        <h2 style={{ margin: '0 0 var(--space-1)', fontSize: 'var(--font-size-2xl)' }}>
          {isCompetition ? outcomeBadge.label : 'Match Complete'}
        </h2>
        <p className="ac-text-muted" style={{ margin: '0 0 var(--space-4)', fontSize: 'var(--font-size-sm)' }}>
          {message}
        </p>

        {isCompetition && (
          <div
            style={{
              background: 'var(--color-surface-raised)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-3)',
              marginBottom: 'var(--space-4)',
            }}
          >
            {outcome === 'win' && (
              <div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: 2 }}>
                  Competition Prize
                </div>
                <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'bold', color: '#10b981' }}>
                  TEST ₾{(prizeMinor / 100).toFixed(2)}
                </div>
              </div>
            )}
            {outcome === 'loss' && (
              <div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: 2 }}>
                  Prize
                </div>
                <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'bold', color: 'var(--color-text-muted)' }}>
                  —
                </div>
              </div>
            )}
            {outcome === 'draw' && (
              <div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: 2 }}>
                  Entry Refunded
                </div>
                <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'bold', color: '#fbbf24' }}>
                  {isFree ? 'FREE' : `TEST ₾${(entryFeeMinor / 100).toFixed(2)}`}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: 2 }}>
                  No competition fee charged.
                </div>
              </div>
            )}
          </div>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 'var(--space-4)',
            background: 'var(--color-surface-raised)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-4)',
            marginBottom: 'var(--space-5)',
          }}
        >
          <ScoreColumn label="You" result={you} isWinner={outcome === 'win'} />
          <ScoreColumn label={opponent.username} result={opponent} isWinner={outcome === 'loss'} />
        </div>

        <RematchControls
          canRematch={resolution.canRematch}
          rematchState={rematchState}
          onRematch={handleRematchClick}
          onDeclineRematch={onDeclineRematch}
          onFindNewOpponent={onFindNewOpponent}
          onPlayPractice={onPlayPractice}
        />

        <div style={{ marginTop: 'var(--space-4)' }}>
          <button
            type="button"
            className="ac-btn ac-btn--ghost"
            onClick={onLeave}
            style={{ width: '100%', fontSize: 'var(--font-size-sm)' }}
          >
            {isCompetition ? 'Back to Competitions' : 'Back to Home'}
            <span style={{ opacity: 0.5, fontSize: 'var(--font-size-xs)', marginLeft: 'var(--space-1)' }}>
              [Esc]
            </span>
          </button>
        </div>

        {/* Rematch Confirmation Modal */}
        {showRematchConfirm && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Rematch Confirmation"
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.75)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 100,
            }}
            onClick={() => setShowRematchConfirm(false)}
          >
            <div
              className="ac-panel"
              style={{
                maxWidth: 400,
                width: '90%',
                padding: 'var(--space-6)',
                textAlign: 'center',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg, 12px)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ margin: '0 0 var(--space-2)', fontSize: 'var(--font-size-xl)' }}>
                REMATCH
              </h3>
              <p className="ac-text-muted" style={{ margin: '0 0 var(--space-4)', fontSize: 'var(--font-size-sm)' }}>
                This creates a new competition entry.
              </p>

              <div
                style={{
                  background: 'var(--color-surface-raised)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: 'var(--space-3)',
                  margin: 'var(--space-3) 0',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 'var(--space-2)',
                }}
              >
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Entry Fee</div>
                  <div style={{ fontWeight: 'bold' }}>
                    {isFree ? 'FREE' : `TEST ₾${(entryFeeMinor / 100).toFixed(2)}`}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Prize</div>
                  <div style={{ fontWeight: 'bold', color: '#10b981' }}>
                    TEST ₾{(prizeMinor / 100).toFixed(2)}
                  </div>
                </div>
              </div>

              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', margin: 'var(--space-3) 0' }}>
                A new entry amount will be reserved.
              </p>

              {user && (user.balances.sandboxGelMinor ?? 0) < entryFeeMinor && !isFree && (
                <div style={{ margin: 'var(--space-3) 0' }}>
                  <p style={{ color: '#f87171', fontSize: '11px', margin: '0 0 var(--space-2)' }}>
                    You do not have enough Sandbox Test GEL to enter another competition.
                  </p>
                  <button
                    type="button"
                    className="ac-btn ac-btn--secondary"
                    disabled={faucetLoading}
                    onClick={async () => {
                      setFaucetLoading(true)
                      try {
                        await apiFetch('/api/competitions/sandbox-faucet', {
                          method: 'POST',
                          body: JSON.stringify({ amountMinor: 10000 }),
                        })
                        await refreshUser()
                      } finally {
                        setFaucetLoading(false)
                      }
                    }}
                    style={{ fontSize: '11px', padding: '4px 10px' }}
                  >
                    {faucetLoading ? 'Adding…' : '[ ADD TEST FUNDS ]'}
                  </button>
                </div>
              )}

              <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
                <button
                  type="button"
                  className="ac-btn ac-btn--ghost"
                  onClick={() => setShowRematchConfirm(false)}
                  style={{ flex: 1 }}
                >
                  CANCEL
                </button>
                <button
                  type="button"
                  className="ac-btn ac-btn--primary"
                  disabled={!isFree && ((user?.balances.sandboxGelMinor ?? 0) < entryFeeMinor)}
                  onClick={() => {
                    setShowRematchConfirm(false)
                    onRematch()
                  }}
                  style={{ flex: 2, fontWeight: 'bold' }}
                >
                  ENTER REMATCH
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Overlay>
  )
}

function RematchControls({
  canRematch,
  rematchState,
  onRematch,
  onDeclineRematch,
  onFindNewOpponent,
  onPlayPractice,
}: {
  canRematch: boolean
  rematchState: RematchState
  onRematch: () => void
  onDeclineRematch: () => void
  onFindNewOpponent?: () => void
  onPlayPractice?: () => void
}) {
  if (rematchState.kind === 'offered') {
    return (
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.25), rgba(251, 191, 36, 0.15))',
          border: '1px solid var(--color-primary)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-4)',
          marginBottom: 'var(--space-2)',
        }}
      >
        <div style={{ fontWeight: 'bold', fontSize: 'var(--font-size-md)', color: 'var(--color-secondary)', marginBottom: 'var(--space-1)' }}>
          ⚔️ Rematch Challenge!
        </div>
        <p className="ac-text-muted" style={{ margin: '0 0 var(--space-4)', fontSize: 'var(--font-size-sm)' }}>
          <strong style={{ color: 'var(--color-text)' }}>{rematchState.fromUsername}</strong> challenged you to a rematch.
        </p>
        <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'center' }}>
          <button
            type="button"
            className="ac-btn ac-btn--primary"
            onClick={onRematch}
            style={{ flex: 1, boxShadow: 'var(--glow-primary)', fontWeight: 'bold' }}
          >
            Accept Rematch
            <span style={{ opacity: 0.7, fontSize: 'var(--font-size-xs)', marginLeft: 'var(--space-1)' }}>[Space / R]</span>
          </button>
          <button
            type="button"
            className="ac-btn ac-btn--ghost"
            onClick={onDeclineRematch}
            style={{ flex: 1 }}
          >
            Decline
            <span style={{ opacity: 0.5, fontSize: 'var(--font-size-xs)', marginLeft: 'var(--space-1)' }}>[Esc]</span>
          </button>
        </div>
      </div>
    )
  }

  if (rematchState.kind === 'waiting') {
    return (
      <div
        style={{
          background: 'var(--color-surface-raised)',
          border: '1px solid var(--color-primary)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-4)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'var(--space-3)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span style={{ animation: 'spin 1.5s linear infinite', display: 'inline-block' }}>⏳</span>
          <span style={{ fontWeight: 'bold', fontSize: 'var(--font-size-sm)' }}>
            Waiting for opponent to accept rematch…
          </span>
        </div>
        {onFindNewOpponent && (
          <button
            type="button"
            className="ac-btn ac-btn--secondary"
            onClick={onFindNewOpponent}
            style={{ width: '100%', fontSize: 'var(--font-size-sm)' }}
          >
            🎯 Find New Opponent Instead
          </button>
        )}
      </div>
    )
  }

  if (rematchState.kind === 'unavailable') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-sm)',
            padding: 'var(--space-2) var(--space-3)',
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-danger)',
          }}
        >
          {rematchState.reason || 'Opponent is not available for a rematch.'}
        </div>
        {onFindNewOpponent && (
          <button
            type="button"
            className="ac-btn ac-btn--primary"
            onClick={onFindNewOpponent}
            style={{ width: '100%', fontWeight: 'bold', boxShadow: 'var(--glow-primary)' }}
          >
            🎯 Find New Opponent
            <span style={{ opacity: 0.7, fontSize: 'var(--font-size-xs)', marginLeft: 'var(--space-1)' }}>[Space / R]</span>
          </button>
        )}
        {onPlayPractice && (
          <button
            type="button"
            className="ac-btn ac-btn--secondary"
            onClick={onPlayPractice}
            style={{ width: '100%', fontSize: 'var(--font-size-sm)' }}
          >
            🕹️ Solo Practice
          </button>
        )}
      </div>
    )
  }

  if (!canRematch) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <div
          style={{
            background: 'rgba(148, 163, 184, 0.1)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            padding: 'var(--space-2) var(--space-3)',
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-text-muted)',
          }}
        >
          Opponent disconnected from rematch window.
        </div>
        {onFindNewOpponent && (
          <button
            type="button"
            className="ac-btn ac-btn--primary"
            onClick={onFindNewOpponent}
            style={{ width: '100%', fontWeight: 'bold', boxShadow: 'var(--glow-primary)' }}
          >
            🎯 Find New Opponent
            <span style={{ opacity: 0.7, fontSize: 'var(--font-size-xs)', marginLeft: 'var(--space-1)' }}>[Space / R]</span>
          </button>
        )}
        {onPlayPractice && (
          <button
            type="button"
            className="ac-btn ac-btn--secondary"
            onClick={onPlayPractice}
            style={{ width: '100%', fontSize: 'var(--font-size-sm)' }}
          >
            🕹️ Solo Practice
          </button>
        )}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <button
        type="button"
        className="ac-btn ac-btn--primary"
        onClick={onRematch}
        style={{
          width: '100%',
          padding: 'var(--space-3) var(--space-5)',
          fontSize: 'var(--font-size-md)',
          fontWeight: 'bold',
          boxShadow: 'var(--glow-primary)',
        }}
      >
        ⚔️ Rematch Opponent
        <span style={{ opacity: 0.7, fontSize: 'var(--font-size-xs)', marginLeft: 'var(--space-1)', fontWeight: 'normal' }}>
          [Space / R]
        </span>
      </button>

      {onFindNewOpponent && (
        <button
          type="button"
          className="ac-btn ac-btn--secondary"
          onClick={onFindNewOpponent}
          style={{ width: '100%', fontSize: 'var(--font-size-sm)', fontWeight: 'bold' }}
        >
          🎯 Find New Opponent
        </button>
      )}
    </div>
  )
}

function ScoreColumn({ label, result, isWinner }: { label: string; result: PlayerResult; isWinner?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div
        className="ac-text-muted"
        style={{
          fontSize: 'var(--font-size-xs)',
          marginBottom: 'var(--space-1)',
          textTransform: 'uppercase',
          letterSpacing: '1px',
          fontWeight: isWinner ? 'bold' : 'normal',
          color: isWinner ? 'var(--color-secondary)' : 'var(--color-text-muted)',
        }}
      >
        {label} {isWinner && '👑'}
      </div>
      <div
        style={{
          fontSize: 'var(--font-size-4xl)',
          fontWeight: 'var(--font-weight-bold)',
          fontFamily: 'var(--font-mono)',
          color: isWinner ? 'var(--color-secondary)' : 'var(--color-text)',
        }}
      >
        {result.status === 'completed' ? result.score : '—'}
      </div>
      {result.status === 'forfeited' && (
        <div className="ac-text-muted" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-danger)' }}>
          forfeited
        </div>
      )}
      {result.status === 'opponent_disconnected' && (
        <div className="ac-text-muted" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-warning)' }}>
          opponent left
        </div>
      )}
      {result.status === 'completed' && result.verdict === 'invalid' && (
        <div className="ac-text-muted" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-danger)' }}>
          score rejected
        </div>
      )}
    </div>
  )
}
