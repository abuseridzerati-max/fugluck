import type { Server as HttpServer } from "node:http";
import type { ClientToServerEvents, ServerToClientEvents } from "@fugluck/shared";
import { Server, type DefaultEventsMap } from "socket.io";
import {
  cancelInvitesForSocket,
  handleCancelGuestLink,
  handleCancelInvite,
  handleCreateGuestLink,
  handleInviteFriend,
  handleJoinGuestLink,
  handleRespondInvite,
} from "./invites";
import {
  createMatch,
  handleDeclineRematch,
  handleDisconnect,
  handleReconnect,
  handleRequestRematch,
  isSocketInMatch,
  recoverOrphanMatches,
  submitScore,
} from "./matches";
import { getOnlineSocket, registerPresence, unregisterPresence } from "./presence";
import { enqueue, generateSeed, getPublicQueueState, isValidGameId, setOnQueueChange, tryPair } from "./queue";
import { socketAuthMiddleware, type MatchmakingSocket, type MatchmakingSocketData } from "./socketAuth";

import { checkSocketRateLimit } from "../utils/rateLimiter";
import { socketIoCorsOptions } from "../config/cors";
import { instanceService, lifecycleEngine } from "../competitions";
import { SandboxAccountingAdapter } from "../accounting";

export type MatchmakingServer = Server<ClientToServerEvents, ServerToClientEvents, DefaultEventsMap, MatchmakingSocketData>;

