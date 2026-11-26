import { SpaceBlasterEngine } from "@fugluck/games/space-blaster/engine";
import { CyberHopperEngine, type Obstacle as CyberHopperObstacle } from "@fugluck/games/cyber-hopper/engine";
import {
  AUTHORITY_VERSION,
  CYBER_HOPPER_AUTHORITY_VERSION,
  GAME_MANIFESTS,
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

/**
 * Single server-side registry of certified authoritative game plugins.
 * Every game with `certified: true` in `GAME_MANIFESTS` MUST have an entry here.
 */
export const SERVER_GAME_PLUGINS: Readonly<Record<string, ServerGamePlugin<any>>> = {
  "space-blaster": spaceBlasterServerPlugin,
  "cyber-hopper": cyberHopperServerPlugin,
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
