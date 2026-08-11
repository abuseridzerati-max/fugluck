import { createSeededRandom, type RandomFn } from "@arcadeclash/shared";
import {
  ASTEROID_MAX_SIZE,
  ASTEROID_MAX_SPEED,
  ASTEROID_MIN_SIZE,
  ASTEROID_MIN_SPEED,
  BASE_SPAWN_INTERVAL_TICKS,
  BULLET_HEIGHT,
  BULLET_SPEED,
  BULLET_WIDTH,
  SHIP_HEIGHT,
  SHIP_SPEED,
  SHIP_WIDTH,
  SHOOT_COOLDOWN_SEC,
  SPACE_COLORS,
  VIRTUAL_HEIGHT,
  VIRTUAL_WIDTH,
} from "./constants";

export type SpaceBlasterInput = {
  moveLeft?: boolean;
  moveRight?: boolean;
  moveUp?: boolean;
  moveDown?: boolean;
  shootPressed?: boolean;
};

export type Bullet = {
  id: number;
  x: number;
  y: number;
  active: boolean;
};

export type Asteroid = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  active: boolean;
};

export class SpaceBlasterEngine {
  public score = 0;
  public tickCount = 0;
  public gameOver = false;

  public shipX = VIRTUAL_WIDTH / 2;
  public shipY = VIRTUAL_HEIGHT - 100;
  public shootCooldownTimer = 0;

  public bullets: Bullet[] = [];
  public asteroids: Asteroid[] = [];

  private rng!: RandomFn;
  private nextBulletId = 1;
  private nextAsteroidId = 1;
  private width = VIRTUAL_WIDTH;
  private height = VIRTUAL_HEIGHT;

  constructor(public readonly seed: number) {
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
    this.shipX = VIRTUAL_WIDTH / 2;
    this.shipY = VIRTUAL_HEIGHT - 100;
    this.shootCooldownTimer = 0;
    this.bullets = [];
    this.asteroids = [];
    this.nextBulletId = 1;
    this.nextAsteroidId = 1;
    this.rng = createSeededRandom(this.seed).stream("gameplay");
  }

  public update(dtSec: number, input: SpaceBlasterInput): "collision" | null {
    if (this.gameOver) return "collision";

    this.tickCount++;

    // 1. Survival passive score gain
    if (this.tickCount % 30 === 0) {
      this.score += 1;
    }

    // 2. Process Movement
    let dx = 0;
    let dy = 0;
    if (input.moveLeft) dx -= 1;
    if (input.moveRight) dx += 1;
    if (input.moveUp) dy -= 1;
    if (input.moveDown) dy += 1;

    if (dx !== 0 && dy !== 0) {
      const invLen = 1 / Math.SQRT2;
      dx *= invLen;
      dy *= invLen;
    }

    this.shipX += dx * SHIP_SPEED * dtSec;
    this.shipY += dy * SHIP_SPEED * dtSec;

    // Clamp ship position within virtual viewport bounds
    const halfW = SHIP_WIDTH / 2;
    const halfH = SHIP_HEIGHT / 2;
    this.shipX = Math.max(halfW, Math.min(VIRTUAL_WIDTH - halfW, this.shipX));
    this.shipY = Math.max(halfH, Math.min(VIRTUAL_HEIGHT - halfH, this.shipY));

    // 3. Process Shooting
    if (this.shootCooldownTimer > 0) {
      this.shootCooldownTimer -= dtSec;
    }

    if (input.shootPressed && this.shootCooldownTimer <= 0) {
      this.shootCooldownTimer = SHOOT_COOLDOWN_SEC;
      this.bullets.push({
        id: this.nextBulletId++,
        x: this.shipX,
        y: this.shipY - halfH,
        active: true,
      });
    }

    // 4. Update Bullets
    for (const b of this.bullets) {
      if (!b.active) continue;
      b.y -= BULLET_SPEED * dtSec;
      if (b.y < -50) {
        b.active = false;
      }
    }

    // 5. Spawn Asteroids
    const spawnRateReduction = Math.min(15, Math.floor(this.tickCount / 300));
    const currentInterval = Math.max(15, BASE_SPAWN_INTERVAL_TICKS - spawnRateReduction);

    if (this.tickCount % currentInterval === 0) {
      const radius = ASTEROID_MIN_SIZE + this.rng() * (ASTEROID_MAX_SIZE - ASTEROID_MIN_SIZE);
      const spawnX = radius + this.rng() * (VIRTUAL_WIDTH - radius * 2);
      const vy = ASTEROID_MIN_SPEED + this.rng() * (ASTEROID_MAX_SPEED - ASTEROID_MIN_SPEED);
      const vx = (this.rng() - 0.5) * 120;

      this.asteroids.push({
        id: this.nextAsteroidId++,
        x: spawnX,
        y: -radius,
        vx,
        vy,
        radius,
        active: true,
      });
    }

    // 6. Update Asteroids
    for (const a of this.asteroids) {
      if (!a.active) continue;
      a.x += a.vx * dtSec;
      a.y += a.vy * dtSec;

      if (a.y > VIRTUAL_HEIGHT + a.radius * 2 || a.x < -100 || a.x > VIRTUAL_WIDTH + 100) {
        a.active = false;
      }
    }

    // 7. Bullet-Asteroid Collision
    for (const b of this.bullets) {
      if (!b.active) continue;
      for (const a of this.asteroids) {
        if (!a.active) continue;
        const distSq = (b.x - a.x) * (b.x - a.x) + (b.y - a.y) * (b.y - a.y);
        if (distSq <= a.radius * a.radius) {
          b.active = false;
          a.active = false;
          this.score += 10;
          break;
        }
      }
    }

    // 8. Ship-Asteroid Collision
    for (const a of this.asteroids) {
      if (!a.active) continue;
      const shipRadius = SHIP_WIDTH * 0.4;
      const distSq = (this.shipX - a.x) * (this.shipX - a.x) + (this.shipY - a.y) * (this.shipY - a.y);
      const minDistance = shipRadius + a.radius;
      if (distSq <= minDistance * minDistance) {
        this.gameOver = true;
        return "collision";
      }
    }

    // Filter out inactive entities periodically to keep arrays clean
    if (this.tickCount % 120 === 0) {
      this.bullets = this.bullets.filter((b) => b.active);
      this.asteroids = this.asteroids.filter((a) => a.active);
    }

    return null;
  }

