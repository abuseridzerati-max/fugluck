import { getActiveAuthorityMatchesLive } from "../competitions/authorityRuntime";
import { getActiveMatchesLive, type LiveActiveMatchRecord, type LiveMatchMode } from "./matches";
import { getOnlinePresenceSnapshot, type OnlinePresenceEntry } from "./presence";
import { getPublicQueueState } from "./queue";

export type LiveUserStatus = "idle" | "queued" | "in_match";

export type LiveOnlineUser = {
  userId: string;
  username: string;
  status: LiveUserStatus;
  gameId: string | null;
};

export type LiveActiveMatch = {
  matchId: string;
  gameId: string;
  mode: LiveMatchMode;
  players: Array<{ userId: string; username: string }>;
  startedAt: string;
  elapsedSeconds: number;
};

export type LiveQueuedPlayer = {
  userId: string;
  username: string;
  gameId: string;
  queuedAt: string;
};

export type AdminLiveSnapshot = {
  timestamp: string;
  summary: {
    onlineUsersCount: number;
    activeMatchesCount: number;
    queuedPlayersCount: number;
  };
  onlineUsers: LiveOnlineUser[];
  activeMatches: LiveActiveMatch[];
  queuedPlayers: LiveQueuedPlayer[];
};

export type LiveMonitorSources = {
  nowMs?: number;
  onlinePresence?: OnlinePresenceEntry[];
  queueEntries?: Array<{
    userId: string;
    username: string;
    gameId: string;
    queuedAt: number | string;
  }>;
  activeMatches?: LiveActiveMatchRecord[];
  activeAuthorityMatches?: LiveActiveMatchRecord[];
};

const STATUS_SORT_ORDER: Record<LiveUserStatus, number> = {
  in_match: 0,
  queued: 1,
  idle: 2,
};

function toIsoTimestamp(value: number | string): string {
  if (typeof value === "number") {
    return new Date(value).toISOString();
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : value;
}

/**
 * Builds a read-only, sanitized real-time operational snapshot of online users,
 * matchmaking queues, and active matches. Never includes tokens, emails,
 * password hashes, or IP addresses.
 */
export function buildLiveMonitorSnapshot(sources?: LiveMonitorSources): AdminLiveSnapshot {
  const nowMs = sources?.nowMs ?? Date.now();
  const rawPresence = sources?.onlinePresence ?? getOnlinePresenceSnapshot();
  const rawQueue = sources?.queueEntries ?? getPublicQueueState();
  const rawStandardMatches = sources?.activeMatches ?? getActiveMatchesLive(nowMs);
  const rawAuthorityMatches = sources?.activeAuthorityMatches ?? getActiveAuthorityMatchesLive(nowMs);

  const matchMap = new Map<string, LiveActiveMatch>();
  for (const m of [...rawStandardMatches, ...rawAuthorityMatches]) {
    if (matchMap.has(m.matchId)) continue;
    matchMap.set(m.matchId, {
      matchId: m.matchId,
      gameId: m.gameId,
      mode: m.mode,
      players: m.players.map((p) => ({
        userId: p.userId,
        username: p.username,
      })),
      startedAt: toIsoTimestamp(m.startedAt),
      elapsedSeconds: Math.max(0, Math.floor(m.elapsedSeconds)),
    });
  }

  const activeMatches = Array.from(matchMap.values()).sort(
    (a, b) => b.elapsedSeconds - a.elapsedSeconds || a.matchId.localeCompare(b.matchId),
  );

  const inMatchGameByUserId = new Map<string, string>();
  for (const match of activeMatches) {
    for (const player of match.players) {
      if (!inMatchGameByUserId.has(player.userId)) {
        inMatchGameByUserId.set(player.userId, match.gameId);
      }
    }
  }

  const queuedGameByUserId = new Map<string, string>();
  const queuedPlayers: LiveQueuedPlayer[] = [];
  for (const entry of rawQueue) {
    if (!queuedGameByUserId.has(entry.userId)) {
      queuedGameByUserId.set(entry.userId, entry.gameId);
    }
    queuedPlayers.push({
      userId: entry.userId,
      username: entry.username,
      gameId: entry.gameId,
      queuedAt: toIsoTimestamp(entry.queuedAt),
    });
  }
  queuedPlayers.sort((a, b) => a.queuedAt.localeCompare(b.queuedAt));

  const seenUserIds = new Set<string>();
  const onlineUsers: LiveOnlineUser[] = [];
  for (const entry of rawPresence) {
    if (seenUserIds.has(entry.userId)) continue;
    seenUserIds.add(entry.userId);

    const activeGameId = inMatchGameByUserId.get(entry.userId);
    if (activeGameId) {
      onlineUsers.push({
        userId: entry.userId,
        username: entry.username,
        status: "in_match",
        gameId: activeGameId,
      });
      continue;
    }

    const queuedGameId = queuedGameByUserId.get(entry.userId);
    if (queuedGameId) {
      onlineUsers.push({
        userId: entry.userId,
        username: entry.username,
        status: "queued",
        gameId: queuedGameId,
      });
      continue;
    }

    onlineUsers.push({
      userId: entry.userId,
      username: entry.username,
      status: "idle",
      gameId: null,
    });
  }

  onlineUsers.sort(
    (a, b) => STATUS_SORT_ORDER[a.status] - STATUS_SORT_ORDER[b.status] || a.username.localeCompare(b.username),
  );

  return {
    timestamp: new Date(nowMs).toISOString(),
    summary: {
      onlineUsersCount: onlineUsers.length,
      activeMatchesCount: activeMatches.length,
      queuedPlayersCount: queuedPlayers.length,
    },
    onlineUsers,
    activeMatches,
    queuedPlayers,
  };
}
