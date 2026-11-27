import { createSeededRandom, type RandomFn } from "@fugluck/shared";
import {
  BOARD_CLEAR_BONUS,
  BOARD_HEIGHT,
  BOARD_PADDING,
  BOARD_WIDTH,
  BOARD_X,
  BOARD_Y,
  CELL_COUNT,
  CELL_GAP,
  CELL_SIZE,
  GRID_COLS,
  GRID_ROWS,
  MINE_COLORS,
  MINE_COUNT,
  NUMBER_COLORS,
  SAFE_CELL_POINTS,
  SAFE_CELL_TOTAL,
  SPEED_BONUS_PER_SEC,
  SPRINT_DURATION_TICKS,
  VIRTUAL_HEIGHT,
  VIRTUAL_WIDTH,
} from "./constants";

export type MinesweeperInput = {
  action?: "reveal" | "flag";
  col?: number;
  row?: number;
};

/**
 * Cell visibility codes for compact deterministic snapshots:
 * -2 = hidden
 * -3 = flagged
 * -1 = revealed mine
 *  0..8 = revealed safe cell with N adjacent mines
 */
export const CELL_HIDDEN = -2;
export const CELL_FLAGGED = -3;
export const CELL_MINE = -1;

export class MinesweeperSprintEngine {
  public score = 0;
  public tickCount = 0;
  public gameOver = false;
  public boardCleared = false;
  public ticksRemaining = SPRINT_DURATION_TICKS;
  public safeCellsRemaining = SAFE_CELL_TOTAL;
  public flagsPlaced = 0;
  public detonatedIdx = -1;

  /** Public visible board (length 140) rendered to canvas & sent in authoritative snapshots. */
  public visibleBoard: number[] = new Array(CELL_COUNT).fill(CELL_HIDDEN);

  private mines: boolean[] = new Array(CELL_COUNT).fill(false);
  private adjacent: number[] = new Array(CELL_COUNT).fill(0);
  private revealed: boolean[] = new Array(CELL_COUNT).fill(false);
  private flagged: boolean[] = new Array(CELL_COUNT).fill(false);
  private revealedSafeCount = 0;

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

  private idxOf(col: number, row: number): number {
    return row * GRID_COLS + col;
  }

