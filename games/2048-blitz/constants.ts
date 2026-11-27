import { VIRTUAL_VIEWPORT } from "@fugluck/shared";

export const VIRTUAL_WIDTH = VIRTUAL_VIEWPORT.width; // 1280
export const VIRTUAL_HEIGHT = VIRTUAL_VIEWPORT.height; // 720

export const GRID_SIZE = 4;
export const CELL_COUNT = GRID_SIZE * GRID_SIZE; // 16

export const BLITZ_DURATION_SEC = 120;
export const BLITZ_DURATION_TICKS = BLITZ_DURATION_SEC * 60; // 7200 ticks at 60Hz

export const CELL_SIZE = 114;
export const CELL_GAP = 14;
export const BOARD_PADDING = 16;
export const BOARD_SIZE = GRID_SIZE * CELL_SIZE + (GRID_SIZE - 1) * CELL_GAP + BOARD_PADDING * 2; // 530
export const BOARD_X = Math.round((VIRTUAL_WIDTH - BOARD_SIZE) / 2); // 375
export const BOARD_Y = 136;

export const FLASH_DURATION_TICKS = 12;

export const BLITZ_COLORS = {
  bg: "#070a10",
  gridLine: "rgba(56, 189, 248, 0.05)",
  boardBg: "#0d1422",
  boardBorder: "rgba(56, 189, 248, 0.35)",
  emptyCell: "#131d30",
  emptyCellBorder: "rgba(148, 163, 184, 0.14)",
  hudBg: "rgba(13, 20, 34, 0.88)",
  hudBorder: "rgba(56, 189, 248, 0.3)",
  textPrimary: "#f8fafc",
  textMuted: "#94a3b8",
  timerNormal: "#10b981",
  timerWarn: "#f59e0b",
  timerCritical: "#f43f5e",
} as const;

export type TileStyle = {
  bg: string;
  border: string;
  text: string;
  glow: string;
};

export const TILE_STYLES: Readonly<Record<number, TileStyle>> = {
  2: { bg: "#17253b", border: "#38bdf8", text: "#e0f2fe", glow: "rgba(56, 189, 248, 0.18)" },
  4: { bg: "#132f3a", border: "#06b6d4", text: "#cffafe", glow: "rgba(6, 182, 212, 0.24)" },
  8: { bg: "#0d352d", border: "#10b981", text: "#d1fae5", glow: "rgba(16, 185, 129, 0.28)" },
  16: { bg: "#1a3320", border: "#84cc16", text: "#ecfccb", glow: "rgba(132, 204, 22, 0.28)" },
  32: { bg: "#3a2710", border: "#f59e0b", text: "#fef3c7", glow: "rgba(245, 158, 11, 0.32)" },
  64: { bg: "#3f1c14", border: "#f97316", text: "#ffedd5", glow: "rgba(249, 115, 22, 0.36)" },
  128: { bg: "#3f1224", border: "#f43f5e", text: "#ffe4e6", glow: "rgba(244, 63, 94, 0.38)" },
  256: { bg: "#3b1236", border: "#ec4899", text: "#fce7f3", glow: "rgba(236, 72, 153, 0.4)" },
  512: { bg: "#291445", border: "#a855f7", text: "#f3e8ff", glow: "rgba(168, 85, 247, 0.42)" },
  1024: { bg: "#1d1b4b", border: "#6366f1", text: "#e0e7ff", glow: "rgba(99, 102, 241, 0.45)" },
  2048: { bg: "#0f3a36", border: "#34d399", text: "#ffffff", glow: "rgba(52, 211, 153, 0.55)" },
};

export const HIGH_TILE_STYLE: TileStyle = {
  bg: "#3b2f0b",
  border: "#fde047",
  text: "#ffffff",
  glow: "rgba(253, 224, 71, 0.6)",
};
