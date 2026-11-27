import { VIRTUAL_VIEWPORT } from "@fugluck/shared";

export const VIRTUAL_WIDTH = VIRTUAL_VIEWPORT.width; // 1280
export const VIRTUAL_HEIGHT = VIRTUAL_VIEWPORT.height; // 720

export const BOARD_SQUARES = 8;
export const SQUARE_SIZE = 74;
export const BOARD_SIZE = BOARD_SQUARES * SQUARE_SIZE; // 592
export const BOARD_X = 96;
export const BOARD_Y = 64;

export const PANEL_X = 730;
export const PANEL_W = 454;

export const BLITZ_CLOCK_SEC = 180; // 3+0 Blitz
export const BLITZ_CLOCK_TICKS = BLITZ_CLOCK_SEC * 60; // 10800 ticks at 60Hz
export const AI_RESPONSE_DELAY_TICKS = 24; // 0.4s deterministic AI think cadence

export const CHECK_BONUS_POINTS = 30;
export const CHECKMATE_WIN_BONUS = 1000;
export const DRAW_BONUS_POINTS = 250;
export const CLOCK_BONUS_PER_SEC = 5;

export const CAPTURE_POINTS: Readonly<Record<string, number>> = {
  p: 50,
  n: 150,
  b: 150,
  r: 250,
  q: 450,
};

export const AI_PIECE_VALUES: Readonly<Record<string, number>> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

export const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
export const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"] as const;

export const PIECE_GLYPHS: Readonly<Record<string, string>> = {
  wk: "♔",
  wq: "♕",
  wr: "♖",
  wb: "♗",
  wn: "♘",
  wp: "♙",
  bk: "♚",
  bq: "♛",
  br: "♜",
  bb: "♝",
  bn: "♞",
  bp: "♟",
};

export const MATERIAL_VALUES: Readonly<Record<string, number>> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
};

export const CHESS_COLORS = {
  bg: "#070a10",
  boardFrame: "#262421",
  boardBorder: "rgba(255, 255, 255, 0.12)",
  lightSquare: "#eeeed2",
  darkSquare: "#769656",
  selectedLight: "#f6f669",
  selectedDark: "#baca44",
  lastMoveLight: "#f6f669",
  lastMoveDark: "#baca44",
  legalDot: "rgba(0, 0, 0, 0.18)",
  legalCaptureRing: "rgba(0, 0, 0, 0.20)",
  checkGlow: "#ff3b30",
  hudBg: "#262421",
  hudCardBg: "#1e1d1a",
  hudBorder: "rgba(255, 255, 255, 0.10)",
  activeClockBg: "#ffffff",
  activeClockText: "#1c1a18",
  inactiveClockBg: "#2f2d2a",
  inactiveClockText: "#9e9b95",
  warnClockBg: "#b45309",
  criticalClockBg: "#b91c1c",
  textPrimary: "#f5f5f4",
  textMuted: "#a8a29e",
  accentGreen: "#81b64c",
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
 * Maps an algebraic square ("a1".."h8") to top-left virtual canvas coordinates.
 */
export function squareToVisualCoords(
  square: string,
  orientation: "w" | "b" = "w",
): { x: number; y: number } | null {
  if (square.length < 2) return null;
  const c = FILES.indexOf(square[0] as (typeof FILES)[number]);
  const r = RANKS.indexOf(square[1] as (typeof RANKS)[number]);
  if (c < 0 || r < 0) return null;
  const vc = orientation === "b" ? BOARD_SQUARES - 1 - c : c;
  const vr = orientation === "b" ? BOARD_SQUARES - 1 - r : r;
  return {
    x: BOARD_X + vc * SQUARE_SIZE,
    y: BOARD_Y + vr * SQUARE_SIZE,
  };
}

/**
 * Maps a client pointer coordinate on a letterboxed (object-fit: contain) 1280x720 canvas
 * into an algebraic chess square ("a1".."h8"), returning null if outside the board.
 */
export function clientPointToSquare(
  rect: { left: number; top: number; width: number; height: number },
  clientX: number,
  clientY: number,
  orientation: "w" | "b" = "w",
): string | null {
  const pt = clientPointToVirtual(rect, clientX, clientY);
  if (!pt) return null;

  const visualCol = Math.floor((pt.vx - BOARD_X) / SQUARE_SIZE);
  const visualRow = Math.floor((pt.vy - BOARD_Y) / SQUARE_SIZE);
  if (visualCol < 0 || visualCol >= BOARD_SQUARES || visualRow < 0 || visualRow >= BOARD_SQUARES) return null;

  const col = orientation === "b" ? BOARD_SQUARES - 1 - visualCol : visualCol;
  const row = orientation === "b" ? BOARD_SQUARES - 1 - visualRow : visualRow;

  return `${FILES[col]}${RANKS[row]}`;
}
