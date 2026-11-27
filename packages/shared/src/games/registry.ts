import {
  AUTHORITY_CAP_TICKS,
  AUTHORITY_VERSION,
  BLITZ_2048_AUTHORITY_VERSION,
  BLITZ_CHESS_AUTHORITY_VERSION,
  BRICK_BREAKER_AUTHORITY_VERSION,
  CHECKERS_AUTHORITY_VERSION,
  CONNECT_4_AUTHORITY_VERSION,
  CYBER_HOPPER_AUTHORITY_VERSION,
  MINESWEEPER_SPRINT_AUTHORITY_VERSION,
  NEON_SNAKE_AUTHORITY_VERSION,
  STACK_TOWER_AUTHORITY_VERSION,
} from "../authority";
import { FIXED_TIMESTEP_SEC } from "../fixedTimestepLoop";
import type { GameGenre, GameManifest } from "./contract";

const DEFAULT_AUTHORITY_DURATION_SEC = Math.round(AUTHORITY_CAP_TICKS * FIXED_TIMESTEP_SEC);

/**
 * Single source of truth for all playable games across shared, client, and server.
 * Adding a game here propagates to GAME_REGISTRY, GAME_COMPETITION_CERTIFICATIONS,
 * catalog views, matchmaking validation, and (when certified) tournament registries.
 */
export const GAME_MANIFESTS: readonly GameManifest[] = [
  {
    id: "space-blaster",
    title: "Space Blaster",
    tagline: "Retro vector arcade space shooter",
    genre: "arena-shooter",
    certified: true,
    modes: ["practice", "casual", "tournament"],
    i18nKeyPrefix: "games.spaceBlaster",
    thumbnail: "space-blaster",
    modulePath: "./space-blaster/index.ts",
    authorityVersion: AUTHORITY_VERSION,
    certificationScope: "LEVEL_3_CERTIFIED",
    matchConfig: {
      defaultDurationSec: DEFAULT_AUTHORITY_DURATION_SEC,
      tieBreaker: "draw",
      minPlayers: 2,
      maxPlayers: 2,
    },
  },
  {
    id: "cyber-hopper",
    title: "Cyber Hopper",
    tagline: "Lane-crossing timing & evasion",
    genre: "reflex-timing",
    certified: true,
    modes: ["practice", "casual", "tournament"],
    i18nKeyPrefix: "games.cyberHopper",
    thumbnail: "cyber-hopper",
    modulePath: "./cyber-hopper/index.ts",
    authorityVersion: CYBER_HOPPER_AUTHORITY_VERSION,
    certificationScope: "LEVEL_3_CERTIFIED",
    matchConfig: {
      defaultDurationSec: DEFAULT_AUTHORITY_DURATION_SEC,
      tieBreaker: "draw",
      minPlayers: 2,
      maxPlayers: 2,
    },
  },
  {
    id: "stack-tower",
    title: "Stack Tower",
    tagline: "Precision neon block stacking with perfect-drop combos",
    genre: "reflex-timing",
    certified: true,
    modes: ["practice", "casual", "tournament"],
    i18nKeyPrefix: "games.stackTower",
    thumbnail: "stack-tower",
    modulePath: "./stack-tower/index.ts",
    authorityVersion: STACK_TOWER_AUTHORITY_VERSION,
    certificationScope: "LEVEL_3_CERTIFIED",
    matchConfig: {
      defaultDurationSec: DEFAULT_AUTHORITY_DURATION_SEC,
      tieBreaker: "draw",
      minPlayers: 2,
      maxPlayers: 2,
    },
  },
  {
    id: "2048-blitz",
    title: "Seeded 2048 Blitz",
    tagline: "120-second seeded 4x4 tile-merging blitz",
    genre: "reflex-timing",
    certified: true,
    modes: ["practice", "casual", "tournament"],
    i18nKeyPrefix: "games.blitz2048",
    thumbnail: "2048-blitz",
    modulePath: "./2048-blitz/index.ts",
    authorityVersion: BLITZ_2048_AUTHORITY_VERSION,
    certificationScope: "LEVEL_3_CERTIFIED",
    matchConfig: {
      defaultDurationSec: 120,
      tieBreaker: "draw",
      minPlayers: 2,
      maxPlayers: 2,
    },
  },
  {
    id: "neon-snake",
    title: "Neon Snake",
    tagline: "Deterministic neon arena snake with speed tiers & bonus orbs",
    genre: "runner",
    certified: true,
    modes: ["practice", "casual", "tournament"],
    i18nKeyPrefix: "games.neonSnake",
    thumbnail: "neon-snake",
    modulePath: "./neon-snake/index.ts",
    authorityVersion: NEON_SNAKE_AUTHORITY_VERSION,
    certificationScope: "LEVEL_3_CERTIFIED",
    matchConfig: {
      defaultDurationSec: 120,
      tieBreaker: "draw",
      minPlayers: 2,
      maxPlayers: 2,
    },
  },
  {
    id: "minesweeper-sprint",
    title: "Minesweeper Sprint",
    tagline: "90-second seeded minefield sprint with fair safe starts",
    genre: "reflex-timing",
    certified: true,
    modes: ["practice", "casual", "tournament"],
    i18nKeyPrefix: "games.minesweeperSprint",
    thumbnail: "minesweeper-sprint",
    modulePath: "./minesweeper-sprint/index.ts",
    authorityVersion: MINESWEEPER_SPRINT_AUTHORITY_VERSION,
    certificationScope: "LEVEL_3_CERTIFIED",
    matchConfig: {
      defaultDurationSec: 90,
      tieBreaker: "draw",
      minPlayers: 2,
      maxPlayers: 2,
    },
  },
  {
    id: "brick-breaker",
    title: "Brick Breaker",
    tagline: "Deterministic neon paddle & armored brick wave breaker",
    genre: "arena-shooter",
    certified: true,
    modes: ["practice", "casual", "tournament"],
    i18nKeyPrefix: "games.brickBreaker",
    thumbnail: "brick-breaker",
    modulePath: "./brick-breaker/index.ts",
    authorityVersion: BRICK_BREAKER_AUTHORITY_VERSION,
    certificationScope: "LEVEL_3_CERTIFIED",
    matchConfig: {
      defaultDurationSec: 120,
      tieBreaker: "draw",
      minPlayers: 2,
      maxPlayers: 2,
    },
  },
  {
    id: "blitz-chess",
    title: "Blitz Chess",
    tagline: "3+0 blitz chess vs deterministic seeded tactical AI",
    genre: "turn-based-board",
    certified: true,
    modes: ["practice", "casual", "tournament"],
    i18nKeyPrefix: "games.blitzChess",
    thumbnail: "blitz-chess",
    modulePath: "./blitz-chess/index.ts",
    authorityVersion: BLITZ_CHESS_AUTHORITY_VERSION,
    certificationScope: "LEVEL_3_CERTIFIED",
    matchConfig: {
      defaultDurationSec: 360,
      tieBreaker: "draw",
      minPlayers: 2,
      maxPlayers: 2,
    },
  },
  {
    id: "connect-4",
    title: "Connect 4",
    tagline: "Classic 7x6 tabletop Connect 4 — live 1v1 PvP or seeded AI",
    genre: "turn-based-board",
    certified: true,
    modes: ["practice", "casual", "tournament"],
    i18nKeyPrefix: "games.connect4",
    thumbnail: "connect-4",
    modulePath: "./connect-4/index.ts",
    authorityVersion: CONNECT_4_AUTHORITY_VERSION,
    certificationScope: "LEVEL_3_CERTIFIED",
    matchConfig: {
      defaultDurationSec: 120,
      tieBreaker: "draw",
      minPlayers: 2,
      maxPlayers: 2,
    },
  },
  {
    id: "checkers",
    title: "Checkers",
    tagline: "Classic 8x8 draughts with mandatory captures, multi-jumps & live PvP",
    genre: "turn-based-board",
    certified: true,
    modes: ["practice", "casual", "tournament"],
    i18nKeyPrefix: "games.checkers",
    thumbnail: "checkers",
    modulePath: "./checkers/index.ts",
    authorityVersion: CHECKERS_AUTHORITY_VERSION,
    certificationScope: "LEVEL_3_CERTIFIED",
    matchConfig: {
      defaultDurationSec: 360,
      tieBreaker: "draw",
      minPlayers: 2,
      maxPlayers: 2,
    },
  },
];

