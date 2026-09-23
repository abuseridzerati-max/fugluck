import { AuthorityRuntime, type AuthorityOptions } from '../competitions/authorityRuntime';
import { templateService } from '../competitions/templateService';
import { AUTHORITY_VERSION } from '@fugluck/shared';
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
export function attachMatchmaking(httpServer: HttpServer, _opts?: { clientOrigin?: string; authorityOptions?: AuthorityOptions }): MatchmakingServer {
  // Trigger crash recovery for any uncompleted active matches from a prior server run
  const startup = recoverOrphanMatches().then(() => lifecycleEngine.recoverOrphanCompetitions());

  const io: MatchmakingServer = new Server(httpServer, {
    cors: socketIoCorsOptions,
    maxHttpBufferSize: 1 * 1024 * 1024, // 1MB payload buffer limit protection
  });

  const authority = new AuthorityRuntime(undefined, _opts?.authorityOptions);
  io.engine.on('close', () => authority.close());
  httpServer.once('close', () => authority.close());
  io.use(socketAuthMiddleware);

  setOnQueueChange(() => {
    io.emit("queueStateUpdate", { entries: getPublicQueueState() });
  });

  io.on("connection", (socket: MatchmakingSocket) => {
    registerPresence(socket);
    authority.register(socket);
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
        await startup;
        const template = await templateService.getTemplate(templateId);
        if (process.env.ENABLE_COMPETITION_AUTHORITY !== 'true' || template?.gameId !== 'space-blaster' || template.rulesVersion !== AUTHORITY_VERSION || template.format !== 'HEAD_TO_HEAD' || template.participantCapacity !== 2) {
          throw new Error('Competition gameplay is blocked pending live authority acceptance.');
        }
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
          await authority.create(joinResult.instanceId);
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

    const handleCancelCompetition = async (payload: { instanceId: string }) => {
      if (!payload?.instanceId) {
        socket.emit("competition:error", {
          code: "INVALID_PAYLOAD",
          message: "A valid instanceId must be provided to cancel entry.",
        });
        return;
      }

      try {
        const owned = await instanceService.getInstance(payload.instanceId);
        if (socket.data.isGuest || !owned?.participants.some(p => p.userId === socket.data.userId)) throw new Error('Participant ownership required.');
        const cancelResult = await lifecycleEngine.cancelUnfilledInstance(
          payload.instanceId,
          new SandboxAccountingAdapter(),
          "User cancelled entry before match lock",
        );

        if (cancelResult.cancelled) {
          socket.emit("competition:cancelled", {
            instanceId: payload.instanceId,
            reason: "User cancelled entry before match lock",
          });
        } else {
          socket.emit("competition:error", {
            code: "CANCEL_REJECTED",
            message: "Cannot cancel entry. The competition may already be locked or started.",
          });
        }
      } catch (err: any) {
        socket.emit("competition:error", {
          code: err.code || "COMPETITION_CANCEL_FAILED",
          message: err.message || "Failed to cancel competition entry.",
        });
      }
    };

    socket.on("competition:cancel", handleCancelCompetition);

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
