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

export const CHESS_COLORS = {
  bg: "#070a10",
  boardFrame: "#0d1422",
  boardBorder: "rgba(56, 189, 248, 0.45)",
  lightSquare: "#1e2c44",
  darkSquare: "#10192b",
  selectedSquare: "rgba(56, 189, 248, 0.38)",
  lastMoveSquare: "rgba(16, 185, 129, 0.28)",
  legalDot: "rgba(52, 211, 153, 0.78)",
  legalCaptureRing: "rgba(244, 63, 94, 0.78)",
  checkGlow: "rgba(244, 63, 94, 0.55)",
  whitePieceBg: "#e2e8f0",
  whitePieceRim: "#38bdf8",
  whitePieceText: "#09101a",
  blackPieceBg: "#111827",
  blackPieceRim: "#ec4899",
  blackPieceText: "#f8fafc",
  hudBg: "rgba(13, 20, 34, 0.92)",
  hudBorder: "rgba(56, 189, 248, 0.3)",
  activeClockBorder: "#10b981",
  textPrimary: "#f8fafc",
  textMuted: "#94a3b8",
  timerNormal: "#10b981",
  timerWarn: "#f59e0b",
  timerCritical: "#f43f5e",
} as const;

/**
 * Maps a client pointer coordinate on a letterboxed (object-fit: contain) 1280x720 canvas
 * into an algebraic chess square ("a1".."h8"), returning null if outside the board.
 */
export function clientPointToSquare(
  rect: { left: number; top: number; width: number; height: number },
  clientX: number,
  clientY: number,
): string | null {
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

  const col = Math.floor((vx - BOARD_X) / SQUARE_SIZE);
  const row = Math.floor((vy - BOARD_Y) / SQUARE_SIZE);
  if (col < 0 || col >= BOARD_SQUARES || row < 0 || row >= BOARD_SQUARES) return null;

  return `${FILES[col]}${RANKS[row]}`;
}
