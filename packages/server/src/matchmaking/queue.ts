import { randomInt } from "node:crypto";
import { gameRegistry } from "@arcadeclash/games";
import type { MatchmakingSocket } from "./socketAuth";

export type QueueEntry = {
  socket: MatchmakingSocket;
  userId: string;
  username: string;
  currency: "COINS" | "DIAMONDS";
  stake: number;
};

const VALID_GAME_IDS = new Set(gameRegistry.map((g) => g.id));

const queues = new Map<string, QueueEntry[]>();

export function isValidGameId(gameId: string): boolean {
  return VALID_GAME_IDS.has(gameId);
}

export function generateSeed(): number {
  return randomInt(0x100000000);
}

export function makeQueueKey(gameId: string, currency: "COINS" | "DIAMONDS" = "COINS", stake: number = 0): string {
  return `${gameId}:${currency}:${stake}`;
}

export function enqueue(
  gameId: string,
  socket: MatchmakingSocket,
  currency: "COINS" | "DIAMONDS" = "COINS",
  stake: number = 0,
): void {
  const key = makeQueueKey(gameId, currency, stake);
  const entries = queues.get(key) ?? [];
  const withoutStale = entries.filter((e) => e.userId !== socket.data.userId);
  withoutStale.push({
    socket,
    userId: socket.data.userId,
    username: socket.data.username,
    currency,
    stake,
  });
  queues.set(key, withoutStale);
}

export function tryPair(
  gameId: string,
  currency: "COINS" | "DIAMONDS" = "COINS",
  stake: number = 0,
): [QueueEntry, QueueEntry] | null {
  const key = makeQueueKey(gameId, currency, stake);
  const entries = queues.get(key);
  if (!entries || entries.length < 2) return null;
  const [a, b, ...rest] = entries;
  queues.set(key, rest);
  return [a, b];
}

export function removeFromQueue(socket: MatchmakingSocket): void {
  for (const [key, entries] of queues) {
    const next = entries.filter((e) => e.socket !== socket);
    if (next.length !== entries.length) queues.set(key, next);
  }
}
