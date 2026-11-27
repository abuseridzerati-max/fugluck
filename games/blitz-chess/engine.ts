import { Chess, type Move, type Square } from "chess.js";
export { Chess };
export { chessSounds } from "./sounds";
export { preloadPieceSprites } from "./pieces";
import {
  createSeededRandom,
  type RandomFn,
  type TurnBasedEngine,
  type TurnBasedGameState,
  type TurnBasedMove,
  type TurnBasedOutcome,
} from "@fugluck/shared";
import {
  AI_PIECE_VALUES,
  AI_RESPONSE_DELAY_TICKS,
  BLITZ_CLOCK_TICKS,
  BOARD_SIZE,
  BOARD_SQUARES,
  BOARD_X,
  BOARD_Y,
  CAPTURE_POINTS,
  CHECK_BONUS_POINTS,
  CHECKMATE_WIN_BONUS,
  CHESS_COLORS,
  CLOCK_BONUS_PER_SEC,
  DRAW_BONUS_POINTS,
  FILES,
  MATERIAL_VALUES,
  PANEL_W,
  PANEL_X,
  PIECE_GLYPHS,
  RANKS,
  SQUARE_SIZE,
  squareToVisualCoords,
  VIRTUAL_HEIGHT,
  VIRTUAL_WIDTH,
} from "./constants";
import { drawChessPiece, preloadPieceSprites } from "./pieces";
import { chessSounds } from "./sounds";

export type ChessDragState = {
  from: string;
  pieceColor: "w" | "b";
  pieceType: string;
  vx: number;
  vy: number;
};

type ChessMoveAnimation = {
  from: string;
  to: string;
  pieceColor: "w" | "b";
  pieceType: string;
  startMs: number;
  durationMs: number;
};

const MOVE_ANIM_DURATION_MS = 120;

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

export type ChessMovePayload = {
  from: string;
  to: string;
};

export type BlitzChessInput = {
  moveFrom?: string;
  moveTo?: string;
  resign?: boolean;
};

const CENTER_SQUARES = new Set(["d4", "d5", "e4", "e5"]);
const EXTENDED_CENTER = new Set(["c3", "c4", "c5", "c6", "d3", "d6", "e3", "e6", "f3", "f4", "f5", "f6"]);

export class BlitzChessEngine implements TurnBasedEngine<string, ChessMovePayload> {
  public score = 0;
  public tickCount = 0;
  public gameOver = false;
  public whiteClockTicks = BLITZ_CLOCK_TICKS;
  public blackClockTicks = BLITZ_CLOCK_TICKS;
  public outcome: TurnBasedOutcome = "in_progress";
  public turnNumber = 0;
  public lastMoveFrom: string | null = null;
  public lastMoveTo: string | null = null;
  public lastMoveSan: string | null = null;
  public capturedByWhite: string[] = [];
  public capturedByBlack: string[] = [];
  public inCheck = false;

  /** Client-only selection, drag, animation & PvP perspective (do not affect deterministic simulation). */
  public selectedSquare: string | null = null;
  public legalTargets: string[] = [];
  public orientation: "w" | "b" = "w";
  public pvpMode = false;
  public whiteLabel = "You (White)";
  public blackLabel = "Black AI";
  public dragState: ChessDragState | null = null;
  public skipNextAnimation = false;

  private animState: ChessMoveAnimation | null = null;
  private lastAnimatedMoveKey = "";
  private soundPlayedGameOver = false;

  private chess: Chess = new Chess();
  private lastHydratedFen = "";
  private aiDelayTicks = 0;
  private rng!: RandomFn;
  private width = VIRTUAL_WIDTH;
  private height = VIRTUAL_HEIGHT;

  public readonly seed: number;

  constructor(seed: number) {
    this.seed = seed;
    preloadPieceSprites();
    this.reset();
  }

