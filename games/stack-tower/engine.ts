import { createSeededRandom, type RandomFn } from "@fugluck/shared";
import {
  BASE_DROP_POINTS,
  BASE_SCREEN_Y,
  BASE_SPEED_PX_SEC,
  BLOCK_HEIGHT,
  CAMERA_ANCHOR_LEVEL,
  FALLING_GRAVITY_PX_SEC2,
  INITIAL_BLOCK_WIDTH,
  MAX_SPEED_PX_SEC,
  MIN_BLOCK_WIDTH,
  NEON_PALETTE,
  PERFECT_PULSE_DURATION_TICKS,
  PERFECT_STREAK_BONUS,
  PERFECT_TOLERANCE_PX,
  PLAYFIELD_LEFT,
  PLAYFIELD_RIGHT,
  SPEED_INCREMENT_PER_LEVEL,
  STACK_COLORS,
  VIRTUAL_HEIGHT,
  VIRTUAL_WIDTH,
} from "./constants";

export type StackTowerInput = {
  drop?: boolean;
};

export type TowerBlock = {
  level: number;
  x: number; // Left edge in canonical 1280 space
  width: number;
  color: string;
};

export type ActiveBlock = {
  level: number;
  x: number;
  width: number;
  direction: 1 | -1;
  speed: number;
  color: string;
};

export type FallingPiece = {
  x: number;
  y: number; // World elevation above base (positive = higher)
  width: number;
  height: number;
  vy: number;
  vx: number;
  color: string;
  alpha: number;
};

export class StackTowerEngine {
  public score = 0;
  public tickCount = 0;
  public gameOver = false;
  public blocksPlaced = 0;
  public perfectStreak = 0;
  public maxStreak = 0;
  public perfectPulseTicks = 0;
  public lastPulseX = VIRTUAL_WIDTH / 2;
  public lastPulseWidth = INITIAL_BLOCK_WIDTH;
  public lastPulseLevel = 0;
  public cameraY = 0;

  public tower: TowerBlock[] = [];
  public activeBlock: ActiveBlock = {
    level: 1,
    x: PLAYFIELD_LEFT,
    width: INITIAL_BLOCK_WIDTH,
    direction: 1,
    speed: BASE_SPEED_PX_SEC,
    color: NEON_PALETTE[0],
  };
  public fallingPieces: FallingPiece[] = [];

  private rng!: RandomFn;
  private paletteOffset = 0;
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

  private colorForLevel(level: number): string {
    return NEON_PALETTE[(level + this.paletteOffset) % NEON_PALETTE.length];
  }

  private speedForLevel(level: number): number {
    const difficultyScale = 1.0 + Math.pow(this.tickCount / 5400, 1.4) * 0.45;
    const raw = (BASE_SPEED_PX_SEC + (level - 1) * SPEED_INCREMENT_PER_LEVEL) * difficultyScale;
    return Math.min(MAX_SPEED_PX_SEC, raw);
  }

  private spawnNextActiveBlock(level: number, width: number): ActiveBlock {
    const direction: 1 | -1 = level % 2 === 1 ? 1 : -1;
    const startX = direction === 1 ? PLAYFIELD_LEFT : PLAYFIELD_RIGHT - width;
    return {
      level,
      x: startX,
      width,
      direction,
      speed: this.speedForLevel(level),
      color: this.colorForLevel(level),
    };
  }

  public reset(): void {
    this.score = 0;
    this.tickCount = 0;
    this.gameOver = false;
    this.blocksPlaced = 0;
    this.perfectStreak = 0;
    this.maxStreak = 0;
    this.perfectPulseTicks = 0;
    this.cameraY = 0;
    this.fallingPieces = [];

    this.rng = createSeededRandom(this.seed).stream("gameplay");
    this.paletteOffset = Math.floor(this.rng() * NEON_PALETTE.length);

    const baseX = (VIRTUAL_WIDTH - INITIAL_BLOCK_WIDTH) / 2;
    this.tower = [
      {
        level: 0,
        x: baseX,
        width: INITIAL_BLOCK_WIDTH,
        color: STACK_COLORS.baseStroke,
      },
    ];

    this.lastPulseX = baseX;
    this.lastPulseWidth = INITIAL_BLOCK_WIDTH;
    this.lastPulseLevel = 0;

    // Seeded initial direction for level 1
    const firstDir: 1 | -1 = this.rng() >= 0.5 ? 1 : -1;
    const firstStartX = firstDir === 1 ? PLAYFIELD_LEFT : PLAYFIELD_RIGHT - INITIAL_BLOCK_WIDTH;
    this.activeBlock = {
      level: 1,
      x: firstStartX,
      width: INITIAL_BLOCK_WIDTH,
      direction: firstDir,
      speed: BASE_SPEED_PX_SEC,
      color: this.colorForLevel(1),
    };
  }

