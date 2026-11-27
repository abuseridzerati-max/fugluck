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
  BOARD_H,
  BOARD_W,
  BOARD_X,
  BOARD_Y,
  CELL_SIZE,
  CLOCK_BONUS_PER_SEC,
  COLS,
  CONNECT4_COLORS,
  DRAW_BONUS,
  PANEL_W,
  PANEL_X,
  ROWS,
  THREAT_3_BONUS,
  VIRTUAL_HEIGHT,
  VIRTUAL_WIDTH,
  WIN_BONUS,
} from "./constants";
import { connect4Sounds } from "./sounds";

export { connect4Sounds } from "./sounds";

export type Connect4MovePayload = {
  col: number;
};

export type Connect4Input = {
  dropCol?: number;
  resign?: boolean;
};

type DropAnimation = {
  col: number;
  targetRow: number;
  player: 1 | 2;
  startMs: number;
  durationMs: number;
};

const DROP_ANIM_DURATION_MS = 180;
const CENTER_COL_WEIGHTS = [2, 6, 12, 20, 12, 6, 2] as const;

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

/** Gravity drop with a subtle final bounce (0 -> 1) */
function easeOutBounceDrop(t: number): number {
  if (t < 0.72) {
    const k = t / 0.72;
    return k * k;
  }
  if (t < 0.88) {
    const k = (t - 0.72) / 0.16;
    return 1 - 0.08 * Math.sin(k * Math.PI);
  }
  const k = (t - 0.88) / 0.12;
  return 1 - 0.025 * Math.sin(k * Math.PI);
}

/** Pure helper: returns lowest empty row (5..0) in a column, or -1 if full/invalid. */
export function findDropRow(board: readonly number[], col: number): number {
  if (!Number.isInteger(col) || col < 0 || col >= COLS) return -1;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r * COLS + col] === 0) return r;
  }
  return -1;
}

/** Pure helper: returns the 4 winning cell indices for `player`, or null. */
export function findWinningCells(board: readonly number[], player: 1 | 2): number[] | null {
  const dirs: ReadonlyArray<[number, number]> = [
    [0, 1], // horizontal
    [1, 0], // vertical
    [1, 1], // diagonal down-right
    [1, -1], // diagonal down-left
  ];

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r * COLS + c] !== player) continue;
      for (const [dr, dc] of dirs) {
        const endR = r + dr * 3;
        const endC = c + dc * 3;
        if (endR < 0 || endR >= ROWS || endC < 0 || endC >= COLS) continue;
        const i1 = (r + dr) * COLS + (c + dc);
        const i2 = (r + dr * 2) * COLS + (c + dc * 2);
        const i3 = endR * COLS + endC;
        if (board[i1] === player && board[i2] === player && board[i3] === player) {
          return [r * COLS + c, i1, i2, i3];
        }
      }
    }
  }
  return null;
}

/** Pure helper: true when top row has no empty slots. */
export function isBoardFull(board: readonly number[]): boolean {
  for (let c = 0; c < COLS; c++) {
    if (board[c] === 0) return false;
  }
  return true;
}

/** Pure helper: counts open 3-in-a-row windows (3 discs of `player` + 1 empty). */
export function countThreeInARowThreats(board: readonly number[], player: 1 | 2): number {
  let threats = 0;
  const dirs: ReadonlyArray<[number, number]> = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      for (const [dr, dc] of dirs) {
        const endR = r + dr * 3;
        const endC = c + dc * 3;
        if (endR < 0 || endR >= ROWS || endC < 0 || endC >= COLS) continue;
        let pCount = 0;
        let emptyCount = 0;
        for (let k = 0; k < 4; k++) {
          const val = board[(r + dr * k) * COLS + (c + dc * k)];
          if (val === player) pCount++;
          else if (val === 0) emptyCount++;
        }
        if (pCount === 3 && emptyCount === 1) threats++;
      }
    }
  }
  return threats;
}

export class Connect4Engine implements TurnBasedEngine<number[], Connect4MovePayload> {
  public board: number[] = new Array<number>(BOARD_CELLS).fill(0);
  public activePlayer: 1 | 2 = 1;
  public score = 0;
  public tickCount = 0;
  public gameOver = false;
  public p1ClockTicks = BLITZ_CLOCK_TICKS;
  public p2ClockTicks = BLITZ_CLOCK_TICKS;
  public outcome: TurnBasedOutcome = "in_progress";
  public turnNumber = 0;
  public lastMoveCol: number | null = null;
  public lastMoveRow: number | null = null;
  public winningCells: number[] = [];

