import type { AuthorityBinding, AuthorityControls, AuthoritySnapshot, AuthorityOutcome } from './authority';
// Wire protocol for casual matchmaking. TEST GEL prize competitions use the
// separate durable competition and authority protocol.
export type JoinQueuePayload = {
  gameId: string;
  currency?: "COINS" | "DIAMONDS";
  stake?: number;
};

export type MatchedPayload = {
  matchId: string;
  gameId: string;
  seed: number;
  opponentUsername: string;
};
export type SubmitScorePayload = {
  matchId: string;
  score: number;
  reason: string;
};

// Casual scores are client-reported and have no prize or wallet authority.

// Explicit result-state union, not a `forfeited: boolean` + sentinel score —
// a casual score report has no prize authority, but a missing submission
// still needs a distinct reason so the interface can describe what happened:
// "never played because the opponent left" has to be a real,
// distinct state from "scored zero" or "forfeited by timeout," not something
// encoded into a free-form `reason` string alongside a fake `score: 0`. Three
// states:
//  - "completed": a casual client score was submitted; it is not independently verified.
//  - "forfeited": never submitted anything, by choice or timeout (idle,
//    tabbed away, deliberately withholding, or the FORFEIT_GRACE_MS window
//    expired). See PROGRESS.md's forfeit-timeout section for why this is a
//    loss for them (the submitter wins) rather than voiding the match.
//  - "opponent_disconnected": this player's own run was still in progress —
//    never submitted, never had the chance to — when their opponent left.
//    Not their fault, not a forfeit; the match resolved because of the OTHER
//    side's action, not this side's inaction. See packages/server/src/
//    matchmaking/matches.ts's handleDisconnect and PROGRESS.md's session log.
export type PlayerResult =
  | { username: string; score: number; reason: string; status: "completed" }
  | { username: string; score: null; reason: null; status: "forfeited" }
  | { username: string; score: null; reason: null; status: "opponent_disconnected" };

// Outcome is already relative to the recipient (mirrors you/opponent, which
// emitResolved personalizes per socket) — "win"/"loss" from the recipient's
// own perspective, so the client never has to compare scores itself. "void"
// means neither player submitted a casual score; see matchOutcome.ts.
export type MatchOutcome = "win" | "loss" | "draw" | "void";

export type MatchResolvedPayload = {
  matchId: string;
  outcome: MatchOutcome;
  you: PlayerResult;
  opponent: PlayerResult;
  // True when the opponent is still on the results screen and a rematch can
  // be offered. False after a disconnect resolution or if they already left.
  canRematch: boolean;
};

// Evidence-only — logged server-side, never affects a casual match outcome.
// Sent by the client whenever document.visibilitychange fires hidden, for as
// long as MatchLoader is mounted (queued through resolved/ended), not just
// during active play — see PROGRESS.md's freeze-frame Known Gaps entry for
// why this is one signal among a client-side-only set, not a real defense on
// its own (a modified client can simply never emit it).
export type VisibilityHiddenPayload = {
  matchId: string;
};

export type QueueErrorPayload = {
  message: string;
};

// Direct friend invite — private match using the same async seeded flow as
// random queue pairing. Invite state is in-memory only (same as the queue).
export type InviteFriendPayload = {
  friendUserId: string;
  gameId: string;
};

export type RespondInvitePayload = {
  inviteId: string;
  accept: boolean;
};

export type InviteReceivedPayload = {
  inviteId: string;
  fromUserId: string;
  fromUsername: string;
  gameId: string;
};

export type InviteRejectedPayload = {
  inviteId: string;
  reason: string;
};

export type InviteErrorPayload = {
  message: string;
};

export type QueueStateEntry = {
  socketId: string;
  userId: string;
  username: string;
  avatarUrl?: string | null;
  gameId: string;
  currency: "COINS" | "DIAMONDS";
  stake: number;
  queuedAt: number;
};

export type QueueStateUpdatePayload = {
  entries: QueueStateEntry[];
};