  public resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
  }

  public reset(): void {
    this.score = 0;
    this.tickCount = 0;
    this.gameOver = false;
    this.whiteClockTicks = BLITZ_CLOCK_TICKS;
    this.blackClockTicks = BLITZ_CLOCK_TICKS;
    this.outcome = "in_progress";
    this.turnNumber = 0;
    this.lastMoveFrom = null;
    this.lastMoveTo = null;
    this.lastMoveSan = null;
    this.capturedByWhite = [];
    this.capturedByBlack = [];
    this.inCheck = false;
    this.selectedSquare = null;
    this.legalTargets = [];
    this.dragState = null;
    this.skipNextAnimation = false;
    this.animState = null;
    this.lastAnimatedMoveKey = "";
    this.soundPlayedGameOver = false;
    this.aiDelayTicks = 0;
    this.chess = new Chess();
    this.lastHydratedFen = this.chess.fen();
    this.rng = createSeededRandom(this.seed).stream("gameplay");
  }

  public getFen(): string {
    return this.chess.fen();
  }

  public getActiveTurn(): "w" | "b" {
    return this.chess.turn();
  }

  public getPieceAt(square: string): { color: "w" | "b"; type: string } | null {
    const piece = this.chess.get(square as Square);
    return piece ? { color: piece.color, type: piece.type } : null;
  }

  /** Hydrates renderer state from an authoritative server snapshot without running engine.update. */
  public hydrateFromSnapshot(snapshot: {
    tickCount: number;
    score: number;
    gameOver: boolean;
    chessFen?: string;
    whiteClockTicks?: number;
    blackClockTicks?: number;
    lastMoveFrom?: string | null;
    lastMoveTo?: string | null;
    lastMoveSan?: string | null;
    capturedByWhite?: string[];
    capturedByBlack?: string[];
    turnOutcome?: TurnBasedOutcome;
    inCheck?: boolean;
    turnNumber?: number;
  }): void {
    const prevCapturedTotal = this.capturedByWhite.length + this.capturedByBlack.length;
    const prevGameOver = this.gameOver;

    this.tickCount = snapshot.tickCount;
    this.score = snapshot.score;
    this.gameOver = snapshot.gameOver;
    if (snapshot.whiteClockTicks !== undefined) this.whiteClockTicks = snapshot.whiteClockTicks;
    if (snapshot.blackClockTicks !== undefined) this.blackClockTicks = snapshot.blackClockTicks;
    if (snapshot.lastMoveFrom !== undefined) this.lastMoveFrom = snapshot.lastMoveFrom;
    if (snapshot.lastMoveTo !== undefined) this.lastMoveTo = snapshot.lastMoveTo;
    if (snapshot.lastMoveSan !== undefined) this.lastMoveSan = snapshot.lastMoveSan;
    if (snapshot.capturedByWhite !== undefined) this.capturedByWhite = snapshot.capturedByWhite;
    if (snapshot.capturedByBlack !== undefined) this.capturedByBlack = snapshot.capturedByBlack;
    if (snapshot.turnOutcome !== undefined) this.outcome = snapshot.turnOutcome;
    if (snapshot.inCheck !== undefined) this.inCheck = snapshot.inCheck;
    if (snapshot.turnNumber !== undefined) this.turnNumber = snapshot.turnNumber;

    if (snapshot.chessFen && snapshot.chessFen !== this.lastHydratedFen) {
      try {
        this.chess.load(snapshot.chessFen);
        this.lastHydratedFen = snapshot.chessFen;
        this.selectedSquare = null;
        this.legalTargets = [];
        this.dragState = null;

        // Trigger smooth slide animation + audio for newly hydrated move
        const moveKey = `${this.turnNumber}:${this.lastMoveFrom ?? ""}-${this.lastMoveTo ?? ""}`;
        if (this.lastMoveFrom && this.lastMoveTo && moveKey !== this.lastAnimatedMoveKey) {
          this.lastAnimatedMoveKey = moveKey;
          const movedPiece = this.chess.get(this.lastMoveTo as Square);
          if (movedPiece && !this.skipNextAnimation) {
            this.animState = {
              from: this.lastMoveFrom,
              to: this.lastMoveTo,
              pieceColor: movedPiece.color,
              pieceType: movedPiece.type,
              startMs: nowMs(),
              durationMs: MOVE_ANIM_DURATION_MS,
            };
          }
          this.skipNextAnimation = false;

          const newCapturedTotal = this.capturedByWhite.length + this.capturedByBlack.length;
          if (this.gameOver && !this.soundPlayedGameOver) {
            this.soundPlayedGameOver = true;
            chessSounds.playGameOver();
          } else if (this.inCheck) {
            chessSounds.playCheck();
          } else if (newCapturedTotal > prevCapturedTotal) {
            chessSounds.playCapture();
          } else {
            chessSounds.playMove();
          }
        }
      } catch {
        // Ignore malformed FEN
      }
    }

    if (this.gameOver && !prevGameOver && !this.soundPlayedGameOver) {
      this.soundPlayedGameOver = true;
      chessSounds.playGameOver();
    }
  }

  public getLegalTargetsForSquare(square: string, allowedColor: "w" | "b" = this.orientation): string[] {
    if (this.gameOver || this.chess.turn() !== allowedColor) return [];
    const piece = this.chess.get(square as Square);
    if (!piece || piece.color !== allowedColor) return [];
    const moves = this.chess.moves({ square: square as Square, verbose: true });
    return [...new Set(moves.map((m) => m.to))];
  }

  public getFirstLegalWhiteMove(): ChessMovePayload | null {
    if (this.gameOver || this.chess.turn() !== "w") return null;
    const moves = this.chess.moves({ verbose: true });
    if (moves.length === 0) return null;
    return { from: moves[0].from, to: moves[0].to };
  }

  public getTurnState(): TurnBasedGameState<string, ChessMovePayload> {
    const lastMove: TurnBasedMove<ChessMovePayload> | null =
      this.lastMoveFrom && this.lastMoveTo
        ? {
            player: this.chess.turn() === "b" ? "player" : "opponent",
            turnNumber: this.turnNumber,
            payload: { from: this.lastMoveFrom, to: this.lastMoveTo },
            notation: this.lastMoveSan ?? undefined,
            tick: this.tickCount,
          }
        : null;

    return {
      board: this.chess.fen(),
      activePlayer: this.chess.turn() === "w" ? "player" : "opponent",
      turnNumber: this.turnNumber,
      outcome: this.outcome,
      playerClockTicks: this.whiteClockTicks,
      opponentClockTicks: this.blackClockTicks,
      lastMove,
      inCheck: this.inCheck,
    };
  }

  public toJSON() {
    return {
      score: this.score,
      tickCount: this.tickCount,
      gameOver: this.gameOver,
      capturedByWhite: this.capturedByWhite,
      capturedByBlack: this.capturedByBlack,
      turnState: this.getTurnState(),
    };
  }

  public applyMove(payload: ChessMovePayload): boolean {
    if (this.gameOver) return false;
    let move: Move | null = null;
    try {
      move = this.chess.move({
        from: payload.from as Square,
        to: payload.to as Square,
        promotion: "q",
      });
    } catch {
      return false;
    }
    if (!move) return false;

    this.turnNumber++;
    this.lastMoveFrom = move.from;
    this.lastMoveTo = move.to;
    this.lastMoveSan = move.san;
    this.lastHydratedFen = this.chess.fen();
    this.inCheck = this.chess.inCheck();

    if (move.color === "w") {
      if (move.captured) {
        this.capturedByWhite.push(move.captured);
        this.score += CAPTURE_POINTS[move.captured] ?? 50;
      }
      if (this.inCheck) {
        this.score += CHECK_BONUS_POINTS;
      }
      this.aiDelayTicks = AI_RESPONSE_DELAY_TICKS;
    } else if (move.captured) {
      this.capturedByBlack.push(move.captured);
    }

    this.evaluateTerminalState();

    // Client-only slide animation & sound feedback (does not affect deterministic state)
    const moveKey = `${this.turnNumber}:${move.from}-${move.to}`;
    this.lastAnimatedMoveKey = moveKey;
    if (!this.skipNextAnimation) {
      this.animState = {
        from: move.from,
        to: move.to,
        pieceColor: move.color,
        pieceType: move.promotion ?? move.piece,
        startMs: nowMs(),
        durationMs: MOVE_ANIM_DURATION_MS,
      };
    }
    this.skipNextAnimation = false;

    if (this.gameOver && !this.soundPlayedGameOver) {
      this.soundPlayedGameOver = true;
      chessSounds.playGameOver();
    } else if (this.inCheck) {
      chessSounds.playCheck();
    } else if (move.captured) {
      chessSounds.playCapture();
    } else {
      chessSounds.playMove();
    }

    return true;
  }

  private evaluateTerminalState(): void {
    if (this.chess.isCheckmate()) {
      // Side whose turn it is has been checkmated
      const whiteWon = this.chess.turn() === "b";
      if (whiteWon) {
        this.outcome = "player_win";
        const secLeft = Math.ceil(this.whiteClockTicks / 60);
        this.score += CHECKMATE_WIN_BONUS + secLeft * CLOCK_BONUS_PER_SEC;
      } else {
        this.outcome = "opponent_win";
        this.score = 0;
      }
      this.gameOver = true;
      return;
    }

    if (this.chess.isDraw() || this.chess.isStalemate() || this.chess.isThreefoldRepetition() || this.chess.isInsufficientMaterial()) {
      this.outcome = "draw";
      this.score += DRAW_BONUS_POINTS;
      this.gameOver = true;
    }
  }

  private pickSeededAiMove(): Move | null {
    const moves = this.chess.moves({ verbose: true });
    if (moves.length === 0) return null;

    let bestMove = moves[0];
    let bestScore = -Infinity;

    for (const move of moves) {
      let evalScore = this.rng() * 8; // deterministic seeded tie-breaking

      if (move.captured) {
        const capVal = AI_PIECE_VALUES[move.captured] ?? 100;
        const moverVal = AI_PIECE_VALUES[move.piece] ?? 100;
        evalScore += capVal * 10 - moverVal * 0.4;
      }
      if (move.promotion) {
        evalScore += 800;
      }
      if (CENTER_SQUARES.has(move.to)) {
        evalScore += 35;
      } else if (EXTENDED_CENTER.has(move.to)) {
        evalScore += 15;
      }
      if (move.san.includes("#")) {
        evalScore += 100000;
      } else if (move.san.includes("+")) {
        evalScore += 45;
      }

      // Quick safety check: penalize moving a high-value piece onto a square attacked by White
      this.chess.move(move);
      const attackedByWhite = this.chess.isAttacked(move.to as Square, "w");
      this.chess.undo();
      if (attackedByWhite) {
        evalScore -= (AI_PIECE_VALUES[move.piece] ?? 100) * 0.7;
      }

      if (evalScore > bestScore) {
        bestScore = evalScore;
        bestMove = move;
      }
    }

    return bestMove;
  }

  public update(_dtSec: number, input: BlitzChessInput): "collision" | null {
    if (this.gameOver) return "collision";

    this.tickCount++;

    if (input.resign) {
      this.outcome = "opponent_win";
      this.score = 0;
      this.gameOver = true;
      return "collision";
    }

    // 1. Tick active side's 3+0 blitz clock
    if (this.chess.turn() === "w") {
      this.whiteClockTicks = Math.max(0, this.whiteClockTicks - 1);
      if (this.whiteClockTicks <= 0) {
        this.outcome = "player_flag";
        this.score = 0;
        this.gameOver = true;
        return "collision";
      }

      // 2. Apply player's move (White)
      if (input.moveFrom && input.moveTo) {
        this.applyMove({ from: input.moveFrom, to: input.moveTo });
        if (this.gameOver) return "collision";
      }
    } else {
      this.blackClockTicks = Math.max(0, this.blackClockTicks - 1);
      if (this.blackClockTicks <= 0) {
        this.outcome = "opponent_flag";
        const secLeft = Math.ceil(this.whiteClockTicks / 60);
        this.score += CHECKMATE_WIN_BONUS + secLeft * CLOCK_BONUS_PER_SEC;
        this.gameOver = true;
        return "collision";
      }

      // 3. Deterministic seeded AI response (Black)
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

  private computeMaterialAdvantage(): { whiteAdv: number; blackAdv: number } {
    const whiteMat = this.capturedByWhite.reduce((sum, p) => sum + (MATERIAL_VALUES[p] ?? 0), 0);
    const blackMat = this.capturedByBlack.reduce((sum, p) => sum + (MATERIAL_VALUES[p] ?? 0), 0);
    return {
      whiteAdv: Math.max(0, whiteMat - blackMat),
      blackAdv: Math.max(0, blackMat - whiteMat),
    };
  }

  private drawPlayerBar(
    ctx: CanvasRenderingContext2D,
    y: number,
    label: string,
    ticks: number,
    isActive: boolean,
    captured: string[],
    capturedPrefix: "w" | "b",
    materialAdv: number,
    sideBadgeColor: "w" | "b",
  ): void {
    const cardH = 112;
    const secLeft = Math.ceil(ticks / 60);
    const isCritical = secLeft <= 20;
    const isWarn = secLeft <= 30 && !isCritical;

    // Card container (rounded)
    drawRoundedRect(ctx, PANEL_X, y, PANEL_W, cardH, 10);
    ctx.fillStyle = CHESS_COLORS.hudBg;
    ctx.fill();
    ctx.strokeStyle = isActive ? CHESS_COLORS.accentGreen : CHESS_COLORS.hudBorder;
    ctx.lineWidth = isActive ? 2 : 1.25;
    ctx.stroke();

    // Side color emblem
    const emblemX = PANEL_X + 26;
    const emblemY = y + 32;
    ctx.fillStyle = sideBadgeColor === "w" ? "#f5f5f4" : "#1c1a18";
    ctx.beginPath();
    ctx.arc(emblemX, emblemY, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = sideBadgeColor === "w" ? "#57534e" : "#a8a29e";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Player Name
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = CHESS_COLORS.textPrimary;
    ctx.font = "bold 17px sans-serif";
    const truncatedLabel = label.length > 20 ? `${label.slice(0, 19)}…` : label;
    ctx.fillText(truncatedLabel, PANEL_X + 46, y + 33);

    // Digital Clock Pill (Chess.com style)
    const clockW = 124;
    const clockH = 44;
    const clockX = PANEL_X + PANEL_W - clockW - 14;
    const clockY = y + 12;

    drawRoundedRect(ctx, clockX, clockY, clockW, clockH, 8);
    if (isCritical && isActive) {
      ctx.fillStyle = CHESS_COLORS.criticalClockBg;
    } else if (isWarn && isActive) {
      ctx.fillStyle = CHESS_COLORS.warnClockBg;
    } else if (isActive) {
      ctx.fillStyle = CHESS_COLORS.activeClockBg;
    } else {
      ctx.fillStyle = CHESS_COLORS.inactiveClockBg;
    }
    ctx.fill();

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = isCritical && isActive
      ? "#ffffff"
      : isWarn && isActive
        ? "#ffffff"
        : isActive
          ? CHESS_COLORS.activeClockText
          : CHESS_COLORS.inactiveClockText;
    ctx.font = "bold 26px monospace";
    ctx.fillText(this.formatClock(ticks), clockX + clockW / 2, clockY + clockH / 2 + 1);

    // Captured pieces row + material advantage badge (+3)
    const capY = y + 82;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const capGlyphs = captured.map((p) => PIECE_GLYPHS[`${capturedPrefix}${p}`] ?? p).join("");
    ctx.fillStyle = "#d6d3d1";
    ctx.font = "19px sans-serif";
    ctx.fillText(capGlyphs || "—", PANEL_X + 18, capY);

    if (materialAdv > 0) {
      const badgeX = PANEL_X + PANEL_W - 56;
      drawRoundedRect(ctx, badgeX, capY - 12, 42, 24, 6);
      ctx.fillStyle = "rgba(129, 182, 76, 0.22)";
      ctx.fill();
      ctx.textAlign = "center";
      ctx.fillStyle = "#a3e635";
      ctx.font = "bold 13px monospace";
      ctx.fillText(`+${materialAdv}`, badgeX + 21, capY + 1);
    }

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
    ctx.fillStyle = CHESS_COLORS.bg;
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

    // 2. Subtle Rounded Board Frame (Chess.com Tournament style)
    drawRoundedRect(ctx, BOARD_X - 14, BOARD_Y - 14, BOARD_SIZE + 28, BOARD_SIZE + 28, 12);
    ctx.fillStyle = CHESS_COLORS.boardFrame;
    ctx.fill();
    ctx.strokeStyle = CHESS_COLORS.boardBorder;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Advance / expire piece slide animation
    let activeAnim: { from: string; to: string; pieceColor: "w" | "b"; pieceType: string; progress: number } | null = null;
    if (this.animState) {
      const elapsed = nowMs() - this.animState.startMs;
      if (elapsed >= this.animState.durationMs) {
        this.animState = null;
      } else {
        const rawT = Math.max(0, Math.min(1, elapsed / this.animState.durationMs));
        const easedT = 1 - Math.pow(1 - rawT, 3); // smooth ease-out cubic
        activeAnim = {
          from: this.animState.from,
          to: this.animState.to,
          pieceColor: this.animState.pieceColor,
          pieceType: this.animState.pieceType,
          progress: easedT,
        };
      }
    }

    // 3. Render 8x8 Tournament Green Squares, Highlights, Coordinates & Static Pieces
    const boardMatrix = this.chess.board();
    const activeColor = this.chess.turn();
    const legalSet = new Set(this.legalTargets);
    const flipped = this.orientation === "b";

    for (let vr = 0; vr < BOARD_SQUARES; vr++) {
      for (let vc = 0; vc < BOARD_SQUARES; vc++) {
        const r = flipped ? BOARD_SQUARES - 1 - vr : vr;
        const c = flipped ? BOARD_SQUARES - 1 - vc : vc;
        const sq = `${FILES[c]}${RANKS[r]}`;
        const sx = BOARD_X + vc * SQUARE_SIZE;
        const sy = BOARD_Y + vr * SQUARE_SIZE;
        const isLight = (r + c) % 2 === 0;

        // Base Tournament Green square
        ctx.fillStyle = isLight ? CHESS_COLORS.lightSquare : CHESS_COLORS.darkSquare;
        ctx.fillRect(sx, sy, SQUARE_SIZE, SQUARE_SIZE);

        // Last-move highlight (#f6f669 on light / #baca44 on dark)
        if (sq === this.lastMoveFrom || sq === this.lastMoveTo) {
          ctx.fillStyle = isLight ? CHESS_COLORS.lastMoveLight : CHESS_COLORS.lastMoveDark;
          ctx.fillRect(sx, sy, SQUARE_SIZE, SQUARE_SIZE);
        }

        // Selected square highlight
        if (sq === this.selectedSquare) {
          ctx.fillStyle = isLight ? CHESS_COLORS.selectedLight : CHESS_COLORS.selectedDark;
          ctx.fillRect(sx, sy, SQUARE_SIZE, SQUARE_SIZE);
        }

        const piece = boardMatrix[r]?.[c] ?? null;

        // Soft radial red check highlight under threatened King
        if (this.inCheck && piece && piece.type === "k" && piece.color === activeColor) {
          const cx = sx + SQUARE_SIZE / 2;
          const cy = sy + SQUARE_SIZE / 2;
          if (typeof ctx.createRadialGradient === "function") {
            const grad = ctx.createRadialGradient(cx, cy, 4, cx, cy, SQUARE_SIZE * 0.56);
            grad.addColorStop(0, "rgba(255, 59, 48, 0.92)");
            grad.addColorStop(0.65, "rgba(255, 59, 48, 0.45)");
            grad.addColorStop(1, "rgba(255, 59, 48, 0)");
            ctx.fillStyle = grad;
            ctx.fillRect(sx, sy, SQUARE_SIZE, SQUARE_SIZE);
          } else {
            ctx.fillStyle = "rgba(255, 59, 48, 0.55)";
            ctx.beginPath();
            ctx.arc(cx, cy, SQUARE_SIZE * 0.44, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // Inside-square coordinates (Chess.com style: opposite square color)
        const coordColor = isLight ? CHESS_COLORS.darkSquare : CHESS_COLORS.lightSquare;
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

        // Legal destination indicators (dot for empty, hollow ring for capture)
        if (legalSet.has(sq)) {
          const cx = sx + SQUARE_SIZE / 2;
          const cy = sy + SQUARE_SIZE / 2;
          if (piece) {
            ctx.strokeStyle = CHESS_COLORS.legalCaptureRing;
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.arc(cx, cy, SQUARE_SIZE * 0.43, 0, Math.PI * 2);
            ctx.stroke();
          } else {
            ctx.fillStyle = CHESS_COLORS.legalDot;
            ctx.beginPath();
            ctx.arc(cx, cy, 11.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // Draw static piece (skip if currently dragged or mid-slide to this square)
        const isDraggedOrigin = this.dragState?.from === sq;
        const isAnimatingTarget = activeAnim?.to === sq;
        if (piece && !isDraggedOrigin && !isAnimatingTarget) {
          drawChessPiece(ctx, piece.color, piece.type, sx, sy, SQUARE_SIZE, 0.92, false);
        }
      }
    }

    // 4. Smoothly sliding animated piece
    if (activeAnim) {
      const fromPt = squareToVisualCoords(activeAnim.from, this.orientation);
      const toPt = squareToVisualCoords(activeAnim.to, this.orientation);
      if (fromPt && toPt) {
        const ix = fromPt.x + (toPt.x - fromPt.x) * activeAnim.progress;
        const iy = fromPt.y + (toPt.y - fromPt.y) * activeAnim.progress;
        drawChessPiece(ctx, activeAnim.pieceColor, activeAnim.pieceType, ix, iy, SQUARE_SIZE, 0.92, false);
      }
    }

    // 5. Floating dragged piece on top (slightly scaled + drop shadow)
    if (this.dragState) {
      const dx = this.dragState.vx - SQUARE_SIZE / 2;
      const dy = this.dragState.vy - SQUARE_SIZE / 2;
      drawChessPiece(ctx, this.dragState.pieceColor, this.dragState.pieceType, dx, dy, SQUARE_SIZE, 1.12, true);
    }

    ctx.textBaseline = "alphabetic";

    // 6. Clean Chess.com-style Right-Side HUD
    const { whiteAdv, blackAdv } = this.computeMaterialAdvantage();

    // Top Opponent Bar
    const topLabel = flipped ? this.whiteLabel : this.blackLabel;
    const topTicks = flipped ? this.whiteClockTicks : this.blackClockTicks;
    const topActive = !this.gameOver && activeColor === (flipped ? "w" : "b");
    const topCaps = flipped ? this.capturedByWhite : this.capturedByBlack;
    const topCapPrefix: "w" | "b" = flipped ? "b" : "w";
    const topAdv = flipped ? whiteAdv : blackAdv;
    const topColor: "w" | "b" = flipped ? "w" : "b";
    this.drawPlayerBar(ctx, 64, topLabel, topTicks, topActive, topCaps, topCapPrefix, topAdv, topColor);

    // Center Match Info & Move Status Card
    drawRoundedRect(ctx, PANEL_X, 198, PANEL_W, 324, 10);
    ctx.fillStyle = CHESS_COLORS.hudCardBg;
    ctx.fill();
    ctx.strokeStyle = CHESS_COLORS.hudBorder;
    ctx.lineWidth = 1.25;
    ctx.stroke();

    ctx.textAlign = "left";
    ctx.fillStyle = CHESS_COLORS.textMuted;
    ctx.font = "bold 12px monospace";
    ctx.fillText(this.pvpMode ? "LIVE 1v1 BLITZ · 3+0" : "TOURNAMENT SCORE · 3+0", PANEL_X + 20, 232);

    ctx.fillStyle = CHESS_COLORS.accentGreen;
    ctx.font = "bold 36px monospace";
    ctx.fillText(this.pvpMode ? "BLITZ CHESS" : String(this.score), PANEL_X + 20, 276);

    const isMyTurn = activeColor === this.orientation;
    const statusLabel = this.pvpMode
      ? this.gameOver
        ? "MATCH ENDED"
        : this.inCheck
          ? isMyTurn
            ? "CHECK! YOUR TURN"
            : "CHECK! OPPONENT'S TURN"
          : isMyTurn
            ? `YOUR TURN (${this.orientation === "w" ? "WHITE" : "BLACK"})`
            : `OPPONENT'S TURN (${this.orientation === "w" ? "BLACK" : "WHITE"})`
      : this.gameOver
        ? this.outcome === "player_win"
          ? "CHECKMATE! YOU WIN"
          : this.outcome === "opponent_flag"
            ? "OPPONENT FLAGGED! WIN"
            : this.outcome === "draw"
              ? "DRAW"
              : "MATCH ENDED"
        : this.inCheck
          ? activeColor === "w"
            ? "CHECK! YOUR TURN"
            : "CHECK! AI THINKING"
          : activeColor === "w"
            ? "YOUR TURN (WHITE)"
            : "AI THINKING (BLACK)";

    // Turn status pill
    drawRoundedRect(ctx, PANEL_X + 20, 298, PANEL_W - 40, 44, 8);
    ctx.fillStyle = this.inCheck
      ? "rgba(255, 59, 48, 0.2)"
      : isMyTurn
        ? "rgba(129, 182, 76, 0.2)"
        : "rgba(255, 255, 255, 0.06)";
    ctx.fill();
    ctx.strokeStyle = this.inCheck ? "#ff3b30" : isMyTurn ? CHESS_COLORS.accentGreen : "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = this.inCheck ? "#fca5a5" : isMyTurn ? "#bef264" : "#d6d3d1";
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(statusLabel, PANEL_X + PANEL_W / 2, 321);

    // Last Move Box
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    drawRoundedRect(ctx, PANEL_X + 20, 364, PANEL_W - 40, 134, 8);
    ctx.fillStyle = "#262421";
    ctx.fill();
    ctx.strokeStyle = CHESS_COLORS.hudBorder;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = CHESS_COLORS.textMuted;
    ctx.font = "bold 12px monospace";
    ctx.fillText(`MOVE #${Math.ceil(this.turnNumber / 2)} · LAST MOVE`, PANEL_X + 36, 394);
    ctx.fillStyle = CHESS_COLORS.textPrimary;
    ctx.font = "bold 30px monospace";
    ctx.fillText(this.lastMoveSan ?? "Awaiting 1. ...", PANEL_X + 36, 438);

    ctx.fillStyle = CHESS_COLORS.textMuted;
    ctx.font = "13px sans-serif";
    ctx.fillText("Drag & drop or click pieces to move", PANEL_X + 36, 478);

    // Bottom Local Player Bar
    const bottomLabel = flipped ? this.blackLabel : this.whiteLabel;
    const bottomTicks = flipped ? this.blackClockTicks : this.whiteClockTicks;
    const bottomActive = !this.gameOver && activeColor === (flipped ? "b" : "w");
    const bottomCaps = flipped ? this.capturedByBlack : this.capturedByWhite;
    const bottomCapPrefix: "w" | "b" = flipped ? "w" : "b";
    const bottomAdv = flipped ? blackAdv : whiteAdv;
    const bottomColor: "w" | "b" = flipped ? "b" : "w";
    this.drawPlayerBar(ctx, 544, bottomLabel, bottomTicks, bottomActive, bottomCaps, bottomCapPrefix, bottomAdv, bottomColor);

    ctx.restore();
  }
}
