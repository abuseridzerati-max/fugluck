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

export type GameCategory =
  | "runner"
  | "racer"
  | "arena-shooter"
  | "falling-block"
  | "physics-table"
  | "turn-based-board"
  | "reflex-timing"
  | "word-trivia"
  | "quiz";

export type GameRegistryItem = {
  id: string;
  name: string;
  engine: GameCategory | string;
  modulePath: string;
};

export const GAME_REGISTRY: GameRegistryItem[] = [
  { id: "neon-runner", name: "Neon Runner", engine: "runner", modulePath: "./neon-runner/index.ts" },
  { id: "pixel-ninja-dash", name: "Pixel Ninja Dash", engine: "reflex-timing", modulePath: "./pixel-ninja-dash/index.ts" },
  { id: "space-blaster", name: "Space Blaster", engine: "arena-shooter", modulePath: "./space-blaster/index.ts" },
  { id: "cyber-hopper", name: "Cyber Hopper", engine: "reflex-timing", modulePath: "./cyber-hopper/index.ts" },
  { id: "speed-trivia", name: "Speed Trivia Clash", engine: "quiz", modulePath: "./speed-trivia/index.ts" },
  { id: "tf-sprint", name: "True / False Sprint", engine: "quiz", modulePath: "./tf-sprint/index.ts" },
];

export function getGameTitle(gameId: string): string {
  const item = GAME_REGISTRY.find((g) => g.id === gameId);
  return item?.name ?? gameId;
}


