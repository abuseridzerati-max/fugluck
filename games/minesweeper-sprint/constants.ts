import { VIRTUAL_VIEWPORT } from "@fugluck/shared";

export const VIRTUAL_WIDTH = VIRTUAL_VIEWPORT.width; // 1280
export const VIRTUAL_HEIGHT = VIRTUAL_VIEWPORT.height; // 720

export const GRID_COLS = 14;
export const GRID_ROWS = 10;
export const CELL_COUNT = GRID_COLS * GRID_ROWS; // 140
export const MINE_COUNT = 22;
export const SAFE_CELL_TOTAL = CELL_COUNT - MINE_COUNT; // 118

export const SPRINT_DURATION_SEC = 90;
export const SPRINT_DURATION_TICKS = SPRINT_DURATION_SEC * 60; // 5400 ticks at 60Hz

export const SAFE_CELL_POINTS = 50;
export const BOARD_CLEAR_BONUS = 500;
export const SPEED_BONUS_PER_SEC = 15;

export const CELL_SIZE = 56;
export const CELL_GAP = 4;
export const BOARD_PADDING = 12;
export const BOARD_WIDTH = GRID_COLS * CELL_SIZE + (GRID_COLS - 1) * CELL_GAP + BOARD_PADDING * 2; // 860
export const BOARD_HEIGHT = GRID_ROWS * CELL_SIZE + (GRID_ROWS - 1) * CELL_GAP + BOARD_PADDING * 2; // 620
export const BOARD_X = Math.round((VIRTUAL_WIDTH - BOARD_WIDTH) / 2); // 210
export const BOARD_Y = 88;

export const MINE_COLORS = {
  bg: "#070a10",
  boardBg: "#0b1220",
  boardBorder: "rgba(56, 189, 248, 0.38)",
  cellHidden: "#162238",
  cellHiddenHighlight: "rgba(148, 163, 184, 0.16)",
  cellHiddenBorder: "rgba(56, 189, 248, 0.25)",
  cellRevealed: "#0d1526",
  cellRevealedBorder: "rgba(148, 163, 184, 0.12)",
  flagBg: "#281e12",
  flagBorder: "#f59e0b",
  flagPole: "#e2e8f0",
  flagBanner: "#f43f5e",
  mineBg: "#2a121b",
  mineDetonatedBg: "#5c1426",
  mineCore: "#f43f5e",
  mineGlow: "rgba(244, 63, 94, 0.45)",
  hudBg: "rgba(11, 18, 32, 0.9)",
  hudBorder: "rgba(56, 189, 248, 0.3)",
  textPrimary: "#f8fafc",
  textMuted: "#94a3b8",
  timerNormal: "#10b981",
  timerWarn: "#f59e0b",
  timerCritical: "#f43f5e",
} as const;

export const NUMBER_COLORS: Readonly<Record<number, string>> = {
  1: "#38bdf8", // Sky Cyan
  2: "#34d399", // Neon Emerald
  3: "#f43f5e", // Neon Rose
  4: "#a855f7", // Neon Violet
  5: "#f59e0b", // Amber
  6: "#06b6d4", // Bright Teal
  7: "#ec4899", // Magenta
  8: "#e2e8f0", // Silver
};

/**
 * Maps a client pointer coordinate on a letterboxed (object-fit: contain) 1280x720 canvas
 * into a 14x10 Minesweeper grid cell, returning null if outside the board.
 */
export function clientPointToMineCell(
  rect: { left: number; top: number; width: number; height: number },
  clientX: number,
  clientY: number,
): { col: number; row: number } | null {
  if (rect.width <= 0 || rect.height <= 0) return null;
  const targetRatio = VIRTUAL_WIDTH / VIRTUAL_HEIGHT;
  const boxRatio = rect.width / rect.height;

  let drawW = rect.width;
  let drawH = rect.height;
  let offsetX = 0;
  let offsetY = 0;

  if (boxRatio > targetRatio) {
    drawH = rect.height;
    drawW = drawH * targetRatio;
    offsetX = (rect.width - drawW) / 2;
  } else {
    drawW = rect.width;
    drawH = drawW / targetRatio;
    offsetY = (rect.height - drawH) / 2;
  }

  const vx = ((clientX - rect.left - offsetX) / drawW) * VIRTUAL_WIDTH;
  const vy = ((clientY - rect.top - offsetY) / drawH) * VIRTUAL_HEIGHT;

  const localX = vx - (BOARD_X + BOARD_PADDING);
  const localY = vy - (BOARD_Y + BOARD_PADDING);
  if (localX < 0 || localY < 0) return null;

  const stride = CELL_SIZE + CELL_GAP;
  const col = Math.floor(localX / stride);
  const row = Math.floor(localY / stride);
  if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return null;

  return { col, row };
}
