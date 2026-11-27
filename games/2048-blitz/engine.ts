import { createSeededRandom, type RandomFn } from "@fugluck/shared";
import {
  BLITZ_COLORS,
  BLITZ_DURATION_TICKS,
  BOARD_PADDING,
  BOARD_SIZE,
  BOARD_X,
  BOARD_Y,
  CELL_COUNT,
  CELL_GAP,
  CELL_SIZE,
  FLASH_DURATION_TICKS,
  GRID_SIZE,
  HIGH_TILE_STYLE,
  TILE_STYLES,
  VIRTUAL_HEIGHT,
  VIRTUAL_WIDTH,
} from "./constants";

export type Blitz2048Input = {
  moveUp?: boolean;
  moveDown?: boolean;
  moveLeft?: boolean;
  moveRight?: boolean;
};

type Direction = "up" | "down" | "left" | "right";

export class Blitz2048Engine {
  public score = 0;
  public tickCount = 0;
  public gameOver = false;
  public moves = 0;
  public bestTile = 0;
  public ticksRemaining = BLITZ_DURATION_TICKS;

  public board: number[] = new Array(CELL_COUNT).fill(0);
  public mergeFlash: number[] = new Array(CELL_COUNT).fill(0);
  public spawnFlash: number[] = new Array(CELL_COUNT).fill(0);

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
    this.moves = 0;
    this.bestTile = 0;
    this.ticksRemaining = BLITZ_DURATION_TICKS;
    this.board = new Array(CELL_COUNT).fill(0);
    this.mergeFlash = new Array(CELL_COUNT).fill(0);
    this.spawnFlash = new Array(CELL_COUNT).fill(0);
    this.rng = createSeededRandom(this.seed).stream("gameplay");