  /** Client-only UI state (does not affect deterministic simulation). */
  public hoverCol = 3;
  public pvpMode = false;
  public localSeat: 1 | 2 = 1;
  public p1Label = "You (Red)";
  public p2Label = "Gold AI";

  private dropAnim: DropAnimation | null = null;
  private lastAnimatedTurn = 0;
  private soundPlayedEnd = false;
  private prevP1Threats = 0;
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
    this.board = new Array<number>(BOARD_CELLS).fill(0);
    this.activePlayer = 1;
    this.score = 0;
    this.tickCount = 0;
    this.gameOver = false;
    this.p1ClockTicks = BLITZ_CLOCK_TICKS;
    this.p2ClockTicks = BLITZ_CLOCK_TICKS;
    this.outcome = "in_progress";
    this.turnNumber = 0;
    this.lastMoveCol = null;
    this.lastMoveRow = null;
    this.winningCells = [];
    this.hoverCol = 3;
    this.dropAnim = null;
    this.lastAnimatedTurn = 0;
    this.soundPlayedEnd = false;
    this.prevP1Threats = 0;
    this.aiDelayTicks = 0;
    this.rng = createSeededRandom(this.seed).stream("gameplay");
  }

  public canDropInColumn(col: number): boolean {
    return !this.gameOver && findDropRow(this.board, col) >= 0;
  }

  public hydrateFromSnapshot(snapshot: {
    tickCount: number;
    score: number;
    gameOver: boolean;
    c4Board?: number[];
    c4ActivePlayer?: 1 | 2;
    p1ClockTicks?: number;
    p2ClockTicks?: number;
    lastMoveCol?: number | null;
    lastMoveRow?: number | null;
    winningCells?: number[];
    turnOutcome?: TurnBasedOutcome;
    turnNumber?: number;
  }): void {
    const prevGameOver = this.gameOver;
    this.tickCount = snapshot.tickCount;
    this.score = snapshot.score;
    this.gameOver = snapshot.gameOver;
    if (Array.isArray(snapshot.c4Board) && snapshot.c4Board.length === BOARD_CELLS) {
      this.board = [...snapshot.c4Board];
    }
    if (snapshot.c4ActivePlayer !== undefined) this.activePlayer = snapshot.c4ActivePlayer;
    if (snapshot.p1ClockTicks !== undefined) this.p1ClockTicks = snapshot.p1ClockTicks;
    if (snapshot.p2ClockTicks !== undefined) this.p2ClockTicks = snapshot.p2ClockTicks;
    if (snapshot.lastMoveCol !== undefined) this.lastMoveCol = snapshot.lastMoveCol;
    if (snapshot.lastMoveRow !== undefined) this.lastMoveRow = snapshot.lastMoveRow;
    if (Array.isArray(snapshot.winningCells)) this.winningCells = [...snapshot.winningCells];
    if (snapshot.turnOutcome !== undefined) this.outcome = snapshot.turnOutcome;
    if (snapshot.turnNumber !== undefined) this.turnNumber = snapshot.turnNumber;

    if (
      this.turnNumber > this.lastAnimatedTurn &&
      this.lastMoveCol !== null &&
      this.lastMoveRow !== null
    ) {
      this.lastAnimatedTurn = this.turnNumber;
      const cellVal = this.board[this.lastMoveRow * COLS + this.lastMoveCol];
      const mover: 1 | 2 = cellVal === 2 ? 2 : 1;
      this.dropAnim = {
        col: this.lastMoveCol,
        targetRow: this.lastMoveRow,
        player: mover,
        startMs: nowMs(),
        durationMs: DROP_ANIM_DURATION_MS,
      };
      if (this.gameOver && !this.soundPlayedEnd) {
        this.soundPlayedEnd = true;
        if (this.winningCells.length === 4) connect4Sounds.playWin();
        else connect4Sounds.playDraw();
      } else {
        connect4Sounds.playDrop();
      }
    } else if (this.gameOver && !prevGameOver && !this.soundPlayedEnd) {
      this.soundPlayedEnd = true;
      if (this.winningCells.length === 4) connect4Sounds.playWin();
      else connect4Sounds.playDraw();
    }
  }

  public getTurnState(): TurnBasedGameState<number[], Connect4MovePayload> {
    const lastMove: TurnBasedMove<Connect4MovePayload> | null =
      this.lastMoveCol !== null
        ? {
            player: this.activePlayer === 2 ? "player" : "opponent",
            turnNumber: this.turnNumber,
            payload: { col: this.lastMoveCol },
            notation: `C${this.lastMoveCol + 1}`,
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
      winningCells: this.winningCells,
      turnState: this.getTurnState(),
    };
  }

  public applyMove(payload: Connect4MovePayload): boolean {
    if (this.gameOver) return false;
    const row = findDropRow(this.board, payload.col);
    if (row < 0) return false;

    const mover = this.activePlayer;
    this.board[row * COLS + payload.col] = mover;
    this.turnNumber++;
    this.lastMoveCol = payload.col;
    this.lastMoveRow = row;
    this.lastAnimatedTurn = this.turnNumber;

    this.dropAnim = {
      col: payload.col,
      targetRow: row,
      player: mover,
      startMs: nowMs(),
      durationMs: DROP_ANIM_DURATION_MS,
    };

    const winCells = findWinningCells(this.board, mover);
    if (winCells) {
      this.winningCells = winCells;
      this.gameOver = true;
      if (mover === 1) {
        this.outcome = "player_win";
        const secLeft = Math.ceil(this.p1ClockTicks / 60);
        this.score += WIN_BONUS + secLeft * CLOCK_BONUS_PER_SEC;
      } else {
        this.outcome = "opponent_win";
        this.score = 0;
      }
      if (!this.soundPlayedEnd) {
        this.soundPlayedEnd = true;
        connect4Sounds.playWin();
      }
      return true;
    }

    if (isBoardFull(this.board)) {
      this.outcome = "draw";
      this.score += DRAW_BONUS;
      this.gameOver = true;
      if (!this.soundPlayedEnd) {
        this.soundPlayedEnd = true;
        connect4Sounds.playDraw();
      }
      return true;
    }

    if (mover === 1) {
      const threats = countThreeInARowThreats(this.board, 1);
      if (threats > this.prevP1Threats) {
        this.score += (threats - this.prevP1Threats) * THREAT_3_BONUS;
      }
      this.prevP1Threats = threats;
      this.aiDelayTicks = AI_RESPONSE_DELAY_TICKS;
    }

    this.activePlayer = mover === 1 ? 2 : 1;
    connect4Sounds.playDrop();
    return true;
  }

  private pickSeededAiColumn(): number | null {
    const validCols: number[] = [];
    for (let c = 0; c < COLS; c++) {
      if (findDropRow(this.board, c) >= 0) validCols.push(c);
    }
    if (validCols.length === 0) return null;

    // 1. Immediate AI winning drop
    for (const col of validCols) {
      const row = findDropRow(this.board, col);
      this.board[row * COLS + col] = 2;
      const wins = findWinningCells(this.board, 2) !== null;
      this.board[row * COLS + col] = 0;
      if (wins) return col;
    }

    // 2. Immediate block of player's 4-in-a-row threat
    for (const col of validCols) {
      const row = findDropRow(this.board, col);
      this.board[row * COLS + col] = 1;
      const oppWins = findWinningCells(this.board, 1) !== null;
      this.board[row * COLS + col] = 0;
      if (oppWins) return col;
    }

    // 3. Tactical heuristic with deterministic seeded tie-breaking
    let bestCol = validCols[0];
    let bestScore = -Infinity;

    for (const col of validCols) {
      const row = findDropRow(this.board, col);
      let evalScore = CENTER_COL_WEIGHTS[col] + this.rng() * 6;

      this.board[row * COLS + col] = 2;
      evalScore += countThreeInARowThreats(this.board, 2) * 28;

      // Avoid setting up an immediate win for Player 1 directly above this disc
      if (row > 0) {
        this.board[(row - 1) * COLS + col] = 1;
        if (findWinningCells(this.board, 1) !== null) {
          evalScore -= 45;
        }
        this.board[(row - 1) * COLS + col] = 0;
      }

      this.board[row * COLS + col] = 0;

      if (evalScore > bestScore) {
        bestScore = evalScore;
        bestCol = col;
      }
    }

    return bestCol;
  }

  public update(_dtSec: number, input: Connect4Input): "collision" | null {
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

      if (input.dropCol !== undefined) {
        this.applyMove({ col: input.dropCol });
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
        const aiCol = this.pickSeededAiColumn();
        if (aiCol !== null) {
          this.applyMove({ col: aiCol });
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

  private drawDisc(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    radius: number,
    player: 1 | 2,
    alpha = 1,
  ): void {
    ctx.save();
    if (alpha < 1) ctx.globalAlpha = alpha;

    const base = player === 1 ? CONNECT4_COLORS.p1Disc : CONNECT4_COLORS.p2Disc;
    const rim = player === 1 ? CONNECT4_COLORS.p1DiscRim : CONNECT4_COLORS.p2DiscRim;
    const hi = player === 1 ? CONNECT4_COLORS.p1DiscHighlight : CONNECT4_COLORS.p2DiscHighlight;

    // Outer rim
    ctx.fillStyle = rim;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    // Inner glossy face
    ctx.fillStyle = base;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.84, 0, Math.PI * 2);
    ctx.fill();

    // Subtle 3D specular highlight dot
    ctx.fillStyle = hi;
    ctx.globalAlpha = alpha * 0.48;
    ctx.beginPath();
    ctx.arc(cx - radius * 0.28, cy - radius * 0.28, radius * 0.24, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private drawPlayerBar(
    ctx: CanvasRenderingContext2D,
    y: number,
    label: string,
    ticks: number,
    isActive: boolean,
    seat: 1 | 2,
  ): void {
    const cardH = 98;
    const secLeft = Math.ceil(ticks / 60);
    const isCritical = secLeft <= 10;
    const isWarn = secLeft <= 20 && !isCritical;

    drawRoundedRect(ctx, PANEL_X, y, PANEL_W, cardH, 10);
    ctx.fillStyle = CONNECT4_COLORS.hudBg;
    ctx.fill();
    ctx.strokeStyle = isActive
      ? seat === 1
        ? CONNECT4_COLORS.p1Disc
        : CONNECT4_COLORS.p2Disc
      : CONNECT4_COLORS.hudBorder;
    ctx.lineWidth = isActive ? 2.25 : 1.25;
    ctx.stroke();

    // Disc color emblem
    this.drawDisc(ctx, PANEL_X + 34, y + cardH / 2, 16, seat, 1);

    // Player Name
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = CONNECT4_COLORS.textPrimary;
    ctx.font = "bold 18px sans-serif";
    const truncated = label.length > 18 ? `${label.slice(0, 17)}…` : label;
    ctx.fillText(truncated, PANEL_X + 62, y + cardH / 2 - 9);

    ctx.fillStyle = CONNECT4_COLORS.textMuted;
    ctx.font = "bold 12px monospace";
    ctx.fillText(seat === 1 ? "RED DISCS" : "GOLD DISCS", PANEL_X + 62, y + cardH / 2 + 14);

    // Digital Clock Pill
    const clockW = 118;
    const clockH = 46;
    const clockX = PANEL_X + PANEL_W - clockW - 16;
    const clockY = y + (cardH - clockH) / 2;

    drawRoundedRect(ctx, clockX, clockY, clockW, clockH, 8);
    if (isCritical && isActive) ctx.fillStyle = CONNECT4_COLORS.criticalClockBg;
    else if (isWarn && isActive) ctx.fillStyle = CONNECT4_COLORS.warnClockBg;
    else if (isActive) ctx.fillStyle = CONNECT4_COLORS.activeClockBg;
    else ctx.fillStyle = CONNECT4_COLORS.inactiveClockBg;
    ctx.fill();

    ctx.textAlign = "center";
    ctx.fillStyle =
      isActive && (isCritical || isWarn)
        ? "#ffffff"
        : isActive
          ? CONNECT4_COLORS.activeClockText
          : CONNECT4_COLORS.inactiveClockText;
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
    ctx.fillStyle = CONNECT4_COLORS.bg;
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

    // 2. Active Hover Preview Ghost Disc above active column
    const isMyTurn = !this.gameOver && this.activePlayer === this.localSeat;
    if (isMyTurn && this.hoverCol >= 0 && this.hoverCol < COLS && findDropRow(this.board, this.hoverCol) >= 0) {
      const previewX = BOARD_X + this.hoverCol * CELL_SIZE + CELL_SIZE / 2;
      const previewY = BOARD_Y - 46;
      this.drawDisc(ctx, previewX, previewY, CELL_SIZE * 0.37, this.localSeat, 0.85);
    }

    // 3. Royal Blue Rounded Tabletop Board Frame + Base Stand
    drawRoundedRect(ctx, BOARD_X - 20, BOARD_Y + BOARD_H - 6, BOARD_W + 40, 26, 8);
    ctx.fillStyle = CONNECT4_COLORS.boardFrameDark;
    ctx.fill();

    drawRoundedRect(ctx, BOARD_X - 14, BOARD_Y - 14, BOARD_W + 28, BOARD_H + 28, 16);
    ctx.fillStyle = CONNECT4_COLORS.boardFrame;
    ctx.fill();
    ctx.strokeStyle = CONNECT4_COLORS.boardBorder;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Subtle active column highlight band
    if (isMyTurn && this.hoverCol >= 0 && this.hoverCol < COLS) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.07)";
      ctx.fillRect(BOARD_X + this.hoverCol * CELL_SIZE + 2, BOARD_Y - 6, CELL_SIZE - 4, BOARD_H + 12);
    }

    // Advance / expire drop bounce animation
    let activeDrop: { col: number; targetRow: number; player: 1 | 2; y: number } | null = null;
    if (this.dropAnim) {
      const elapsed = nowMs() - this.dropAnim.startMs;
      if (elapsed >= this.dropAnim.durationMs) {
        this.dropAnim = null;
      } else {
        const rawT = Math.max(0, Math.min(1, elapsed / this.dropAnim.durationMs));
        const eased = easeOutBounceDrop(rawT);
        const startY = BOARD_Y - 46;
        const endY = BOARD_Y + this.dropAnim.targetRow * CELL_SIZE + CELL_SIZE / 2;
        activeDrop = {
          col: this.dropAnim.col,
          targetRow: this.dropAnim.targetRow,
          player: this.dropAnim.player,
          y: startY + (endY - startY) * eased,
        };
      }
    }

    // 4. Render 7x6 Circular Slots & Placed Discs
    const winSet = new Set(this.winningCells);
    const discRadius = CELL_SIZE * 0.39;

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const idx = r * COLS + c;
        const cx = BOARD_X + c * CELL_SIZE + CELL_SIZE / 2;
        const cy = BOARD_Y + r * CELL_SIZE + CELL_SIZE / 2;

        // Recessed slot circle
        ctx.fillStyle = CONNECT4_COLORS.slotBg;
        ctx.beginPath();
        ctx.arc(cx, cy, discRadius + 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = CONNECT4_COLORS.slotRim;
        ctx.lineWidth = 2.5;
        ctx.stroke();

        const val = this.board[idx];
        const isAnimatingHere = activeDrop !== null && activeDrop.col === c && activeDrop.targetRow === r;

        if ((val === 1 || val === 2) && !isAnimatingHere) {
          this.drawDisc(ctx, cx, cy, discRadius, val, 1);

          // Last move subtle ring
          if (this.lastMoveCol === c && this.lastMoveRow === r && winSet.size === 0) {
            ctx.strokeStyle = CONNECT4_COLORS.lastMoveRing;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(cx, cy, discRadius * 0.42, 0, Math.PI * 2);
            ctx.stroke();
          }

          // Winning 4-in-a-row glowing ring
          if (winSet.has(idx)) {
            ctx.strokeStyle = CONNECT4_COLORS.winRing;
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.arc(cx, cy, discRadius + 1, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      }
    }

    // 5. Render Falling Animated Disc
    if (activeDrop) {
      const cx = BOARD_X + activeDrop.col * CELL_SIZE + CELL_SIZE / 2;
      this.drawDisc(ctx, cx, activeDrop.y, discRadius, activeDrop.player, 1);
    }

    // 6. Column Index Labels (1..7)
    ctx.fillStyle = CONNECT4_COLORS.textMuted;
    ctx.font = "bold 13px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let c = 0; c < COLS; c++) {
      ctx.fillText(String(c + 1), BOARD_X + c * CELL_SIZE + CELL_SIZE / 2, BOARD_Y + BOARD_H + 34);
    }
    ctx.textBaseline = "alphabetic";

    // 7. Right-Side Tabletop HUD
    const opponentSeat: 1 | 2 = this.localSeat === 1 ? 2 : 1;
    const topLabel = opponentSeat === 1 ? this.p1Label : this.p2Label;
    const topTicks = opponentSeat === 1 ? this.p1ClockTicks : this.p2ClockTicks;
    const topActive = !this.gameOver && this.activePlayer === opponentSeat;
    this.drawPlayerBar(ctx, 132, topLabel, topTicks, topActive, opponentSeat);

    // Center Match Status Card
    drawRoundedRect(ctx, PANEL_X, 252, PANEL_W, 276, 10);
    ctx.fillStyle = CONNECT4_COLORS.hudCardBg;
    ctx.fill();
    ctx.strokeStyle = CONNECT4_COLORS.hudBorder;
    ctx.lineWidth = 1.25;
    ctx.stroke();

    ctx.textAlign = "left";
    ctx.fillStyle = CONNECT4_COLORS.textMuted;
    ctx.font = "bold 12px monospace";
    ctx.fillText(this.pvpMode ? "LIVE 1v1 CONNECT 4 · 60s" : "TOURNAMENT SCORE · 60s", PANEL_X + 20, 286);

    ctx.fillStyle = CONNECT4_COLORS.accentBlue;
    ctx.font = "bold 36px monospace";
    ctx.fillText(this.pvpMode ? "CONNECT 4" : String(this.score), PANEL_X + 20, 330);

    const statusLabel = this.gameOver
      ? this.outcome === "player_win" || this.outcome === "opponent_flag"
        ? "CONNECT 4! VICTORY"
        : this.outcome === "draw"
          ? "BOARD FULL · DRAW"
          : "MATCH ENDED"
      : isMyTurn
        ? `YOUR TURN (${this.localSeat === 1 ? "RED" : "GOLD"})`
        : this.pvpMode
          ? `OPPONENT'S TURN (${opponentSeat === 1 ? "RED" : "GOLD"})`
          : "AI THINKING (GOLD)";

    drawRoundedRect(ctx, PANEL_X + 20, 354, PANEL_W - 40, 46, 8);
    ctx.fillStyle = isMyTurn ? "rgba(56, 189, 248, 0.16)" : "rgba(255, 255, 255, 0.06)";
    ctx.fill();
    ctx.strokeStyle = isMyTurn ? CONNECT4_COLORS.accentBlue : "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = isMyTurn ? "#7dd3fc" : "#cbd5e1";
    ctx.font = "bold 16px sans-serif";
    ctx.fillText(statusLabel, PANEL_X + PANEL_W / 2, 378);

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = CONNECT4_COLORS.textMuted;
    ctx.font = "bold 12px monospace";
    ctx.fillText(`TURN #${this.turnNumber} · LAST DROP`, PANEL_X + 20, 434);
    ctx.fillStyle = CONNECT4_COLORS.textPrimary;
    ctx.font = "bold 24px monospace";
    ctx.fillText(
      this.lastMoveCol !== null ? `Column ${this.lastMoveCol + 1}` : "Awaiting move 1...",
      PANEL_X + 20,
      468,
    );

    ctx.fillStyle = CONNECT4_COLORS.textMuted;
    ctx.font = "13px sans-serif";
    ctx.fillText("Click column, keys 1–7, or Arrows + Space", PANEL_X + 20, 506);

    // Bottom Local Player Bar
    const bottomLabel = this.localSeat === 1 ? this.p1Label : this.p2Label;
    const bottomTicks = this.localSeat === 1 ? this.p1ClockTicks : this.p2ClockTicks;
    const bottomActive = !this.gameOver && this.activePlayer === this.localSeat;
    this.drawPlayerBar(ctx, 550, bottomLabel, bottomTicks, bottomActive, this.localSeat);

    ctx.restore();
  }
}
