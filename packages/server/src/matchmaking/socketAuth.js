import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { SESSION_COOKIE_NAME, verifySessionToken } from "../auth/jwt";
import { db } from "../db/client";
import { users } from "../db/schema";
function extractSessionCookie(cookieHeader) {
    if (!cookieHeader)
        return null;
    for (const part of cookieHeader.split(";")) {
        const separatorIndex = part.indexOf("=");
        if (separatorIndex === -1)
            continue;
        const name = part.slice(0, separatorIndex).trim();
        if (name === SESSION_COOKIE_NAME)
            return part.slice(separatorIndex + 1).trim();
    }
    return null;
}
function extractSessionToken(socket) {
    const cookieToken = extractSessionCookie(socket.handshake.headers.cookie);
    if (cookieToken)
        return cookieToken;
    const handshakeAuth = socket.handshake.auth;
    if (handshakeAuth?.token)
        return handshakeAuth.token;
    const authHeader = socket.handshake.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
        return authHeader.substring(7);
    }
    return null;
}
// Socket.IO connection middleware — mirrors attachSession + requireAuth from
// the Express auth middleware, applied to the handshake instead of a request.
// Allows unauthenticated guests with ephemeral IDs for Free-Play instant matches.
export async function socketAuthMiddleware(socket, next) {
    const token = extractSessionToken(socket);
    const payload = token ? verifySessionToken(token) : null;
    if (!payload) {
        const handshakeAuth = socket.handshake.auth;
        const handshakeQuery = socket.handshake.query;
        const isGuest = Boolean(handshakeAuth?.isGuest || handshakeQuery?.guestId);
        if (isGuest) {
            const rawId = handshakeAuth?.guestId || handshakeQuery?.guestId || randomUUID().slice(0, 6);
            socket.data.userId = `guest_${rawId}`;
            socket.data.username = `Guest_${rawId.slice(0, 4)}`;
            socket.data.isGuest = true;
            next();
            return;
        }
        next(new Error("unauthorized"));
        return;
    }
    const user = await db.query.users.findFirst({ where: eq(users.id, payload.sub) });
    if (!user) {
        next(new Error("unauthorized"));
        return;
    }
    socket.data.userId = user.id;
    socket.data.username = user.username;
    socket.data.isGuest = false;
    next();
}
