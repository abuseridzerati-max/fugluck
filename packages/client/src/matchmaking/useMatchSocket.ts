import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  ClientToServerEvents,
  CompetitionTemplate,
  MatchedPayload,
  MatchResolvedPayload,
  RematchOfferedPayload,
  ServerToClientEvents,
  SubmitScorePayload,
  TurnMatchEndedPayload,
  TurnMatchErrorPayload,
  TurnMatchStatePayload,
} from '@fugluck/shared'
import { io, type Socket } from 'socket.io-client'
import { API_URL } from '../lib/api'
import { getGuestProof } from '../lib/guestId'

export type MatchmakingConnectionState = 'connecting' | 'queued' | 'matched' | 'reconnecting' | 'closed'

export type CompetitionWaitingState = {
  instanceId: string
  templateId: string
  seatIndex: number
  currentParticipants: number
  participantCapacity: number
  isLocked: boolean
}

export type MatchSocketMode =
  | { kind: 'queue'; stake?: number; currency?: 'COINS' }
  | { kind: 'competition'; templateId: string; template?: CompetitionTemplate }
  | { kind: 'sendInvite'; friendUserId: string }
  | { kind: 'acceptInvite'; inviteId: string }
  | { kind: 'createGuest' }
  | { kind: 'joinGuest'; code: string }
  | { kind: 'resume' }

export type RematchState =
  | { kind: 'idle' }
  | { kind: 'waiting' }
  | { kind: 'offered'; fromUsername: string }
  | { kind: 'unavailable'; reason: string }

export type UseMatchSocketResult = {
  connectionState: MatchmakingConnectionState
  match: MatchedPayload | null
  resolution: MatchResolvedPayload | null
  error: string | null
  waitingLabel: string | null
  guestLinkCode: string | null
  rematchState: RematchState
  competitionWaiting: CompetitionWaitingState | null
  turnMatchState: TurnMatchStatePayload | null
  turnMatchEnded: TurnMatchEndedPayload | null
  turnMatchError: TurnMatchErrorPayload | null
  cancelCompetition: () => void
  submitScore: (payload: SubmitScorePayload) => void
  sendTurnMove: (matchId: string, move: Record<string, unknown>) => void
  resignTurnMatch: (matchId: string) => void
  syncTurnMatch: (matchId: string) => void
  // Evidence-only, fire-and-forget — see PROGRESS.md's freeze-frame Known
  // Gaps entry. No-ops if there's no active match yet (nothing to report
  // against).
  reportVisibilityHidden: (matchId: string) => void
  requestRematch: () => void
  declineRematch: () => void
  disconnect: () => void
}

