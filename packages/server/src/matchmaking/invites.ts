import { randomUUID } from "node:crypto";
import { and, eq, or } from "drizzle-orm";
import { db } from "../db/client";
import { friendships } from "../db/schema";
import { createMatch, getMatchIdForSocket } from "./matches";
import { getOnlineSocket } from "./presence";
import { generateSeed, isValidGameId, removeFromQueue, type QueueEntry } from "./queue";
import type { MatchmakingSocket } from "./socketAuth";

export const INVITE_TTL_MS = 60_000;
export const GUEST_LINK_TTL_MS = 600_000; // 10 minutes
export const GUEST_LINK_RECONNECT_GRACE_MS = 45_000;

let inviteTtlOverrideForTests: number | null = null;
let guestLinkTtlOverrideForTests: number | null = null;
let guestReconnectGraceOverrideForTests: number | null = null;
let areFriendsOverrideForTests: ((a: string, b: string) => Promise<boolean>) | null = null;
let createMatchOverrideForTests: typeof createMatch | null = null;

export function configureInviteTimersForTests(options: {
  inviteTtlMs?: number | null;
  guestLinkTtlMs?: number | null;
  guestReconnectGraceMs?: number | null;
  areFriends?: ((a: string, b: string) => Promise<boolean>) | null;
  createMatch?: typeof createMatch | null;
}): void {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("Invite timer test controls require NODE_ENV=test.");
  }
  inviteTtlOverrideForTests = options.inviteTtlMs ?? null;
  guestLinkTtlOverrideForTests = options.guestLinkTtlMs ?? null;
  guestReconnectGraceOverrideForTests = options.guestReconnectGraceMs ?? null;
  areFriendsOverrideForTests = options.areFriends ?? null;
  createMatchOverrideForTests = options.createMatch ?? null;
}

function effectiveInviteTtlMs(): number {
  return inviteTtlOverrideForTests ?? INVITE_TTL_MS;
}

function effectiveGuestLinkTtlMs(): number {
  return guestLinkTtlOverrideForTests ?? GUEST_LINK_TTL_MS;
}

function effectiveGuestReconnectGraceMs(): number {
  return guestReconnectGraceOverrideForTests ?? GUEST_LINK_RECONNECT_GRACE_MS;
}

type InviteStatus = "PENDING" | "ACCEPTED" | "CANCELLED" | "EXPIRED";

type PendingInvite = {
  id: string;
  from: MatchmakingSocket;
  toUserId: string;
  gameId: string;
  status: InviteStatus;
  expiresAt: number;
  timer: ReturnType<typeof setTimeout>;
};

const pendingById = new Map<string, PendingInvite>();
// At most one outbound invite per inviter socket.
const pendingByFromSocket = new Map<MatchmakingSocket, string>();
// Tracks users whose accepted invite is currently creating a match asynchronously.
const inFlightMatchUsers = new Set<string>();

function isSocketInOrEnteringMatch(socket: MatchmakingSocket | null | undefined): boolean {
  if (!socket) return false;
  return Boolean(getMatchIdForSocket(socket) || inFlightMatchUsers.has(socket.data.userId));
}

function unrefTimer(timer: ReturnType<typeof setTimeout>): void {
  if (typeof timer === "object" && timer !== null && "unref" in timer) {
    (timer as { unref: () => void }).unref();
  }
}

async function areFriends(a: string, b: string): Promise<boolean> {
  if (areFriendsOverrideForTests) return areFriendsOverrideForTests(a, b);
  const row = await db.query.friendships.findFirst({
    where: and(
      eq(friendships.status, "accepted"),
      or(
        and(eq(friendships.requesterId, a), eq(friendships.addresseeId, b)),
        and(eq(friendships.requesterId, b), eq(friendships.addresseeId, a)),
      ),
    ),
  });
  return Boolean(row);
}

