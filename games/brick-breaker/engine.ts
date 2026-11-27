import { createSeededRandom, type RandomFn } from "@fugluck/shared";
import {
  ARENA_BOTTOM,
  ARENA_HEIGHT,
  ARENA_LEFT,
  ARENA_RIGHT,
  ARENA_TOP,
  ARENA_WIDTH,
  BALL_RADIUS,
  BASE_BALL_SPEED,
  BREAKER_COLORS,
  BRICK_COLS,
  BRICK_DESTROY_POINTS,
  BRICK_GAP_X,
  BRICK_GAP_Y,
  BRICK_HEIGHT,
  BRICK_HIT_POINTS,
  BRICK_HP_COLORS,
  BRICK_OFFSET_X,
  BRICK_OFFSET_Y,
  BRICK_ROWS,
  BRICK_WIDTH,
  INITIAL_LIVES,
  LAUNCH_DELAY_TICKS,
  MATCH_DURATION_TICKS,
  MAX_BALL_SPEED,
  PADDLE_HEIGHT,
  PADDLE_SPEED_PX_SEC,
  PADDLE_WIDTH,
  PADDLE_Y,
  ROW_STANDARD_COLORS,
  TRAIL_LENGTH,
  VIRTUAL_HEIGHT,
  VIRTUAL_WIDTH,
  WAVE_BALL_SPEED_INC,
  WAVE_CLEAR_BONUS,
} from "./constants";

export type BrickBreakerInput = {
  left?: boolean;
  right?: boolean;
};

export type Brick = {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  hp: number;
  maxHp: number;
  color: string;
};

export class BrickBreakerEngine {
  public score = 0;
  public tickCount = 0;
  public gameOver = false;
  public ticksRemaining = MATCH_DURATION_TICKS;
  public lives = INITIAL_LIVES;
  public wave = 1;
  public combo = 0;
  public launchTicks = LAUNCH_DELAY_TICKS;

  public paddleX = VIRTUAL_WIDTH / 2;
  public ballX = VIRTUAL_WIDTH / 2;
  public ballY = PADDLE_Y - BALL_RADIUS - 2;
  public ballVx = 0;
  public ballVy = 0;
  public bricks: Brick[] = [];
  public trail: Array<{ x: number; y: number }> = [];

  private rng!: RandomFn;
  private nextBrickId = 1;
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

  private currentBallSpeed(): number {
    return Math.min(MAX_BALL_SPEED, BASE_BALL_SPEED + (this.wave - 1) * WAVE_BALL_SPEED_INC);
  }

  private prepareLaunch(): void {
    this.launchTicks = LAUNCH_DELAY_TICKS;
    this.ballX = this.paddleX;
    this.ballY = PADDLE_Y - BALL_RADIUS - 2;
    this.ballVx = 0;
    this.ballVy = 0;
    this.trail = [];
  }

  private launchBall(): void {
    const speed = this.currentBallSpeed();
    // Seeded angle between -32deg and +32deg from straight up, avoiding near-0 vertical stalls
    const sign = this.rng() >= 0.5 ? 1 : -1;
    const angleRad = sign * (0.24 + this.rng() * 0.34);
    this.ballVx = Math.sin(angleRad) * speed;
    this.ballVy = -Math.cos(angleRad) * speed;
  }

  private spawnWave(): void {
    this.bricks = [];
    const patternType = Math.floor(this.rng() * 3);

    for (let r = 0; r < BRICK_ROWS; r++) {
      for (let c = 0; c < BRICK_COLS; c++) {
        // Symmetric deterministic cutouts for wave variety
        if (patternType === 1 && r === 2 && (c === 0 || c === BRICK_COLS - 1)) continue;
        if (patternType === 2 && (r + c) % 7 === 0 && r >= 2) continue;

        const maxHp = r === 0 ? 3 : r === 1 ? 2 : 1;
        const color =
          maxHp > 1
            ? BRICK_HP_COLORS[maxHp].fill
            : ROW_STANDARD_COLORS[(r + this.wave) % ROW_STANDARD_COLORS.length];

        this.bricks.push({
          id: this.nextBrickId++,
          x: BRICK_OFFSET_X + c * (BRICK_WIDTH + BRICK_GAP_X),
          y: BRICK_OFFSET_Y + r * (BRICK_HEIGHT + BRICK_GAP_Y),
          width: BRICK_WIDTH,
          height: BRICK_HEIGHT,
          hp: maxHp,
          maxHp,
          color,
        });
      }
    }
  }

