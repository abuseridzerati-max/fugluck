import { SpaceBlasterEngine } from "@fugluck/games/space-blaster/engine";
import { CyberHopperEngine, type Obstacle as CyberHopperObstacle } from "@fugluck/games/cyber-hopper/engine";
import { StackTowerEngine } from "@fugluck/games/stack-tower/engine";
import { Blitz2048Engine } from "@fugluck/games/2048-blitz/engine";
import { NeonSnakeEngine } from "@fugluck/games/neon-snake/engine";
import { MinesweeperSprintEngine } from "@fugluck/games/minesweeper-sprint/engine";
import { BrickBreakerEngine } from "@fugluck/games/brick-breaker/engine";
import { BlitzChessEngine } from "@fugluck/games/blitz-chess/engine";
import { Connect4Engine } from "@fugluck/games/connect-4/engine";
import { CheckersEngine } from "@fugluck/games/checkers/engine";
import {
  AUTHORITY_VERSION,
  BLITZ_2048_AUTHORITY_VERSION,
  BLITZ_CHESS_AUTHORITY_VERSION,
  BRICK_BREAKER_AUTHORITY_VERSION,
  CHECKERS_AUTHORITY_VERSION,
  CONNECT_4_AUTHORITY_VERSION,
  CYBER_HOPPER_AUTHORITY_VERSION,
  GAME_MANIFESTS,
  MINESWEEPER_SPRINT_AUTHORITY_VERSION,
  NEON_SNAKE_AUTHORITY_VERSION,
  STACK_TOWER_AUTHORITY_VERSION,
  VIRTUAL_VIEWPORT,
  type AuthorityControls,
  type AuthoritySnapshot,
} from "@fugluck/shared";
import type { ServerGamePlugin, ServerTieCandidate } from "./contract";
export type { ServerGamePlugin, ServerTieCandidate } from "./contract";

const BASE_CONTROL_KEYS = [
  "sessionId",
  "instanceId",
  "matchId",
  "gameId",
  "version",
  "nonce",
  "epoch",
  "seq",
  "snapshot",
] as const;

class ControlGuard {
  seq = -1;
  tokens = 12;
  refill = 0;
  lastInput = -Infinity;

  validateAndConsume(p: AuthorityControls, now: number, snapshotTimes: Map<number, number>): void {
    if (!Number.isSafeInteger(p.seq) || p.seq <= this.seq) throw Error("INPUT_SEQUENCE");
    if (!Number.isSafeInteger(p.snapshot) || now - (snapshotTimes.get(p.snapshot) ?? -Infinity) > 500) {
      throw Error("INPUT_STALE");
    }
    this.tokens = Math.min(12, this.tokens + Math.max(0, now - this.refill) * 0.06);
    this.refill = now;
    if (this.tokens < 1) throw Error("INPUT_RATE");
  }

  commit(seq: number, now: number): void {
    this.tokens--;
    this.seq = seq;
    this.lastInput = now;
  }
}

interface SpaceBlasterServerState {
  engine: SpaceBlasterEngine;
  guard: ControlGuard;
  held: {
    moveLeft: boolean;
    moveRight: boolean;
    moveUp: boolean;
    moveDown: boolean;
    shootPressed: boolean;
  };
}

interface CyberHopperServerState {
  engine: CyberHopperEngine;
  guard: ControlGuard;
  hopPulses: {
    hopUp: boolean;
    hopDown: boolean;
    hopLeft: boolean;
    hopRight: boolean;
  };
}

interface StackTowerServerState {
  engine: StackTowerEngine;
  guard: ControlGuard;
  dropPending: boolean;
}

interface Blitz2048ServerState {
  engine: Blitz2048Engine;
  guard: ControlGuard;
  movePulses: {
    moveUp: boolean;
    moveDown: boolean;
    moveLeft: boolean;
    moveRight: boolean;
  };
}

interface NeonSnakeServerState {
  engine: NeonSnakeEngine;
  guard: ControlGuard;
  movePulses: {
    moveUp: boolean;
    moveDown: boolean;
    moveLeft: boolean;
    moveRight: boolean;
  };
}

interface MinesweeperServerState {
  engine: MinesweeperSprintEngine;
  guard: ControlGuard;
  pendingCell: {
    action?: "reveal" | "flag";
    col?: number;
    row?: number;
  };
}

interface BrickBreakerServerState {
  engine: BrickBreakerEngine;
  guard: ControlGuard;
  held: {
    left: boolean;
    right: boolean;
  };
}

interface BlitzChessServerState {
  engine: BlitzChessEngine;
  guard: ControlGuard;
  pendingMove: {
    moveFrom?: string;
    moveTo?: string;
    resign?: boolean;
  };
}

interface Connect4ServerState {
  engine: Connect4Engine;
  guard: ControlGuard;
  pendingMove: {
    dropCol?: number;
    resign?: boolean;
  };
}

