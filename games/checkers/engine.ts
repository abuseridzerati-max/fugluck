import {
  createSeededRandom,
  type RandomFn,
  type TurnBasedEngine,
  type TurnBasedGameState,
  type TurnBasedMove,
  type TurnBasedOutcome,
} from "@fugluck/shared";
import {
  AI_RESPONSE_DELAY_TICKS,
  BLITZ_CLOCK_TICKS,
  BOARD_CELLS,
  BOARD_SIZE,
  BOARD_SQUARES,
  BOARD_X,
  BOARD_Y,
  CAPTURE_POINTS,
  CHECKERS_COLORS,
  CLOCK_BONUS_PER_SEC,
  DRAW_BONUS,
  DRAW_QUIET_HALF_MOVES,
  FILES,
  indexToAlgebraic,
  indexToVisualCoords,
  KING_PROMOTION_POINTS,
  PANEL_W,
  PANEL_X,
  RANKS,
  SQUARE_SIZE,
  VIRTUAL_HEIGHT,
  VIRTUAL_WIDTH,
  WIN_BONUS,
} from "./constants";
import { checkersSounds } from "./sounds";

export { checkersSounds } from "./sounds";

// Piece encoding: 0=empty, 1=Red(p1) man, 2=Red(p1) King, 3=Black(p2) man, 4=Black(p2) King
export type CheckersPiece = 0 | 1 | 2 | 3 | 4;

export type CheckersMovePayload = {
  from: number;
  to: number;
};

export type CheckersInput = {
  from?: number;
  to?: number;
  resign?: boolean;
};

export type CheckersMove = {
  from: number;
  to: number;
  capturedIdx: number | null;
};

export type CheckersDragState = {
  from: number;
  piece: number;
  vx: number;
  vy: number;
};

type CheckersAnimation = {
  from: number;
  to: number;
  piece: number;
  startMs: number;
  durationMs: number;
};

const MOVE_ANIM_DURATION_MS = 140;

function nowMs(): number {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  if (typeof ctx.quadraticCurveTo === "function") {
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
  } else {
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
  }
  ctx.closePath();
}

export function createInitialCheckersBoard(): number[] {
  const board = new Array<number>(BOARD_CELLS).fill(0);
  for (let r = 0; r < BOARD_SQUARES; r++) {
    for (let c = 0; c < BOARD_SQUARES; c++) {
      if ((r + c) % 2 !== 1) continue;
      if (r < 3) board[r * BOARD_SQUARES + c] = 3; // Black (p2)
      else if (r > 4) board[r * BOARD_SQUARES + c] = 1; // Red (p1)
    }
  }
  return board;
}

export function ownerOfPiece(piece: number): 0 | 1 | 2 {
  if (piece === 1 || piece === 2) return 1;
  if (piece === 3 || piece === 4) return 2;
  return 0;
}

export function isKingPiece(piece: number): boolean {
  return piece === 2 || piece === 4;
}