  public update(dtSec: number, input: StackTowerInput): "collision" | null {
    if (this.gameOver) return "collision";

    this.tickCount++;

    if (this.perfectPulseTicks > 0) {
      this.perfectPulseTicks--;
    }

    // 1. Oscillate active block horizontally across the playfield
    const block = this.activeBlock;
    block.x += block.direction * block.speed * dtSec;

    const minX = PLAYFIELD_LEFT;
    const maxX = Math.max(PLAYFIELD_LEFT, PLAYFIELD_RIGHT - block.width);
    if (block.x <= minX) {
      block.x = minX;
      block.direction = 1;
    } else if (block.x >= maxX) {
      block.x = maxX;
      block.direction = -1;
    }

    // 2. Process DROP input
    if (input.drop) {
      const top = this.tower[this.tower.length - 1];
      const deltaX = block.x - top.x;

      if (Math.abs(deltaX) <= PERFECT_TOLERANCE_PX) {
        // Perfect drop: snap cleanly with zero trim
        const snapped: TowerBlock = {
          level: block.level,
          x: top.x,
          width: block.width,
          color: block.color,
        };
        this.tower.push(snapped);
        this.blocksPlaced++;
        this.perfectStreak++;
        if (this.perfectStreak > this.maxStreak) {
          this.maxStreak = this.perfectStreak;
        }
        this.score += BASE_DROP_POINTS + PERFECT_STREAK_BONUS * this.perfectStreak;
        this.perfectPulseTicks = PERFECT_PULSE_DURATION_TICKS;
        this.lastPulseX = snapped.x;
        this.lastPulseWidth = snapped.width;
        this.lastPulseLevel = snapped.level;

        this.activeBlock = this.spawnNextActiveBlock(block.level + 1, snapped.width);
      } else {
        // Compute overlap between moving block and top tower block
        const overlapLeft = Math.max(block.x, top.x);
        const overlapRight = Math.min(block.x + block.width, top.x + top.width);
        const overlapWidth = overlapRight - overlapLeft;

        if (overlapWidth < MIN_BLOCK_WIDTH) {
          // Missed completely — spawn entire block as falling debris and end run
          this.fallingPieces.push({
            x: block.x,
            y: block.level * BLOCK_HEIGHT,
            width: block.width,
            height: BLOCK_HEIGHT,
            vy: -40,
            vx: block.direction * 90,
            color: block.color,
            alpha: 1,
          });
          this.gameOver = true;
          return "collision";
        }

        // Trim overhang and keep overlapping section
        const placed: TowerBlock = {
          level: block.level,
          x: overlapLeft,
          width: overlapWidth,
          color: block.color,
        };
        this.tower.push(placed);
        this.blocksPlaced++;
        this.perfectStreak = 0;
        this.score += BASE_DROP_POINTS;

        // Create falling overhang slice
        const overhangWidth = block.width - overlapWidth;
        if (overhangWidth > 0.5) {
          const overhangOnLeft = block.x < top.x;
          const overhangX = overhangOnLeft ? block.x : overlapRight;
          this.fallingPieces.push({
            x: overhangX,
            y: block.level * BLOCK_HEIGHT,
            width: overhangWidth,
            height: BLOCK_HEIGHT,
            vy: -30,
            vx: overhangOnLeft ? -85 : 85,
            color: block.color,
            alpha: 0.95,
          });
        }

        this.activeBlock = this.spawnNextActiveBlock(block.level + 1, placed.width);
      }
    }

    // 3. Smooth vertical camera pan as tower climbs
    const targetCameraY = Math.max(0, (this.tower.length - CAMERA_ANCHOR_LEVEL) * BLOCK_HEIGHT);
    this.cameraY += (targetCameraY - this.cameraY) * Math.min(1, dtSec * 8);

    // 4. Update falling overhang pieces
    for (const piece of this.fallingPieces) {
      piece.vy -= FALLING_GRAVITY_PX_SEC2 * dtSec;
      piece.y += piece.vy * dtSec;
      piece.x += piece.vx * dtSec;
      piece.alpha = Math.max(0, piece.alpha - dtSec * 1.15);
    }
    if (this.fallingPieces.length > 0) {
      this.fallingPieces = this.fallingPieces.filter((p) => p.alpha > 0.02 && p.y > this.cameraY - 400);
    }

    return null;
  }

