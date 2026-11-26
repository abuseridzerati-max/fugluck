import type { AuthorityControls, AuthoritySnapshot } from "@fugluck/shared";

export interface ServerTieCandidate {
  userId: string;
  score: number;
  ticks: number;
}

/**
 * Standard server-authoritative game plugin contract.
 * Required for every game with `manifest.certified === true`.
 * Wraps deterministic game engines without altering their physics or math.
 */
export interface ServerGamePlugin<TState = unknown> {
  /** Must match `manifest.id` in `GAME_MANIFESTS`. */
  readonly gameId: string;
  /** Must match `manifest.authorityVersion` in `GAME_MANIFESTS`. */
  readonly authorityVersion: string;
  /** Allowed payload keys on `authority:controls` messages for this game. */
  readonly allowedControlKeys: readonly string[];
  /** Default reference entry fee (minor units) for standard tournament configs. */
  readonly defaultReferenceEntryMinor: number;

  /** Instantiate fresh deterministic engine + control state for a player session. */
  createState(seed: number): TState;
  /** Validate and buffer a live client control packet against rate/seq/stale guards. */
  applyInput(state: TState, controls: AuthorityControls, now: number, snapshotTimes: Map<number, number>): void;
  /** Advance simulation by one fixed timestep (`dtSec`). Returns `true` if the run collided/ended. */
  tick(state: TState, dtSec: number, now: number): boolean;
  /** Current authoritative score for this player state. */
  getScore(state: TState): number;
  /** Current authoritative tick count for this player state. */
  getTickCount(state: TState): number;
  /** Returns `true` when the player run is finished (collision/gameOver or tick cap reached). */
  isFinished(state: TState, capTicks: number): boolean;
  /** Populate game-specific fields onto the outgoing `AuthoritySnapshot`. */
  serializeSnapshot(state: TState, base: AuthoritySnapshot): AuthoritySnapshot;
  /** Reset held/buffered controls (pass `resetSession = true` on new socket bind). */
  resetControls(state: TState, resetSession?: boolean): void;
  /** Timestamp (performance.now) of last accepted input for disconnect health checks. */
  getLastInputAt(state: TState): number;
  /** Resolve equal-score tie between two players; return winning `userId` or `null` for a draw. */
  resolveTie(playerA: ServerTieCandidate, playerB: ServerTieCandidate): string | null;
}