// Owns exactly one socket connection for one matchmaking attempt — queue,
// outbound friend invite, accept-invite, or guest link. Connect on mount, act, disconnect
// on unmount. Same lifecycle as before; mode only changes the first emit.
export function useMatchSocket(gameId: string, mode: MatchSocketMode = { kind: 'queue' }): UseMatchSocketResult {
  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null)
  const intentionalDisconnectRef = useRef(false)
  const resolutionMatchIdRef = useRef<string | null>(null)
  const hasMatchRef = useRef(false)
  const [connectionState, setConnectionState] = useState<MatchmakingConnectionState>('connecting')
  const [match, setMatch] = useState<MatchedPayload | null>(null)
  const [resolution, setResolution] = useState<MatchResolvedPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [waitingLabel, setWaitingLabel] = useState<string | null>(null)
  const [guestLinkCode, setGuestLinkCode] = useState<string | null>(null)
  const [rematchState, setRematchState] = useState<RematchState>({ kind: 'idle' })
  const [competitionWaiting, setCompetitionWaiting] = useState<CompetitionWaitingState | null>(null)
  const [turnMatchState, setTurnMatchState] = useState<TurnMatchStatePayload | null>(null)
  const [turnMatchEnded, setTurnMatchEnded] = useState<TurnMatchEndedPayload | null>(null)
  const [turnMatchError, setTurnMatchError] = useState<TurnMatchErrorPayload | null>(null)

  useEffect(() => {
    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(API_URL, {
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 8,
      reconnectionDelay: 500,
      reconnectionDelayMax: 4_000,
      autoConnect: false,
    })
    socketRef.current = socket

    function emitModeAction() {
      if (mode.kind === 'queue') {
        setWaitingLabel('Looking for an opponent…')
        socket.emit('joinQueue', { gameId, currency: mode.currency, stake: mode.stake })
      } else if (mode.kind === 'competition') {
        setWaitingLabel('Registering competition entry…')
        socket.emit('competition:join', { templateId: mode.templateId })
      } else if (mode.kind === 'sendInvite') {
        setWaitingLabel('Sending invite…')
        socket.emit('inviteFriend', { friendUserId: mode.friendUserId, gameId })
      } else if (mode.kind === 'acceptInvite') {
        setWaitingLabel('Joining match…')
        socket.emit('respondInvite', { inviteId: mode.inviteId, accept: true })
      } else if (mode.kind === 'createGuest') {
        setWaitingLabel('Creating shareable guest link…')
        socket.emit('createGuestLink', { gameId })
      } else if (mode.kind === 'joinGuest') {
        setWaitingLabel('Joining guest match…')
        socket.emit('joinGuestLink', { code: mode.code })
      } else {
        // The server checks authenticated sockets for an active match before
        // this callback runs and emits the authoritative matched payload when
        // one exists. Do not join a fresh queue while restoring that match.
        setWaitingLabel('Restoring your active match…')
      }
    }

    socket.on('connect', () => {
      setError(null)
      const inPlay = hasMatchRef.current || Boolean(resolutionMatchIdRef.current)
      if (inPlay) {
        setConnectionState('matched')
        return
      }
      setConnectionState('queued')
      emitModeAction()
    })

    socket.on('competition:joined', (payload) => {
      setCompetitionWaiting({
        instanceId: payload.instanceId,
        templateId: payload.templateId,
        seatIndex: payload.seatIndex,
        currentParticipants: payload.currentParticipants,
        participantCapacity: payload.participantCapacity,
        isLocked: payload.currentParticipants >= payload.participantCapacity,
      })
      if (payload.currentParticipants < payload.participantCapacity) {
        setWaitingLabel('Waiting for competitor…')
      } else {
        setWaitingLabel('Competition full! Starting match…')
      }
    })

    const onGuestLinkCreated = (payload: { code: string }) => {
      if (hasMatchRef.current || resolutionMatchIdRef.current) return
      setGuestLinkCode(payload.code)
      setWaitingLabel('Waiting for opponent to join via link…')
    }

    const onGuestLinkPending = (payload: { message: string }) => {
      if (hasMatchRef.current || resolutionMatchIdRef.current) return
      setWaitingLabel(payload.message)
    }

    const onInviteSent = (payload: { inviteId: string; toUsername: string }) => {
      if (hasMatchRef.current || resolutionMatchIdRef.current) return
      if (payload.toUsername === 'Guest Link') {
        setGuestLinkCode(payload.inviteId)
        setWaitingLabel('Waiting for opponent to join via link…')
      } else {
        setWaitingLabel(`Waiting for ${payload.toUsername} to accept…`)
      }
    }

    const onInviteRejected = (payload: { reason?: string }) => {
      // Ignore any late invite expiration/rejection once a match has started.
      if (hasMatchRef.current || resolutionMatchIdRef.current) return
      setError(payload.reason || 'Invite was declined.')
      setConnectionState('closed')
    }

    const onInviteError = (payload: { message: string }) => {
      // Ignore any late invite error once a match has started.
      if (hasMatchRef.current || resolutionMatchIdRef.current) return
      setError(payload.message)
      setConnectionState('closed')
    }

    function teardownInviteListeners() {
      socket.off('guestLinkCreated', onGuestLinkCreated)
      socket.off('guestLinkPending', onGuestLinkPending)
      socket.off('inviteSent', onInviteSent)
      socket.off('inviteRejected', onInviteRejected)
      socket.off('inviteError', onInviteError)
    }

    socket.on('competition:matched', (payload) => {
      hasMatchRef.current = true
      teardownInviteListeners()
      setError(null)
      setGuestLinkCode(null)
      setConnectionState('matched')
      setWaitingLabel(null)
      setRematchState({ kind: 'idle' })
      setResolution(null)
      resolutionMatchIdRef.current = null
      setMatch({
        matchId: payload.matchId,
        gameId: payload.gameId,
        seed: payload.seed,
        opponentUsername: payload.opponentUsername,
      })
    })

    socket.on('competition:cancelled', () => {
      setWaitingLabel('Competition entry cancelled. Your reserved test funds have been returned.')
      setConnectionState('closed')
    })

    socket.on('competition:error', (payload) => {
      let friendlyMsg = payload.message || 'Competition error.'
      if (payload.code === 'INSUFFICIENT_FUNDS') {
        friendlyMsg = 'Insufficient Sandbox Test GEL. Please add test funds to enter.'
      } else if (payload.code === 'GUEST_NOT_ALLOWED') {
        friendlyMsg = 'Guest users cannot enter paid sandbox competitions. Please log in.'
      } else if (payload.code === 'TEMPLATE_DISABLED') {
        friendlyMsg = 'This competition is currently unavailable.'
      } else if (payload.code === 'ALREADY_REGISTERED') {
        friendlyMsg = 'You are already registered in this competition.'
      } else if (payload.code === 'GAME_NOT_ELIGIBLE') {
        friendlyMsg = 'This game is not eligible for paid sandbox competitions.'
      }
      setError(friendlyMsg)
      setConnectionState('closed')
    })

    socket.on('guestLinkCreated', onGuestLinkCreated)
    socket.on('guestLinkPending', onGuestLinkPending)
    socket.on('inviteSent', onInviteSent)
    socket.on('inviteRejected', onInviteRejected)
    socket.on('inviteError', onInviteError)

    socket.on('matched', (payload) => {
      hasMatchRef.current = true
      teardownInviteListeners()
      setError(null)
      setGuestLinkCode(null)
      setConnectionState('matched')
      setWaitingLabel(null)
      setRematchState({ kind: 'idle' })
      setResolution(null)
      setTurnMatchState(null)
      setTurnMatchEnded(null)
      setTurnMatchError(null)
      resolutionMatchIdRef.current = null
      setMatch(payload)
    })

    socket.on('turn_match:state', (payload) => {
      setTurnMatchError(null)
      setTurnMatchState(payload)
    })

    socket.on('turn_match:ended', (payload) => {
      setTurnMatchEnded(payload)
      setTurnMatchState(payload.finalState)
    })

    socket.on('turn_match:error', (payload) => {
      setTurnMatchError(payload)
    })

    socket.on('matchResolved', (payload) => {
      resolutionMatchIdRef.current = payload.matchId
      setRematchState(payload.canRematch ? { kind: 'idle' } : { kind: 'unavailable', reason: 'Opponent left.' })
      setResolution(payload)
    })

    socket.on('rematchOffered', (payload: RematchOfferedPayload) => {
      setRematchState({ kind: 'offered', fromUsername: payload.fromUsername })
    })

    socket.on('rematchWaiting', () => {
      setRematchState({ kind: 'waiting' })
    })

    socket.on('rematchUnavailable', (payload) => {
      setRematchState({ kind: 'unavailable', reason: payload.reason })
    })

    socket.on('queueError', (payload) => {
      if (resolutionMatchIdRef.current) {
        setRematchState({ kind: 'unavailable', reason: payload.message })
        return
      }
      setError(payload.message)
    })

    socket.on('connect_error', (err) => {
      if (intentionalDisconnectRef.current) return
      setError(err.message || 'Could not connect to matchmaking.')
      setConnectionState('closed')
    })

    socket.on('disconnect', (reason) => {
      if (intentionalDisconnectRef.current || reason === 'io client disconnect') {
        setConnectionState('closed')
        return
      }
      setConnectionState('reconnecting')
      setWaitingLabel('Connection interrupted, reconnecting…')
    })

    socket.io.on('reconnect_failed', () => {
      if (intentionalDisconnectRef.current) return
      setError('Could not reconnect to matchmaking.')
      setConnectionState('closed')
    })

    // Reconnect can emit `matched` immediately during the server connection
    // callback. Attach every listener before opening the transport so that
    // authoritative resume payload cannot be missed.
    void getGuestProof().then(guestTicket => {
      if (intentionalDisconnectRef.current) return;
      socket.auth={...(socket.auth as Record<string,unknown>),guestTicket};
      socket.connect();
    }).catch(() => {
      if (intentionalDisconnectRef.current) return;
      setError('Could not establish a guest connection. Please retry.');
      setConnectionState('closed');
    });

    return () => {
      intentionalDisconnectRef.current = true
      teardownInviteListeners()
      if (mode.kind === 'createGuest' && !hasMatchRef.current) {
        socket.emit('cancelGuestLink')
      }
      socket.disconnect()
      socketRef.current = null
    }
    // Mode/gameId are fixed for the lifetime of one MatchLoader instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submitScore = useCallback((payload: SubmitScorePayload) => {
    socketRef.current?.emit('submitScore', payload)
  }, [])

  const sendTurnMove = useCallback((matchId: string, move: Record<string, unknown>) => {
    socketRef.current?.emit('turn_match:move', { matchId, move })
  }, [])

  const resignTurnMatch = useCallback((matchId: string) => {
    socketRef.current?.emit('turn_match:resign', { matchId })
  }, [])

  const syncTurnMatch = useCallback((matchId: string) => {
    socketRef.current?.emit('turn_match:sync', { matchId })
  }, [])

  const reportVisibilityHidden = useCallback((matchId: string) => {
    socketRef.current?.emit('visibilityHidden', { matchId })
  }, [])

  const requestRematch = useCallback(() => {
    const matchId = resolutionMatchIdRef.current
    if (!matchId) return
    setRematchState({ kind: 'waiting' })
    socketRef.current?.emit('requestRematch', { matchId })
  }, [])

  const declineRematch = useCallback(() => {
    const matchId = resolutionMatchIdRef.current
    if (!matchId) return
    socketRef.current?.emit('declineRematch', { matchId })
    setRematchState({ kind: 'unavailable', reason: 'Rematch declined.' })
  }, [])

  const cancelCompetition = useCallback(() => {
    if (competitionWaiting?.instanceId) {
      socketRef.current?.emit('competition:cancel', { instanceId: competitionWaiting.instanceId })
    }
  }, [competitionWaiting?.instanceId])

  const disconnect = useCallback(() => {
    intentionalDisconnectRef.current = true
    const socket = socketRef.current
    if (!socket) return
    if (mode.kind === 'createGuest' && !hasMatchRef.current) {
      socket.emit('cancelGuestLink')
    }
    if (competitionWaiting?.instanceId && !competitionWaiting.isLocked) {
      socket.emit('competition:cancel', { instanceId: competitionWaiting.instanceId })
    }
    const matchId = resolutionMatchIdRef.current
    if (matchId) {
      socket.emit('declineRematch', { matchId })
    }
    socket.disconnect()
  }, [mode.kind, competitionWaiting?.instanceId, competitionWaiting?.isLocked])

  return {
    connectionState,
    match,
    resolution,
    error,
    waitingLabel,
    guestLinkCode,
    rematchState,
    competitionWaiting,
    turnMatchState,
    turnMatchEnded,
    turnMatchError,
    cancelCompetition,
    submitScore,
    sendTurnMove,
    resignTurnMatch,
    syncTurnMatch,
    reportVisibilityHidden,
    requestRematch,
    declineRematch,
    disconnect,
  }
}
