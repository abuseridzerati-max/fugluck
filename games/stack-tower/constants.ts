import { VIRTUAL_VIEWPORT } from "@fugluck/shared";

export const VIRTUAL_WIDTH = VIRTUAL_VIEWPORT.width; // 1280
export const VIRTUAL_HEIGHT = VIRTUAL_VIEWPORT.height; // 720

export const INITIAL_BLOCK_WIDTH = 300;
export const MIN_BLOCK_WIDTH = 6;
export const BLOCK_HEIGHT = 36;

export const PLAYFIELD_LEFT = 220;
export const PLAYFIELD_RIGHT = VIRTUAL_WIDTH - 220; // 1060
export const BASE_SCREEN_Y = 610; // Top edge of the foundation block (level 0) in screen coords when cameraY = 0
export const CAMERA_ANCHOR_LEVEL = 7; // Start panning camera once tower exceeds this many blocks

export const BASE_SPEED_PX_SEC = 280;
export const SPEED_INCREMENT_PER_LEVEL = 14;
export const MAX_SPEED_PX_SEC = 760;

export const PERFECT_TOLERANCE_PX = 8;
export const BASE_DROP_POINTS = 100;
export const PERFECT_STREAK_BONUS = 50;
export const PERFECT_PULSE_DURATION_TICKS = 28;

export const FALLING_GRAVITY_PX_SEC2 = 1450;

export const STACK_COLORS = {
  bg: "#070a10",
  gridLine: "rgba(56, 189, 248, 0.06)",
  guideRail: "rgba(148, 163, 184, 0.14)",
  baseFill: "#1e293b",
  baseStroke: "#38bdf8",
  perfectGlow: "#34d399",
  perfectFlash: "#ffffff",
  textPrimary: "#f8fafc",
  textMuted: "#94a3b8",
  hudBg: "rgba(7, 10, 16, 0.78)",
  hudBorder: "rgba(56, 189, 248, 0.28)",
} as const;

export const NEON_PALETTE = [
  "#10b981", // Emerald
  "#06b6d4", // Cyan
  "#3b82f6", // Electric Blue
  "#8b5cf6", // Violet
  "#ec4899", // Magenta
  "#f59e0b", // Amber
] as const;