// Sole entry point for this module: builds the Socket.IO server, wires
// session auth and the queue/match event handlers, and returns it. Nothing
// outside this file reaches into queue.ts/matches.ts directly.
export function attachMatchmaking(httpServer: HttpServer, _opts?: { clientOrigin?: string }): MatchmakingServer {
  // Trigger crash recovery for any uncompleted active matches from a prior server run
  void recoverOrphanMatches();
  void lifecycleEngine.recoverOrphanCompetitions();

  const io: MatchmakingServer = new Server(httpServer, {
    cors: socketIoCorsOptions,
    maxHttpBufferSize: 1 * 1024 * 1024, // 1MB payload buffer limit protection
  });

  io.use(socketAuthMiddleware);

  setOnQueueChange(() => {
    io.emit("queueStateUpdate", { entries: getPublicQueueState() });
  });

  io.on("connection", (socket: MatchmakingSocket) => {
    registerPresence(socket);
    handleReconnect(socket.data.userId, socket);
    socket.emit("queueStateUpdate", { entries: getPublicQueueState() });

    socket.on("joinQueue", async (payload) => {
      if (!checkSocketRateLimit(socket.id, "joinQueue", 6, 10_000)) {
        socket.emit("queueError", { message: "Too many queue requests. Please wait a moment." });
        return;
      }

      if (!payload || typeof payload.gameId !== "string" || !isValidGameId(payload.gameId)) {
        socket.emit("queueError", { message: "Unknown game." });
        return;
      }

      const currency = payload.currency === "DIAMONDS" ? "DIAMONDS" : "COINS";
      let stake = typeof payload.stake === "number" && Number.isFinite(payload.stake) && payload.stake > 0 ? Math.floor(payload.stake) : 0;
      if (stake > 100_000) stake = 100_000;

      if (stake > 0 && socket.data.isGuest) {
        socket.emit("queueError", { message: "guests_cannot_wager" });
        return;
      }

      if (stake > 0 && !socket.data.isEmailVerified) {
        socket.emit("queueError", { message: "Email verification is required for wagering matches." });
        return;
      }

      enqueue(payload.gameId, socket, currency, stake);
      const pair = tryPair(payload.gameId, currency, stake);
      if (pair) {
        const [a, b] = pair;
        await createMatch(payload.gameId, a, b, generateSeed());
      }
    });

    const handleJoinCompetition = async (payload: any) => {
      if (!checkSocketRateLimit(socket.id, "joinCompetition", 6, 10_000)) {
        socket.emit("competition:error", {
          code: "RATE_LIMITED",
          message: "Too many competition join requests. Please wait a moment.",
        });
        return;
      }

      // Guest Restriction (Section 10)
      if (socket.data.isGuest) {
        socket.emit("competition:error", {
          code: "GUEST_NOT_ALLOWED",
          message: "Guests are not permitted to enter competitions.",
        });
        return;
      }

      if (!payload || typeof payload.templateId !== "string") {
        socket.emit("competition:error", {
          code: "INVALID_PAYLOAD",
          message: "A valid templateId must be provided.",
        });
        return;
      }

      // Client financial inputs are strictly ignored per Section 9
      const templateId = payload.templateId;

      try {
        const joinResult = await instanceService.joinCompetitionQueue(
          templateId,
          socket.data.userId,
          new SandboxAccountingAdapter(),
          { isGuest: Boolean(socket.data.isGuest) },
        );

        socket.emit("competition:joined", {
          instanceId: joinResult.instanceId,
          templateId: joinResult.templateId,
          seatIndex: joinResult.seatIndex,
          currentParticipants: joinResult.currentParticipants,
          participantCapacity: joinResult.participantCapacity,
        });

        // If instance is locked (2/2 for head to head), activate match
        if (joinResult.isLocked) {
          const matchResult = await lifecycleEngine.activateLockedCompetition(
            joinResult.instanceId,
            new SandboxAccountingAdapter(),
          );

          const p1Socket = getOnlineSocket(matchResult.player1Id);
          const p2Socket = getOnlineSocket(matchResult.player2Id);

          if (p1Socket) {
            p1Socket.emit("competition:matched", {
              matchId: matchResult.matchId,
              instanceId: joinResult.instanceId,
              gameId: matchResult.gameId,
              seed: matchResult.seed,
              opponentUsername: p2Socket?.data?.username ?? "Opponent",
            });
            p1Socket.emit("matched", {
              matchId: matchResult.matchId,
              gameId: matchResult.gameId,
              seed: matchResult.seed,
              opponentUsername: p2Socket?.data?.username ?? "Opponent",
            });
          }
          if (p2Socket) {
            p2Socket.emit("competition:matched", {
              matchId: matchResult.matchId,
              instanceId: joinResult.instanceId,
              gameId: matchResult.gameId,
              seed: matchResult.seed,
              opponentUsername: p1Socket?.data?.username ?? "Opponent",
            });
            p2Socket.emit("matched", {
              matchId: matchResult.matchId,
              gameId: matchResult.gameId,
              seed: matchResult.seed,
              opponentUsername: p1Socket?.data?.username ?? "Opponent",
            });
          }
        }
      } catch (err: any) {
        socket.emit("competition:error", {
          code: err.code || "COMPETITION_JOIN_FAILED",
          message: err.message || "Failed to join competition.",
        });
      }
    };

    socket.on("competition:join", handleJoinCompetition);
    socket.on("joinCompetition", handleJoinCompetition);

    socket.on("challengeFriend" as any, () => {
      socket.emit("inviteError", { message: "Paid private friend challenges are prohibited." });
    });

    socket.on("inviteFriend", (payload) => {
      if (!checkSocketRateLimit(socket.id, "inviteFriend", 6, 10_000)) {
        socket.emit("inviteError", { message: "Too many invite requests." });
        return;
      }
      void handleInviteFriend(socket, payload);
    });

    socket.on("respondInvite", (payload) => {
      if (!checkSocketRateLimit(socket.id, "respondInvite", 10, 10_000)) return;
      handleRespondInvite(socket, payload);
    });

    socket.on("cancelInvite", (payload) => {
      if (!checkSocketRateLimit(socket.id, "cancelInvite", 10, 10_000)) return;
      handleCancelInvite(socket, payload);
    });

    socket.on("createGuestLink", (payload) => {
      if (!checkSocketRateLimit(socket.id, "createGuestLink", 6, 10_000)) return;
      handleCreateGuestLink(socket, payload);
    });

    socket.on("joinGuestLink", (payload) => {
      if (!checkSocketRateLimit(socket.id, "joinGuestLink", 6, 10_000)) return;
      handleJoinGuestLink(socket, payload);
    });

    socket.on("cancelGuestLink", () => {
      if (!checkSocketRateLimit(socket.id, "cancelGuestLink", 10, 10_000)) return;
      handleCancelGuestLink(socket);
    });

    socket.on("requestRematch", (payload) => {
      if (!checkSocketRateLimit(socket.id, "requestRematch", 6, 10_000)) return;
      handleRequestRematch(socket, payload);
    });

    socket.on("declineRematch", (payload) => {
      if (!checkSocketRateLimit(socket.id, "declineRematch", 10, 10_000)) return;
      handleDeclineRematch(socket, payload);
    });

    socket.on("submitScore", (payload) => {
      if (!checkSocketRateLimit(socket.id, "submitScore", 2, 5_000)) return;
      submitScore(socket, payload);
    });

    // Evidence only — no state, no verdict impact. See PROGRESS.md's
    // freeze-frame Known Gaps entry: this and the client-side auto-forfeit
    // are both things a modified client can simply not do, so this is one
    // signal to look at later, not an enforcement mechanism.
    socket.on("visibilityHidden", (payload) => {
      if (!checkSocketRateLimit(socket.id, "visibilityHidden", 5, 10_000)) return;
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