  public render(ctx: CanvasRenderingContext2D): void {
    const scaleX = this.width / VIRTUAL_WIDTH;
    const scaleY = this.height / VIRTUAL_HEIGHT;

    ctx.save();
    ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);

    // Background
    ctx.fillStyle = SPACE_COLORS.bg;
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

    // Stars background visual effect
    ctx.fillStyle = SPACE_COLORS.star;
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 20; i++) {
      const starX = ((i * 137 + this.tickCount * 2) % VIRTUAL_WIDTH);
      const starY = ((i * 219 + this.tickCount * 4) % VIRTUAL_HEIGHT);
      ctx.fillRect(starX, starY, 2, 2);
    }
    ctx.globalAlpha = 1.0;

    // Render Bullets
    ctx.fillStyle = SPACE_COLORS.bullet;
    for (const b of this.bullets) {
      if (!b.active) continue;
      ctx.fillRect(b.x - BULLET_WIDTH / 2, b.y - BULLET_HEIGHT / 2, BULLET_WIDTH, BULLET_HEIGHT);
    }

    // Render Asteroids
    ctx.fillStyle = SPACE_COLORS.asteroidBody;
    ctx.strokeStyle = SPACE_COLORS.asteroidBorder;
    ctx.lineWidth = 3;
    for (const a of this.asteroids) {
      if (!a.active) continue;
      ctx.beginPath();
      ctx.arc(a.x, a.y, a.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Render Ship (triangle / cyan fighter)
    if (!this.gameOver) {
      const halfW = SHIP_WIDTH / 2;
      const halfH = SHIP_HEIGHT / 2;

      ctx.fillStyle = SPACE_COLORS.shipPrimary;
      ctx.beginPath();
      ctx.moveTo(this.shipX, this.shipY - halfH);
      ctx.lineTo(this.shipX - halfW, this.shipY + halfH);
      ctx.lineTo(this.shipX + halfW, this.shipY + halfH);
      ctx.closePath();
      ctx.fill();

      // Engine Flame
      ctx.fillStyle = SPACE_COLORS.shipEngine;
      ctx.beginPath();
      ctx.moveTo(this.shipX - halfW * 0.5, this.shipY + halfH);
      ctx.lineTo(this.shipX, this.shipY + halfH + 12 + (this.tickCount % 4) * 3);
      ctx.lineTo(this.shipX + halfW * 0.5, this.shipY + halfH);
      ctx.closePath();
      ctx.fill();
    }

    // HUD Text
    ctx.fillStyle = SPACE_COLORS.textPrimary;
    ctx.font = "bold 24px sans-serif";
    ctx.fillText(`SCORE: ${this.score}`, 30, 45);

    ctx.restore();
  }
}
