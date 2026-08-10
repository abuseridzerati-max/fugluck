import type { Server as HttpServer } from "node:http";
import type { ClientToServerEvents, ServerToClientEvents } from "@arcadeclash/shared";
import { Server, type DefaultEventsMap } from "socket.io";
import {
  cancelInvitesForSocket,
  handleCancelInvite,
  handleCreateGuestLink,
  handleInviteFriend,
  handleJoinGuestLink,
  handleRespondInvite,
} from "./invites";
import { createMatch, handleDisconnect, handleReconnect, isSocketInMatch, submitScore } from "./matches";
import { registerPresence, unregisterPresence } from "./presence";
import { enqueue, generateSeed, isValidGameId, tryPair } from "./queue";
import { socketAuthMiddleware, type MatchmakingSocket, type MatchmakingSocketData } from "./socketAuth";

export type MatchmakingServer = Server<ClientToServerEvents, ServerToClientEvents, DefaultEventsMap, MatchmakingSocketData>;

// Sole entry point for this module: builds the Socket.IO server, wires
// session auth and the queue/match event handlers, and returns it. Nothing
// outside this file reaches into queue.ts/matches.ts directly.
export function attachMatchmaking(httpServer: HttpServer, opts: { clientOrigin: string }): MatchmakingServer {
  const io: MatchmakingServer = new Server(httpServer, {
    cors: { origin: opts.clientOrigin, credentials: true },
  });

  io.use(socketAuthMiddleware);

  io.on("connection", (socket: MatchmakingSocket) => {
    registerPresence(socket);
    handleReconnect(socket.data.userId, socket);

    socket.on("joinQueue", (payload) => {
      if (!payload || typeof payload.gameId !== "string" || !isValidGameId(payload.gameId)) {
        socket.emit("queueError", { message: "Unknown game." });
        return;
      }

      const currency = payload.currency === "DIAMONDS" ? "DIAMONDS" : "COINS";
      const stake = typeof payload.stake === "number" && payload.stake > 0 ? Math.floor(payload.stake) : 0;

      enqueue(payload.gameId, socket, currency, stake);
      const pair = tryPair(payload.gameId, currency, stake);
      if (pair) {
        const [a, b] = pair;
        createMatch(payload.gameId, a, b, generateSeed());
      }
    });

    socket.on("inviteFriend", (payload) => {
      void handleInviteFriend(socket, payload);
    });

    socket.on("respondInvite", (payload) => {
      handleRespondInvite(socket, payload);
    });

    socket.on("cancelInvite", (payload) => {
      handleCancelInvite(socket, payload);
    });

    socket.on("createGuestLink" as any, (payload: any) => {
      handleCreateGuestLink(socket, payload);
    });

    socket.on("joinGuestLink" as any, (payload: any) => {
      handleJoinGuestLink(socket, payload);
    });

    socket.on("submitScore", (payload) => {
      submitScore(socket, payload);
    });

    // Evidence only — no state, no verdict impact. See PROGRESS.md's
    // freeze-frame Known Gaps entry: this and the client-side auto-forfeit
    // are both things a modified client can simply not do, so this is one
    // signal to look at later, not an enforcement mechanism.
    socket.on("visibilityHidden", (payload) => {
      if (!payload || typeof payload.matchId !== "string" || !isSocketInMatch(socket, payload.matchId)) return;
      console.warn(`[matchmaking] visibility-hidden reported: match=${payload.matchId} user=${socket.data.username}`);
    });

    socket.on("disconnect", () => {
      cancelInvitesForSocket(socket);
      unregisterPresence(socket);
      handleDisconnect(socket);
    });
  });

  return io;
}