    this.spawnTile();
    this.spawnTile();
    this.updateBestTile();
  }

  private spawnTile(): boolean {
    const empty: number[] = [];
    for (let i = 0; i < CELL_COUNT; i++) {
      if (this.board[i] === 0) empty.push(i);
    }
    if (empty.length === 0) return false;
    const cellIdx = empty[Math.floor(this.rng() * empty.length)];
    const value = this.rng() < 0.9 ? 2 : 4;
    this.board[cellIdx] = value;
    this.spawnFlash[cellIdx] = FLASH_DURATION_TICKS;
    return true;
  }

  private updateBestTile(): void {
    let maxVal = 0;
    for (let i = 0; i < CELL_COUNT; i++) {
      if (this.board[i] > maxVal) maxVal = this.board[i];
    }
    this.bestTile = maxVal;
  }

  public hasValidMoves(): boolean {
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const val = this.board[r * GRID_SIZE + c];
        if (val === 0) return true;
        if (c + 1 < GRID_SIZE && this.board[r * GRID_SIZE + c + 1] === val) return true;
        if (r + 1 < GRID_SIZE && this.board[(r + 1) * GRID_SIZE + c] === val) return true;
      }
    }
    return false;
  }

  private applyMove(dir: Direction): boolean {
    let moved = false;

    const getLineIndices = (line: number): number[] => {
      const indices: number[] = [];
      for (let step = 0; step < GRID_SIZE; step++) {
        if (dir === "left") indices.push(line * GRID_SIZE + step);
        else if (dir === "right") indices.push(line * GRID_SIZE + (GRID_SIZE - 1 - step));
        else if (dir === "up") indices.push(step * GRID_SIZE + line);
        else indices.push((GRID_SIZE - 1 - step) * GRID_SIZE + line);
      }
      return indices;
    };

    for (let line = 0; line < GRID_SIZE; line++) {
      const indices = getLineIndices(line);
      const nonZero: number[] = [];
      for (const idx of indices) {
        if (this.board[idx] !== 0) nonZero.push(this.board[idx]);
      }

      const mergedLine: number[] = [];
      const mergedFlags: boolean[] = [];

      let i = 0;
      while (i < nonZero.length) {
        if (i + 1 < nonZero.length && nonZero[i] === nonZero[i + 1]) {
          const nextVal = nonZero[i] * 2;
          mergedLine.push(nextVal);
          mergedFlags.push(true);
          this.score += nextVal;
          i += 2;
        } else {
          mergedLine.push(nonZero[i]);
          mergedFlags.push(false);
          i += 1;
        }
      }

      while (mergedLine.length < GRID_SIZE) {
        mergedLine.push(0);
        mergedFlags.push(false);
      }

      for (let step = 0; step < GRID_SIZE; step++) {
        const idx = indices[step];
        if (this.board[idx] !== mergedLine[step]) {
          moved = true;
        }
        this.board[idx] = mergedLine[step];
        if (mergedFlags[step]) {
          this.mergeFlash[idx] = FLASH_DURATION_TICKS;
        }
      }
    }

    return moved;
  }

  public update(_dtSec: number, input: Blitz2048Input): "collision" | null {
    if (this.gameOver) return "collision";

    this.tickCount++;
    this.ticksRemaining = Math.max(0, BLITZ_DURATION_TICKS - this.tickCount);

    for (let i = 0; i < CELL_COUNT; i++) {
      if (this.mergeFlash[i] > 0) this.mergeFlash[i]--;
      if (this.spawnFlash[i] > 0) this.spawnFlash[i]--;
    }

    // Process at most one directional move per tick
    let dir: Direction | null = null;
    if (input.moveUp) dir = "up";
    else if (input.moveDown) dir = "down";
    else if (input.moveLeft) dir = "left";
    else if (input.moveRight) dir = "right";

    if (dir !== null) {
      const moved = this.applyMove(dir);
      if (moved) {
        this.moves++;
        this.spawnTile();
        this.updateBestTile();
      }
    }

    if (this.ticksRemaining <= 0 || !this.hasValidMoves()) {
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
    ctx.fillStyle = BLITZ_COLORS.bg;
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

    // 2. Subtle neon grid backdrop
    ctx.strokeStyle = BLITZ_COLORS.gridLine;
    ctx.lineWidth = 1;
    for (let x = 80; x < VIRTUAL_WIDTH; x += 80) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, VIRTUAL_HEIGHT);
      ctx.stroke();
    }
    for (let y = 80; y < VIRTUAL_HEIGHT; y += 80) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(VIRTUAL_WIDTH, y);
      ctx.stroke();
    }

    // 3. Top HUD Bar (Score, Best Tile, Moves, Blitz Timer)
    const hudY = 24;
    const hudH = 84;
    const hudCards = [
      { x: 160, w: 230, label: "SCORE", value: String(this.score), accent: "#38bdf8" },
      { x: 410, w: 210, label: "BEST TILE", value: String(this.bestTile), accent: "#a855f7" },
      { x: 640, w: 190, label: "MOVES", value: String(this.moves), accent: "#94a3b8" },
    ];

    for (const card of hudCards) {
      ctx.fillStyle = BLITZ_COLORS.hudBg;
      ctx.fillRect(card.x, hudY, card.w, hudH);
      ctx.strokeStyle = BLITZ_COLORS.hudBorder;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(card.x, hudY, card.w, hudH);

      ctx.textAlign = "left";
      ctx.fillStyle = BLITZ_COLORS.textMuted;
      ctx.font = "bold 14px monospace";
      ctx.fillText(card.label, card.x + 18, hudY + 28);

      ctx.fillStyle = card.accent;
      ctx.font = "bold 30px monospace";
      ctx.fillText(card.value, card.x + 18, hudY + 66);
    }

    // Timer Card
    const secLeft = Math.ceil(this.ticksRemaining / 60);
    const timerColor =
      secLeft <= 10
        ? BLITZ_COLORS.timerCritical
        : secLeft <= 30
          ? BLITZ_COLORS.timerWarn
          : BLITZ_COLORS.timerNormal;

    const timerX = 850;
    const timerW = 270;
    ctx.fillStyle = BLITZ_COLORS.hudBg;
    ctx.fillRect(timerX, hudY, timerW, hudH);
    ctx.strokeStyle = timerColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(timerX, hudY, timerW, hudH);

    ctx.textAlign = "left";
    ctx.fillStyle = BLITZ_COLORS.textMuted;
    ctx.font = "bold 14px monospace";
    ctx.fillText("TIME LEFT", timerX + 18, hudY + 28);

    ctx.fillStyle = timerColor;
    ctx.font = "bold 32px monospace";
    ctx.fillText(this.formatTimeRemaining(), timerX + 18, hudY + 66);

    // Timer progress bar inside timer card
    const barX = timerX + 132;
    const barY = hudY + 46;
    const barW = 118;
    const barH = 14;
    const ratio = Math.max(0, Math.min(1, this.ticksRemaining / BLITZ_DURATION_TICKS));
    ctx.fillStyle = "#131d30";
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = timerColor;
    ctx.fillRect(barX, barY, barW * ratio, barH);
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);

    // 4. 4x4 Board Container
    ctx.fillStyle = BLITZ_COLORS.boardBg;
    ctx.fillRect(BOARD_X, BOARD_Y, BOARD_SIZE, BOARD_SIZE);
    ctx.strokeStyle = BLITZ_COLORS.boardBorder;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(BOARD_X, BOARD_Y, BOARD_SIZE, BOARD_SIZE);

    // 5. Render 16 Cells & Tiles
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const idx = r * GRID_SIZE + c;
        const cellX = BOARD_X + BOARD_PADDING + c * (CELL_SIZE + CELL_GAP);
        const cellY = BOARD_Y + BOARD_PADDING + r * (CELL_SIZE + CELL_GAP);
        const val = this.board[idx] ?? 0;

        // Empty slot backdrop
        ctx.fillStyle = BLITZ_COLORS.emptyCell;
        ctx.fillRect(cellX, cellY, CELL_SIZE, CELL_SIZE);
        ctx.strokeStyle = BLITZ_COLORS.emptyCellBorder;
        ctx.lineWidth = 1;
        ctx.strokeRect(cellX, cellY, CELL_SIZE, CELL_SIZE);

        if (val <= 0) continue;

        const style = TILE_STYLES[val] ?? HIGH_TILE_STYLE;
        const mergeT = (this.mergeFlash[idx] ?? 0) / FLASH_DURATION_TICKS;
        const spawnT = (this.spawnFlash[idx] ?? 0) / FLASH_DURATION_TICKS;
        const pad = mergeT > 0 ? -Math.round(mergeT * 4) : spawnT > 0 ? Math.round(spawnT * 10) : 0;

        const tx = cellX + pad;
        const ty = cellY + pad;
        const ts = Math.max(8, CELL_SIZE - pad * 2);

        // Outer neon glow
        ctx.fillStyle = style.glow;
        ctx.fillRect(tx - 3, ty - 3, ts + 6, ts + 6);

        // Main tile body
        ctx.fillStyle = style.bg;
        ctx.fillRect(tx, ty, ts, ts);

        // Top highlight bevel
        ctx.fillStyle = "rgba(255, 255, 255, 0.14)";
        ctx.fillRect(tx, ty, ts, 6);

        // Crisp neon border
        ctx.strokeStyle = mergeT > 0 ? "#ffffff" : style.border;
        ctx.lineWidth = mergeT > 0 ? 3 : 2;
        ctx.strokeRect(tx, ty, ts, ts);

        // Tile value text
        const fontSize = val >= 1024 ? 32 : val >= 128 ? 38 : 44;
        ctx.fillStyle = style.text;
        ctx.font = `bold ${fontSize}px monospace`;
        ctx.fillText(String(val), cellX + CELL_SIZE / 2, cellY + CELL_SIZE / 2 + 2);
      }
    }

    ctx.textBaseline = "alphabetic";
    ctx.restore();
  }
}