export const GAME_MANIFEST_MAP: Readonly<Record<string, GameManifest>> = Object.fromEntries(
  GAME_MANIFESTS.map((manifest) => [manifest.id, manifest]),
);

export function getGameManifest(gameId: string): GameManifest | undefined {
  return GAME_MANIFEST_MAP[gameId];
}

export function getCertifiedGameManifests(): GameManifest[] {
  return GAME_MANIFESTS.filter((manifest) => manifest.certified);
}

export function getCertifiedGameIds(): string[] {
  return getCertifiedGameManifests().map((manifest) => manifest.id);
}

export function isCertifiedGame(gameId: string, rulesVersion?: string): boolean {
  const manifest = GAME_MANIFEST_MAP[gameId];
  if (!manifest?.certified) return false;
  return rulesVersion === undefined || manifest.authorityVersion === rulesVersion;
}

const GENRE_DISPLAY_ORDER: readonly GameGenre[] = [
  "runner",
  "arena-shooter",
  "reflex-timing",
  "quiz",
  "racer",
  "falling-block",
  "physics-table",
  "turn-based-board",
  "word-trivia",
];

/** Returns unique genres present in GAME_MANIFESTS in stable display order. */
export function getAvailableGenres(): GameGenre[] {
  const present = new Set<GameGenre>(GAME_MANIFESTS.map((m) => m.genre));
  const ordered = GENRE_DISPLAY_ORDER.filter((g) => present.has(g));
  for (const genre of present) {
    if (!ordered.includes(genre)) ordered.push(genre);
  }
  return ordered;
}
