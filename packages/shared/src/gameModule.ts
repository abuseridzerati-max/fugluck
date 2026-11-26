// Standard interface every mini-game plugs into. "match" mode is accepted
// for forward compatibility but isn't implemented during the games-only
// phase — modules should log and fall back to practice-like behavior if
// they receive it (see PROGRESS.md "Current phase").
export type GameMode = "practice" | "match";

// Canonical virtual viewport across all games — physics, obstacle spawn,
// and server-side validation are locked to this 16:9 resolution (1280x720).
// Client containers letterbox this viewport to guarantee identical physics
// and scoring regardless of client monitor size or aspect ratio.
export const VIRTUAL_VIEWPORT = { width: 1280, height: 720 };

export type GameOverPayload = {
  score: number;
  reason: string;
  durationMs: number;
  seed: number;
};
export interface GameModule extends EventTarget {
  init(container: HTMLElement, mode: GameMode, opponentSocket: WebSocket | null, seed: number): void;
  start(): void;
  pause(): void;
  destroy(): void;
}

export type GameModuleFactory = () => GameModule;

import { GAME_MANIFESTS, GAME_MANIFEST_MAP, type GameGenre } from "./games";

export type GameCategory = GameGenre;

export type GameRegistryItem = {
  id: string;
  name: string;
  engine: GameCategory | string;
  modulePath: string;
};

/** Derived from the single source-of-truth `GAME_MANIFESTS` registry. */
export const GAME_REGISTRY: GameRegistryItem[] = GAME_MANIFESTS.map((manifest) => ({
  id: manifest.id,
  name: manifest.title,
  engine: manifest.genre,
  modulePath: manifest.modulePath,
}));

export function getGameTitle(gameId: string): string {
  return GAME_MANIFEST_MAP[gameId]?.title ?? gameId;
}


