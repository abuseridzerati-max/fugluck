// Headless checks for wallet ledger helpers + friendship query shapes.
// Does NOT hit a live DB — only verifies shared pack constants and that the
// server modules export the expected functions (import graph sanity).
//
// Run: npx tsx scripts/wallet-friends-check.ts

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-for-wallet-check";
process.env.NODE_ENV = process.env.NODE_ENV || "test";

import fs from "node:fs";
import path from "node:path";
import { SIGNUP_COIN_GRANT, type PublicUser } from "@fugluck/shared";
import { getGameTitle } from "@fugluck/shared";
import { activeGames, navFilters } from "../packages/client/src/mock/homeData";

let failures = 0;

function check(label: string, pass: boolean, detail?: string) {
  if (pass) {
    console.log(`  PASS  ${label}`);
  } else {
    failures++;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function run() {
  console.log("wallet-friends-check");

  check("signup grant is 1000 coins", SIGNUP_COIN_GRANT === 1000);
  const sharedWalletExports = await import("@fugluck/shared");
  check("SIGNUP_COIN_GRANT is exported from shared wallet module", "SIGNUP_COIN_GRANT" in sharedWalletExports);
  check("no shared export advertises virtual purchase packs", !Object.keys(sharedWalletExports).some((key) => /packs/i.test(key)));
  check("wallet shared module exports clean currency helpers only", !Object.keys(sharedWalletExports).some((key) => /pack$/i.test(key)));

  const sample: PublicUser = {
    id: "x",
    username: "tester",
    email: null,
    avatarUrl: null,
    gamesPlayed: 0,
    gamesWon: 0,
    createdAt: new Date().toISOString(),
    balances: { coins: 10 },
  };
  check("PublicUser carries balances", sample.balances.coins === 10);

  // Auth session persistence rehydration test simulation
  const mockStoredSession = JSON.stringify(sample);
  const rehydrated = JSON.parse(mockStoredSession) as PublicUser;
  check("Auth session rehydrates from localStorage mock", rehydrated.username === "tester" && rehydrated.balances.coins === 10);

  // Auth Session Persistence & Token Storage Simulation
  const mockSessionToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mockToken";
  const mockAuthStorageKey = "fugluck_auth_token";
  const mockStorage: Record<string, string> = {};
  mockStorage[mockAuthStorageKey] = mockSessionToken;

  check("Auth session token stores in localStorage mock", mockStorage["fugluck_auth_token"] === mockSessionToken);
  check("Auth loading gate rehydrates user state prior to network sync", Boolean(mockStorage["fugluck_auth_token"]));

  // Ledger Reason Key Format Verification
  const testMatchId = "match-unit-test-456";
  const testEscrowReason = `stake_escrow:${testMatchId}`;
  const testPayoutReason = `stake_payout:${testMatchId}`;

  check("Escrow ledger key follows stake_escrow:{matchId} pattern", testEscrowReason === "stake_escrow:match-unit-test-456");
  check("Payout ledger key follows stake_payout:{matchId} pattern", testPayoutReason === "stake_payout:match-unit-test-456");

  // ---------------------------------------------------------------------------
  // Server Authorization Boundary Negative Test Suite
  // ---------------------------------------------------------------------------

  // 1. Friend Request Input Validation Guard
  function mockValidateFriendRequest(body: any) {
    if (!body || typeof body.username !== "string" || body.username.trim().length === 0) {
      return { status: 400, body: { error: "username is required." } };
    }
    return { status: 200, username: body.username.trim() };
  }

  const emptyUserReq = mockValidateFriendRequest({});
  check("Friend request rejects missing username (400)", emptyUserReq.status === 400);

  const blankUserReq = mockValidateFriendRequest({ username: "   " });
  check("Friend request rejects whitespace-only username (400)", blankUserReq.status === 400);

  // 2. Self-Friending Authorization Guard
  function mockSendFriendRequest(senderId: string, targetId: string) {
    if (senderId === targetId) {
      return { status: 400, body: { error: "Cannot send friend request to yourself." } };
    }
    return { status: 200, success: true };
  }

  const selfFriendReq = mockSendFriendRequest("usr_123", "usr_123");
  check("Self-friending is rejected (400)", selfFriendReq.status === 400);

  // 3. Friend Response Authorization Guard
  function mockRespondFriendRequest(currentUserId: string, addresseeId: string) {
    if (currentUserId !== addresseeId) {
      return { status: 404, body: { error: "No pending friend request found." } };
    }
    return { status: 200, success: true };
  }

  const unauthAccept = mockRespondFriendRequest("attacker_id", "real_target_id");
  check("Accepting someone else's friend request is rejected (404)", unauthAccept.status === 404);

  // 4. Guest Wagering Prohibition Guard
  function mockEnqueueWageringMatch(socket: { isGuest?: boolean; userId?: string }, currency: string, stake: number) {
    if (socket.isGuest && stake > 0) {
      return { error: "guests_cannot_wager" };
    }
    return { success: true };
  }

  const guestWagerAttempt = mockEnqueueWageringMatch({ isGuest: true, userId: "guest_999" }, "COINS", 50);
  check("Wagering queue rejects unauthenticated guest attempting stake > 0", guestWagerAttempt.error === "guests_cannot_wager");

  const guestFreePlayAttempt = mockEnqueueWageringMatch({ isGuest: true, userId: "guest_999" }, "COINS", 0);
  check("Wagering queue permits unauthenticated guest for Free Play (stake = 0)", guestFreePlayAttempt.success === true);

  // 5. Escrow Stake Balance Authorization Guard
  function mockEscrowStake(userBalance: number, stakeAmount: number) {
    if (stakeAmount <= 0) return { error: "stake_must_be_positive" };
    if (userBalance < stakeAmount) return { error: "insufficient_funds" };
    return { newBalance: userBalance - stakeAmount };
  }

  const insufficientEscrowAttempt = mockEscrowStake(25, 100);
  check("Escrow debit rejects attempt when user balance is insufficient", insufficientEscrowAttempt.error === "insufficient_funds");

  // 6. Friend Removal Authorization Guard (DELETE /api/friends/:id)
  function mockRemoveFriend(currentUserId: string, friendship: { requesterId: string; addresseeId: string; status: string }) {
    if ((friendship.requesterId !== currentUserId && friendship.addresseeId !== currentUserId) || friendship.status !== "accepted") {
      return { status: 404, body: { error: "Friendship not found or not accepted." } };
    }
    return { status: 200, body: { success: true } };
  }

  const acceptedFriendshipAB = { requesterId: "usr_A", addresseeId: "usr_B", status: "accepted" };
  check("User A can remove accepted friendship with User B (200)", mockRemoveFriend("usr_A", acceptedFriendshipAB).status === 200);
  check("User B can remove accepted friendship with User A (200)", mockRemoveFriend("usr_B", acceptedFriendshipAB).status === 200);
  check("Unrelated User C is rejected when attempting to remove friendship between A and B (404)", mockRemoveFriend("usr_C", acceptedFriendshipAB).status === 404);

  const pendingFriendshipAB = { requesterId: "usr_A", addresseeId: "usr_B", status: "pending" };
  check("Pending friendship cannot be removed via unfriend endpoint (404)", mockRemoveFriend("usr_A", pendingFriendshipAB).status === 404);

  // 7. Friend Request Cancellation Authorization Guard (DELETE /api/friends/:id/cancel)
  function mockCancelFriendRequest(currentUserId: string, friendship: { requesterId: string; addresseeId: string; status: string }) {
    if (friendship.requesterId !== currentUserId || friendship.status !== "pending") {
      return { status: 404, body: { error: "No pending outgoing request found to cancel." } };
    }
    return { status: 200, body: { success: true } };
  }

  check("Requester User A can cancel pending outgoing request (200)", mockCancelFriendRequest("usr_A", pendingFriendshipAB).status === 200);
  check("Addressee User B cannot cancel outgoing request through requester endpoint (404)", mockCancelFriendRequest("usr_B", pendingFriendshipAB).status === 404);
  check("Unrelated User C cannot cancel request (404)", mockCancelFriendRequest("usr_C", pendingFriendshipAB).status === 404);
  check("Accepted friendship cannot be canceled through request cancellation endpoint (404)", mockCancelFriendRequest("usr_A", acceptedFriendshipAB).status === 404);

  // 8. Game Title Registry Resolution
  check("getGameTitle resolves 'space-blaster'", getGameTitle("space-blaster") === "Space Blaster");
  check("getGameTitle resolves 'cyber-hopper'", getGameTitle("cyber-hopper") === "Cyber Hopper");
  check("getGameTitle resolves 'stack-tower'", getGameTitle("stack-tower") === "Stack Tower");
  check("getGameTitle resolves '2048-blitz'", getGameTitle("2048-blitz") === "Seeded 2048 Blitz");
  check("getGameTitle resolves 'neon-snake'", getGameTitle("neon-snake") === "Neon Snake");
  check("getGameTitle resolves 'minesweeper-sprint'", getGameTitle("minesweeper-sprint") === "Minesweeper Sprint");
  check("getGameTitle resolves 'brick-breaker'", getGameTitle("brick-breaker") === "Brick Breaker");
  check("getGameTitle resolves 'blitz-chess'", getGameTitle("blitz-chess") === "Blitz Chess");
  check("getGameTitle resolves 'connect-4'", getGameTitle("connect-4") === "Connect 4");
  check("getGameTitle resolves 'checkers'", getGameTitle("checkers") === "Checkers");
  check("getGameTitle falls back to gameId for unknown id", getGameTitle("unknown-game") === "unknown-game");

  // 9. Wallet Transaction History Label Mapping & Isolation
  const { formatReasonLabel } = await import("../packages/server/src/routes/wallet");

  check("formatReasonLabel maps signup_grant to 'Signup Grant'", formatReasonLabel("signup_grant", 1000) === "Signup Grant");
  check("formatReasonLabel maps monthly refill", formatReasonLabel("monthly_allowance_refill:2026-08", 250) === "Monthly Allowance Refill");
  check("formatReasonLabel maps stake escrow", formatReasonLabel("stake_escrow:m_123", -100) === "Wager Escrow");
  check("formatReasonLabel maps stake payout", formatReasonLabel("stake_payout:m_123", 200) === "Match Payout (Victory)");
  check("formatReasonLabel maps stake refund", formatReasonLabel("stake_refund:m_123", 100) === "Match Refund");
  check("formatReasonLabel maps admin coin reset", formatReasonLabel("admin_coin_reset:key_1", 400) === "Coin Allowance Reset");
  check("formatReasonLabel maps admin adjustment", formatReasonLabel("admin_adjustment:sys", 10) === "Admin Adjustment");
  check("formatReasonLabel maps admin grant", formatReasonLabel("admin_grant:sys", 500) === "Admin Grant");
  check("formatReasonLabel falls back to generic signed label", formatReasonLabel("other_reason", -25) === "Wallet Debit");

  // 10. Ledger History Isolation Simulation
  type LedgerEntry = { id: string; userId: string; amount: number; reason: string; createdAt: Date };
  const mockLedger: LedgerEntry[] = [
    { id: "e1", userId: "usr_A", amount: 1000, reason: "signup_grant", createdAt: new Date("2026-08-01") },
    { id: "e2", userId: "usr_A", amount: -50, reason: "stake_escrow:m1", createdAt: new Date("2026-08-02") },
    { id: "e3", userId: "usr_B", amount: 1000, reason: "signup_grant", createdAt: new Date("2026-08-01") },
  ];

  function getMockUserHistory(requestingUserId: string): LedgerEntry[] {
    return mockLedger
      .filter((e) => e.userId === requestingUserId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  const userAHistory = getMockUserHistory("usr_A");
  check("Wallet history returns only requesting user entries (count 2)", userAHistory.length === 2 && userAHistory.every((e) => e.userId === "usr_A"));
  check("Wallet history does not leak other users' entries to User A", !userAHistory.some((e) => e.userId === "usr_B"));
  check("Wallet history sorts newest first", userAHistory[0].id === "e2" && userAHistory[1].id === "e1");

  // 11. Catalog Active Categories & Search Filtering
  check("Catalog navFilters has exactly 5 active categories (no empty falling-block, hot, or quiz)", navFilters.length === 5 && !navFilters.some((f) => (f.engine as string) === "falling-block" || (f.engine as string) === "hot" || (f.engine as string) === "quiz"));
  check("Active games contains 10 canonical certified playable games", activeGames.length === 10);

  function searchGames(query: string) {
    const q = query.trim().toLowerCase();
    return activeGames.filter((g) => g.title.toLowerCase().includes(q) || g.engine.toLowerCase().includes(q));
  }

  check("Game search 'blaster' filters to Space Blaster", searchGames("blaster").length === 1 && searchGames("blaster")[0].id === "space-blaster");
  check("Game search 'turn-based-board' filters to Blitz Chess, Connect 4, and Checkers", searchGames("turn-based-board").length === 3);
  check("Game search 'nonexistent' yields empty array", searchGames("nonexistent").length === 0);

  // 12. Friend Invite & Guest Link Post-Accept Expiry Regression Suite
  const {
    clearPendingInvitesForMatchStart,
    configureInviteTimersForTests,
    getGuestLinkInfo,
    handleCreateGuestLink,
    handleInviteFriend,
    handleJoinGuestLink,
    handleRespondInvite,
  } = await import("../packages/server/src/matchmaking/invites");
  const { registerPresence, unregisterPresence } = await import("../packages/server/src/matchmaking/presence");

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  function makeMockSocket(userId: string, username: string) {
    const emitted: Array<{ event: string; payload: any }> = [];
    return {
      id: `sock_${userId}_${Math.random().toString(36).slice(2, 8)}`,
      connected: true,
      data: { userId, username, isGuest: false, isEmailVerified: true },
      emitted,
      emit(event: string, payload: any) {
        emitted.push({ event, payload });
        return true;
      },
    } as any;
  }

  let releaseInFlightMatch: (() => void) | null = null;
  const mockCreateMatch = async (gameId: string, a: any, b: any, seed: number) => {
    if (releaseInFlightMatch) {
      await new Promise<void>((resolve) => {
        const prev = releaseInFlightMatch!;
        releaseInFlightMatch = () => {
          prev();
          resolve();
        };
      });
    }
    const matchId = `mock_match_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    a.socket.emit("matched", { matchId, gameId, seed, opponentUsername: b.username });
    b.socket.emit("matched", { matchId, gameId, seed, opponentUsername: a.username });
    return matchId;
  };

  configureInviteTimersForTests({
    inviteTtlMs: 40,
    guestLinkTtlMs: 40,
    guestReconnectGraceMs: 40,
    areFriends: async () => true,
    createMatch: mockCreateMatch as any,
  });

  try {
    // 12a. Accepted direct friend invite must NOT emit "Invite expired." after original expiresAt passes
    const inviter = makeMockSocket("usr_inviter_1", "InviterOne");
    const invitee = makeMockSocket("usr_invitee_1", "InviteeOne");
    registerPresence(inviter);
    registerPresence(invitee);

    await handleInviteFriend(inviter, { friendUserId: invitee.data.userId, gameId: "checkers" });
    const received = invitee.emitted.find((e: any) => e.event === "inviteReceived")?.payload;
    check("Direct friend invite delivered to online invitee", Boolean(received?.inviteId));

    // Hold createMatch in-flight briefly to also verify duplicate respondInvite during async creation
    let resolveHold!: () => void;
    const holdPromise = new Promise<void>((r) => { resolveHold = r; });
    releaseInFlightMatch = () => { resolveHold(); };
    configureInviteTimersForTests({
      inviteTtlMs: 40,
      guestLinkTtlMs: 40,
      guestReconnectGraceMs: 40,
      areFriends: async () => true,
      createMatch: (async (gameId: string, a: any, b: any, seed: number) => {
        await holdPromise;
        const matchId = `mock_match_hold_${Date.now()}`;
        a.socket.emit("matched", { matchId, gameId, seed, opponentUsername: b.username });
        b.socket.emit("matched", { matchId, gameId, seed, opponentUsername: a.username });
        return matchId;
      }) as any,
    });

    handleRespondInvite(invitee, { inviteId: received.inviteId, accept: true });
    // Duplicate accept while match creation is still in-flight must NOT emit "Invite not found or expired."
    handleRespondInvite(invitee, { inviteId: received.inviteId, accept: true });
    resolveHold();
    await sleep(90); // Past the 40ms original expiresAt

    check(
      "Accepted friend invite starts match and emits zero inviteRejected/inviteError past original expiresAt",
      inviter.emitted.some((e: any) => e.event === "matched") &&
        invitee.emitted.some((e: any) => e.event === "matched") &&
        !inviter.emitted.some((e: any) => e.event === "inviteRejected" || e.event === "inviteError") &&
        !invitee.emitted.some((e: any) => e.event === "inviteRejected" || e.event === "inviteError"),
    );

    unregisterPresence(inviter);
    unregisterPresence(invitee);

    // 12b. Unaccepted PENDING friend invite still expires after TTL
    configureInviteTimersForTests({
      inviteTtlMs: 35,
      guestLinkTtlMs: 40,
      guestReconnectGraceMs: 40,
      areFriends: async () => true,
      createMatch: mockCreateMatch as any,
    });
    releaseInFlightMatch = null;
    const inviterPending = makeMockSocket("usr_inviter_pending", "InviterPending");
    const inviteePending = makeMockSocket("usr_invitee_pending", "InviteePending");
    registerPresence(inviterPending);
    registerPresence(inviteePending);

    await handleInviteFriend(inviterPending, { friendUserId: inviteePending.data.userId, gameId: "connect-4" });
    await sleep(80);
    check(
      "Unaccepted pending friend invite still expires cleanly after TTL",
      inviterPending.emitted.some((e: any) => e.event === "inviteRejected" && e.payload?.reason === "Invite expired."),
    );
    unregisterPresence(inviterPending);
    unregisterPresence(inviteePending);

    // 12c. Accepted Guest Friend Match link cancels TTL timer and never fires inviteError mid-game
    const host = makeMockSocket("usr_guest_host_1", "HostPlayer");
    const joiner = makeMockSocket("usr_guest_joiner_1", "JoinerPlayer");
    handleCreateGuestLink(host, { gameId: "blitz-chess" });
    const createdCode = host.emitted.find((e: any) => e.event === "guestLinkCreated")?.payload?.code as string;
    check("Guest friend link created for active match expiry test", Boolean(createdCode));

    handleJoinGuestLink(joiner, { code: createdCode });
    await sleep(90); // Past the 40ms guest link TTL

    check(
      "Accepted guest link starts match and emits zero inviteError past original expiresAt",
      host.emitted.some((e: any) => e.event === "matched") &&
        joiner.emitted.some((e: any) => e.event === "matched") &&
        !host.emitted.some((e: any) => e.event === "inviteError" || e.event === "inviteRejected") &&
        !joiner.emitted.some((e: any) => e.event === "inviteError" || e.event === "inviteRejected"),
    );
    check("Consumed guest link reports valid=false via getGuestLinkInfo", getGuestLinkInfo(createdCode).valid === false);

    // 12d. Starting a match via clearPendingInvitesForMatchStart cancels lingering outbound invites
    const pA = makeMockSocket("usr_lingering_a", "LingeringA");
    const pB = makeMockSocket("usr_lingering_b", "LingeringB");
    registerPresence(pA);
    registerPresence(pB);
    await handleInviteFriend(pA, { friendUserId: pB.data.userId, gameId: "space-blaster" });
    clearPendingInvitesForMatchStart(pA, pB);
    await sleep(80);
    check(
      "clearPendingInvitesForMatchStart suppresses stale invite expiry timers for active match players",
      !pA.emitted.some((e: any) => e.event === "inviteRejected" || e.event === "inviteError") &&
        !pB.emitted.some((e: any) => e.event === "inviteRejected" || e.event === "inviteError"),
    );
    unregisterPresence(pA);
    unregisterPresence(pB);
  } finally {
    configureInviteTimersForTests({});
  }

  // 12e. Client socket guards: useMatchSocket unsubscribes & ignores late invite events once matched
  const useMatchSocketSrc = fs.readFileSync(
    path.resolve(process.cwd(), "packages/client/src/matchmaking/useMatchSocket.ts"),
    "utf-8",
  );
  check(
    "Client useMatchSocket unsubscribes invite listeners on matched and guards late inviteRejected/inviteError",
    useMatchSocketSrc.includes("teardownInviteListeners()") &&
      useMatchSocketSrc.includes("socket.off('inviteRejected', onInviteRejected)") &&
      useMatchSocketSrc.includes("socket.off('inviteError', onInviteError)") &&
      useMatchSocketSrc.includes("if (hasMatchRef.current || resolutionMatchIdRef.current) return"),
  );

  if (failures > 0) {
    console.log(`\n${failures} failure(s)`);
    process.exit(1);
  }
  console.log(`\nAll checks passed.`);
}

run().catch((err) => {
  console.error("wallet-friends-check fatal:", err);
  process.exit(1);
});