interface CheckersServerState {
  engine: CheckersEngine;
  guard: ControlGuard;
  pendingMove: {
    from?: number;
    to?: number;
    resign?: boolean;
  };
}

function defaultDrawTieResolver(_playerA: ServerTieCandidate, _playerB: ServerTieCandidate): string | null {
  return null;
}

const spaceBlasterServerPlugin: ServerGamePlugin<SpaceBlasterServerState> = {
  gameId: "space-blaster",
  authorityVersion: AUTHORITY_VERSION,
  allowedControlKeys: [...BASE_CONTROL_KEYS, "left", "right", "up", "down", "fire"],
  defaultReferenceEntryMinor: 500,

  createState(seed: number): SpaceBlasterServerState {
    const engine = new SpaceBlasterEngine(seed);
    engine.resize(VIRTUAL_VIEWPORT.width, VIRTUAL_VIEWPORT.height);
    return {
      engine,
      guard: new ControlGuard(),
      held: { moveLeft: false, moveRight: false, moveUp: false, moveDown: false, shootPressed: false },
    };
  },

  applyInput(state, controls, now, snapshotTimes) {
    state.guard.validateAndConsume(controls, now, snapshotTimes);
    for (const key of ["left", "right", "up", "down", "fire"] as const) {
      if (typeof controls[key] !== "boolean") throw Error("INPUT_SHAPE");
    }
    state.guard.commit(controls.seq, now);
    state.held = {
      moveLeft: Boolean(controls.left),
      moveRight: Boolean(controls.right),
      moveUp: Boolean(controls.up),
      moveDown: Boolean(controls.down),
      shootPressed: state.held.shootPressed || Boolean(controls.fire),
    };
  },

  tick(state, dtSec, now) {
    if (now - state.guard.lastInput > 250) {
      state.held = { moveLeft: false, moveRight: false, moveUp: false, moveDown: false, shootPressed: false };
    }
    const input = { ...state.held };
    state.held.shootPressed = false;
    return Boolean(state.engine.update(dtSec, input));
  },

  getScore(state) {
    return state.engine.score;
  },

  getTickCount(state) {
    return state.engine.tickCount;
  },

  isFinished(state, capTicks) {
    return state.engine.gameOver || state.engine.tickCount >= capTicks;
  },

  serializeSnapshot(state, base): AuthoritySnapshot {
    return {
      ...base,
      tickCount: state.engine.tickCount,
      score: state.engine.score,
      gameOver: state.engine.gameOver,
      shipX: state.engine.shipX,
      shipY: state.engine.shipY,
      bullets: state.engine.bullets.filter((b) => b.active),
      asteroids: state.engine.asteroids.filter((a) => a.active),
    };
  },

  resetControls(state, resetSession = false) {
    state.held = { moveLeft: false, moveRight: false, moveUp: false, moveDown: false, shootPressed: false };
    if (resetSession) state.guard = new ControlGuard();
  },

  getLastInputAt(state) {
    return state.guard.lastInput;
  },

  resolveTie: defaultDrawTieResolver,
};

const cyberHopperServerPlugin: ServerGamePlugin<CyberHopperServerState> = {
  gameId: "cyber-hopper",
  authorityVersion: CYBER_HOPPER_AUTHORITY_VERSION,
  allowedControlKeys: [...BASE_CONTROL_KEYS, "hopUp", "hopDown", "hopLeft", "hopRight"],
  defaultReferenceEntryMinor: 400,

  createState(seed: number): CyberHopperServerState {
    const engine = new CyberHopperEngine(seed);
    engine.resize(VIRTUAL_VIEWPORT.width, VIRTUAL_VIEWPORT.height);
    return {
      engine,
      guard: new ControlGuard(),
      hopPulses: { hopUp: false, hopDown: false, hopLeft: false, hopRight: false },
    };
  },

  applyInput(state, controls, now, snapshotTimes) {
    state.guard.validateAndConsume(controls, now, snapshotTimes);
    for (const key of ["hopUp", "hopDown", "hopLeft", "hopRight"] as const) {
      if (controls[key] !== undefined && typeof controls[key] !== "boolean") throw Error("INPUT_SHAPE");
    }
    state.guard.commit(controls.seq, now);
    state.hopPulses = {
      hopUp: state.hopPulses.hopUp || Boolean(controls.hopUp),
      hopDown: state.hopPulses.hopDown || Boolean(controls.hopDown),
      hopLeft: state.hopPulses.hopLeft || Boolean(controls.hopLeft),
      hopRight: state.hopPulses.hopRight || Boolean(controls.hopRight),
    };
  },

  tick(state, dtSec, now) {
    if (now - state.guard.lastInput > 250) {
      state.hopPulses = { hopUp: false, hopDown: false, hopLeft: false, hopRight: false };
    }
    const input = { ...state.hopPulses };
    state.hopPulses = { hopUp: false, hopDown: false, hopLeft: false, hopRight: false };
    return Boolean(state.engine.update(dtSec, input));
  },

  getScore(state) {
    return state.engine.score;
  },

  getTickCount(state) {
    return state.engine.tickCount;
  },

  isFinished(state, capTicks) {
    return state.engine.gameOver || state.engine.tickCount >= capTicks;
  },

  serializeSnapshot(state, base): AuthoritySnapshot {
    return {
      ...base,
      tickCount: state.engine.tickCount,
      score: state.engine.score,
      gameOver: state.engine.gameOver,
      gridX: state.engine.gridX,
      gridY: state.engine.gridY,
      roundsCompleted: state.engine.roundsCompleted,
      obstacles: state.engine.obstacles
        .filter((o: CyberHopperObstacle) => o.active && o.x >= -o.width && o.x <= VIRTUAL_VIEWPORT.width + o.width)
        .map((o: CyberHopperObstacle) => ({
          id: o.id,
          x: Math.round(o.x),
          y: Math.round(o.y),
          width: o.width,
          height: Math.round(o.height),
          direction: o.direction,
          color: o.color,
          active: true,
        })),
    };
  },

  resetControls(state, resetSession = false) {
    state.hopPulses = { hopUp: false, hopDown: false, hopLeft: false, hopRight: false };
    if (resetSession) state.guard = new ControlGuard();
  },

  getLastInputAt(state) {
    return state.guard.lastInput;
  },

  resolveTie: defaultDrawTieResolver,
};