function clearInvite(
  invite: PendingInvite,
  nextStatus: Exclude<InviteStatus, "PENDING">,
  notifyFrom: boolean,
  reason?: string,
): void {
  clearTimeout(invite.timer);
  const wasPending = invite.status === "PENDING";
  if (wasPending) {
    invite.status = nextStatus;
  }
  pendingById.delete(invite.id);
  if (pendingByFromSocket.get(invite.from) === invite.id) {
    pendingByFromSocket.delete(invite.from);
  }
  if (
    wasPending &&
    notifyFrom &&
    nextStatus !== "ACCEPTED" &&
    invite.from.connected &&
    reason &&
    !isSocketInOrEnteringMatch(invite.from)
  ) {
    invite.from.emit("inviteRejected", { inviteId: invite.id, reason });
  }
}

function clearPendingInvitesForSocketSilently(socket: MatchmakingSocket): void {
  const outboundId = pendingByFromSocket.get(socket);
  if (outboundId) {
    const invite = pendingById.get(outboundId);
    if (invite) clearInvite(invite, "CANCELLED", false);
  }
  // Also clear any pending outbound invites owned by this userId on another socket.
  for (const invite of [...pendingById.values()]) {
    if (invite.from.data.userId === socket.data.userId) {
      clearInvite(invite, "CANCELLED", false);
    }
  }
  const guestCode = guestLinksByUserId.get(socket.data.userId);
  if (guestCode) {
    const link = guestLinksByCode.get(guestCode);
    if (link) destroyGuestLink(link, "CANCELLED");
  }
}

/**
 * Cancels any lingering pending friend invites or guest links held by either
 * match participant without emitting expiry/rejection errors to active players.
 */
export function clearPendingInvitesForMatchStart(a: MatchmakingSocket, b: MatchmakingSocket): void {
  clearPendingInvitesForSocketSilently(a);
  clearPendingInvitesForSocketSilently(b);
}

export function cancelInvitesForSocket(socket: MatchmakingSocket): void {
  // Only clear invites this socket sent. Do NOT clear invites addressed to
  // this userId — the invitee may disconnect a presence socket and
  // immediately reconnect in MatchLoader to accept.
  const outboundId = pendingByFromSocket.get(socket);
  if (outboundId) {
    const invite = pendingById.get(outboundId);
    if (invite && invite.status === "PENDING") {
      const target = getOnlineSocket(invite.toUserId);
      clearInvite(invite, "CANCELLED", false);
      if (target && !isSocketInOrEnteringMatch(target)) {
        target.emit("inviteRejected", { inviteId: invite.id, reason: "Inviter went offline." });
      }
    }
  }

  parkGuestLinkForReconnect(socket);
}

export async function handleInviteFriend(
  socket: MatchmakingSocket,
  payload: { friendUserId?: unknown; gameId?: unknown },
): Promise<void> {
  if (isSocketInOrEnteringMatch(socket)) return;
  if (!payload || typeof payload.friendUserId !== "string" || typeof payload.gameId !== "string") {
    socket.emit("inviteError", { message: "Invalid invite." });
    return;
  }
  // Section 11: Paid private friend challenges remain prohibited
  if ("templateId" in (payload as any) || "entryFee" in (payload as any) || (payload as any).isPaid) {
    socket.emit("inviteError", { message: "Paid private friend challenges are prohibited." });
    return;
  }
  if (!isValidGameId(payload.gameId)) {
    socket.emit("inviteError", { message: "Unknown game." });
    return;
  }
  if (payload.friendUserId === socket.data.userId) {
    socket.emit("inviteError", { message: "You can't invite yourself." });
    return;
  }
  if (!(await areFriends(socket.data.userId, payload.friendUserId))) {
    if (socket.connected && !isSocketInOrEnteringMatch(socket)) {
      socket.emit("inviteError", { message: "You can only invite accepted friends." });
    }
    return;
  }

  // Re-check after async DB query in case the inviter entered a match or disconnected.
  if (!socket.connected || isSocketInOrEnteringMatch(socket)) return;

  const target = getOnlineSocket(payload.friendUserId);
  if (!target) {
    socket.emit("inviteError", { message: "That friend is offline." });
    return;
  }

  // Replace any prior outbound invite from this socket.
  const priorId = pendingByFromSocket.get(socket);
  if (priorId) {
    const prior = pendingById.get(priorId);
    if (prior) clearInvite(prior, "CANCELLED", false);
  }

  const inviteId = randomUUID();
  const ttlMs = effectiveInviteTtlMs();
  const timer = setTimeout(() => {
    const invite = pendingById.get(inviteId);
    if (invite && invite.status === "PENDING" && !isSocketInOrEnteringMatch(invite.from)) {
      clearInvite(invite, "EXPIRED", true, "Invite expired.");
    } else if (invite) {
      clearInvite(invite, "CANCELLED", false);
    }
  }, ttlMs);
  unrefTimer(timer);

  const invite: PendingInvite = {
    id: inviteId,
    from: socket,
    toUserId: payload.friendUserId,
    gameId: payload.gameId,
    status: "PENDING",
    expiresAt: Date.now() + ttlMs,
    timer,
  };
  pendingById.set(inviteId, invite);
  pendingByFromSocket.set(socket, inviteId);

  socket.emit("inviteSent", {
    inviteId,
    gameId: payload.gameId,
    toUsername: target.data.username,
  });
  target.emit("inviteReceived", {
    inviteId,
    fromUserId: socket.data.userId,
    fromUsername: socket.data.username,
    gameId: payload.gameId,
  });
}

