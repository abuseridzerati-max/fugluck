import { createSeededRandom, type RandomFn } from "@fugluck/shared";
import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  ARENA_X,
  ARENA_Y,
  BASE_STEP_TICKS,
  BONUS_ORB_INTERVAL,
  BONUS_ORB_LIFETIME_TICKS,
  BONUS_ORB_POINTS,
  CELL_SIZE,
  GRID_COLS,
  GRID_ROWS,
  MATCH_DURATION_TICKS,
  MIN_STEP_TICKS,
  ORBS_PER_SPEED_TIER,
  SNAKE_COLORS,
  STANDARD_ORB_POINTS,
  VIRTUAL_HEIGHT,
  VIRTUAL_WIDTH,
} from "./constants";

export type SnakeDirection = "up" | "down" | "left" | "right";

export type NeonSnakeInput = {
  moveUp?: boolean;
  moveDown?: boolean;
  moveLeft?: boolean;
  moveRight?: boolean;
};

export type GridPoint = {
  x: number;
  y: number;
};

function isOpposite(a: SnakeDirection, b: SnakeDirection): boolean {
  return (
    (a === "up" && b === "down") ||
    (a === "down" && b === "up") ||
    (a === "left" && b === "right") ||
    (a === "right" && b === "left")
  );
}

export class NeonSnakeEngine {
  public score = 0;
  public tickCount = 0;
  public gameOver = false;
  public ticksRemaining = MATCH_DURATION_TICKS;
  public orbsEaten = 0;
  public stepIntervalTicks = BASE_STEP_TICKS;

  public snake: GridPoint[] = [];
  public direction: SnakeDirection = "right";
  public food: GridPoint = { x: 20, y: 9 };
  public bonusFood: GridPoint | null = null;
  public bonusFoodTicks = 0;

  private queuedDirection: SnakeDirection | null = null;
  private stepAccumulator = 0;
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
    this.ticksRemaining = MATCH_DURATION_TICKS;
    this.orbsEaten = 0;
    this.stepIntervalTicks = BASE_STEP_TICKS;
    this.direction = "right";
    this.queuedDirection = null;
    this.stepAccumulator = 0;
    this.bonusFood = null;
    this.bonusFoodTicks = 0;

    this.rng = createSeededRandom(this.seed).stream("gameplay");

    // 4-segment starting snake near center-left moving right
    const startY = Math.floor(GRID_ROWS / 2);
    this.snake = [
      { x: 10, y: startY },
      { x: 9, y: startY },
      { x: 8, y: startY },
      { x: 7, y: startY },
    ];

