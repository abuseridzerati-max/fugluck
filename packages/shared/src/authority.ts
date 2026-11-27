/** RV-001 v1: current controls and current state only; no input history. */
export const AUTHORITY_VERSION = 'space-blaster-rv001-v1';
export const CYBER_HOPPER_AUTHORITY_VERSION = 'cyber-hopper-rv001-v1';
export const STACK_TOWER_AUTHORITY_VERSION = 'stack-tower-rv001-v1';
export const BLITZ_2048_AUTHORITY_VERSION = '2048-blitz-rv001-v1';
export const NEON_SNAKE_AUTHORITY_VERSION = 'neon-snake-rv001-v1';
export const AUTHORITY_CAP_TICKS = 180 * 60;
export type AuthorityState = 'CREATED' | 'READY' | 'ACTIVE' | 'COMPLETED' | 'FORFEITED' | 'VOIDED' | 'EXPIRED';
export interface AuthorityBinding {
  sessionId: string; instanceId: string; matchId: string; gameId: string;
  version: string; nonce: string; epoch: number;
}
export interface AuthorityControls extends AuthorityBinding {
  seq: number; snapshot: number;
  left?: boolean; right?: boolean; up?: boolean; down?: boolean; fire?: boolean;
  hopUp?: boolean; hopDown?: boolean; hopLeft?: boolean; hopRight?: boolean;
  drop?: boolean;
  moveUp?: boolean; moveDown?: boolean; moveLeft?: boolean; moveRight?: boolean;
}
export interface CyberHopperObstacleSnapshot {
  id: number; x: number; y: number; width: number; height: number;
  direction: 1 | -1; color: string; active?: boolean; laneIndex?: number; speed?: number;
}
export interface StackTowerBlockSnapshot {
  level: number; x: number; width: number; color: string;
}
export interface StackTowerActiveBlockSnapshot extends StackTowerBlockSnapshot {
  direction: 1 | -1; speed: number;
}
export interface StackTowerFallingPieceSnapshot {
  x: number; y: number; width: number; height: number; vy: number; vx: number; color: string; alpha: number;
}
export interface AuthoritySnapshot {
  sessionId: string; epoch: number; createdAt: number; emittedAt: number;
  seq: number; serverTime: number; startAt: number | null; deadline: number | null;
  state: AuthorityState; tickCount: number; score: number; gameOver: boolean;
  shipX?: number; shipY?: number;
  bullets?: Array<{ id: number; x: number; y: number; active: boolean }>;
  asteroids?: Array<{ id: number; x: number; y: number; vx: number; vy: number; radius: number; active: boolean }>;
  gridX?: number; gridY?: number; roundsCompleted?: number;
  obstacles?: CyberHopperObstacleSnapshot[];
  tower?: StackTowerBlockSnapshot[];
  activeBlock?: StackTowerActiveBlockSnapshot;
  fallingPieces?: StackTowerFallingPieceSnapshot[];
  cameraY?: number;
  blocksPlaced?: number;
  perfectStreak?: number;
  maxStreak?: number;
  perfectPulseTicks?: number;
  lastPulseX?: number;
  lastPulseWidth?: number;
  lastPulseLevel?: number;
  board?: number[];
  mergeFlash?: number[];
  spawnFlash?: number[];
  moves?: number;
  bestTile?: number;
  ticksRemaining?: number;
  snake?: Array<{ x: number; y: number }>;
  snakeDirection?: 'up' | 'down' | 'left' | 'right';
  food?: { x: number; y: number };
  bonusFood?: { x: number; y: number } | null;
  bonusFoodTicks?: number;
  stepIntervalTicks?: number;
  orbsEaten?: number;
}
export interface AuthorityOutcome { instanceId: string; matchId?:string; status: string; reason: string; winnerUserId: string | null; yourScore?: number }