  public reset(): void {
    this.score = 0;
    this.tickCount = 0;
    this.gameOver = false;
    this.boardCleared = false;
    this.ticksRemaining = SPRINT_DURATION_TICKS;
    this.flagsPlaced = 0;
    this.detonatedIdx = -1;
    this.revealedSafeCount = 0;

    this.mines = new Array(CELL_COUNT).fill(false);
    this.adjacent = new Array(CELL_COUNT).fill(0);
    this.revealed = new Array(CELL_COUNT).fill(false);
    this.flagged = new Array(CELL_COUNT).fill(false);
    this.visibleBoard = new Array(CELL_COUNT).fill(CELL_HIDDEN);

    this.rng = createSeededRandom(this.seed).stream("gameplay");

    // Pick a deterministic safe opening cell inside the interior so its 3x3 neighborhood is mine-free
    const openCol = 3 + Math.floor(this.rng() * (GRID_COLS - 6));
    const openRow = 2 + Math.floor(this.rng() * (GRID_ROWS - 4));

    const candidates: number[] = [];
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        if (Math.abs(c - openCol) <= 1 && Math.abs(r - openRow) <= 1) continue;
        candidates.push(this.idxOf(c, r));
      }
    }

    // Deterministic Fisher-Yates shuffle for mine placement
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      const tmp = candidates[i];
      candidates[i] = candidates[j];
      candidates[j] = tmp;
    }

    for (let i = 0; i < MINE_COUNT && i < candidates.length; i++) {
      this.mines[candidates[i]] = true;
    }

    // Precompute adjacent mine counts
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const idx = this.idxOf(c, r);
        if (this.mines[idx]) continue;
        let count = 0;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = r + dr;
            const nc = c + dc;
            if (nr >= 0 && nr < GRID_ROWS && nc >= 0 && nc < GRID_COLS) {
              if (this.mines[this.idxOf(nc, nr)]) count++;
            }
          }
        }
        this.adjacent[idx] = count;
      }
    }

    // Deterministically open the guaranteed-safe zero-adjacent starting pocket (0 opening points)
    this.revealFlood(openCol, openRow, false);
    this.safeCellsRemaining = SAFE_CELL_TOTAL - this.revealedSafeCount;
  }

  private revealFlood(startCol: number, startRow: number, grantPoints: boolean): void {
    const queue: Array<{ col: number; row: number }> = [{ col: startCol, row: startRow }];
    let head = 0;

    while (head < queue.length) {
      const { col, row } = queue[head++];
      const idx = this.idxOf(col, row);
      if (this.revealed[idx] || this.mines[idx]) continue;

      if (this.flagged[idx]) {
        this.flagged[idx] = false;
        this.flagsPlaced = Math.max(0, this.flagsPlaced - 1);
      }

      this.revealed[idx] = true;
      this.revealedSafeCount++;
      this.visibleBoard[idx] = this.adjacent[idx];
      if (grantPoints) {
        this.score += SAFE_CELL_POINTS;
      }

      if (this.adjacent[idx] === 0) {
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nc = col + dc;
            const nr = row + dr;
            if (nc >= 0 && nc < GRID_COLS && nr >= 0 && nr < GRID_ROWS) {
              const nIdx = this.idxOf(nc, nr);
              if (!this.revealed[nIdx] && !this.mines[nIdx]) {
                queue.push({ col: nc, row: nr });
              }
            }
          }
        }
      }
    }
  }

  private revealAllMines(): void {
    for (let i = 0; i < CELL_COUNT; i++) {
      if (this.mines[i]) {
        this.visibleBoard[i] = CELL_MINE;
      }
    }
  }

  /** Helper used by tests to locate a guaranteed-safe hidden cell deterministically. */
  public findFirstHiddenSafeCell(): { col: number; row: number } | null {
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const idx = this.idxOf(c, r);
        if (!this.revealed[idx] && !this.mines[idx]) {
          return { col: c, row: r };
        }
      }
    }
    return null;
  }

  public update(_dtSec: number, input: MinesweeperInput): "collision" | null {
    if (this.gameOver) return "collision";

    this.tickCount++;
    this.ticksRemaining = Math.max(0, SPRINT_DURATION_TICKS - this.tickCount);

    if (
      input.action &&
      typeof input.col === "number" &&
      typeof input.row === "number" &&
      Number.isInteger(input.col) &&
      Number.isInteger(input.row) &&
      input.col >= 0 &&
      input.col < GRID_COLS &&
      input.row >= 0 &&
      input.row < GRID_ROWS
    ) {
      const idx = this.idxOf(input.col, input.row);

      if (input.action === "flag") {
        if (!this.revealed[idx]) {
          this.flagged[idx] = !this.flagged[idx];
          this.flagsPlaced += this.flagged[idx] ? 1 : -1;
          this.visibleBoard[idx] = this.flagged[idx] ? CELL_FLAGGED : CELL_HIDDEN;
        }
      } else if (input.action === "reveal") {
        if (!this.revealed[idx] && !this.flagged[idx]) {
          if (this.mines[idx]) {
            this.detonatedIdx = idx;
            this.revealAllMines();
            this.gameOver = true;
            return "collision";
          }

          this.revealFlood(input.col, input.row, true);
          this.safeCellsRemaining = SAFE_CELL_TOTAL - this.revealedSafeCount;

          if (this.safeCellsRemaining <= 0) {
            const secLeft = Math.ceil(this.ticksRemaining / 60);
            this.score += BOARD_CLEAR_BONUS + secLeft * SPEED_BONUS_PER_SEC;
            this.boardCleared = true;
            this.gameOver = true;
            return "collision";
          }
        }
      }
    }

    if (this.ticksRemaining <= 0) {
      this.revealAllMines();
      this.gameOver = true;
      return "collision";
    }

    return null;
  }

  private formatTimeRemaining(): string {
    const totalSec = Math.ceil(this.ticksRemaining / 60);
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  }

  public render(ctx: CanvasRenderingContext2D): void {
    const backingW = ctx.canvas?.width && ctx.canvas.width > 0 ? ctx.canvas.width : this.width;
    const backingH = ctx.canvas?.height && ctx.canvas.height > 0 ? ctx.canvas.height : this.height;
    const scaleX = backingW / VIRTUAL_WIDTH;
    const scaleY = backingH / VIRTUAL_HEIGHT;

    ctx.save();
    ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);

    // 1. Background
    ctx.fillStyle = MINE_COLORS.bg;
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

    // 2. Top HUD Bar (Score, Mines Remaining, Safe Cells Left, Time Remaining)
    const hudY = 14;
    const hudH = 60;
    const minesRemaining = Math.max(0, MINE_COUNT - this.flagsPlaced);

    const hudCards = [
      { x: BOARD_X, w: 220, label: "SCORE", value: String(this.score), accent: "#34d399" },
      { x: BOARD_X + 232, w: 170, label: "MINES", value: String(minesRemaining), accent: "#f43f5e" },
      { x: BOARD_X + 414, w: 170, label: "SAFE LEFT", value: String(this.safeCellsRemaining), accent: "#38bdf8" },
    ];

    for (const card of hudCards) {
      ctx.fillStyle = MINE_COLORS.hudBg;
      ctx.fillRect(card.x, hudY, card.w, hudH);
      ctx.strokeStyle = MINE_COLORS.hudBorder;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(card.x, hudY, card.w, hudH);

      ctx.textAlign = "left";
      ctx.fillStyle = MINE_COLORS.textMuted;
      ctx.font = "bold 12px monospace";
      ctx.fillText(card.label, card.x + 14, hudY + 20);

      ctx.fillStyle = card.accent;
      ctx.font = "bold 24px monospace";
      ctx.fillText(card.value, card.x + 14, hudY + 48);
    }

    // Timer Card
    const secLeft = Math.ceil(this.ticksRemaining / 60);
    const timerColor =
      secLeft <= 10
        ? MINE_COLORS.timerCritical
        : secLeft <= 25
          ? MINE_COLORS.timerWarn
          : MINE_COLORS.timerNormal;

    const timerX = BOARD_X + 596;
    const timerW = BOARD_WIDTH - 596; // 264
    ctx.fillStyle = MINE_COLORS.hudBg;
    ctx.fillRect(timerX, hudY, timerW, hudH);
    ctx.strokeStyle = timerColor;
    ctx.lineWidth = 1.75;
    ctx.strokeRect(timerX, hudY, timerW, hudH);

    ctx.textAlign = "left";
    ctx.fillStyle = MINE_COLORS.textMuted;
    ctx.font = "bold 12px monospace";
    ctx.fillText("TIME LEFT", timerX + 14, hudY + 20);

    ctx.fillStyle = timerColor;
    ctx.font = "bold 24px monospace";
    ctx.fillText(this.formatTimeRemaining(), timerX + 14, hudY + 48);

    const barX = timerX + 108;
    const barY = hudY + 34;
    const barW = timerW - 122;
    const barH = 12;
    const ratio = Math.max(0, Math.min(1, this.ticksRemaining / SPRINT_DURATION_TICKS));
    ctx.fillStyle = "#131d30";
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = timerColor;
    ctx.fillRect(barX, barY, barW * ratio, barH);
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);

    // 3. Board Frame
    ctx.fillStyle = MINE_COLORS.boardBg;
    ctx.fillRect(BOARD_X, BOARD_Y, BOARD_WIDTH, BOARD_HEIGHT);
    ctx.strokeStyle = MINE_COLORS.boardBorder;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(BOARD_X, BOARD_Y, BOARD_WIDTH, BOARD_HEIGHT);

    // 4. Render 14x10 Cells
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const idx = this.idxOf(c, r);
        const cx = BOARD_X + BOARD_PADDING + c * (CELL_SIZE + CELL_GAP);
        const cy = BOARD_Y + BOARD_PADDING + r * (CELL_SIZE + CELL_GAP);
        const code = this.visibleBoard[idx] ?? CELL_HIDDEN;

        if (code === CELL_HIDDEN) {
          ctx.fillStyle = MINE_COLORS.cellHidden;
          ctx.fillRect(cx, cy, CELL_SIZE, CELL_SIZE);
          ctx.fillStyle = MINE_COLORS.cellHiddenHighlight;
          ctx.fillRect(cx, cy, CELL_SIZE, 5);
          ctx.strokeStyle = MINE_COLORS.cellHiddenBorder;
          ctx.lineWidth = 1.25;
          ctx.strokeRect(cx, cy, CELL_SIZE, CELL_SIZE);
        } else if (code === CELL_FLAGGED) {
          ctx.fillStyle = MINE_COLORS.flagBg;
          ctx.fillRect(cx, cy, CELL_SIZE, CELL_SIZE);
          ctx.strokeStyle = MINE_COLORS.flagBorder;
          ctx.lineWidth = 1.75;
          ctx.strokeRect(cx, cy, CELL_SIZE, CELL_SIZE);

          // Crisp vector flag
          const poleX = cx + 22;
          ctx.strokeStyle = MINE_COLORS.flagPole;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(poleX, cy + 13);
          ctx.lineTo(poleX, cy + 43);
          ctx.stroke();

          ctx.fillStyle = MINE_COLORS.flagBanner;
          ctx.beginPath();
          ctx.moveTo(poleX + 1, cy + 13);
          ctx.lineTo(poleX + 20, cy + 21);
          ctx.lineTo(poleX + 1, cy + 29);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = MINE_COLORS.flagBorder;
          ctx.fillRect(poleX - 7, cy + 41, 15, 4);
        } else if (code === CELL_MINE) {
          const isDetonated = idx === this.detonatedIdx;
          ctx.fillStyle = isDetonated ? MINE_COLORS.mineDetonatedBg : MINE_COLORS.mineBg;
          ctx.fillRect(cx, cy, CELL_SIZE, CELL_SIZE);
          ctx.strokeStyle = MINE_COLORS.mineCore;
          ctx.lineWidth = isDetonated ? 2.5 : 1.5;
          ctx.strokeRect(cx, cy, CELL_SIZE, CELL_SIZE);

          const mx = cx + CELL_SIZE / 2;
          const my = cy + CELL_SIZE / 2;
          ctx.fillStyle = MINE_COLORS.mineGlow;
          ctx.beginPath();
          ctx.arc(mx, my, 17, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = MINE_COLORS.mineCore;
          ctx.beginPath();
          ctx.arc(mx, my, 10, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(mx - 3, my - 3, 3, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Revealed safe cell (0..8)
          ctx.fillStyle = MINE_COLORS.cellRevealed;
          ctx.fillRect(cx, cy, CELL_SIZE, CELL_SIZE);
          ctx.strokeStyle = MINE_COLORS.cellRevealedBorder;
          ctx.lineWidth = 1;
          ctx.strokeRect(cx, cy, CELL_SIZE, CELL_SIZE);

          if (code > 0) {
            ctx.fillStyle = NUMBER_COLORS[code] ?? "#e2e8f0";
            ctx.font = "bold 28px monospace";
            ctx.fillText(String(code), cx + CELL_SIZE / 2, cy + CELL_SIZE / 2 + 2);
          }
        }
      }
    }

    ctx.textBaseline = "alphabetic";
    ctx.restore();
  }
}
