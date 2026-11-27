import type { TurnBasedOutcome } from './games/turnBased';

/** RV-001 v1: current controls and current state only; no input history. */
export const AUTHORITY_VERSION = 'space-blaster-rv001-v1';
export const CYBER_HOPPER_AUTHORITY_VERSION = 'cyber-hopper-rv001-v1';
export const STACK_TOWER_AUTHORITY_VERSION = 'stack-tower-rv001-v1';
export const BLITZ_2048_AUTHORITY_VERSION = '2048-blitz-rv001-v1';
export const NEON_SNAKE_AUTHORITY_VERSION = 'neon-snake-rv001-v1';
export const MINESWEEPER_SPRINT_AUTHORITY_VERSION = 'minesweeper-sprint-rv001-v1';
export const BRICK_BREAKER_AUTHORITY_VERSION = 'brick-breaker-rv001-v1';
export const BLITZ_CHESS_AUTHORITY_VERSION = 'blitz-chess-rv001-v1';
export const CONNECT_4_AUTHORITY_VERSION = 'connect-4-rv001-v1';
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
  cellAction?: 'reveal' | 'flag'; cellCol?: number; cellRow?: number;
  moveFrom?: string; moveTo?: string; resign?: boolean;
  dropCol?: number;
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
  visibleBoard?: number[];
  safeCellsRemaining?: number;
  flagsPlaced?: number;
  detonatedIdx?: number;
  boardCleared?: boolean;
  paddleX?: number;
  ballX?: number;
  ballY?: number;
  ballVx?: number;
  ballVy?: number;
  bricks?: Array<{ id: number; x: number; y: number; width: number; height: number; hp: number; maxHp: number; color: string }>;
  lives?: number;
  wave?: number;
  combo?: number;
  launchTicks?: number;
  trail?: Array<{ x: number; y: number }>;
  chessFen?: string;
  whiteClockTicks?: number;
  blackClockTicks?: number;
  lastMoveFrom?: string | null;
  lastMoveTo?: string | null;
  lastMoveSan?: string | null;
  capturedByWhite?: string[];
  capturedByBlack?: string[];
  turnOutcome?: TurnBasedOutcome;
  inCheck?: boolean;
  turnNumber?: number;
  c4Board?: number[];
  c4ActivePlayer?: 1 | 2;
  p1ClockTicks?: number;
  p2ClockTicks?: number;
  lastMoveCol?: number | null;
  lastMoveRow?: number | null;
  winningCells?: number[];
}
export interface AuthorityOutcome { instanceId: string; matchId?:string; status: string; reason: string; winnerUserId: string | null; yourScore?: number }