const stackTowerServerPlugin: ServerGamePlugin<StackTowerServerState> = {
  gameId: "stack-tower",
  authorityVersion: STACK_TOWER_AUTHORITY_VERSION,
  allowedControlKeys: [...BASE_CONTROL_KEYS, "drop"],
  defaultReferenceEntryMinor: 400,

  createState(seed: number): StackTowerServerState {
    const engine = new StackTowerEngine(seed);
    engine.resize(VIRTUAL_VIEWPORT.width, VIRTUAL_VIEWPORT.height);
    return {
      engine,
      guard: new ControlGuard(),
      dropPending: false,
    };
  },

  applyInput(state, controls, now, snapshotTimes) {
    state.guard.validateAndConsume(controls, now, snapshotTimes);
    if (controls.drop !== undefined && typeof controls.drop !== "boolean") {
      throw Error("INPUT_SHAPE");
    }
    state.guard.commit(controls.seq, now);
    state.dropPending = state.dropPending || Boolean(controls.drop);
  },

  tick(state, dtSec, now) {
    if (now - state.guard.lastInput > 250) {
      state.dropPending = false;
    }
    const input = { drop: state.dropPending };
    state.dropPending = false;
    return Boolean(state.engine.update(dtSec, input));
  },

  getScore(state) {
    return state.engine.score;
  },

  getTickCount(state) {
    return state.engine.tickCount;
  },

  isFinished(state, capTicks) {
    return state.engine.gameOver || state.engine.tickCount >= capTicks;
  },

  serializeSnapshot(state, base): AuthoritySnapshot {
    const visibleTower = state.engine.tower.slice(-24).map((b) => ({
      level: b.level,
      x: Math.round(b.x * 10) / 10,
      width: Math.round(b.width * 10) / 10,
      color: b.color,
    }));
    return {
      ...base,
      tickCount: state.engine.tickCount,
      score: state.engine.score,
      gameOver: state.engine.gameOver,
      tower: visibleTower,
      activeBlock: {
        level: state.engine.activeBlock.level,
        x: Math.round(state.engine.activeBlock.x * 10) / 10,
        width: Math.round(state.engine.activeBlock.width * 10) / 10,
        direction: state.engine.activeBlock.direction,
        speed: Math.round(state.engine.activeBlock.speed * 10) / 10,
        color: state.engine.activeBlock.color,
      },
      fallingPieces: state.engine.fallingPieces.slice(-6).map((p) => ({
        x: Math.round(p.x * 10) / 10,
        y: Math.round(p.y * 10) / 10,
        width: Math.round(p.width * 10) / 10,
        height: p.height,
        vy: Math.round(p.vy),
        vx: Math.round(p.vx),
        color: p.color,
        alpha: Math.round(p.alpha * 100) / 100,
      })),
      cameraY: Math.round(state.engine.cameraY * 10) / 10,
      blocksPlaced: state.engine.blocksPlaced,
      perfectStreak: state.engine.perfectStreak,
      maxStreak: state.engine.maxStreak,
      perfectPulseTicks: state.engine.perfectPulseTicks,
      lastPulseX: Math.round(state.engine.lastPulseX * 10) / 10,
      lastPulseWidth: Math.round(state.engine.lastPulseWidth * 10) / 10,
      lastPulseLevel: state.engine.lastPulseLevel,
    };
  },

  resetControls(state, resetSession = false) {
    state.dropPending = false;
    if (resetSession) state.guard = new ControlGuard();
  },

  getLastInputAt(state) {
    return state.guard.lastInput;
  },

  resolveTie: defaultDrawTieResolver,
};