export type GuestLinkCreatedPayload = {
  code: string;
  gameId: string;
  expiresAt: number;
};

export type GuestLinkPendingPayload = {
  message: string;
};

export type RematchOfferedPayload = {
  matchId: string;
  fromUsername: string;
};

export type RematchWaitingPayload = {
  matchId: string;
};

export type RematchUnavailablePayload = {
  matchId: string;
  reason: string;
};

export type JoinCompetitionPayload = {
  templateId: string;
};

export type CompetitionJoinedPayload = {
  instanceId: string;
  templateId: string;
  seatIndex: number;
  currentParticipants: number;
  participantCapacity: number;
};

export type CompetitionMatchedPayload = {
  matchId: string;
  instanceId: string;
  gameId: string;
  seed: number;
  opponentUsername: string;
};

export type CompetitionErrorPayload = {
  code: string;
  message: string;
};

export interface ClientToServerEvents {
  'authority:ready': (payload: AuthorityBinding) => void;
  'authority:controls': (payload: AuthorityControls) => void;
  'authority:resume': (payload: { instanceId: string }) => void;
  'authority:forfeit': (payload: AuthorityBinding) => void;
  joinQueue: (payload: JoinQueuePayload) => void;
  submitScore: (payload: SubmitScorePayload) => void;
  visibilityHidden: (payload: VisibilityHiddenPayload) => void;
  inviteFriend: (payload: InviteFriendPayload) => void;
  respondInvite: (payload: RespondInvitePayload) => void;
  // Cancel a pending invite you sent (or leave the "waiting for accept" screen).
  cancelInvite: (payload: { inviteId: string }) => void;
  createGuestLink: (payload: { gameId: string }) => void;
  joinGuestLink: (payload: { code: string }) => void;
  // Host explicitly cancelled the waiting screen — destroy the link immediately
  // rather than waiting out the reconnect grace window.
  cancelGuestLink: () => void;
  requestRematch: (payload: { matchId: string }) => void;
  declineRematch: (payload: { matchId: string }) => void;
  "competition:join"?: (payload: JoinCompetitionPayload) => void;
  joinCompetition?: (payload: JoinCompetitionPayload) => void;
  "competition:cancel"?: (payload: { instanceId: string }) => void;
}

export interface ServerToClientEvents {
  'authority:probe': (ack: () => void) => void;
  'authority:session': (payload: AuthorityBinding) => void;
  'authority:snapshot': (payload: AuthoritySnapshot) => void;
  'authority:outcome': (payload: AuthorityOutcome) => void;
  'authority:error': (payload: { code: string }) => void;
  matched: (payload: MatchedPayload) => void;
  matchResolved: (payload: MatchResolvedPayload) => void;
  queueError: (payload: QueueErrorPayload) => void;
  inviteReceived: (payload: InviteReceivedPayload) => void;
  inviteRejected: (payload: InviteRejectedPayload) => void;
  inviteError: (payload: InviteErrorPayload) => void;
  // Echoed to the inviter so the waiting UI knows which inviteId to cancel.
  inviteSent: (payload: { inviteId: string; gameId: string; toUsername: string }) => void;
  guestLinkCreated: (payload: GuestLinkCreatedPayload) => void;
  guestLinkPending: (payload: GuestLinkPendingPayload) => void;
  rematchOffered: (payload: RematchOfferedPayload) => void;
  rematchWaiting: (payload: RematchWaitingPayload) => void;
  rematchUnavailable: (payload: RematchUnavailablePayload) => void;
  // Real-time broadcast of waiting players in the public matchmaking lobby.
  queueStateUpdate: (payload: QueueStateUpdatePayload) => void;
  "competition:joined"?: (payload: CompetitionJoinedPayload) => void;
  "competition:matched"?: (payload: CompetitionMatchedPayload) => void;
  "competition:error"?: (payload: CompetitionErrorPayload) => void;
  "competition:cancelled"?: (payload: { instanceId: string; reason: string }) => void;
}
