export type GameEngine =
  | "runner"
  | "racer"
  | "arena-shooter"
  | "falling-block"
  | "physics-table"
  | "turn-based-board"
  | "reflex-timing"
  | "word-trivia";

export type GameRegistryEntry = {
  id: string;
  name: string;
  engine: GameEngine;
  modulePath: string;
};

export const gameRegistry: GameRegistryEntry[] = [
  { id: "neon-runner", name: "Neon Runner", engine: "runner", modulePath: "./neon-runner/index.ts" },
  {
    id: "pixel-ninja-dash",
    name: "Pixel Ninja Dash",
    engine: "reflex-timing",
    modulePath: "./pixel-ninja-dash/index.ts",
  },
  {
    id: "sky-dodge",
    name: "Sky Dodge",
    engine: "arena-shooter",
    modulePath: "./sky-dodge/index.ts",
  },
  {
    id: "space-blaster",
    name: "Space Blaster",
    engine: "arena-shooter",
    modulePath: "./space-blaster/index.ts",
  },
  {
    id: "game-3",
    name: "Space Blaster (Game #3)",
    engine: "arena-shooter",
    modulePath: "./game-3/index.ts",
  },
  {
    id: "cyber-hopper",
    name: "Cyber Hopper",
    engine: "reflex-timing",
    modulePath: "./cyber-hopper/index.ts",
  },
  {
    id: "game-4",
    name: "Cyber Hopper (Game #4)",
    engine: "reflex-timing",
    modulePath: "./game-4/index.ts",
  },
];