const blitz2048ServerPlugin: ServerGamePlugin<Blitz2048ServerState> = {
  gameId: "2048-blitz",
  authorityVersion: BLITZ_2048_AUTHORITY_VERSION,
  allowedControlKeys: [...BASE_CONTROL_KEYS, "moveUp", "moveDown", "moveLeft", "moveRight"],
  defaultReferenceEntryMinor: 400,

  createState(seed: number): Blitz2048ServerState {
    const engine = new Blitz2048Engine(seed);
    engine.resize(VIRTUAL_VIEWPORT.width, VIRTUAL_VIEWPORT.height);
    return {
      engine,
      guard: new ControlGuard(),
      movePulses: { moveUp: false, moveDown: false, moveLeft: false, moveRight: false },
    };
  },

  applyInput(state, controls, now, snapshotTimes) {
    state.guard.validateAndConsume(controls, now, snapshotTimes);
    for (const key of ["moveUp", "moveDown", "moveLeft", "moveRight"] as const) {
      if (controls[key] !== undefined && typeof controls[key] !== "boolean") {
        throw Error("INPUT_SHAPE");
      }
    }
    state.guard.commit(controls.seq, now);
    state.movePulses = {
      moveUp: state.movePulses.moveUp || Boolean(controls.moveUp),
      moveDown: state.movePulses.moveDown || Boolean(controls.moveDown),
      moveLeft: state.movePulses.moveLeft || Boolean(controls.moveLeft),
      moveRight: state.movePulses.moveRight || Boolean(controls.moveRight),
    };
  },

  tick(state, dtSec, now) {
    if (now - state.guard.lastInput > 250) {
      state.movePulses = { moveUp: false, moveDown: false, moveLeft: false, moveRight: false };
    }
    const input = { ...state.movePulses };
    state.movePulses = { moveUp: false, moveDown: false, moveLeft: false, moveRight: false };
    return Boolean(state.engine.update(dtSec, input));
  },

  getScore(state) {
    return state.engine.score;
  },

  getTickCount(state) {
    return state.engine.tickCount;
  },

  isFinished(state, capTicks) {
    return state.engine.gameOver || state.engine.tickCount >= capTicks;
  },

  serializeSnapshot(state, base): AuthoritySnapshot {
    return {
      ...base,
      tickCount: state.engine.tickCount,
      score: state.engine.score,
      gameOver: state.engine.gameOver,
      board: [...state.engine.board],
      mergeFlash: [...state.engine.mergeFlash],
      spawnFlash: [...state.engine.spawnFlash],
      moves: state.engine.moves,
      bestTile: state.engine.bestTile,
      ticksRemaining: state.engine.ticksRemaining,
    };
  },

  resetControls(state, resetSession = false) {
    state.movePulses = { moveUp: false, moveDown: false, moveLeft: false, moveRight: false };
    if (resetSession) state.guard = new ControlGuard();
  },

  getLastInputAt(state) {
    return state.guard.lastInput;
  },

  resolveTie: defaultDrawTieResolver,
};

