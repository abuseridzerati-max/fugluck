import { VIRTUAL_VIEWPORT } from "@fugluck/shared";

export const VIRTUAL_WIDTH = VIRTUAL_VIEWPORT.width; // 1280
export const VIRTUAL_HEIGHT = VIRTUAL_VIEWPORT.height; // 720

export const BOARD_SQUARES = 8;
export const BOARD_CELLS = BOARD_SQUARES * BOARD_SQUARES; // 64
export const SQUARE_SIZE = 74;
export const BOARD_SIZE = BOARD_SQUARES * SQUARE_SIZE; // 592
export const BOARD_X = 96;
export const BOARD_Y = 64;

export const PANEL_X = 730;
export const PANEL_W = 454;

export const BLITZ_CLOCK_SEC = 180; // 3+0 Blitz
export const BLITZ_CLOCK_TICKS = BLITZ_CLOCK_SEC * 60; // 10800 ticks at 60Hz
export const AI_RESPONSE_DELAY_TICKS = 22; // ~0.37s deterministic AI cadence
export const DRAW_QUIET_HALF_MOVES = 40;

export const CAPTURE_POINTS = 80;
export const KING_PROMOTION_POINTS = 150;
export const WIN_BONUS = 1000;
export const DRAW_BONUS = 250;
export const CLOCK_BONUS_PER_SEC = 5;

export const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
export const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"] as const;

export const CHECKERS_COLORS = {
  bg: "#070a10",
  boardFrame: "#2b1d14",
  boardBorder: "rgba(240, 217, 181, 0.25)",
  lightSquare: "#f0d9b5",
  darkSquare: "#b58863",
  selectedSquare: "rgba(250, 204, 21, 0.45)",
  lastMoveSquare: "rgba(16, 185, 129, 0.32)",
  legalDot: "rgba(0, 0, 0, 0.24)",
  legalCaptureRing: "#10b981",
  forcedCaptureRing: "#f59e0b",
  p1Base: "#dc2626",
  p1Rim: "#991b1b",
  p1Inner: "#ef4444",
  p1Highlight: "#fca5a5",
  p2Base: "#27272a",
  p2Rim: "#09090b",
  p2Inner: "#3f3f46",
  p2Highlight: "#d4d4d8",
  crownGold: "#facc15",
  crownStroke: "#854d0e",
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
  textMuted: "#a8a29e",
  accentGold: "#f59e0b",
} as const;

/**
 * Converts client pointer coordinates on a letterboxed 1280x720 canvas
 * into virtual canvas coordinates (0..1280, 0..720).
 */
export function clientPointToVirtual(
  rect: { left: number; top: number; width: number; height: number },
  clientX: number,
  clientY: number,
): { vx: number; vy: number } | null {
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
  return { vx, vy };
}

/**
 * Maps a client pointer coordinate on a letterboxed 1280x720 canvas
 * into a Checkers board cell index (0..63), respecting board orientation (1=Red bottom, 2=Black bottom).
 */
export function clientPointToCheckersIndex(
  rect: { left: number; top: number; width: number; height: number },
  clientX: number,
  clientY: number,
  orientation: 1 | 2 = 1,
): number | null {
  const pt = clientPointToVirtual(rect, clientX, clientY);
  if (!pt) return null;

  const visualCol = Math.floor((pt.vx - BOARD_X) / SQUARE_SIZE);
  const visualRow = Math.floor((pt.vy - BOARD_Y) / SQUARE_SIZE);
  if (visualCol < 0 || visualCol >= BOARD_SQUARES || visualRow < 0 || visualRow >= BOARD_SQUARES) return null;

  const col = orientation === 2 ? BOARD_SQUARES - 1 - visualCol : visualCol;
  const row = orientation === 2 ? BOARD_SQUARES - 1 - visualRow : visualRow;
  return row * BOARD_SQUARES + col;
}

/**
 * Maps a board cell index (0..63) to top-left virtual canvas coordinates.
 */
export function indexToVisualCoords(
  idx: number,
  orientation: 1 | 2 = 1,
): { x: number; y: number } {
  const row = Math.floor(idx / BOARD_SQUARES);
  const col = idx % BOARD_SQUARES;
  const vr = orientation === 2 ? BOARD_SQUARES - 1 - row : row;
  const vc = orientation === 2 ? BOARD_SQUARES - 1 - col : col;
  return {
    x: BOARD_X + vc * SQUARE_SIZE,
    y: BOARD_Y + vr * SQUARE_SIZE,
  };
}

export function indexToAlgebraic(idx: number): string {
  const row = Math.floor(idx / BOARD_SQUARES);
  const col = idx % BOARD_SQUARES;
  return `${FILES[col] ?? "?"}${RANKS[row] ?? "?"}`;
}
