export type GameGenre =
  | "runner"
  | "racer"
  | "arena-shooter"
  | "falling-block"
  | "physics-table"
  | "turn-based-board"
  | "reflex-timing"
  | "word-trivia"
  | "quiz";

export type GamePlayMode = "practice" | "casual" | "tournament";

export type GameTieBreakerRule = "draw" | "higher-ticks" | "faster-completion";

export type GameCertificationScope = "LEVEL_3_CERTIFIED" | "NOT_CERTIFIED" | "OUT_OF_SCOPE";

export interface GameMatchConfig {
  /** Default round duration in seconds. */
  defaultDurationSec: number;
  /** How equal scores are resolved. */
  tieBreaker: GameTieBreakerRule;
  /** Minimum number of players in a competitive match. */
  minPlayers: number;
  /** Maximum number of players in a competitive match. */
  maxPlayers: number;
}

export interface GameManifest {
  /** Unique URL-safe slug, e.g. 'space-blaster'. */
  id: string;
  /** Default English display title (fallback when i18n key is not defined). */
  title: string;
  /** Default English short description shown on game cards. */
  tagline: string;
  /** Genre used for category filter pills and color badges. */
  genre: GameGenre;
  /** True when certified for Coins Knockout & Level 3 server-authoritative tournaments. */
  certified: boolean;
  /** Supported play modes for this game. */
  modes: readonly GamePlayMode[];
  /** Prefix for i18n keys (title, description, controls / how-to-play). */
  i18nKeyPrefix: string;
  /** Artwork / thumbnail key used by UI card and competition visual components. */
  thumbnail: string;
  /** Relative module path inside `@fugluck/games`. */
  modulePath: string;
  /** Server-authoritative rules version (required when `certified === true`). */
  authorityVersion?: string;
  /** Technical certification scope for competition eligibility views. */
  certificationScope: GameCertificationScope;
  /** Default match duration, tie-breaker rule, and player bounds. */
  matchConfig: GameMatchConfig;
}
