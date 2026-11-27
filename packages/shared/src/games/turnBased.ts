/**
 * Reusable turn-based board game contract shared across turn-based modules
 * (Blitz Chess, Connect 4, Checkers, Gomoku, Naval Strike, etc.).
 */

export type TurnBasedPlayer = "player" | "opponent";

export type TurnBasedOutcome =
  | "in_progress"
  | "player_win"
  | "opponent_win"
  | "draw"
  | "player_flag"
  | "opponent_flag";

export interface TurnBasedMove<TPayload = unknown> {
  /** Side that executed the move. */
  player: TurnBasedPlayer;
  /** 1-based ply / turn counter. */
  turnNumber: number;
  /** Game-specific move coordinates or descriptor (e.g. `{ from, to }`, `{ col }`). */
  payload: TPayload;
  /** Optional human-readable notation (e.g. SAN "Nf3", "e4"). */
  notation?: string;
  /** Optional deterministic simulation tick at which the move occurred. */
  tick?: number;
}

export interface TurnBasedGameState<TBoard = unknown, TMovePayload = unknown> {
  /** Serializable representation of the current board (e.g. FEN, flat grid, piece list). */
  board: TBoard;
  /** Side whose turn it currently is. */
  activePlayer: TurnBasedPlayer;
  /** Current ply / turn counter. */
  turnNumber: number;
  /** Match status or terminal outcome. */
  outcome: TurnBasedOutcome;
  /** Remaining clock ticks (at 60Hz) for the player. */
  playerClockTicks: number;
  /** Remaining clock ticks (at 60Hz) for the opponent. */
  opponentClockTicks: number;
  /** Most recent move applied, or null before the first move. */
  lastMove: TurnBasedMove<TMovePayload> | null;
  /** Optional check / threat indicator for chess-like games. */
  inCheck?: boolean;
}

export interface TurnBasedEngine<TBoard = unknown, TMovePayload = unknown> {
  getTurnState(): TurnBasedGameState<TBoard, TMovePayload>;
  applyMove(payload: TMovePayload): boolean;
}