const neonSnakeServerPlugin: ServerGamePlugin<NeonSnakeServerState> = {
  gameId: "neon-snake",
  authorityVersion: NEON_SNAKE_AUTHORITY_VERSION,
  allowedControlKeys: [...BASE_CONTROL_KEYS, "moveUp", "moveDown", "moveLeft", "moveRight"],
  defaultReferenceEntryMinor: 400,

  createState(seed: number): NeonSnakeServerState {
    const engine = new NeonSnakeEngine(seed);
    engine.resize(VIRTUAL_VIEWPORT.width, VIRTUAL_VIEWPORT.height);
    return {
      engine,
      guard: new ControlGuard(),
      movePulses: { moveUp: false, moveDown: false, moveLeft: false, moveRight: false },
    };
  },

  applyInput(state, controls, now, snapshotTimes) {
    state.guard.validateAndConsume(controls, now, snapshotTimes);
    for (const key of ["moveUp", "moveDown", "moveLeft", "moveRight"] as const) {
      if (controls[key] !== undefined && typeof controls[key] !== "boolean") {
        throw Error("INPUT_SHAPE");
      }
    }
    state.guard.commit(controls.seq, now);
    state.movePulses = {
      moveUp: state.movePulses.moveUp || Boolean(controls.moveUp),
      moveDown: state.movePulses.moveDown || Boolean(controls.moveDown),
      moveLeft: state.movePulses.moveLeft || Boolean(controls.moveLeft),
      moveRight: state.movePulses.moveRight || Boolean(controls.moveRight),
    };
  },

  tick(state, dtSec, now) {
    if (now - state.guard.lastInput > 250) {
      state.movePulses = { moveUp: false, moveDown: false, moveLeft: false, moveRight: false };
    }
    const input = { ...state.movePulses };
    state.movePulses = { moveUp: false, moveDown: false, moveLeft: false, moveRight: false };
    return Boolean(state.engine.update(dtSec, input));
  },

  getScore(state) {
    return state.engine.score;
  },

  getTickCount(state) {
    return state.engine.tickCount;
  },

  isFinished(state, capTicks) {
    return state.engine.gameOver || state.engine.tickCount >= capTicks;
  },

  serializeSnapshot(state, base): AuthoritySnapshot {
    return {
      ...base,
      tickCount: state.engine.tickCount,
      score: state.engine.score,
      gameOver: state.engine.gameOver,
      ticksRemaining: state.engine.ticksRemaining,
      snake: state.engine.snake.map((s) => ({ x: s.x, y: s.y })),
      snakeDirection: state.engine.direction,
      food: { x: state.engine.food.x, y: state.engine.food.y },
      bonusFood: state.engine.bonusFood ? { x: state.engine.bonusFood.x, y: state.engine.bonusFood.y } : null,
      bonusFoodTicks: state.engine.bonusFoodTicks,
      stepIntervalTicks: state.engine.stepIntervalTicks,
      orbsEaten: state.engine.orbsEaten,
    };
  },

  resetControls(state, resetSession = false) {
    state.movePulses = { moveUp: false, moveDown: false, moveLeft: false, moveRight: false };
    if (resetSession) state.guard = new ControlGuard();
  },

  getLastInputAt(state) {
    return state.guard.lastInput;
  },

  resolveTie: defaultDrawTieResolver,
};

const minesweeperSprintServerPlugin: ServerGamePlugin<MinesweeperServerState> = {
  gameId: "minesweeper-sprint",
  authorityVersion: MINESWEEPER_SPRINT_AUTHORITY_VERSION,
  allowedControlKeys: [...BASE_CONTROL_KEYS, "cellAction", "cellCol", "cellRow"],
  defaultReferenceEntryMinor: 400,

  createState(seed: number): MinesweeperServerState {
    const engine = new MinesweeperSprintEngine(seed);
    engine.resize(VIRTUAL_VIEWPORT.width, VIRTUAL_VIEWPORT.height);
    return {
      engine,
      guard: new ControlGuard(),
      pendingCell: {},
    };
  },

  applyInput(state, controls, now, snapshotTimes) {
    state.guard.validateAndConsume(controls, now, snapshotTimes);
    if (controls.cellAction !== undefined) {
      if (controls.cellAction !== "reveal" && controls.cellAction !== "flag") {
        throw Error("INPUT_SHAPE");
      }
      if (
        typeof controls.cellCol !== "number" ||
        typeof controls.cellRow !== "number" ||
        !Number.isInteger(controls.cellCol) ||
        !Number.isInteger(controls.cellRow)
      ) {
        throw Error("INPUT_SHAPE");
      }
    }
    state.guard.commit(controls.seq, now);
    if (controls.cellAction) {
      state.pendingCell = {
        action: controls.cellAction,
        col: controls.cellCol,
        row: controls.cellRow,
      };
    }
  },

  tick(state, dtSec, now) {
    if (now - state.guard.lastInput > 250) {
      state.pendingCell = {};
    }
    const input = state.pendingCell;
    state.pendingCell = {};
    return Boolean(state.engine.update(dtSec, input));
  },

  getScore(state) {
    return state.engine.score;
  },

  getTickCount(state) {
    return state.engine.tickCount;
  },

  isFinished(state, capTicks) {
    return state.engine.gameOver || state.engine.tickCount >= capTicks;
  },

  serializeSnapshot(state, base): AuthoritySnapshot {
    return {
      ...base,
      tickCount: state.engine.tickCount,
      score: state.engine.score,
      gameOver: state.engine.gameOver,
      ticksRemaining: state.engine.ticksRemaining,
      visibleBoard: [...state.engine.visibleBoard],
      safeCellsRemaining: state.engine.safeCellsRemaining,
      flagsPlaced: state.engine.flagsPlaced,
      detonatedIdx: state.engine.detonatedIdx,
      boardCleared: state.engine.boardCleared,
    };
  },

  resetControls(state, resetSession = false) {
    state.pendingCell = {};
    if (resetSession) state.guard = new ControlGuard();
  },

  getLastInputAt(state) {
    return state.guard.lastInput;
  },

  resolveTie: defaultDrawTieResolver,
};