export function handleRespondInvite(
  socket: MatchmakingSocket,
  payload: { inviteId?: unknown; accept?: unknown },
): void {
  if (isSocketInOrEnteringMatch(socket)) return;
  if (!payload || typeof payload.inviteId !== "string" || typeof payload.accept !== "boolean") {
    socket.emit("inviteError", { message: "Invalid invite response." });
    return;
  }

  const invite = pendingById.get(payload.inviteId);
  if (!invite || invite.status !== "PENDING" || invite.toUserId !== socket.data.userId) {
    socket.emit("inviteError", { message: "Invite not found or expired." });
    return;
  }

  if (!payload.accept) {
    clearInvite(invite, "CANCELLED", true, "Invite declined.");
    return;
  }

  if (!invite.from.connected) {
    clearInvite(invite, "CANCELLED", false);
    socket.emit("inviteError", { message: "Inviter went offline." });
    return;
  }

  // Pull both out of any random queue before starting the private match.
  removeFromQueue(invite.from);
  removeFromQueue(socket);

  const a: QueueEntry = {
    socket: invite.from,
    userId: invite.from.data.userId,
    username: invite.from.data.username,
    currency: "COINS",
    stake: 0,
  };
  const b: QueueEntry = {
    socket,
    userId: socket.data.userId,
    username: socket.data.username,
    currency: "COINS",
    stake: 0,
  };

  // Mark ACCEPTED and clear its timer immediately before async match creation,
  // and cancel any other pending invites/guest links held by either player.
  clearInvite(invite, "ACCEPTED", false);
  clearPendingInvitesForMatchStart(invite.from, socket);
  inFlightMatchUsers.add(a.userId);
  inFlightMatchUsers.add(b.userId);

  const launchMatch = createMatchOverrideForTests ?? createMatch;
  void launchMatch(invite.gameId, a, b, generateSeed()).finally(() => {
    inFlightMatchUsers.delete(a.userId);
    inFlightMatchUsers.delete(b.userId);
  });
}

export function handleCancelInvite(socket: MatchmakingSocket, payload: { inviteId?: unknown }): void {
  if (!payload || typeof payload.inviteId !== "string") return;
  const invite = pendingById.get(payload.inviteId);
  if (!invite || invite.status !== "PENDING" || invite.from !== socket) return;
  const target = getOnlineSocket(invite.toUserId);
  clearInvite(invite, "CANCELLED", false);
  if (target && !isSocketInOrEnteringMatch(target)) {
    target.emit("inviteRejected", { inviteId: payload.inviteId, reason: "Invite cancelled." });
  }
}

