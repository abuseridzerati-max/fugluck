import { VIRTUAL_VIEWPORT } from "@fugluck/shared";

export const VIRTUAL_WIDTH = VIRTUAL_VIEWPORT.width; // 1280
export const VIRTUAL_HEIGHT = VIRTUAL_VIEWPORT.height; // 720

export const ARENA_LEFT = 100;
export const ARENA_RIGHT = VIRTUAL_WIDTH - 100; // 1180
export const ARENA_TOP = 84;
export const ARENA_BOTTOM = 704;
export const ARENA_WIDTH = ARENA_RIGHT - ARENA_LEFT; // 1080
export const ARENA_HEIGHT = ARENA_BOTTOM - ARENA_TOP; // 620

export const MATCH_DURATION_SEC = 120;
export const MATCH_DURATION_TICKS = MATCH_DURATION_SEC * 60; // 7200 ticks at 60Hz
export const INITIAL_LIVES = 3;
export const LAUNCH_DELAY_TICKS = 45; // 0.75s launch countdown

export const PADDLE_WIDTH = 156;
export const PADDLE_HEIGHT = 18;
export const PADDLE_Y = 656;
export const PADDLE_SPEED_PX_SEC = 740;

export const BALL_RADIUS = 10;
export const BASE_BALL_SPEED = 460;
export const WAVE_BALL_SPEED_INC = 42;
export const MAX_BALL_SPEED = 720;
export const TRAIL_LENGTH = 8;

export const BRICK_COLS = 11;
export const BRICK_ROWS = 5;
export const BRICK_WIDTH = 86;
export const BRICK_HEIGHT = 28;
export const BRICK_GAP_X = 8;
export const BRICK_GAP_Y = 8;
export const BRICK_OFFSET_X = Math.round(
  ARENA_LEFT + (ARENA_WIDTH - (BRICK_COLS * BRICK_WIDTH + (BRICK_COLS - 1) * BRICK_GAP_X)) / 2,
); // 127
export const BRICK_OFFSET_Y = 114;

export const BRICK_HIT_POINTS = 50;
export const BRICK_DESTROY_POINTS = 100;
export const WAVE_CLEAR_BONUS = 500;

export const BREAKER_COLORS = {
  bg: "#070a10",
  arenaBg: "#0a101d",
  arenaBorder: "rgba(56, 189, 248, 0.4)",
  gridLine: "rgba(56, 189, 248, 0.04)",
  paddleFill: "#10b981",
  paddleHighlight: "#d1fae5",
  paddleGlow: "rgba(16, 185, 129, 0.3)",
  ballFill: "#ffffff",
  ballCore: "#38bdf8",
  ballGlow: "rgba(56, 189, 248, 0.45)",
  hudBg: "rgba(10, 16, 29, 0.9)",
  hudBorder: "rgba(56, 189, 248, 0.3)",
  textPrimary: "#f8fafc",
  textMuted: "#94a3b8",
  timerNormal: "#10b981",
  timerWarn: "#f59e0b",
  timerCritical: "#f43f5e",
} as const;

export const BRICK_HP_COLORS: Readonly<Record<number, { fill: string; border: string }>> = {
  3: { fill: "#7c3aed", border: "#ddd6fe" }, // Armored Violet (3 HP)
  2: { fill: "#ec4899", border: "#fbcfe8" }, // Armored Magenta (2 HP)
  1: { fill: "#06b6d4", border: "#cffafe" }, // Standard Cyan (1 HP)
};

export const ROW_STANDARD_COLORS = ["#06b6d4", "#10b981", "#38bdf8"] as const;