const brickBreakerServerPlugin: ServerGamePlugin<BrickBreakerServerState> = {
  gameId: "brick-breaker",
  authorityVersion: BRICK_BREAKER_AUTHORITY_VERSION,
  allowedControlKeys: [...BASE_CONTROL_KEYS, "left", "right"],
  defaultReferenceEntryMinor: 400,

  createState(seed: number): BrickBreakerServerState {
    const engine = new BrickBreakerEngine(seed);
    engine.resize(VIRTUAL_VIEWPORT.width, VIRTUAL_VIEWPORT.height);
    return {
      engine,
      guard: new ControlGuard(),
      held: { left: false, right: false },
    };
  },

  applyInput(state, controls, now, snapshotTimes) {
    state.guard.validateAndConsume(controls, now, snapshotTimes);
    for (const key of ["left", "right"] as const) {
      if (controls[key] !== undefined && typeof controls[key] !== "boolean") {
        throw Error("INPUT_SHAPE");
      }
    }
    state.guard.commit(controls.seq, now);
    state.held = {
      left: Boolean(controls.left),
      right: Boolean(controls.right),
    };
  },

  tick(state, dtSec, now) {
    if (now - state.guard.lastInput > 250) {
      state.held = { left: false, right: false };
    }
    return Boolean(state.engine.update(dtSec, { ...state.held }));
  },

  getScore(state) {
    return state.engine.score;
  },

  getTickCount(state) {
    return state.engine.tickCount;
  },

  isFinished(state, capTicks) {
    return state.engine.gameOver || state.engine.tickCount >= capTicks;
  },

  serializeSnapshot(state, base): AuthoritySnapshot {
    return {
      ...base,
      tickCount: state.engine.tickCount,
      score: state.engine.score,
      gameOver: state.engine.gameOver,
      ticksRemaining: state.engine.ticksRemaining,
      paddleX: Math.round(state.engine.paddleX * 10) / 10,
      ballX: Math.round(state.engine.ballX * 10) / 10,
      ballY: Math.round(state.engine.ballY * 10) / 10,
      ballVx: Math.round(state.engine.ballVx),
      ballVy: Math.round(state.engine.ballVy),
      bricks: state.engine.bricks.filter((b) => b.hp > 0).map((b) => ({ ...b })),
      lives: state.engine.lives,
      wave: state.engine.wave,
      combo: state.engine.combo,
      launchTicks: state.engine.launchTicks,
      trail: state.engine.trail.map((pt) => ({ x: Math.round(pt.x), y: Math.round(pt.y) })),
    };
  },

  resetControls(state, resetSession = false) {
    state.held = { left: false, right: false };
    if (resetSession) state.guard = new ControlGuard();
  },

  getLastInputAt(state) {
    return state.guard.lastInput;
  },

  resolveTie: defaultDrawTieResolver,
};

const SQUARE_RE = /^[a-h][1-8]$/;

const blitzChessServerPlugin: ServerGamePlugin<BlitzChessServerState> = {
  gameId: "blitz-chess",
  authorityVersion: BLITZ_CHESS_AUTHORITY_VERSION,
  allowedControlKeys: [...BASE_CONTROL_KEYS, "moveFrom", "moveTo", "resign"],
  defaultReferenceEntryMinor: 400,

  createState(seed: number): BlitzChessServerState {
    const engine = new BlitzChessEngine(seed);
    engine.resize(VIRTUAL_VIEWPORT.width, VIRTUAL_VIEWPORT.height);
    return {
      engine,
      guard: new ControlGuard(),
      pendingMove: {},
    };
  },

  applyInput(state, controls, now, snapshotTimes) {
    state.guard.validateAndConsume(controls, now, snapshotTimes);
    if (controls.resign !== undefined && typeof controls.resign !== "boolean") {
      throw Error("INPUT_SHAPE");
    }
    if (controls.moveFrom !== undefined || controls.moveTo !== undefined) {
      if (
        typeof controls.moveFrom !== "string" ||
        typeof controls.moveTo !== "string" ||
        !SQUARE_RE.test(controls.moveFrom) ||
        !SQUARE_RE.test(controls.moveTo)
      ) {
        throw Error("INPUT_SHAPE");
      }
    }
    state.guard.commit(controls.seq, now);
    if (controls.resign) {
      state.pendingMove = { resign: true };
    } else if (controls.moveFrom && controls.moveTo) {
      state.pendingMove = { moveFrom: controls.moveFrom, moveTo: controls.moveTo };
    }
  },

  tick(state, dtSec, now) {
    if (now - state.guard.lastInput > 250) {
      state.pendingMove = {};
    }
    const input = state.pendingMove;
    state.pendingMove = {};
    return Boolean(state.engine.update(dtSec, input));
  },

  getScore(state) {
    return state.engine.score;
  },

  getTickCount(state) {
    return state.engine.tickCount;
  },

  isFinished(state, capTicks) {
    return state.engine.gameOver || state.engine.tickCount >= capTicks;
  },

  serializeSnapshot(state, base): AuthoritySnapshot {
    return {
      ...base,
      tickCount: state.engine.tickCount,
      score: state.engine.score,
      gameOver: state.engine.gameOver,
      chessFen: state.engine.getFen(),
      whiteClockTicks: state.engine.whiteClockTicks,
      blackClockTicks: state.engine.blackClockTicks,
      lastMoveFrom: state.engine.lastMoveFrom,
      lastMoveTo: state.engine.lastMoveTo,
      lastMoveSan: state.engine.lastMoveSan,
      capturedByWhite: [...state.engine.capturedByWhite],
      capturedByBlack: [...state.engine.capturedByBlack],
      turnOutcome: state.engine.outcome,
      inCheck: state.engine.inCheck,
      turnNumber: state.engine.turnNumber,
    };
  },

  resetControls(state, resetSession = false) {
    state.pendingMove = {};
    if (resetSession) state.guard = new ControlGuard();
  },

  getLastInputAt(state) {
    return state.guard.lastInput;
  },

  resolveTie: defaultDrawTieResolver,
};