type GuestInviteLink = {
  code: string;
  hostUserId: string;
  hostUsername: string;
  hostSocket: MatchmakingSocket | null;
  gameId: string;
  status: InviteStatus;
  createdAt: number;
  expiresAt: number;
  ttlTimer: ReturnType<typeof setTimeout>;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  pendingJoiner: MatchmakingSocket | null;
};

const guestLinksByCode = new Map<string, GuestInviteLink>();
const guestLinksByUserId = new Map<string, string>();

function generateGuestCode(): string {
  for (let i = 0; i < 8; i++) {
    const code = randomUUID().replace(/-/g, "").slice(0, 12);
    if (!guestLinksByCode.has(code)) return code;
  }
  return randomUUID().replace(/-/g, "");
}

function destroyGuestLink(
  link: GuestInviteLink,
  nextStatus: Exclude<InviteStatus, "PENDING">,
  pendingReason?: string,
): void {
  clearTimeout(link.ttlTimer);
  if (link.reconnectTimer) {
    clearTimeout(link.reconnectTimer);
    link.reconnectTimer = null;
  }
  const wasPending = link.status === "PENDING";
  if (wasPending) {
    link.status = nextStatus;
  }
  guestLinksByCode.delete(link.code);
  if (guestLinksByUserId.get(link.hostUserId) === link.code) {
    guestLinksByUserId.delete(link.hostUserId);
  }
  const pending = link.pendingJoiner;
  link.pendingJoiner = null;
  if (
    wasPending &&
    nextStatus !== "ACCEPTED" &&
    pendingReason &&
    pending?.connected &&
    !isSocketInOrEnteringMatch(pending)
  ) {
    pending.emit("inviteError", { message: pendingReason });
  }
}

function emitGuestLinkCreated(socket: MatchmakingSocket, link: GuestInviteLink): void {
  socket.emit("inviteSent", {
    inviteId: link.code,
    gameId: link.gameId,
    toUsername: "Guest Link",
  });
  socket.emit("guestLinkCreated", {
    code: link.code,
    gameId: link.gameId,
    expiresAt: link.expiresAt,
  });
}

function startGuestMatch(link: GuestInviteLink, guest: MatchmakingSocket): void {
  if (link.status !== "PENDING") return;

  const host = link.hostSocket;
  if (!host || !host.connected) {
    if (link.pendingJoiner && link.pendingJoiner !== guest && link.pendingJoiner.connected) {
      guest.emit("inviteError", { message: "Someone else is already joining this link." });
      return;
    }
    link.pendingJoiner = guest;
    guest.emit("guestLinkPending", { message: "Waiting for the host to reconnect…" });
    return;
  }

  if (host.data.userId === guest.data.userId) {
    guest.emit("inviteError", { message: "You cannot join your own guest link." });
    return;
  }

  removeFromQueue(host);
  removeFromQueue(guest);

  const a: QueueEntry = {
    socket: host,
    userId: host.data.userId,
    username: host.data.username,
    currency: "COINS",
    stake: 0,
  };
  const b: QueueEntry = {
    socket: guest,
    userId: guest.data.userId,
    username: guest.data.username,
    currency: "COINS",
    stake: 0,
  };

  const gameId = link.gameId;
  destroyGuestLink(link, "ACCEPTED");
  clearPendingInvitesForMatchStart(host, guest);
  inFlightMatchUsers.add(a.userId);
  inFlightMatchUsers.add(b.userId);

  const launchMatch = createMatchOverrideForTests ?? createMatch;
  void launchMatch(gameId, a, b, generateSeed()).finally(() => {
    inFlightMatchUsers.delete(a.userId);
    inFlightMatchUsers.delete(b.userId);
  });
}