  public reset(): void {
    this.score = 0;
    this.tickCount = 0;
    this.gameOver = false;
    this.ticksRemaining = MATCH_DURATION_TICKS;
    this.lives = INITIAL_LIVES;
    this.wave = 1;
    this.combo = 0;
    this.nextBrickId = 1;
    this.paddleX = VIRTUAL_WIDTH / 2;
    this.rng = createSeededRandom(this.seed).stream("gameplay");

    this.spawnWave();
    this.prepareLaunch();
  }

  public update(dtSec: number, input: BrickBreakerInput): "collision" | null {
    if (this.gameOver) return "collision";

    this.tickCount++;
    this.ticksRemaining = Math.max(0, MATCH_DURATION_TICKS - this.tickCount);

    // 1. Move paddle horizontally within arena bounds
    const moveDir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (moveDir !== 0) {
      this.paddleX += moveDir * PADDLE_SPEED_PX_SEC * dtSec;
      const minPaddleX = ARENA_LEFT + PADDLE_WIDTH / 2 + 4;
      const maxPaddleX = ARENA_RIGHT - PADDLE_WIDTH / 2 - 4;
      if (this.paddleX < minPaddleX) this.paddleX = minPaddleX;
      if (this.paddleX > maxPaddleX) this.paddleX = maxPaddleX;
    }

    // 2. Launch countdown or active ball simulation
    if (this.launchTicks > 0) {
      this.launchTicks--;
      this.ballX = this.paddleX;
      this.ballY = PADDLE_Y - BALL_RADIUS - 2;
      if (this.launchTicks === 0) {
        this.launchBall();
      }
    } else {
      // Record deterministic motion trail
      this.trail.push({ x: this.ballX, y: this.ballY });
      if (this.trail.length > TRAIL_LENGTH) {
        this.trail.shift();
      }

      this.ballX += this.ballVx * dtSec;
      this.ballY += this.ballVy * dtSec;

      // Wall collisions
      if (this.ballX - BALL_RADIUS <= ARENA_LEFT) {
        this.ballX = ARENA_LEFT + BALL_RADIUS;
        this.ballVx = Math.abs(this.ballVx);
      } else if (this.ballX + BALL_RADIUS >= ARENA_RIGHT) {
        this.ballX = ARENA_RIGHT - BALL_RADIUS;
        this.ballVx = -Math.abs(this.ballVx);
      }

      if (this.ballY - BALL_RADIUS <= ARENA_TOP) {
        this.ballY = ARENA_TOP + BALL_RADIUS;
        this.ballVy = Math.abs(this.ballVy);
      }

      // Paddle collision (angle modulated by hit offset from paddle center)
      const paddleLeft = this.paddleX - PADDLE_WIDTH / 2;
      const paddleRight = this.paddleX + PADDLE_WIDTH / 2;
      if (
        this.ballVy > 0 &&
        this.ballY + BALL_RADIUS >= PADDLE_Y &&
        this.ballY - BALL_RADIUS <= PADDLE_Y + PADDLE_HEIGHT &&
        this.ballX + BALL_RADIUS >= paddleLeft &&
        this.ballX - BALL_RADIUS <= paddleRight
      ) {
        this.ballY = PADDLE_Y - BALL_RADIUS;
        const rawOffset = (this.ballX - this.paddleX) / (PADDLE_WIDTH / 2);
        const clampedOffset = Math.max(-1, Math.min(1, rawOffset));
        const bounceAngle = clampedOffset * (Math.PI / 3); // up to +-60 deg
        const speed = this.currentBallSpeed();
        this.ballVx = Math.sin(bounceAngle) * speed;
        this.ballVy = -Math.cos(bounceAngle) * speed;
        this.combo = 0;
      }

      // Brick collisions (at most one brick bounce per tick for crisp deterministic reflections)
      for (const brick of this.bricks) {
        if (brick.hp <= 0) continue;

        const closestX = Math.max(brick.x, Math.min(this.ballX, brick.x + brick.width));
        const closestY = Math.max(brick.y, Math.min(this.ballY, brick.y + brick.height));
        const dx = this.ballX - closestX;
        const dy = this.ballY - closestY;

        if (dx * dx + dy * dy <= BALL_RADIUS * BALL_RADIUS) {
          const overlapLeft = this.ballX + BALL_RADIUS - brick.x;
          const overlapRight = brick.x + brick.width - (this.ballX - BALL_RADIUS);
          const overlapTop = this.ballY + BALL_RADIUS - brick.y;
          const overlapBottom = brick.y + brick.height - (this.ballY - BALL_RADIUS);
          const minOverlapX = Math.min(overlapLeft, overlapRight);
          const minOverlapY = Math.min(overlapTop, overlapBottom);

          if (minOverlapX < minOverlapY) {
            this.ballVx = -this.ballVx;
          } else {
            this.ballVy = -this.ballVy;
          }

          brick.hp--;
          this.combo++;
          const comboMult = 1 + Math.min(this.combo - 1, 8) * 0.25;
          this.score += Math.round(BRICK_HIT_POINTS * comboMult);
          if (brick.hp <= 0) {
            this.score += BRICK_DESTROY_POINTS;
          }
          break;
        }
      }

      // Wave clear check
      const remainingBricks = this.bricks.some((b) => b.hp > 0);
      if (!remainingBricks) {
        this.score += WAVE_CLEAR_BONUS;
        this.wave++;
        this.combo = 0;
        this.spawnWave();
        this.prepareLaunch();
      }

      // Ball lost below bottom boundary
      if (this.ballY - BALL_RADIUS > ARENA_BOTTOM) {
        this.lives--;
        this.combo = 0;
        if (this.lives <= 0) {
          this.gameOver = true;
          return "collision";
        }
        this.prepareLaunch();
      }
    }

    if (this.ticksRemaining <= 0) {
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
    ctx.fillStyle = BREAKER_COLORS.bg;
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

    // 2. Top HUD Bar (Score, Wave, Lives, Combo, Time Remaining)
    const hudY = 14;
    const hudH = 56;
    const hudCards = [
      { x: ARENA_LEFT, w: 220, label: "SCORE", value: String(this.score), accent: "#34d399" },
      { x: ARENA_LEFT + 232, w: 140, label: "WAVE", value: String(this.wave), accent: "#38bdf8" },
      { x: ARENA_LEFT + 384, w: 150, label: "LIVES", value: "♥".repeat(Math.max(0, this.lives)), accent: "#f43f5e" },
      { x: ARENA_LEFT + 546, w: 160, label: "COMBO", value: this.combo > 1 ? `x${this.combo}` : "-", accent: "#f59e0b" },
    ];

    for (const card of hudCards) {
      ctx.fillStyle = BREAKER_COLORS.hudBg;
      ctx.fillRect(card.x, hudY, card.w, hudH);
      ctx.strokeStyle = BREAKER_COLORS.hudBorder;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(card.x, hudY, card.w, hudH);

      ctx.textAlign = "left";
      ctx.fillStyle = BREAKER_COLORS.textMuted;
      ctx.font = "bold 12px monospace";
      ctx.fillText(card.label, card.x + 14, hudY + 20);

      ctx.fillStyle = card.accent;
      ctx.font = "bold 24px monospace";
      ctx.fillText(card.value, card.x + 14, hudY + 46);
    }

    // Timer Card
    const secLeft = Math.ceil(this.ticksRemaining / 60);
    const timerColor =
      secLeft <= 10
        ? BREAKER_COLORS.timerCritical
        : secLeft <= 30
          ? BREAKER_COLORS.timerWarn
          : BREAKER_COLORS.timerNormal;

    const timerX = ARENA_LEFT + 718;
    const timerW = ARENA_WIDTH - 718; // 362
    ctx.fillStyle = BREAKER_COLORS.hudBg;
    ctx.fillRect(timerX, hudY, timerW, hudH);
    ctx.strokeStyle = timerColor;
    ctx.lineWidth = 1.75;
    ctx.strokeRect(timerX, hudY, timerW, hudH);

    ctx.textAlign = "left";
    ctx.fillStyle = BREAKER_COLORS.textMuted;
    ctx.font = "bold 12px monospace";
    ctx.fillText("TIME LEFT", timerX + 14, hudY + 20);

    ctx.fillStyle = timerColor;
    ctx.font = "bold 24px monospace";
    ctx.fillText(this.formatTimeRemaining(), timerX + 14, hudY + 46);

    const barX = timerX + 120;
    const barY = hudY + 32;
    const barW = timerW - 136;
    const barH = 12;
    const ratio = Math.max(0, Math.min(1, this.ticksRemaining / MATCH_DURATION_TICKS));
    ctx.fillStyle = "#131d30";
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = timerColor;
    ctx.fillRect(barX, barY, barW * ratio, barH);
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);

    // 3. Arena Surface & Subtle Grid
    ctx.fillStyle = BREAKER_COLORS.arenaBg;
    ctx.fillRect(ARENA_LEFT, ARENA_TOP, ARENA_WIDTH, ARENA_HEIGHT);

    ctx.strokeStyle = BREAKER_COLORS.gridLine;
    ctx.lineWidth = 1;
    for (let x = ARENA_LEFT + 90; x < ARENA_RIGHT; x += 90) {
      ctx.beginPath();
      ctx.moveTo(x, ARENA_TOP);
      ctx.lineTo(x, ARENA_BOTTOM);
      ctx.stroke();
    }
    for (let y = ARENA_TOP + 80; y < ARENA_BOTTOM; y += 80) {
      ctx.beginPath();
      ctx.moveTo(ARENA_LEFT, y);
      ctx.lineTo(ARENA_RIGHT, y);
      ctx.stroke();
    }

    ctx.strokeStyle = BREAKER_COLORS.arenaBorder;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(ARENA_LEFT, ARENA_TOP, ARENA_WIDTH, ARENA_HEIGHT);

    // 4. Bricks (with HP color tiers and crack lines on damaged armored bricks)
    for (const brick of this.bricks) {
      if (brick.hp <= 0) continue;

      const tier = BRICK_HP_COLORS[brick.hp];
      const fill = brick.maxHp > 1 && tier ? tier.fill : brick.color;
      const border = tier ? tier.border : "rgba(255,255,255,0.5)";

      ctx.fillStyle = fill;
      ctx.fillRect(brick.x, brick.y, brick.width, brick.height);

      // Top bevel highlight
      ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
      ctx.fillRect(brick.x, brick.y, brick.width, 5);

      ctx.strokeStyle = border;
      ctx.lineWidth = brick.hp > 1 ? 2 : 1.25;
      ctx.strokeRect(brick.x + 0.5, brick.y + 0.5, brick.width - 1, brick.height - 1);

      // Visual crack indicator on damaged multi-hit bricks
      if (brick.hp < brick.maxHp) {
        ctx.strokeStyle = "rgba(7, 10, 16, 0.78)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(brick.x + brick.width * 0.3, brick.y + 2);
        ctx.lineTo(brick.x + brick.width * 0.45, brick.y + brick.height * 0.5);
        ctx.lineTo(brick.x + brick.width * 0.65, brick.y + brick.height - 2);
        ctx.stroke();
      }
    }

    // 5. Glowing Neon Paddle
    const paddleLeft = this.paddleX - PADDLE_WIDTH / 2;
    ctx.fillStyle = BREAKER_COLORS.paddleGlow;
    ctx.fillRect(paddleLeft - 4, PADDLE_Y - 4, PADDLE_WIDTH + 8, PADDLE_HEIGHT + 8);

    ctx.fillStyle = BREAKER_COLORS.paddleFill;
    ctx.fillRect(paddleLeft, PADDLE_Y, PADDLE_WIDTH, PADDLE_HEIGHT);

    ctx.fillStyle = BREAKER_COLORS.paddleHighlight;
    ctx.fillRect(paddleLeft + 6, PADDLE_Y + 2, PADDLE_WIDTH - 12, 4);

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.75;
    ctx.strokeRect(paddleLeft, PADDLE_Y, PADDLE_WIDTH, PADDLE_HEIGHT);

    // 6. Ball Motion Trail
    for (let i = 0; i < this.trail.length; i++) {
      const pt = this.trail[i];
      const frac = (i + 1) / (this.trail.length + 1);
      ctx.save();
      ctx.globalAlpha = frac * 0.35;
      ctx.fillStyle = BREAKER_COLORS.ballCore;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, BALL_RADIUS * (0.45 + frac * 0.45), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 7. Ball
    if (!this.gameOver) {
      ctx.fillStyle = BREAKER_COLORS.ballGlow;
      ctx.beginPath();
      ctx.arc(this.ballX, this.ballY, BALL_RADIUS + 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = BREAKER_COLORS.ballFill;
      ctx.beginPath();
      ctx.arc(this.ballX, this.ballY, BALL_RADIUS, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = BREAKER_COLORS.ballCore;
      ctx.beginPath();
      ctx.arc(this.ballX, this.ballY, BALL_RADIUS * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}