const connect4ServerPlugin: ServerGamePlugin<Connect4ServerState> = {
  gameId: "connect-4",
  authorityVersion: CONNECT_4_AUTHORITY_VERSION,
  allowedControlKeys: [...BASE_CONTROL_KEYS, "dropCol", "resign"],
  defaultReferenceEntryMinor: 400,

  createState(seed: number): Connect4ServerState {
    const engine = new Connect4Engine(seed);
    engine.resize(VIRTUAL_VIEWPORT.width, VIRTUAL_VIEWPORT.height);
    return {
      engine,
      guard: new ControlGuard(),
      pendingMove: {},
    };
  },

  applyInput(state, controls, now, snapshotTimes) {
    state.guard.validateAndConsume(controls, now, snapshotTimes);
    if (controls.resign !== undefined && typeof controls.resign !== "boolean") {
      throw Error("INPUT_SHAPE");
    }
    if (controls.dropCol !== undefined) {
      if (typeof controls.dropCol !== "number" || !Number.isInteger(controls.dropCol) || controls.dropCol < 0 || controls.dropCol > 6) {
        throw Error("INPUT_SHAPE");
      }
    }
    state.guard.commit(controls.seq, now);
    if (controls.resign) {
      state.pendingMove = { resign: true };
    } else if (controls.dropCol !== undefined) {
      state.pendingMove = { dropCol: controls.dropCol };
    }
  },

  tick(state, dtSec, now) {
    if (now - state.guard.lastInput > 250) {
      state.pendingMove = {};
    }
    const input = state.pendingMove;
    state.pendingMove = {};
    return Boolean(state.engine.update(dtSec, input));
  },

  getScore(state) {
    return state.engine.score;
  },

  getTickCount(state) {
    return state.engine.tickCount;
  },

  isFinished(state, capTicks) {
    return state.engine.gameOver || state.engine.tickCount >= capTicks;
  },

  serializeSnapshot(state, base): AuthoritySnapshot {
    return {
      ...base,
      tickCount: state.engine.tickCount,
      score: state.engine.score,
      gameOver: state.engine.gameOver,
      c4Board: [...state.engine.board],
      c4ActivePlayer: state.engine.activePlayer,
      p1ClockTicks: state.engine.p1ClockTicks,
      p2ClockTicks: state.engine.p2ClockTicks,
      lastMoveCol: state.engine.lastMoveCol,
      lastMoveRow: state.engine.lastMoveRow,
      winningCells: [...state.engine.winningCells],
      turnOutcome: state.engine.outcome,
      turnNumber: state.engine.turnNumber,
    };
  },

  resetControls(state, resetSession = false) {
    state.pendingMove = {};
    if (resetSession) state.guard = new ControlGuard();
  },

  getLastInputAt(state) {
    return state.guard.lastInput;
  },

  resolveTie: defaultDrawTieResolver,
};