function parkGuestLinkForReconnect(socket: MatchmakingSocket): void {
  const code = guestLinksByUserId.get(socket.data.userId);
  if (!code) return;
  const link = guestLinksByCode.get(code);
  if (!link || link.status !== "PENDING" || (link.hostSocket && link.hostSocket !== socket)) return;

  link.hostSocket = null;
  if (link.reconnectTimer) clearTimeout(link.reconnectTimer);
  link.reconnectTimer = setTimeout(() => {
    const active = guestLinksByCode.get(code);
    if (active && active.status === "PENDING" && !active.hostSocket?.connected) {
      destroyGuestLink(active, "EXPIRED", "Guest invite link expired or host is offline.");
    }
  }, effectiveGuestReconnectGraceMs());
  unrefTimer(link.reconnectTimer);
}

export function getGuestLinkInfo(code: string): {
  valid: boolean;
  gameId?: string;
  hostUsername?: string;
  hostOnline?: boolean;
  error?: string;
} {
  const link = guestLinksByCode.get(code);
  if (!link || link.status !== "PENDING") {
    return { valid: false, error: "Guest invite link expired or host is offline." };
  }
  return {
    valid: true,
    gameId: link.gameId,
    hostUsername: link.hostUsername,
    hostOnline: Boolean(link.hostSocket?.connected),
  };
}

export function handleCancelGuestLink(socket: MatchmakingSocket): void {
  const code = guestLinksByUserId.get(socket.data.userId);
  if (!code) return;
  const link = guestLinksByCode.get(code);
  if (!link || link.status !== "PENDING") return;
  destroyGuestLink(link, "CANCELLED", "The host cancelled this invite.");
}

export function handleCreateGuestLink(socket: MatchmakingSocket, payload: { gameId?: unknown }): void {
  if (isSocketInOrEnteringMatch(socket)) return;
  if (!payload || typeof payload.gameId !== "string" || !isValidGameId(payload.gameId)) {
    socket.emit("inviteError", { message: "Invalid game for guest link." });
    return;
  }

  const existingCode = guestLinksByUserId.get(socket.data.userId);
  if (existingCode) {
    const existing = guestLinksByCode.get(existingCode);
    if (existing && existing.status === "PENDING" && existing.gameId === payload.gameId) {
      existing.hostSocket = socket;
      existing.hostUsername = socket.data.username;
      if (existing.reconnectTimer) {
        clearTimeout(existing.reconnectTimer);
        existing.reconnectTimer = null;
      }
      emitGuestLinkCreated(socket, existing);
      if (existing.pendingJoiner?.connected) {
        const joiner = existing.pendingJoiner;
        existing.pendingJoiner = null;
        startGuestMatch(existing, joiner);
      }
      return;
    }
    if (existing) destroyGuestLink(existing, "CANCELLED", "The host started a new invite.");
  }

  const code = generateGuestCode();
  const ttlMs = effectiveGuestLinkTtlMs();
  const expiresAt = Date.now() + ttlMs;
  const ttlTimer = setTimeout(() => {
    const active = guestLinksByCode.get(code);
    if (active && active.status === "PENDING") {
      destroyGuestLink(active, "EXPIRED", "Guest invite link expired or host is offline.");
    }
  }, ttlMs);
  unrefTimer(ttlTimer);

  const link: GuestInviteLink = {
    code,
    hostUserId: socket.data.userId,
    hostUsername: socket.data.username,
    hostSocket: socket,
    gameId: payload.gameId,
    status: "PENDING",
    createdAt: Date.now(),
    expiresAt,
    ttlTimer,
    reconnectTimer: null,
    pendingJoiner: null,
  };
  guestLinksByCode.set(code, link);
  guestLinksByUserId.set(socket.data.userId, code);
  emitGuestLinkCreated(socket, link);
}

export function handleJoinGuestLink(socket: MatchmakingSocket, payload: { code?: unknown }): void {
  if (isSocketInOrEnteringMatch(socket)) return;
  if (!payload || typeof payload.code !== "string") {
    socket.emit("inviteError", { message: "Invalid guest link code." });
    return;
  }

  const link = guestLinksByCode.get(payload.code);
  if (!link || link.status !== "PENDING") {
    socket.emit("inviteError", { message: "Guest invite link expired or host is offline." });
    return;
  }

  startGuestMatch(link, socket);
}