function moveDirectionsForPiece(piece: number): ReadonlyArray<[number, number]> {
  if (piece === 1) return [[-1, -1], [-1, 1]]; // Red moves up
  if (piece === 3) return [[1, -1], [1, 1]]; // Black moves down
  if (piece === 2 || piece === 4) return [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  return [];
}

export function getCaptureMovesForPiece(board: readonly number[], fromIdx: number): CheckersMove[] {
  const piece = board[fromIdx] ?? 0;
  const owner = ownerOfPiece(piece);
  if (owner === 0) return [];
  const enemy: 1 | 2 = owner === 1 ? 2 : 1;

  const r = Math.floor(fromIdx / BOARD_SQUARES);
  const c = fromIdx % BOARD_SQUARES;
  const moves: CheckersMove[] = [];

  for (const [dr, dc] of moveDirectionsForPiece(piece)) {
    const midR = r + dr;
    const midC = c + dc;
    const landR = r + dr * 2;
    const landC = c + dc * 2;
    if (landR < 0 || landR >= BOARD_SQUARES || landC < 0 || landC >= BOARD_SQUARES) continue;
    const midIdx = midR * BOARD_SQUARES + midC;
    const landIdx = landR * BOARD_SQUARES + landC;
    if (ownerOfPiece(board[midIdx] ?? 0) === enemy && board[landIdx] === 0) {
      moves.push({ from: fromIdx, to: landIdx, capturedIdx: midIdx });
    }
  }
  return moves;
}

export function getSimpleMovesForPiece(board: readonly number[], fromIdx: number): CheckersMove[] {
  const piece = board[fromIdx] ?? 0;
  if (ownerOfPiece(piece) === 0) return [];

  const r = Math.floor(fromIdx / BOARD_SQUARES);
  const c = fromIdx % BOARD_SQUARES;
  const moves: CheckersMove[] = [];

  for (const [dr, dc] of moveDirectionsForPiece(piece)) {
    const nr = r + dr;
    const nc = c + dc;
    if (nr < 0 || nr >= BOARD_SQUARES || nc < 0 || nc >= BOARD_SQUARES) continue;
    const toIdx = nr * BOARD_SQUARES + nc;
    if (board[toIdx] === 0) {
      moves.push({ from: fromIdx, to: toIdx, capturedIdx: null });
    }
  }
  return moves;
}

/**
 * Computes all legal moves for `player`, strictly enforcing mandatory captures
 * and multi-jump chain continuation when `chainFromIdx !== null`.
 */
export function getLegalCheckersMoves(
  board: readonly number[],
  player: 1 | 2,
  chainFromIdx: number | null,
): CheckersMove[] {
  if (chainFromIdx !== null) {
    if (ownerOfPiece(board[chainFromIdx] ?? 0) !== player) return [];
    return getCaptureMovesForPiece(board, chainFromIdx);
  }

  const captures: CheckersMove[] = [];
  for (let i = 0; i < BOARD_CELLS; i++) {
    if (ownerOfPiece(board[i] ?? 0) !== player) continue;
    const caps = getCaptureMovesForPiece(board, i);
    if (caps.length > 0) captures.push(...caps);
  }
  if (captures.length > 0) return captures;

  const simples: CheckersMove[] = [];
  for (let i = 0; i < BOARD_CELLS; i++) {
    if (ownerOfPiece(board[i] ?? 0) !== player) continue;
    const m = getSimpleMovesForPiece(board, i);
    if (m.length > 0) simples.push(...m);
  }
  return simples;
}

export function countCheckersPieces(board: readonly number[]): { p1: number; p2: number } {
  let p1 = 0;
  let p2 = 0;
  for (let i = 0; i < BOARD_CELLS; i++) {
    const o = ownerOfPiece(board[i] ?? 0);
    if (o === 1) p1++;
    else if (o === 2) p2++;
  }
  return { p1, p2 };
}

export function applyCheckersMovePure(
  board: number[],
  player: 1 | 2,
  chainFromIdx: number | null,
  fromIdx: number,
  toIdx: number,
):
  | {
      ok: true;
      captured: boolean;
      crowned: boolean;
      movedPiece: number;
      nextPlayer: 1 | 2;
      nextChainFromIdx: number | null;
    }
  | { ok: false; code: string; message: string } {
  const legal = getLegalCheckersMoves(board, player, chainFromIdx);
  const chosen = legal.find((m) => m.from === fromIdx && m.to === toIdx);
  if (!chosen) {
    const hasMandatoryCapture = legal.some((m) => m.capturedIdx !== null);
    return {
      ok: false,
      code: hasMandatoryCapture ? "CAPTURE_REQUIRED" : "ILLEGAL_MOVE",
      message: hasMandatoryCapture ? "A capture jump is mandatory." : "Illegal checkers move.",
    };
  }

  let piece = board[fromIdx];
  board[fromIdx] = 0;
  const captured = chosen.capturedIdx !== null;
  if (chosen.capturedIdx !== null) {
    board[chosen.capturedIdx] = 0;
  }

  const toRow = Math.floor(toIdx / BOARD_SQUARES);
  let crowned = false;
  if (piece === 1 && toRow === 0) {
    piece = 2;
    crowned = true;
  } else if (piece === 3 && toRow === BOARD_SQUARES - 1) {
    piece = 4;
    crowned = true;
  }

  board[toIdx] = piece;

  // Multi-jump continuation: if captured and NOT newly crowned and another jump exists
  if (captured && !crowned) {
    const followUp = getCaptureMovesForPiece(board, toIdx);
    if (followUp.length > 0) {
      return {
        ok: true,
        captured,
        crowned,
        movedPiece: piece,
        nextPlayer: player,
        nextChainFromIdx: toIdx,
      };
    }
  }

  return {
    ok: true,
    captured,
    crowned,
    movedPiece: piece,
    nextPlayer: player === 1 ? 2 : 1,
    nextChainFromIdx: null,
  };
}

export function evaluateCheckersTerminal(
  board: readonly number[],
  nextPlayer: 1 | 2,
  chainFromIdx: number | null,
  quietHalfMoves: number,
): { ended: false } | { ended: true; winner: 1 | 2 | null; reason: "win" | "draw" } {
  const counts = countCheckersPieces(board);
  if (counts.p1 === 0) return { ended: true, winner: 2, reason: "win" };
  if (counts.p2 === 0) return { ended: true, winner: 1, reason: "win" };
  const nextMoves = getLegalCheckersMoves(board, nextPlayer, chainFromIdx);
  if (nextMoves.length === 0) {
    return { ended: true, winner: nextPlayer === 1 ? 2 : 1, reason: "win" };
  }
  if (quietHalfMoves >= DRAW_QUIET_HALF_MOVES) {
    return { ended: true, winner: null, reason: "draw" };
  }
  return { ended: false };
}

export class CheckersEngine implements TurnBasedEngine<number[], CheckersMovePayload> {
  public board: number[] = createInitialCheckersBoard();
  public activePlayer: 1 | 2 = 1;
  public chainFromIdx: number | null = null;
  public quietHalfMoves = 0;
  public score = 0;
  public tickCount = 0;
  public gameOver = false;
  public p1ClockTicks = BLITZ_CLOCK_TICKS;
  public p2ClockTicks = BLITZ_CLOCK_TICKS;
  public outcome: TurnBasedOutcome = "in_progress";
  public turnNumber = 0;
  public lastMoveFrom: number | null = null;
  public lastMoveTo: number | null = null;
  public lastMoveNotation: string | null = null;

  /** Client-only UI state (not serialized in toJSON()). */
  public selectedIdx: number | null = null;
  public legalTargets: number[] = [];
  public orientation: 1 | 2 = 1;
  public pvpMode = false;
  public p1Label = "You (Red)";
  public p2Label = "Black AI";
  public dragState: CheckersDragState | null = null;
  public skipNextAnimation = false;

  private animState: CheckersAnimation | null = null;
  private lastAnimatedTurn = 0;
  private soundPlayedEnd = false;
  private aiDelayTicks = 0;
  private rng!: RandomFn;
  private width = VIRTUAL_WIDTH;
  private height = VIRTUAL_HEIGHT;

  public readonly seed: number;

  constructor(seed: number) {
    this.seed = seed;
    this.reset();
  }

  public resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  public reset(): void {
    this.board = createInitialCheckersBoard();
    this.activePlayer = 1;
    this.chainFromIdx = null;
    this.quietHalfMoves = 0;
    this.score = 0;
    this.tickCount = 0;
    this.gameOver = false;
    this.p1ClockTicks = BLITZ_CLOCK_TICKS;
    this.p2ClockTicks = BLITZ_CLOCK_TICKS;
    this.outcome = "in_progress";
    this.turnNumber = 0;
    this.lastMoveFrom = null;
    this.lastMoveTo = null;
    this.lastMoveNotation = null;
    this.selectedIdx = null;
    this.legalTargets = [];
    this.dragState = null;
    this.skipNextAnimation = false;
    this.animState = null;
    this.lastAnimatedTurn = 0;
    this.soundPlayedEnd = false;
    this.aiDelayTicks = 0;
    this.rng = createSeededRandom(this.seed).stream("gameplay");
  }

  public getLegalTargetsForIndex(idx: number, allowedPlayer: 1 | 2 = this.orientation): number[] {
    if (this.gameOver || this.activePlayer !== allowedPlayer) return [];
    const legal = getLegalCheckersMoves(this.board, allowedPlayer, this.chainFromIdx);
    return legal.filter((m) => m.from === idx).map((m) => m.to);
  }

  public getFirstLegalP1Move(): CheckersMovePayload | null {
    if (this.gameOver || this.activePlayer !== 1) return null;
    const legal = getLegalCheckersMoves(this.board, 1, this.chainFromIdx);
    if (legal.length === 0) return null;
    return { from: legal[0].from, to: legal[0].to };
  }

  public hydrateFromSnapshot(snapshot: {
    tickCount: number;
    score: number;
    gameOver: boolean;
    chkBoard?: number[];
    chkActivePlayer?: 1 | 2;
    chkChainFromIdx?: number | null;
    chkQuietHalfMoves?: number;
    p1ClockTicks?: number;
    p2ClockTicks?: number;
    chkLastMoveFrom?: number | null;
    chkLastMoveTo?: number | null;
    turnOutcome?: TurnBasedOutcome;
    turnNumber?: number;
  }): void {
    const prevCounts = countCheckersPieces(this.board);
    const prevKings = this.board.filter((p) => isKingPiece(p)).length;
    const prevGameOver = this.gameOver;

    this.tickCount = snapshot.tickCount;
    this.score = snapshot.score;
    this.gameOver = snapshot.gameOver;
    if (Array.isArray(snapshot.chkBoard) && snapshot.chkBoard.length === BOARD_CELLS) {
      this.board = [...snapshot.chkBoard];
    }
    if (snapshot.chkActivePlayer !== undefined) this.activePlayer = snapshot.chkActivePlayer;
    if (snapshot.chkChainFromIdx !== undefined) this.chainFromIdx = snapshot.chkChainFromIdx;
    if (snapshot.chkQuietHalfMoves !== undefined) this.quietHalfMoves = snapshot.chkQuietHalfMoves;
    if (snapshot.p1ClockTicks !== undefined) this.p1ClockTicks = snapshot.p1ClockTicks;
    if (snapshot.p2ClockTicks !== undefined) this.p2ClockTicks = snapshot.p2ClockTicks;
    if (snapshot.chkLastMoveFrom !== undefined) this.lastMoveFrom = snapshot.chkLastMoveFrom;
    if (snapshot.chkLastMoveTo !== undefined) this.lastMoveTo = snapshot.chkLastMoveTo;
    if (snapshot.turnOutcome !== undefined) this.outcome = snapshot.turnOutcome;
    if (snapshot.turnNumber !== undefined) this.turnNumber = snapshot.turnNumber;

    if (this.lastMoveFrom !== null && this.lastMoveTo !== null) {
      this.lastMoveNotation = `${indexToAlgebraic(this.lastMoveFrom)}→${indexToAlgebraic(this.lastMoveTo)}`;
    }

    if (this.turnNumber > this.lastAnimatedTurn && this.lastMoveFrom !== null && this.lastMoveTo !== null) {
      this.lastAnimatedTurn = this.turnNumber;
      this.selectedIdx = this.chainFromIdx !== null && this.activePlayer === this.orientation ? this.chainFromIdx : null;
      this.legalTargets =
        this.selectedIdx !== null ? this.getLegalTargetsForIndex(this.selectedIdx, this.orientation) : [];
      this.dragState = null;

      const movedPiece = this.board[this.lastMoveTo] ?? 0;
      if (movedPiece !== 0 && !this.skipNextAnimation) {
        this.animState = {
          from: this.lastMoveFrom,
          to: this.lastMoveTo,
          piece: movedPiece,
          startMs: nowMs(),
          durationMs: MOVE_ANIM_DURATION_MS,
        };
      }
      this.skipNextAnimation = false;

      const nextCounts = countCheckersPieces(this.board);
      const nextKings = this.board.filter((p) => isKingPiece(p)).length;
      const captured = nextCounts.p1 + nextCounts.p2 < prevCounts.p1 + prevCounts.p2;
      const crowned = nextKings > prevKings;

      if (this.gameOver && !this.soundPlayedEnd) {
        this.soundPlayedEnd = true;
        checkersSounds.playGameOver();
      } else if (crowned) {
        checkersSounds.playKing();
      } else if (captured) {
        checkersSounds.playCapture();
      } else {
        checkersSounds.playMove();
      }
    } else if (this.gameOver && !prevGameOver && !this.soundPlayedEnd) {
      this.soundPlayedEnd = true;
      checkersSounds.playGameOver();
    }
  }

  public getTurnState(): TurnBasedGameState<number[], CheckersMovePayload> {
    const lastMove: TurnBasedMove<CheckersMovePayload> | null =
      this.lastMoveFrom !== null && this.lastMoveTo !== null
        ? {
            player: this.activePlayer === 2 ? "player" : "opponent",
            turnNumber: this.turnNumber,
            payload: { from: this.lastMoveFrom, to: this.lastMoveTo },
            notation: this.lastMoveNotation ?? undefined,
            tick: this.tickCount,
          }
        : null;

    return {
      board: [...this.board],
      activePlayer: this.activePlayer === 1 ? "player" : "opponent",
      turnNumber: this.turnNumber,
      outcome: this.outcome,
      playerClockTicks: this.p1ClockTicks,
      opponentClockTicks: this.p2ClockTicks,
      lastMove,
    };
  }

  public toJSON() {
    return {
      score: this.score,
      tickCount: this.tickCount,
      gameOver: this.gameOver,
      chainFromIdx: this.chainFromIdx,
      quietHalfMoves: this.quietHalfMoves,
      turnState: this.getTurnState(),
    };
  }

  public applyMove(payload: CheckersMovePayload): boolean {
    if (this.gameOver) return false;
    const mover = this.activePlayer;
    const res = applyCheckersMovePure(this.board, mover, this.chainFromIdx, payload.from, payload.to);
    if (!res.ok) return false;

    this.turnNumber++;
    this.lastMoveFrom = payload.from;
    this.lastMoveTo = payload.to;
    this.lastMoveNotation = `${indexToAlgebraic(payload.from)}${res.captured ? "×" : "→"}${indexToAlgebraic(payload.to)}`;
    this.lastAnimatedTurn = this.turnNumber;
    this.quietHalfMoves = res.captured || res.crowned ? 0 : this.quietHalfMoves + 1;

    if (!this.skipNextAnimation) {
      this.animState = {
        from: payload.from,
        to: payload.to,
        piece: res.movedPiece,
        startMs: nowMs(),
        durationMs: MOVE_ANIM_DURATION_MS,
      };
    }
    this.skipNextAnimation = false;

    if (mover === 1) {
      if (res.captured) this.score += CAPTURE_POINTS;
      if (res.crowned) this.score += KING_PROMOTION_POINTS;
    }

    this.activePlayer = res.nextPlayer;
    this.chainFromIdx = res.nextChainFromIdx;

    if (this.activePlayer === 1 && this.chainFromIdx !== null) {
      this.selectedIdx = this.chainFromIdx;
      this.legalTargets = this.getLegalTargetsForIndex(this.chainFromIdx, 1);
    } else {
      this.selectedIdx = null;
      this.legalTargets = [];
    }

    if (this.activePlayer === 2) {
      this.aiDelayTicks = AI_RESPONSE_DELAY_TICKS;
    }

    const terminal = evaluateCheckersTerminal(this.board, this.activePlayer, this.chainFromIdx, this.quietHalfMoves);
    if (terminal.ended) {
      this.gameOver = true;
      if (terminal.winner === 1) {
        this.outcome = "player_win";
        const secLeft = Math.ceil(this.p1ClockTicks / 60);
        this.score += WIN_BONUS + secLeft * CLOCK_BONUS_PER_SEC;
      } else if (terminal.winner === 2) {
        this.outcome = "opponent_win";
        this.score = 0;
      } else {
        this.outcome = "draw";
        this.score += DRAW_BONUS;
      }
      if (!this.soundPlayedEnd) {
        this.soundPlayedEnd = true;
        checkersSounds.playGameOver();
      }
      return true;
    }

    if (res.crowned) checkersSounds.playKing();
    else if (res.captured) checkersSounds.playCapture();
    else checkersSounds.playMove();

    return true;
  }

  private pickSeededAiMove(): CheckersMove | null {
    const legal = getLegalCheckersMoves(this.board, 2, this.chainFromIdx);
    if (legal.length === 0) return null;

    let bestMove = legal[0];
    let bestScore = -Infinity;

    for (const move of legal) {
      const sim = [...this.board];
      const res = applyCheckersMovePure(sim, 2, this.chainFromIdx, move.from, move.to);
      if (!res.ok) continue;

      let evalScore = this.rng() * 8;
      if (res.captured) evalScore += 120;
      if (res.nextChainFromIdx !== null) evalScore += 95; // multi-jump bonus
      if (res.crowned) evalScore += 110;

      const toRow = Math.floor(move.to / BOARD_SQUARES);
      const toCol = move.to % BOARD_SQUARES;
      // Center & advancement preference
      if (toCol >= 2 && toCol <= 5 && toRow >= 2 && toRow <= 5) evalScore += 22;
      if (sim[move.to] === 3) evalScore += toRow * 4;

      // Penalize landing where opponent can immediately capture this piece
      if (res.nextPlayer === 1) {
        const oppCaps = getLegalCheckersMoves(sim, 1, null).filter((m) => m.capturedIdx === move.to);
        if (oppCaps.length > 0) evalScore -= 70;
      }

      if (evalScore > bestScore) {
        bestScore = evalScore;
        bestMove = move;
      }
    }

    return bestMove;
  }

  public update(_dtSec: number, input: CheckersInput): "collision" | null {
    if (this.gameOver) return "collision";

    this.tickCount++;

    if (input.resign) {
      this.outcome = "opponent_win";
      this.score = 0;
      this.gameOver = true;
      return "collision";
    }

    if (this.activePlayer === 1) {
      this.p1ClockTicks = Math.max(0, this.p1ClockTicks - 1);
      if (this.p1ClockTicks <= 0) {
        this.outcome = "player_flag";
        this.score = 0;
        this.gameOver = true;
        return "collision";
      }

      if (input.from !== undefined && input.to !== undefined) {
        this.applyMove({ from: input.from, to: input.to });
        if (this.gameOver) return "collision";
      }
    } else {
      this.p2ClockTicks = Math.max(0, this.p2ClockTicks - 1);
      if (this.p2ClockTicks <= 0) {
        this.outcome = "opponent_flag";
        const secLeft = Math.ceil(this.p1ClockTicks / 60);
        this.score += WIN_BONUS + secLeft * CLOCK_BONUS_PER_SEC;
        this.gameOver = true;
        return "collision";
      }

      if (this.aiDelayTicks > 0) {
        this.aiDelayTicks--;
      } else {
        const aiMove = this.pickSeededAiMove();
        if (aiMove) {
          this.applyMove({ from: aiMove.from, to: aiMove.to });
          if (this.gameOver) return "collision";
        }
      }
    }

    return null;
  }

  private formatClock(ticks: number): string {
    const totalSec = Math.ceil(ticks / 60);
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  }

  private drawCheckerPiece(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    radius: number,
    piece: number,
    elevated = false,
  ): void {
    const owner = ownerOfPiece(piece);
    if (owner === 0) return;
    const king = isKingPiece(piece);

    ctx.save();
    // Subtle drop shadow
    ctx.fillStyle = elevated ? "rgba(0, 0, 0, 0.36)" : "rgba(0, 0, 0, 0.28)";
    ctx.beginPath();
    ctx.arc(cx, cy + (elevated ? 6 : 3), radius, 0, Math.PI * 2);
    ctx.fill();

    // Outer rim
    ctx.fillStyle = owner === 1 ? CHECKERS_COLORS.p1Rim : CHECKERS_COLORS.p2Rim;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    // Main disc face
    ctx.fillStyle = owner === 1 ? CHECKERS_COLORS.p1Base : CHECKERS_COLORS.p2Base;
    ctx.beginPath();
    ctx.arc(cx, cy - 1, radius * 0.88, 0, Math.PI * 2);
    ctx.fill();

    // Concentric tabletop ridge ring
    ctx.strokeStyle = owner === 1 ? CHECKERS_COLORS.p1Highlight : CHECKERS_COLORS.p2Highlight;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy - 1, radius * 0.66, 0, Math.PI * 2);
    ctx.stroke();

    // Inner recessed face
    ctx.globalAlpha = 1;
    ctx.fillStyle = owner === 1 ? CHECKERS_COLORS.p1Inner : CHECKERS_COLORS.p2Inner;
    ctx.beginPath();
    ctx.arc(cx, cy - 1, radius * 0.54, 0, Math.PI * 2);
    ctx.fill();

    // Crisp gold King crown emblem
    if (king) {
      const w = radius * 0.68;
      const h = radius * 0.46;
      const bx = cx - w / 2;
      const by = cy + h * 0.42;

      ctx.fillStyle = CHECKERS_COLORS.crownGold;
      ctx.strokeStyle = CHECKERS_COLORS.crownStroke;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx - w * 0.08, by - h * 0.9);
      ctx.lineTo(cx - w * 0.2, by - h * 0.42);
      ctx.lineTo(cx, by - h * 1.05);
      ctx.lineTo(cx + w * 0.2, by - h * 0.42);
      ctx.lineTo(bx + w * 1.08, by - h * 0.9);
      ctx.lineTo(bx + w, by);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }

  private drawPlayerBar(
    ctx: CanvasRenderingContext2D,
    y: number,
    label: string,
    ticks: number,
    isActive: boolean,
    seat: 1 | 2,
    piecesLeft: number,
  ): void {
    const cardH = 104;
    const secLeft = Math.ceil(ticks / 60);
    const isCritical = secLeft <= 20;
    const isWarn = secLeft <= 35 && !isCritical;

    drawRoundedRect(ctx, PANEL_X, y, PANEL_W, cardH, 10);
    ctx.fillStyle = CHECKERS_COLORS.hudBg;
    ctx.fill();
    ctx.strokeStyle = isActive ? CHECKERS_COLORS.accentGold : CHECKERS_COLORS.hudBorder;
    ctx.lineWidth = isActive ? 2.25 : 1.25;
    ctx.stroke();

    this.drawCheckerPiece(ctx, PANEL_X + 34, y + cardH / 2, 16, seat === 1 ? 1 : 3, false);

    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = CHECKERS_COLORS.textPrimary;
    ctx.font = "bold 18px sans-serif";
    const truncated = label.length > 18 ? `${label.slice(0, 17)}…` : label;
    ctx.fillText(truncated, PANEL_X + 62, y + cardH / 2 - 11);

    ctx.fillStyle = CHECKERS_COLORS.textMuted;
    ctx.font = "bold 12px monospace";
    ctx.fillText(`${piecesLeft} PIECES LEFT`, PANEL_X + 62, y + cardH / 2 + 13);

    const clockW = 122;
    const clockH = 46;
    const clockX = PANEL_X + PANEL_W - clockW - 16;
    const clockY = y + (cardH - clockH) / 2;

    drawRoundedRect(ctx, clockX, clockY, clockW, clockH, 8);
    if (isCritical && isActive) ctx.fillStyle = CHECKERS_COLORS.criticalClockBg;
    else if (isWarn && isActive) ctx.fillStyle = CHECKERS_COLORS.warnClockBg;
    else if (isActive) ctx.fillStyle = CHECKERS_COLORS.activeClockBg;
    else ctx.fillStyle = CHECKERS_COLORS.inactiveClockBg;
    ctx.fill();

    ctx.textAlign = "center";
    ctx.fillStyle =
      isActive && (isCritical || isWarn)
        ? "#ffffff"
        : isActive
          ? CHECKERS_COLORS.activeClockText
          : CHECKERS_COLORS.inactiveClockText;
    ctx.font = "bold 26px monospace";
    ctx.fillText(this.formatClock(ticks), clockX + clockW / 2, clockY + clockH / 2 + 1);
    ctx.textBaseline = "alphabetic";
  }

  public render(ctx: CanvasRenderingContext2D): void {
    const backingW = ctx.canvas?.width && ctx.canvas.width > 0 ? ctx.canvas.width : this.width;
    const backingH = ctx.canvas?.height && ctx.canvas.height > 0 ? ctx.canvas.height : this.height;
    const scaleX = backingW / VIRTUAL_WIDTH;
    const scaleY = backingH / VIRTUAL_HEIGHT;

    ctx.save();
    ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);

    // 1. Dark Arena Surround
    ctx.fillStyle = CHECKERS_COLORS.bg;
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

    // 2. Warm Mahogany Rounded Board Frame
    drawRoundedRect(ctx, BOARD_X - 14, BOARD_Y - 14, BOARD_SIZE + 28, BOARD_SIZE + 28, 12);
    ctx.fillStyle = CHECKERS_COLORS.boardFrame;
    ctx.fill();
    ctx.strokeStyle = CHECKERS_COLORS.boardBorder;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Advance / expire slide animation
    let activeAnim: { from: number; to: number; piece: number; progress: number } | null = null;
    if (this.animState) {
      const elapsed = nowMs() - this.animState.startMs;
      if (elapsed >= this.animState.durationMs) {
        this.animState = null;
      } else {
        const rawT = Math.max(0, Math.min(1, elapsed / this.animState.durationMs));
        const eased = 1 - Math.pow(1 - rawT, 3);
        activeAnim = {
          from: this.animState.from,
          to: this.animState.to,
          piece: this.animState.piece,
          progress: eased,
        };
      }
    }

    const flipped = this.orientation === 2;
    const isMyTurn = !this.gameOver && this.activePlayer === this.orientation;
    const legalMovesNow = isMyTurn ? getLegalCheckersMoves(this.board, this.orientation, this.chainFromIdx) : [];
    const forcedCaptureOrigins = new Set(
      legalMovesNow.filter((m) => m.capturedIdx !== null).map((m) => m.from),
    );
    const legalTargetSet = new Set(this.legalTargets);
    const captureTargetSet = new Set(
      legalMovesNow
        .filter((m) => m.from === this.selectedIdx && m.capturedIdx !== null)
        .map((m) => m.to),
    );

    // 3. Render 8x8 Walnut/Mahogany Board, Coordinates, Highlights & Pieces
    for (let vr = 0; vr < BOARD_SQUARES; vr++) {
      for (let vc = 0; vc < BOARD_SQUARES; vc++) {
        const r = flipped ? BOARD_SQUARES - 1 - vr : vr;
        const c = flipped ? BOARD_SQUARES - 1 - vc : vc;
        const idx = r * BOARD_SQUARES + c;
        const sx = BOARD_X + vc * SQUARE_SIZE;
        const sy = BOARD_Y + vr * SQUARE_SIZE;
        const isLight = (r + c) % 2 === 0;

        ctx.fillStyle = isLight ? CHECKERS_COLORS.lightSquare : CHECKERS_COLORS.darkSquare;
        ctx.fillRect(sx, sy, SQUARE_SIZE, SQUARE_SIZE);

        if (idx === this.lastMoveFrom || idx === this.lastMoveTo) {
          ctx.fillStyle = CHECKERS_COLORS.lastMoveSquare;
          ctx.fillRect(sx, sy, SQUARE_SIZE, SQUARE_SIZE);
        }

        if (idx === this.selectedIdx) {
          ctx.fillStyle = CHECKERS_COLORS.selectedSquare;
          ctx.fillRect(sx, sy, SQUARE_SIZE, SQUARE_SIZE);
        }

        // Inside-square corner coordinates (opposite square color, flip-aware)
        const coordColor = isLight ? CHECKERS_COLORS.darkSquare : CHECKERS_COLORS.lightSquare;
        if (vc === 0) {
          ctx.fillStyle = coordColor;
          ctx.font = "bold 12px sans-serif";
          ctx.textAlign = "left";
          ctx.textBaseline = "top";
          ctx.fillText(RANKS[r], sx + 4, sy + 4);
        }
        if (vr === BOARD_SQUARES - 1) {
          ctx.fillStyle = coordColor;
          ctx.font = "bold 12px sans-serif";
          ctx.textAlign = "right";
          ctx.textBaseline = "bottom";
          ctx.fillText(FILES[c], sx + SQUARE_SIZE - 4, sy + SQUARE_SIZE - 3);
        }

        const cx = sx + SQUARE_SIZE / 2;
        const cy = sy + SQUARE_SIZE / 2;

        // Legal destination indicator
        if (legalTargetSet.has(idx)) {
          if (captureTargetSet.has(idx)) {
            ctx.strokeStyle = CHECKERS_COLORS.legalCaptureRing;
            ctx.lineWidth = 4.5;
            ctx.beginPath();
            ctx.arc(cx, cy, SQUARE_SIZE * 0.38, 0, Math.PI * 2);
            ctx.stroke();
          } else {
            ctx.fillStyle = CHECKERS_COLORS.legalDot;
            ctx.beginPath();
            ctx.arc(cx, cy, 11.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // Forced-capture piece indicator ring
        if (forcedCaptureOrigins.has(idx) && this.dragState?.from !== idx) {
          ctx.strokeStyle = CHECKERS_COLORS.forcedCaptureRing;
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.arc(cx, cy, SQUARE_SIZE * 0.43, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Static checker piece
        const piece = this.board[idx] ?? 0;
        const isDraggedOrigin = this.dragState?.from === idx;
        const isAnimTarget = activeAnim?.to === idx;
        if (piece !== 0 && !isDraggedOrigin && !isAnimTarget) {
          this.drawCheckerPiece(ctx, cx, cy, SQUARE_SIZE * 0.38, piece, false);
        }
      }
    }

    // 4. Sliding animated piece
    if (activeAnim) {
      const fromPt = indexToVisualCoords(activeAnim.from, this.orientation);
      const toPt = indexToVisualCoords(activeAnim.to, this.orientation);
      const ix = fromPt.x + (toPt.x - fromPt.x) * activeAnim.progress + SQUARE_SIZE / 2;
      const iy = fromPt.y + (toPt.y - fromPt.y) * activeAnim.progress + SQUARE_SIZE / 2;
      this.drawCheckerPiece(ctx, ix, iy, SQUARE_SIZE * 0.38, activeAnim.piece, false);
    }

    // 5. Elevated floating dragged piece
    if (this.dragState) {
      this.drawCheckerPiece(ctx, this.dragState.vx, this.dragState.vy, SQUARE_SIZE * 0.42, this.dragState.piece, true);
    }

    ctx.textBaseline = "alphabetic";

    // 6. Right-Side Tabletop HUD
    const counts = countCheckersPieces(this.board);
    const opponentSeat: 1 | 2 = this.orientation === 1 ? 2 : 1;

    // Top Opponent Bar
    this.drawPlayerBar(
      ctx,
      64,
      opponentSeat === 1 ? this.p1Label : this.p2Label,
      opponentSeat === 1 ? this.p1ClockTicks : this.p2ClockTicks,
      !this.gameOver && this.activePlayer === opponentSeat,
      opponentSeat,
      opponentSeat === 1 ? counts.p1 : counts.p2,
    );

    // Center Match Status Card
    drawRoundedRect(ctx, PANEL_X, 190, PANEL_W, 334, 10);
    ctx.fillStyle = CHECKERS_COLORS.hudCardBg;
    ctx.fill();
    ctx.strokeStyle = CHECKERS_COLORS.hudBorder;
    ctx.lineWidth = 1.25;
    ctx.stroke();

    ctx.textAlign = "left";
    ctx.fillStyle = CHECKERS_COLORS.textMuted;
    ctx.font = "bold 12px monospace";
    ctx.fillText(this.pvpMode ? "LIVE 1v1 CHECKERS · 3+0" : "TOURNAMENT SCORE · 3+0", PANEL_X + 20, 224);

    ctx.fillStyle = CHECKERS_COLORS.accentGold;
    ctx.font = "bold 36px monospace";
    ctx.fillText(this.pvpMode ? "CHECKERS" : String(this.score), PANEL_X + 20, 268);

    const statusLabel = this.gameOver
      ? this.outcome === "player_win" || this.outcome === "opponent_flag"
        ? "VICTORY!"
        : this.outcome === "draw"
          ? "DRAW (40-MOVE RULE)"
          : "MATCH ENDED"
      : isMyTurn
        ? this.chainFromIdx !== null
          ? "MULTI-JUMP! CONTINUE CAPTURE"
          : forcedCaptureOrigins.size > 0
            ? "CAPTURE REQUIRED!"
            : `YOUR TURN (${this.orientation === 1 ? "RED" : "BLACK"})`
        : this.pvpMode
          ? `OPPONENT'S TURN (${opponentSeat === 1 ? "RED" : "BLACK"})`
          : "AI THINKING (BLACK)";

    drawRoundedRect(ctx, PANEL_X + 20, 294, PANEL_W - 40, 46, 8);
    ctx.fillStyle = forcedCaptureOrigins.size > 0
      ? "rgba(245, 158, 11, 0.2)"
      : isMyTurn
        ? "rgba(16, 185, 129, 0.18)"
        : "rgba(255, 255, 255, 0.06)";
    ctx.fill();
    ctx.strokeStyle = forcedCaptureOrigins.size > 0
      ? "#f59e0b"
      : isMyTurn
        ? "#10b981"
        : "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = forcedCaptureOrigins.size > 0 ? "#fcd34d" : isMyTurn ? "#34d399" : "#cbd5e1";
    ctx.font = "bold 15px sans-serif";
    ctx.fillText(statusLabel, PANEL_X + PANEL_W / 2, 318);

    // Last Move Box
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    drawRoundedRect(ctx, PANEL_X + 20, 362, PANEL_W - 40, 142, 8);
    ctx.fillStyle = "#1e1d1a";
    ctx.fill();
    ctx.strokeStyle = CHECKERS_COLORS.hudBorder;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = CHECKERS_COLORS.textMuted;
    ctx.font = "bold 12px monospace";
    ctx.fillText(`MOVE #${this.turnNumber} · LAST MOVE`, PANEL_X + 36, 392);
    ctx.fillStyle = CHECKERS_COLORS.textPrimary;
    ctx.font = "bold 28px monospace";
    ctx.fillText(this.lastMoveNotation ?? "Awaiting move 1...", PANEL_X + 36, 434);

    ctx.fillStyle = CHECKERS_COLORS.textMuted;
    ctx.font = "13px sans-serif";
    ctx.fillText("Captures are mandatory · Multi-jumps chain", PANEL_X + 36, 480);

    // Bottom Local Player Bar
    this.drawPlayerBar(
      ctx,
      552,
      this.orientation === 1 ? this.p1Label : this.p2Label,
      this.orientation === 1 ? this.p1ClockTicks : this.p2ClockTicks,
      !this.gameOver && this.activePlayer === this.orientation,
      this.orientation,
      this.orientation === 1 ? counts.p1 : counts.p2,
    );

    ctx.restore();
  }
}