const checkersServerPlugin: ServerGamePlugin<CheckersServerState> = {
  gameId: "checkers",
  authorityVersion: CHECKERS_AUTHORITY_VERSION,
  allowedControlKeys: [...BASE_CONTROL_KEYS, "chkFrom", "chkTo", "resign"],
  defaultReferenceEntryMinor: 400,

  createState(seed: number): CheckersServerState {
    const engine = new CheckersEngine(seed);
    engine.resize(VIRTUAL_VIEWPORT.width, VIRTUAL_VIEWPORT.height);
    return {
      engine,
      guard: new ControlGuard(),
      pendingMove: {},
    };
  },

  applyInput(state, controls, now, snapshotTimes) {
    state.guard.validateAndConsume(controls, now, snapshotTimes);
    if (controls.resign !== undefined && typeof controls.resign !== "boolean") {
      throw Error("INPUT_SHAPE");
    }
    if (controls.chkFrom !== undefined || controls.chkTo !== undefined) {
      if (
        typeof controls.chkFrom !== "number" ||
        typeof controls.chkTo !== "number" ||
        !Number.isInteger(controls.chkFrom) ||
        !Number.isInteger(controls.chkTo) ||
        controls.chkFrom < 0 ||
        controls.chkFrom >= 64 ||
        controls.chkTo < 0 ||
        controls.chkTo >= 64
      ) {
        throw Error("INPUT_SHAPE");
      }
    }
    state.guard.commit(controls.seq, now);
    if (controls.resign) {
      state.pendingMove = { resign: true };
    } else if (controls.chkFrom !== undefined && controls.chkTo !== undefined) {
      state.pendingMove = { from: controls.chkFrom, to: controls.chkTo };
    }
  },

  tick(state, dtSec, now) {
    if (now - state.guard.lastInput > 250) {
      state.pendingMove = {};
    }
    const input = state.pendingMove;
    state.pendingMove = {};
    return Boolean(state.engine.update(dtSec, input));
  },

  getScore(state) {
    return state.engine.score;
  },

  getTickCount(state) {
    return state.engine.tickCount;
  },

  isFinished(state, capTicks) {
    return state.engine.gameOver || state.engine.tickCount >= capTicks;
  },

  serializeSnapshot(state, base): AuthoritySnapshot {
    return {
      ...base,
      tickCount: state.engine.tickCount,
      score: state.engine.score,
      gameOver: state.engine.gameOver,
      chkBoard: [...state.engine.board],
      chkActivePlayer: state.engine.activePlayer,
      chkChainFromIdx: state.engine.chainFromIdx,
      chkQuietHalfMoves: state.engine.quietHalfMoves,
      p1ClockTicks: state.engine.p1ClockTicks,
      p2ClockTicks: state.engine.p2ClockTicks,
      chkLastMoveFrom: state.engine.lastMoveFrom,
      chkLastMoveTo: state.engine.lastMoveTo,
      turnOutcome: state.engine.outcome,
      turnNumber: state.engine.turnNumber,
    };
  },

  resetControls(state, resetSession = false) {
    state.pendingMove = {};
    if (resetSession) state.guard = new ControlGuard();
  },

  getLastInputAt(state) {
    return state.guard.lastInput;
  },

  resolveTie: defaultDrawTieResolver,
};

/**
 * Single server-side registry of certified authoritative game plugins.
 * Every game with `certified: true` in `GAME_MANIFESTS` MUST have an entry here.
 */
export const SERVER_GAME_PLUGINS: Readonly<Record<string, ServerGamePlugin<any>>> = {
  "space-blaster": spaceBlasterServerPlugin,
  "cyber-hopper": cyberHopperServerPlugin,
  "stack-tower": stackTowerServerPlugin,
  "2048-blitz": blitz2048ServerPlugin,
  "neon-snake": neonSnakeServerPlugin,
  "minesweeper-sprint": minesweeperSprintServerPlugin,
  "brick-breaker": brickBreakerServerPlugin,
  "blitz-chess": blitzChessServerPlugin,
  "connect-4": connect4ServerPlugin,
  "checkers": checkersServerPlugin,
};

export function getServerGamePlugin(gameId: string): ServerGamePlugin<any> | undefined {
  return SERVER_GAME_PLUGINS[gameId];
}

export function isSupportedServerGame(gameId: string, rulesVersion?: string): boolean {
  const plugin = SERVER_GAME_PLUGINS[gameId];
  if (!plugin) return false;
  return rulesVersion === undefined || plugin.authorityVersion === rulesVersion;
}

/**
 * Startup/test invariant: every `certified: true` game in `GAME_MANIFESTS`
 * must have a matching `SERVER_GAME_PLUGINS` entry with matching authorityVersion.
 */
export function assertServerGamePluginsValid(): void {
  const errors: string[] = [];
  for (const manifest of GAME_MANIFESTS) {
    if (!manifest.certified) continue;
    const plugin = SERVER_GAME_PLUGINS[manifest.id];
    if (!plugin) {
      errors.push(`Certified game '${manifest.id}' is missing from SERVER_GAME_PLUGINS.`);
      continue;
    }
    if (!manifest.authorityVersion) {
      errors.push(`Certified game '${manifest.id}' is missing authorityVersion in GAME_MANIFESTS.`);
    } else if (plugin.authorityVersion !== manifest.authorityVersion) {
      errors.push(
        `Certified game '${manifest.id}' authorityVersion mismatch: manifest='${manifest.authorityVersion}' vs server='${plugin.authorityVersion}'.`,
      );
    }
  }
  if (errors.length > 0) {
    throw new Error(`Server game plugin registry validation failed:\n- ${errors.join("\n- ")}`);
  }
}