  private levelToScreenY(level: number): number {
    return BASE_SCREEN_Y - level * BLOCK_HEIGHT + this.cameraY;
  }

  private worldYToScreenY(worldY: number): number {
    return BASE_SCREEN_Y - worldY + this.cameraY;
  }

  public render(ctx: CanvasRenderingContext2D): void {
    const backingW = ctx.canvas?.width && ctx.canvas.width > 0 ? ctx.canvas.width : this.width;
    const backingH = ctx.canvas?.height && ctx.canvas.height > 0 ? ctx.canvas.height : this.height;
    const scaleX = backingW / VIRTUAL_WIDTH;
    const scaleY = backingH / VIRTUAL_HEIGHT;

    ctx.save();
    ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);

    // 1. Background
    ctx.fillStyle = STACK_COLORS.bg;
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

    // 2. Subtle vertical & scrolling horizontal neon grid lines
    ctx.strokeStyle = STACK_COLORS.gridLine;
    ctx.lineWidth = 1;
    for (let x = 160; x < VIRTUAL_WIDTH; x += 80) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, VIRTUAL_HEIGHT);
      ctx.stroke();
    }
    const gridOffsetY = this.cameraY % 60;
    for (let y = gridOffsetY; y < VIRTUAL_HEIGHT; y += 60) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(VIRTUAL_WIDTH, y);
      ctx.stroke();
    }

    // Playfield side rails
    ctx.strokeStyle = STACK_COLORS.guideRail;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(PLAYFIELD_LEFT, 80);
    ctx.lineTo(PLAYFIELD_LEFT, VIRTUAL_HEIGHT - 30);
    ctx.moveTo(PLAYFIELD_RIGHT, 80);
    ctx.lineTo(PLAYFIELD_RIGHT, VIRTUAL_HEIGHT - 30);
    ctx.stroke();

    // 3. Draw stacked tower blocks (visible viewport culling)
    for (const block of this.tower) {
      const screenY = this.levelToScreenY(block.level);
      if (screenY > VIRTUAL_HEIGHT + BLOCK_HEIGHT || screenY < -BLOCK_HEIGHT) continue;

      if (block.level === 0) {
        // Foundation plinth
        ctx.fillStyle = STACK_COLORS.baseFill;
        ctx.fillRect(block.x, screenY, block.width, VIRTUAL_HEIGHT - screenY + 40);
        ctx.strokeStyle = STACK_COLORS.baseStroke;
        ctx.lineWidth = 2.5;
        ctx.strokeRect(block.x, screenY, block.width, BLOCK_HEIGHT);
      } else {
        ctx.fillStyle = block.color;
        ctx.fillRect(block.x, screenY, block.width, BLOCK_HEIGHT - 2);

        // Top neon bevel highlight
        ctx.fillStyle = "rgba(255, 255, 255, 0.28)";
        ctx.fillRect(block.x, screenY, block.width, 5);

        // Crisp block outline
        ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(block.x + 0.5, screenY + 0.5, Math.max(0, block.width - 1), BLOCK_HEIGHT - 3);
      }
    }

    // 4. Draw falling trimmed overhang pieces
    for (const piece of this.fallingPieces) {
      const screenY = this.worldYToScreenY(piece.y);
      if (screenY > VIRTUAL_HEIGHT + 80 || screenY < -80) continue;
      ctx.save();
      ctx.globalAlpha = piece.alpha;
      ctx.fillStyle = piece.color;
      ctx.fillRect(piece.x, screenY, piece.width, piece.height - 2);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      ctx.strokeRect(piece.x, screenY, piece.width, piece.height - 2);
      ctx.restore();
    }

    // 5. Draw active oscillating block
    if (!this.gameOver) {
      const activeY = this.levelToScreenY(this.activeBlock.level);

      // Subtle vertical drop guide aligned with top tower block
      const top = this.tower[this.tower.length - 1];
      if (top) {
        ctx.strokeStyle = "rgba(52, 211, 153, 0.14)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(top.x, activeY - 12);
        ctx.lineTo(top.x, activeY + BLOCK_HEIGHT + 16);
        ctx.moveTo(top.x + top.width, activeY - 12);
        ctx.lineTo(top.x + top.width, activeY + BLOCK_HEIGHT + 16);
        ctx.stroke();
      }

      // Outer glow halo
      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = this.activeBlock.color;
      ctx.fillRect(this.activeBlock.x - 4, activeY - 4, this.activeBlock.width + 8, BLOCK_HEIGHT + 6);
      ctx.restore();

      // Main block body
      ctx.fillStyle = this.activeBlock.color;
      ctx.fillRect(this.activeBlock.x, activeY, this.activeBlock.width, BLOCK_HEIGHT - 2);

      // Top bright highlight
      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      ctx.fillRect(this.activeBlock.x, activeY, this.activeBlock.width, 6);

      // Crisp border
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.strokeRect(this.activeBlock.x, activeY, this.activeBlock.width, BLOCK_HEIGHT - 2);
    }

    // 6. Perfect-drop visual pulse & streak callout
    if (this.perfectPulseTicks > 0) {
      const progress = 1 - this.perfectPulseTicks / PERFECT_PULSE_DURATION_TICKS;
      const pulseAlpha = Math.max(0, 1 - progress);
      const expand = progress * 34;
      const pulseY = this.levelToScreenY(this.lastPulseLevel);

      ctx.save();
      ctx.globalAlpha = pulseAlpha;
      ctx.strokeStyle = STACK_COLORS.perfectGlow;
      ctx.lineWidth = 3.5;
      ctx.strokeRect(
        this.lastPulseX - expand,
        pulseY - expand * 0.25,
        this.lastPulseWidth + expand * 2,
        BLOCK_HEIGHT + expand * 0.5,
      );

      ctx.fillStyle = STACK_COLORS.perfectFlash;
      ctx.font = "bold 28px sans-serif";
      ctx.textAlign = "center";
      const label = this.perfectStreak > 1 ? `PERFECT! x${this.perfectStreak}` : "PERFECT!";
      ctx.fillText(label, this.lastPulseX + this.lastPulseWidth / 2, pulseY - 16 - progress * 24);
      ctx.restore();
    }

    // 7. Live Canvas HUD (Score, Height, Perfect Streak)
    ctx.fillStyle = STACK_COLORS.hudBg;
    ctx.fillRect(24, 18, 430, 56);
    ctx.strokeStyle = STACK_COLORS.hudBorder;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(24, 18, 430, 56);

    ctx.textAlign = "left";
    ctx.fillStyle = STACK_COLORS.textPrimary;
    ctx.font = "bold 24px monospace";
    ctx.fillText(`SCORE ${this.score}`, 42, 54);

    ctx.fillStyle = STACK_COLORS.textMuted;
    ctx.font = "bold 18px monospace";
    ctx.fillText(`HEIGHT ${this.blocksPlaced}`, 248, 53);

    if (this.perfectStreak > 0) {
      ctx.fillStyle = STACK_COLORS.hudBg;
      ctx.fillRect(VIRTUAL_WIDTH - 246, 18, 222, 56);
      ctx.strokeStyle = STACK_COLORS.perfectGlow;
      ctx.lineWidth = 2;
      ctx.strokeRect(VIRTUAL_WIDTH - 246, 18, 222, 56);

      ctx.fillStyle = STACK_COLORS.perfectGlow;
      ctx.font = "bold 22px monospace";
      ctx.textAlign = "right";
      ctx.fillText(`STREAK x${this.perfectStreak}`, VIRTUAL_WIDTH - 42, 54);
    }

    ctx.restore();
  }
}
