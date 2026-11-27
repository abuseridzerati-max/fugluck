import { VIRTUAL_VIEWPORT } from "@fugluck/shared";

export const VIRTUAL_WIDTH = VIRTUAL_VIEWPORT.width; // 1280
export const VIRTUAL_HEIGHT = VIRTUAL_VIEWPORT.height; // 720

export const GRID_COLS = 32;
export const GRID_ROWS = 18;
export const CELL_SIZE = 34;

export const ARENA_WIDTH = GRID_COLS * CELL_SIZE; // 1088
export const ARENA_HEIGHT = GRID_ROWS * CELL_SIZE; // 612
export const ARENA_X = Math.round((VIRTUAL_WIDTH - ARENA_WIDTH) / 2); // 96
export const ARENA_Y = 86;

export const MATCH_DURATION_SEC = 120;
export const MATCH_DURATION_TICKS = MATCH_DURATION_SEC * 60; // 7200 ticks at 60Hz

export const BASE_STEP_TICKS = 9; // ~6.67 cells/sec initially
export const MIN_STEP_TICKS = 4; // 15 cells/sec max speed
export const ORBS_PER_SPEED_TIER = 5;

export const STANDARD_ORB_POINTS = 100;
export const BONUS_ORB_POINTS = 300;
export const BONUS_ORB_INTERVAL = 5; // Spawn a bonus orb every 5 standard orbs eaten
export const BONUS_ORB_LIFETIME_TICKS = 360; // 6 seconds at 60Hz

export const SNAKE_COLORS = {
  bg: "#070a10",
  arenaBg: "#0a101d",
  arenaBorder: "rgba(16, 185, 129, 0.45)",
  gridLine: "rgba(56, 189, 248, 0.05)",
  headFill: "#34d399",
  headStroke: "#ffffff",
  bodyPrimary: "#10b981",
  bodySecondary: "#06b6d4",
  bodyGlow: "rgba(16, 185, 129, 0.24)",
  foodFill: "#ec4899",
  foodGlow: "rgba(236, 72, 153, 0.35)",
  bonusFill: "#f59e0b",
  bonusGlow: "rgba(245, 158, 11, 0.42)",
  hudBg: "rgba(10, 16, 29, 0.9)",
  hudBorder: "rgba(56, 189, 248, 0.3)",
  textPrimary: "#f8fafc",
  textMuted: "#94a3b8",
  timerNormal: "#10b981",
  timerWarn: "#f59e0b",
  timerCritical: "#f43f5e",
} as const;
