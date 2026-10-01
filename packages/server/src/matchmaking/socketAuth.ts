import { randomUUID } from "node:crypto";
import type { ClientToServerEvents, ServerToClientEvents } from "@fugluck/shared";
import type { DefaultEventsMap, Socket } from "socket.io";
import { SESSION_COOKIE_NAME, verifySessionToken, verifySocketTicket, verifyGuestTicket } from "../auth/jwt";
import { sessionUser, trackSessionSocket } from '../auth/session';
import type { SessionTokenPayload } from '../auth/jwt';
import { checkSocketRateLimit } from '../utils/rateLimiter';

// The trust boundary: userId comes from the verified session cookie, and
// username is looked up here from that same verified userId — never taken
// from anything the client sends over the socket. Unauthenticated guests
// are issued ephemeral guest_ IDs for zero-registration instant play.
export type MatchmakingSocketData = {
  userId: string;
  username: string;
  isGuest?: boolean;
  isEmailVerified?: boolean;
  sessionPayload?: SessionTokenPayload;
};

export type MatchmakingSocket = Socket<ClientToServerEvents, ServerToClientEvents, DefaultEventsMap, MatchmakingSocketData>;

function extractSessionCookie(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const separatorIndex = part.indexOf("=");
    if (separatorIndex === -1) continue;
    const name = part.slice(0, separatorIndex).trim();
    if (name === SESSION_COOKIE_NAME) return part.slice(separatorIndex + 1).trim();
  }
  return null;
}

function extractSessionToken(socket: MatchmakingSocket): string | null {
  const cookieToken = extractSessionCookie(socket.handshake.headers.cookie);
  if (cookieToken) return cookieToken;

  const handshakeAuth = socket.handshake.auth as { token?: string } | undefined;
  if (handshakeAuth?.token) return handshakeAuth.token;

  const authHeader = socket.handshake.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }

  return null;
}

// Socket.IO connection middleware — mirrors attachSession + requireAuth from
// the Express auth middleware, applied to the handshake instead of a request.
// Allows unauthenticated guests with ephemeral IDs for Free-Play instant matches.
export async function socketAuthMiddleware(socket: MatchmakingSocket, next: (err?: Error) => void): Promise<void> {
  try {
  const auth = socket.handshake.auth as { socketTicket?: unknown } | undefined;
  const hasTicket = Boolean(auth && Object.prototype.hasOwnProperty.call(auth, 'socketTicket'));
  const token = extractSessionToken(socket);
  const payload = hasTicket ? verifySocketTicket(auth?.socketTicket) : token ? verifySessionToken(token) : null;
  if ((hasTicket || token) && !payload) { next(new Error('unauthorized')); return; }
  if (!payload) {
    // Unauthenticated connections are guests. Instant invite links and free
    // play must work without a prior login — requiring an explicit `isGuest`
    // handshake flag made copied links fail for anyone who wasn't already
    // signed in.
    const handshakeAuth = socket.handshake.auth as {guestTicket?:unknown} | undefined;
    const guestId = verifyGuestTicket(handshakeAuth?.guestTicket);
    if (handshakeAuth && Object.prototype.hasOwnProperty.call(handshakeAuth,'guestTicket') && !guestId) {
      next(new Error('unauthorized')); return;
    }
    // Public guest IDs are identifiers, never proof of ownership. A proofless
    // socket gets a new server identity; a signed capability permits reconnect.
    socket.data.userId = guestId ?? `guest_${randomUUID()}`;
    socket.data.username = `Guest_${socket.data.userId.slice(6,10)}`;
    socket.data.isGuest = true;
    socket.data.isEmailVerified = false;
    next();
    return;
  }

  const user = payload.sessionPurpose === 'user' ? await sessionUser(payload) : null;
  if (!user) {
    next(new Error("unauthorized"));
    return;
  }

  if (user.status === "banned" || user.status === "suspended") {
    next(new Error("account_suspended"));
    return;
  }

  socket.data.userId = user.id;
  socket.data.username = user.username;
  socket.data.isGuest = false;
  socket.data.isEmailVerified = user.isEmailVerified ?? false;
  socket.data.sessionPayload = payload;
  next();
  } catch {
    next(new Error('authentication_unavailable'));
  }
}

/** Recheck protected actions and long-lived sessions; do not query the DB for every control frame. */
export function guardSocketSession(socket: MatchmakingSocket): void {
  const payload = socket.data.sessionPayload;
  if (!payload) return;
  const forget = trackSessionSocket(payload, () => socket.disconnect(true));
  async function valid() {
    try {
      const user = await sessionUser(payload!);
      if (!user || user.status !== 'active') return false;
      socket.data.isEmailVerified = user.isEmailVerified ?? false;
      return true;
    } catch { return false; }
  }
  const interval = setInterval(() => { void valid().then(ok => { if (!ok) socket.disconnect(true); }); }, 10_000);
  interval.unref();
  socket.once('disconnect', () => { clearInterval(interval); forget(); });
  const protectedEvents = new Set(['joinQueue', 'competition:join', 'joinCompetition', 'competition:cancel',
    'inviteFriend', 'respondInvite', 'requestRematch', 'authority:resume']);
  socket.use(([event], done) => {
    if (!protectedEvents.has(event)) { done(); return; }
    if (!checkSocketRateLimit(payload.sub, 'session-actions', 30, 10_000)) {
      done(new Error('rate_limited')); return;
    }
    void valid().then(ok => {
      if (ok) done(); else { done(new Error('unauthorized')); socket.disconnect(true); }
    });
  });
}
