/** RV-001 v1: current controls and current state only; no input history. */
export const AUTHORITY_VERSION = 'space-blaster-rv001-v1';
export const AUTHORITY_CAP_TICKS = 180 * 60;
export type AuthorityState = 'CREATED' | 'READY' | 'ACTIVE' | 'COMPLETED' | 'FORFEITED' | 'VOIDED' | 'EXPIRED';
export interface AuthorityBinding {
  sessionId: string; instanceId: string; matchId: string; gameId: string;
  version: string; nonce: string; epoch: number;
}
export interface AuthorityControls extends AuthorityBinding {
  seq: number; snapshot: number;
  left: boolean; right: boolean; up: boolean; down: boolean; fire: boolean;
}
export interface AuthoritySnapshot {
  seq: number; serverTime: number; startAt: number | null; deadline: number | null;
  state: AuthorityState; tickCount: number; score: number; gameOver: boolean;
  shipX: number; shipY: number;
  bullets: Array<{ id: number; x: number; y: number; active: boolean }>;
  asteroids: Array<{ id: number; x: number; y: number; vx: number; vy: number; radius: number; active: boolean }>;
}
export interface AuthorityOutcome { instanceId: string; status: string; reason: string; winnerUserId: string | null; yourScore?: number }
