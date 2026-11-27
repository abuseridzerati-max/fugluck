import { VIRTUAL_VIEWPORT } from "@fugluck/shared";

export const VIRTUAL_WIDTH = VIRTUAL_VIEWPORT.width; // 1280
export const VIRTUAL_HEIGHT = VIRTUAL_VIEWPORT.height; // 720

export const COLS = 7;
export const ROWS = 6;
export const BOARD_CELLS = COLS * ROWS; // 42

export const CELL_SIZE = 86;
export const BOARD_W = COLS * CELL_SIZE; // 602
export const BOARD_H = ROWS * CELL_SIZE; // 516
export const BOARD_X = 88;
export const BOARD_Y = 132;

export const PANEL_X = 738;
export const PANEL_W = 454;

export const BLITZ_CLOCK_SEC = 60; // 60s Blitz per player
export const BLITZ_CLOCK_TICKS = BLITZ_CLOCK_SEC * 60; // 3600 ticks at 60Hz
export const AI_RESPONSE_DELAY_TICKS = 22; // ~0.37s deterministic AI cadence

export const THREAT_3_BONUS = 40;
export const WIN_BONUS = 1000;
export const DRAW_BONUS = 250;
export const CLOCK_BONUS_PER_SEC = 5;

export const CONNECT4_COLORS = {
  bg: "#070a10",
  boardFrame: "#1d4ed8",
  boardFrameDark: "#1e3a8a",
  boardBorder: "rgba(147, 197, 253, 0.35)",
  slotBg: "#0b1120",
  slotRim: "rgba(15, 23, 42, 0.9)",
  p1Disc: "#ef4444",
  p1DiscRim: "#b91c1c",
  p1DiscHighlight: "#fca5a5",
  p2Disc: "#facc15",
  p2DiscRim: "#ca8a04",
  p2DiscHighlight: "#fef08a",
  winRing: "#34d399",
  lastMoveRing: "rgba(255, 255, 255, 0.72)",
  hudBg: "#1e1d1a",
  hudCardBg: "#15161c",
  hudBorder: "rgba(255, 255, 255, 0.12)",
  activeClockBg: "#ffffff",
  activeClockText: "#111827",
  inactiveClockBg: "#27272a",
  inactiveClockText: "#a1a1aa",
  warnClockBg: "#b45309",
  criticalClockBg: "#b91c1c",
  textPrimary: "#f8fafc",
  textMuted: "#94a3b8",
  accentBlue: "#38bdf8",
} as const;

/**
 * Converts client pointer coordinates on a letterboxed 1280x720 canvas
 * into a Connect 4 column index (0..6), or null if outside the board horizontally.
 */
export function clientPointToColumn(
  rect: { left: number; top: number; width: number; height: number },
  clientX: number,
  clientY: number,
): number | null {
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

  if (vy < BOARD_Y - CELL_SIZE || vy > BOARD_Y + BOARD_H + 24) return null;
  const col = Math.floor((vx - BOARD_X) / CELL_SIZE);
  if (col < 0 || col >= COLS) return null;
  return col;
}
