import { Chess, type Move, type Square } from "chess.js";
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
  PANEL_W,
  PANEL_X,
  PIECE_GLYPHS,
  RANKS,
  SQUARE_SIZE,
  VIRTUAL_HEIGHT,
  VIRTUAL_WIDTH,
} from "./constants";

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

  /** Client-only selection highlight (does not affect deterministic simulation). */
  public selectedSquare: string | null = null;
  public legalTargets: string[] = [];

  private chess: Chess = new Chess();
  private lastHydratedFen = "";
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
      } catch {
        // Ignore malformed FEN
      }
    }
  }

  public getLegalTargetsForSquare(square: string): string[] {
    if (this.gameOver || this.chess.turn() !== "w") return [];
    const piece = this.chess.get(square as Square);
    if (!piece || piece.color !== "w") return [];
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

  private drawClockCard(
    ctx: CanvasRenderingContext2D,
    y: number,
    label: string,
    ticks: number,
    isActive: boolean,
  ): void {
    const secLeft = Math.ceil(ticks / 60);
    const clockColor =
      secLeft <= 10
        ? CHESS_COLORS.timerCritical
        : secLeft <= 30
          ? CHESS_COLORS.timerWarn
          : CHESS_COLORS.timerNormal;

    ctx.fillStyle = CHESS_COLORS.hudBg;
    ctx.fillRect(PANEL_X, y, PANEL_W, 84);
    ctx.strokeStyle = isActive ? CHESS_COLORS.activeClockBorder : CHESS_COLORS.hudBorder;
    ctx.lineWidth = isActive ? 2.5 : 1.5;
    ctx.strokeRect(PANEL_X, y, PANEL_W, 84);

    ctx.textAlign = "left";
    ctx.fillStyle = isActive ? "#34d399" : CHESS_COLORS.textMuted;
    ctx.font = "bold 14px monospace";
    ctx.fillText(label, PANEL_X + 18, y + 28);

    ctx.fillStyle = clockColor;
    ctx.font = "bold 34px monospace";
    ctx.fillText(this.formatClock(ticks), PANEL_X + 18, y + 68);

    // Clock progress bar
    const barX = PANEL_X + 165;
    const barY = y + 48;
    const barW = PANEL_W - 185;
    const barH = 14;
    const ratio = Math.max(0, Math.min(1, ticks / BLITZ_CLOCK_TICKS));
    ctx.fillStyle = "#131d30";
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = clockColor;
    ctx.fillRect(barX, barY, barW * ratio, barH);
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);
  }

  public render(ctx: CanvasRenderingContext2D): void {
    const backingW = ctx.canvas?.width && ctx.canvas.width > 0 ? ctx.canvas.width : this.width;
    const backingH = ctx.canvas?.height && ctx.canvas.height > 0 ? ctx.canvas.height : this.height;
    const scaleX = backingW / VIRTUAL_WIDTH;
    const scaleY = backingH / VIRTUAL_HEIGHT;

    ctx.save();
    ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);

    // 1. Background
    ctx.fillStyle = CHESS_COLORS.bg;
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

    // 2. Board Outer Frame
    ctx.fillStyle = CHESS_COLORS.boardFrame;
    ctx.fillRect(BOARD_X - 16, BOARD_Y - 16, BOARD_SIZE + 32, BOARD_SIZE + 32);
    ctx.strokeStyle = CHESS_COLORS.boardBorder;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(BOARD_X - 16, BOARD_Y - 16, BOARD_SIZE + 32, BOARD_SIZE + 32);

    // 3. Render 8x8 Squares, Highlights & Pieces
    const boardMatrix = this.chess.board();
    const activeColor = this.chess.turn();
    const legalSet = new Set(this.legalTargets);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    for (let r = 0; r < BOARD_SQUARES; r++) {
      for (let c = 0; c < BOARD_SQUARES; c++) {
        const sq = `${FILES[c]}${RANKS[r]}`;
        const sx = BOARD_X + c * SQUARE_SIZE;
        const sy = BOARD_Y + r * SQUARE_SIZE;
        const isLight = (r + c) % 2 === 0;

        ctx.fillStyle = isLight ? CHESS_COLORS.lightSquare : CHESS_COLORS.darkSquare;
        ctx.fillRect(sx, sy, SQUARE_SIZE, SQUARE_SIZE);

        if (sq === this.lastMoveFrom || sq === this.lastMoveTo) {
          ctx.fillStyle = CHESS_COLORS.lastMoveSquare;
          ctx.fillRect(sx, sy, SQUARE_SIZE, SQUARE_SIZE);
        }

        if (sq === this.selectedSquare) {
          ctx.fillStyle = CHESS_COLORS.selectedSquare;
          ctx.fillRect(sx, sy, SQUARE_SIZE, SQUARE_SIZE);
        }

        const piece = boardMatrix[r]?.[c] ?? null;

        // Red check glow under threatened king
        if (this.inCheck && piece && piece.type === "k" && piece.color === activeColor) {
          ctx.fillStyle = CHESS_COLORS.checkGlow;
          ctx.fillRect(sx, sy, SQUARE_SIZE, SQUARE_SIZE);
        }

        // Legal destination indicator
        if (legalSet.has(sq)) {
          const cx = sx + SQUARE_SIZE / 2;
          const cy = sy + SQUARE_SIZE / 2;
          if (piece) {
            ctx.strokeStyle = CHESS_COLORS.legalCaptureRing;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(cx, cy, SQUARE_SIZE * 0.42, 0, Math.PI * 2);
            ctx.stroke();
          } else {
            ctx.fillStyle = CHESS_COLORS.legalDot;
            ctx.beginPath();
            ctx.arc(cx, cy, 10, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // Piece medallion + crisp glyph
        if (piece) {
          const cx = sx + SQUARE_SIZE / 2;
          const cy = sy + SQUARE_SIZE / 2;
          const isWhite = piece.color === "w";
          ctx.fillStyle = isWhite ? CHESS_COLORS.whitePieceBg : CHESS_COLORS.blackPieceBg;
          ctx.beginPath();
          ctx.arc(cx, cy, SQUARE_SIZE * 0.36, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = isWhite ? CHESS_COLORS.whitePieceRim : CHESS_COLORS.blackPieceRim;
          ctx.lineWidth = 2.25;
          ctx.stroke();

          const glyph = PIECE_GLYPHS[`${piece.color}${piece.type}`] ?? piece.type.toUpperCase();
          ctx.fillStyle = isWhite ? CHESS_COLORS.whitePieceText : CHESS_COLORS.blackPieceText;
          ctx.font = "bold 36px sans-serif";
          ctx.fillText(glyph, cx, cy + 2);
        }
      }
    }

    // 4. Algebraic Coordinates (Files a-h & Ranks 1-8)
    ctx.fillStyle = CHESS_COLORS.textMuted;
    ctx.font = "bold 13px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let c = 0; c < BOARD_SQUARES; c++) {
      ctx.fillText(FILES[c], BOARD_X + c * SQUARE_SIZE + SQUARE_SIZE / 2, BOARD_Y + BOARD_SIZE + 26);
    }
    for (let r = 0; r < BOARD_SQUARES; r++) {
      ctx.fillText(RANKS[r], BOARD_X - 28, BOARD_Y + r * SQUARE_SIZE + SQUARE_SIZE / 2);
    }

    ctx.textBaseline = "alphabetic";

    // 5. Right-Side Arcade HUD Panel
    this.drawClockCard(ctx, 64, "BLACK AI · 3+0", this.blackClockTicks, !this.gameOver && activeColor === "b");

    // Score & Status Card
    ctx.fillStyle = CHESS_COLORS.hudBg;
    ctx.fillRect(PANEL_X, 166, PANEL_W, 118);
    ctx.strokeStyle = CHESS_COLORS.hudBorder;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(PANEL_X, 166, PANEL_W, 118);

    ctx.textAlign = "left";
    ctx.fillStyle = CHESS_COLORS.textMuted;
    ctx.font = "bold 13px monospace";
    ctx.fillText("TOURNAMENT SCORE", PANEL_X + 18, 192);

    ctx.fillStyle = "#34d399";
    ctx.font = "bold 34px monospace";
    ctx.fillText(String(this.score), PANEL_X + 18, 232);

    const statusLabel = this.gameOver
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

    ctx.fillStyle = this.inCheck ? "#f43f5e" : activeColor === "w" ? "#38bdf8" : "#f59e0b";
    ctx.font = "bold 16px monospace";
    ctx.fillText(statusLabel, PANEL_X + 18, 266);

    // Captured Pieces Tray
    ctx.fillStyle = CHESS_COLORS.hudBg;
    ctx.fillRect(PANEL_X, 302, PANEL_W, 134);
    ctx.strokeStyle = CHESS_COLORS.hudBorder;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(PANEL_X, 302, PANEL_W, 134);

    ctx.fillStyle = CHESS_COLORS.textMuted;
    ctx.font = "bold 12px monospace";
    ctx.fillText("CAPTURED BY YOU", PANEL_X + 18, 326);
    const whiteCaps = this.capturedByWhite.map((p) => PIECE_GLYPHS[`b${p}`] ?? p).join(" ");
    ctx.fillStyle = "#f8fafc";
    ctx.font = "22px sans-serif";
    ctx.fillText(whiteCaps || "—", PANEL_X + 18, 356);

    ctx.fillStyle = CHESS_COLORS.textMuted;
    ctx.font = "bold 12px monospace";
    ctx.fillText("CAPTURED BY AI", PANEL_X + 18, 390);
    const blackCaps = this.capturedByBlack.map((p) => PIECE_GLYPHS[`w${p}`] ?? p).join(" ");
    ctx.fillStyle = "#cbd5e1";
    ctx.font = "22px sans-serif";
    ctx.fillText(blackCaps || "—", PANEL_X + 18, 420);

    // Last Move / Info Card
    ctx.fillStyle = CHESS_COLORS.hudBg;
    ctx.fillRect(PANEL_X, 454, PANEL_W, 100);
    ctx.strokeStyle = CHESS_COLORS.hudBorder;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(PANEL_X, 454, PANEL_W, 100);

    ctx.fillStyle = CHESS_COLORS.textMuted;
    ctx.font = "bold 12px monospace";
    ctx.fillText(`MOVE #${Math.ceil(this.turnNumber / 2)} · LAST MOVE`, PANEL_X + 18, 480);
    ctx.fillStyle = "#f8fafc";
    ctx.font = "bold 24px monospace";
    ctx.fillText(this.lastMoveSan ?? "Awaiting 1. ...", PANEL_X + 18, 518);

    // Player (White) Clock Card
    this.drawClockCard(ctx, 572, "YOU (WHITE) · 3+0", this.whiteClockTicks, !this.gameOver && activeColor === "w");

    ctx.restore();
  }
}