    this.food = this.spawnEmptyCell() ?? { x: 22, y: startY };
  }

  private spawnEmptyCell(excludeExtra?: GridPoint | null): GridPoint | null {
    const occupied = new Set<number>();
    for (const seg of this.snake) {
      occupied.add(seg.y * GRID_COLS + seg.x);
    }
    if (excludeExtra) {
      occupied.add(excludeExtra.y * GRID_COLS + excludeExtra.x);
    }

    const empty: GridPoint[] = [];
    for (let y = 0; y < GRID_ROWS; y++) {
      for (let x = 0; x < GRID_COLS; x++) {
        if (!occupied.has(y * GRID_COLS + x)) {
          empty.push({ x, y });
        }
      }
    }
    if (empty.length === 0) return null;
    return empty[Math.floor(this.rng() * empty.length)];
  }

  private queueInput(input: NeonSnakeInput): void {
    let requested: SnakeDirection | null = null;
    if (input.moveUp) requested = "up";
    else if (input.moveDown) requested = "down";
    else if (input.moveLeft) requested = "left";
    else if (input.moveRight) requested = "right";

    if (!requested) return;
    // Prevent 180-degree self-reversal against the active movement direction
    if (requested !== this.direction && !isOpposite(this.direction, requested)) {
      this.queuedDirection = requested;
    }
  }

  public update(_dtSec: number, input: NeonSnakeInput): "collision" | null {
    if (this.gameOver) return "collision";

    this.tickCount++;
    this.ticksRemaining = Math.max(0, MATCH_DURATION_TICKS - this.tickCount);

    // 1. Buffer 1 upcoming turn per tick with strict 180-degree reversal guard
    this.queueInput(input);

    // 2. Tick bonus orb countdown
    if (this.bonusFood !== null) {
      this.bonusFoodTicks--;
      if (this.bonusFoodTicks <= 0) {
        this.bonusFood = null;
        this.bonusFoodTicks = 0;
      }
    }

    // 3. Advance snake on deterministic step cadence
    this.stepAccumulator++;
    if (this.stepAccumulator >= this.stepIntervalTicks) {
      this.stepAccumulator = 0;

      if (this.queuedDirection && !isOpposite(this.direction, this.queuedDirection)) {
        this.direction = this.queuedDirection;
      }
      this.queuedDirection = null;

      const head = this.snake[0];
      const nextHead: GridPoint = {
        x: head.x + (this.direction === "right" ? 1 : this.direction === "left" ? -1 : 0),
        y: head.y + (this.direction === "down" ? 1 : this.direction === "up" ? -1 : 0),
      };

      // Wall collision
      if (nextHead.x < 0 || nextHead.x >= GRID_COLS || nextHead.y < 0 || nextHead.y >= GRID_ROWS) {
        this.gameOver = true;
        return "collision";
      }

      const willEatFood = nextHead.x === this.food.x && nextHead.y === this.food.y;
      const willEatBonus =
        this.bonusFood !== null && nextHead.x === this.bonusFood.x && nextHead.y === this.bonusFood.y;

      // Self-collision (tail cell is vacated if not growing on this step)
      const checkLen = willEatFood ? this.snake.length : this.snake.length - 1;
      for (let i = 0; i < checkLen; i++) {
        if (this.snake[i].x === nextHead.x && this.snake[i].y === nextHead.y) {
          this.gameOver = true;
          return "collision";
        }
      }

      // Move snake
      this.snake.unshift(nextHead);
      if (!willEatFood) {
        this.snake.pop();
      }

      if (willEatFood) {
        this.score += STANDARD_ORB_POINTS;
        this.orbsEaten++;
        this.stepIntervalTicks = Math.max(
          MIN_STEP_TICKS,
          BASE_STEP_TICKS - Math.floor(this.orbsEaten / ORBS_PER_SPEED_TIER),
        );

        const nextFood = this.spawnEmptyCell(this.bonusFood);
        if (!nextFood) {
          // Board completely filled!
          this.gameOver = true;
          return "collision";
        }
        this.food = nextFood;

        // Deterministic bonus orb every 5th standard orb
        if (this.orbsEaten % BONUS_ORB_INTERVAL === 0 && this.bonusFood === null) {
          const bonusCell = this.spawnEmptyCell(this.food);
          if (bonusCell) {
            this.bonusFood = bonusCell;
            this.bonusFoodTicks = BONUS_ORB_LIFETIME_TICKS;
          }
        }
      }

      if (willEatBonus) {
        this.score += BONUS_ORB_POINTS;
        this.bonusFood = null;
        this.bonusFoodTicks = 0;
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
    ctx.fillStyle = SNAKE_COLORS.bg;
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

    // 2. Top HUD Bar (Score, Length, Speed, Time Remaining)
    const hudY = 14;
    const hudH = 58;
    const speedMult = (BASE_STEP_TICKS / Math.max(1, this.stepIntervalTicks)).toFixed(1);

    const hudCards = [
      { x: ARENA_X, w: 260, label: "SCORE", value: String(this.score), accent: "#34d399" },
      { x: ARENA_X + 276, w: 200, label: "LENGTH", value: String(this.snake.length), accent: "#38bdf8" },
      { x: ARENA_X + 492, w: 200, label: "SPEED", value: `${speedMult}x`, accent: "#a855f7" },
    ];

    for (const card of hudCards) {
      ctx.fillStyle = SNAKE_COLORS.hudBg;
      ctx.fillRect(card.x, hudY, card.w, hudH);
      ctx.strokeStyle = SNAKE_COLORS.hudBorder;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(card.x, hudY, card.w, hudH);

      ctx.textAlign = "left";
      ctx.fillStyle = SNAKE_COLORS.textMuted;
      ctx.font = "bold 12px monospace";
      ctx.fillText(card.label, card.x + 14, hudY + 20);

      ctx.fillStyle = card.accent;
      ctx.font = "bold 24px monospace";
      ctx.fillText(card.value, card.x + 14, hudY + 47);
    }

    // Timer Card
    const secLeft = Math.ceil(this.ticksRemaining / 60);
    const timerColor =
      secLeft <= 10
        ? SNAKE_COLORS.timerCritical
        : secLeft <= 30
          ? SNAKE_COLORS.timerWarn
          : SNAKE_COLORS.timerNormal;

    const timerX = ARENA_X + 708;
    const timerW = ARENA_WIDTH - 708; // 380
    ctx.fillStyle = SNAKE_COLORS.hudBg;
    ctx.fillRect(timerX, hudY, timerW, hudH);
    ctx.strokeStyle = timerColor;
    ctx.lineWidth = 1.75;
    ctx.strokeRect(timerX, hudY, timerW, hudH);

    ctx.textAlign = "left";
    ctx.fillStyle = SNAKE_COLORS.textMuted;
    ctx.font = "bold 12px monospace";
    ctx.fillText("TIME LEFT", timerX + 14, hudY + 20);

    ctx.fillStyle = timerColor;
    ctx.font = "bold 24px monospace";
    ctx.fillText(this.formatTimeRemaining(), timerX + 14, hudY + 47);

    const barX = timerX + 126;
    const barY = hudY + 32;
    const barW = timerW - 144;
    const barH = 12;
    const ratio = Math.max(0, Math.min(1, this.ticksRemaining / MATCH_DURATION_TICKS));
    ctx.fillStyle = "#131d30";
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = timerColor;
    ctx.fillRect(barX, barY, barW * ratio, barH);
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);

    // 3. Arena Surface & Grid
    ctx.fillStyle = SNAKE_COLORS.arenaBg;
    ctx.fillRect(ARENA_X, ARENA_Y, ARENA_WIDTH, ARENA_HEIGHT);

    ctx.strokeStyle = SNAKE_COLORS.gridLine;
    ctx.lineWidth = 1;
    for (let c = 1; c < GRID_COLS; c++) {
      const gx = ARENA_X + c * CELL_SIZE;
      ctx.beginPath();
      ctx.moveTo(gx, ARENA_Y);
      ctx.lineTo(gx, ARENA_Y + ARENA_HEIGHT);
      ctx.stroke();
    }
    for (let r = 1; r < GRID_ROWS; r++) {
      const gy = ARENA_Y + r * CELL_SIZE;
      ctx.beginPath();
      ctx.moveTo(ARENA_X, gy);
      ctx.lineTo(ARENA_X + ARENA_WIDTH, gy);
      ctx.stroke();
    }

    ctx.strokeStyle = SNAKE_COLORS.arenaBorder;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(ARENA_X, ARENA_Y, ARENA_WIDTH, ARENA_HEIGHT);

    // 4. Pulsing Standard Food Orb
    const pulse = 0.85 + 0.15 * Math.sin(this.tickCount * 0.18);
    const fx = ARENA_X + this.food.x * CELL_SIZE + CELL_SIZE / 2;
    const fy = ARENA_Y + this.food.y * CELL_SIZE + CELL_SIZE / 2;

    ctx.fillStyle = SNAKE_COLORS.foodGlow;
    ctx.beginPath();
    ctx.arc(fx, fy, 15 * pulse, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = SNAKE_COLORS.foodFill;
    ctx.beginPath();
    ctx.arc(fx, fy, 10 * pulse, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(fx - 3, fy - 3, 3, 0, Math.PI * 2);
    ctx.fill();

    // 5. Optional Timed Bonus Orb
    if (this.bonusFood !== null) {
      const bx = ARENA_X + this.bonusFood.x * CELL_SIZE + CELL_SIZE / 2;
      const by = ARENA_Y + this.bonusFood.y * CELL_SIZE + CELL_SIZE / 2;
      const bonusPulse = 0.88 + 0.18 * Math.sin(this.tickCount * 0.3);

      ctx.fillStyle = SNAKE_COLORS.bonusGlow;
      ctx.beginPath();
      ctx.arc(bx, by, 17 * bonusPulse, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = SNAKE_COLORS.bonusFill;
      ctx.beginPath();
      ctx.arc(bx, by, 12 * bonusPulse, 0, Math.PI * 2);
      ctx.fill();

      // Remaining lifetime ring around bonus orb
      const bonusRatio = Math.max(0, Math.min(1, this.bonusFoodTicks / BONUS_ORB_LIFETIME_TICKS));
      ctx.strokeStyle = "#fde047";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(bx, by, 16, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * bonusRatio);
      ctx.stroke();
    }

    // 6. Segmented Neon Snake
    for (let i = this.snake.length - 1; i >= 0; i--) {
      const seg = this.snake[i];
      const sx = ARENA_X + seg.x * CELL_SIZE;
      const sy = ARENA_Y + seg.y * CELL_SIZE;

      if (i === 0) {
        // Head with outer glow & directional eyes
        ctx.fillStyle = SNAKE_COLORS.bodyGlow;
        ctx.fillRect(sx - 2, sy - 2, CELL_SIZE + 4, CELL_SIZE + 4);

        ctx.fillStyle = SNAKE_COLORS.headFill;
        ctx.fillRect(sx + 2, sy + 2, CELL_SIZE - 4, CELL_SIZE - 4);
        ctx.strokeStyle = SNAKE_COLORS.headStroke;
        ctx.lineWidth = 2;
        ctx.strokeRect(sx + 2, sy + 2, CELL_SIZE - 4, CELL_SIZE - 4);

        // Directional eyes
        ctx.fillStyle = "#070a10";
        const cx = sx + CELL_SIZE / 2;
        const cy = sy + CELL_SIZE / 2;
        if (this.direction === "right") {
          ctx.fillRect(cx + 4, cy - 7, 5, 5);
          ctx.fillRect(cx + 4, cy + 2, 5, 5);
        } else if (this.direction === "left") {
          ctx.fillRect(cx - 9, cy - 7, 5, 5);
          ctx.fillRect(cx - 9, cy + 2, 5, 5);
        } else if (this.direction === "up") {
          ctx.fillRect(cx - 7, cy - 9, 5, 5);
          ctx.fillRect(cx + 2, cy - 9, 5, 5);
        } else {
          ctx.fillRect(cx - 7, cy + 4, 5, 5);
          ctx.fillRect(cx + 2, cy + 4, 5, 5);
        }
      } else {
        // Tapered neon body segment
        const pad = i === this.snake.length - 1 ? 6 : 4;
        ctx.fillStyle = i % 2 === 0 ? SNAKE_COLORS.bodyPrimary : SNAKE_COLORS.bodySecondary;
        ctx.fillRect(sx + pad, sy + pad, CELL_SIZE - pad * 2, CELL_SIZE - pad * 2);

        ctx.strokeStyle = "rgba(255, 255, 255, 0.28)";
        ctx.lineWidth = 1;
        ctx.strokeRect(sx + pad, sy + pad, CELL_SIZE - pad * 2, CELL_SIZE - pad * 2);
      }
    }

    ctx.restore();
  }
}
