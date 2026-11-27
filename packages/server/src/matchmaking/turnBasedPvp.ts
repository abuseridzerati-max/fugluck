import type {
  TurnMatchEndReason,
  TurnMatchEndedPayload,
  TurnMatchMovePayload,
  TurnMatchResignPayload,
  TurnMatchSeat,
  TurnMatchStatePayload,
} from "@fugluck/shared";
import { Chess } from "@fugluck/games/blitz-chess/engine";
import { findDropRow, findWinningCells, isBoardFull } from "@fugluck/games/connect-4/engine";
import { BOARD_CELLS, COLS } from "@fugluck/games/connect-4/constants";
import {
  applyCheckersMovePure,
  createInitialCheckersBoard,
  evaluateCheckersTerminal,
} from "@fugluck/games/checkers/engine";
import type { MatchmakingSocket } from "./socketAuth";
import { logger } from "../utils/safeLogger";

export interface TurnBasedPvpAdapter<TState = unknown, TMove = Record<string, unknown>> {
  readonly gameId: string;
  readonly initialClockMs: number;
  createInitialState(seed: number): TState;
  getActiveTurn(state: TState): TurnMatchSeat;
  getTurnNumber(state: TState): number;
  applyMove(
    state: TState,
    seat: TurnMatchSeat,
    move: TMove,
  ):
    | { ok: true; state: TState; ended?: { winnerSeat: TurnMatchSeat | null; reason: TurnMatchEndReason } }
    | { ok: false; code: string; message: string };
  serializeState(state: TState): {
    boardState: Record<string, unknown>;
    lastMove: Record<string, unknown> | null;
    inCheck?: boolean;
  };
}

type BlitzChessPvpState = {
  chess: Chess;
  turnNumber: number;
  lastMoveFrom: string | null;
  lastMoveTo: string | null;
  lastMoveSan: string | null;
  capturedByWhite: string[];
  capturedByBlack: string[];
};

const VALID_PROMOTIONS = new Set(["q", "r", "b", "n"]);

export const blitzChessPvpAdapter: TurnBasedPvpAdapter<BlitzChessPvpState, Record<string, unknown>> = {
  gameId: "blitz-chess",
  initialClockMs: 180_000, // 3+0 Blitz
  createInitialState(): BlitzChessPvpState {
    return {
      chess: new Chess(),
      turnNumber: 0,
      lastMoveFrom: null,
      lastMoveTo: null,
      lastMoveSan: null,
      capturedByWhite: [],
      capturedByBlack: [],
    };
  },
  getActiveTurn(state): TurnMatchSeat {
    return state.chess.turn() === "w" ? "p1" : "p2";
  },
  getTurnNumber(state): number {
    return state.turnNumber;
  },
  applyMove(state, seat, rawMove) {
    const expectedColor = seat === "p1" ? "w" : "b";
    if (state.chess.turn() !== expectedColor) {
      return { ok: false, code: "NOT_YOUR_TURN", message: "Wait for your opponent to move." };
    }

    const from = typeof rawMove.from === "string" ? rawMove.from.trim().toLowerCase() : "";
    const to = typeof rawMove.to === "string" ? rawMove.to.trim().toLowerCase() : "";
    const rawPromo = typeof rawMove.promotion === "string" ? rawMove.promotion.trim().toLowerCase() : "q";
    const promotion = VALID_PROMOTIONS.has(rawPromo) ? rawPromo : "q";

    if (!from || !to) {
      return { ok: false, code: "INVALID_MOVE", message: "Move requires from and to squares." };
    }

    let executed;
    try {
      executed = state.chess.move({ from, to, promotion });
    } catch {
      return { ok: false, code: "ILLEGAL_MOVE", message: "Illegal chess move." };
    }
    if (!executed) {
      return { ok: false, code: "ILLEGAL_MOVE", message: "Illegal chess move." };
    }

    state.turnNumber += 1;
    state.lastMoveFrom = executed.from;
    state.lastMoveTo = executed.to;
    state.lastMoveSan = executed.san;
    if (executed.captured) {
      if (executed.color === "w") state.capturedByWhite.push(executed.captured);
      else state.capturedByBlack.push(executed.captured);
    }

    if (state.chess.isCheckmate()) {
      return { ok: true, state, ended: { winnerSeat: seat, reason: "checkmate" } };
    }
    if (state.chess.isStalemate()) {
      return { ok: true, state, ended: { winnerSeat: null, reason: "stalemate" } };
    }
    if (
      state.chess.isDraw() ||
      state.chess.isThreefoldRepetition() ||
      state.chess.isInsufficientMaterial()
    ) {
      return { ok: true, state, ended: { winnerSeat: null, reason: "draw" } };
    }

    return { ok: true, state };
  },
  serializeState(state) {
    return {
      boardState: {
        fen: state.chess.fen(),
        capturedByWhite: [...state.capturedByWhite],
        capturedByBlack: [...state.capturedByBlack],
      },
      lastMove:
        state.lastMoveFrom && state.lastMoveTo
          ? {
              from: state.lastMoveFrom,
              to: state.lastMoveTo,
              san: state.lastMoveSan,
            }
          : null,
      inCheck: state.chess.inCheck(),
    };
  },
};

type Connect4PvpState = {
  board: number[];
  activePlayer: 1 | 2;
  turnNumber: number;
  lastMoveCol: number | null;
  lastMoveRow: number | null;
  winningCells: number[];
};

export const connect4PvpAdapter: TurnBasedPvpAdapter<Connect4PvpState, Record<string, unknown>> = {
  gameId: "connect-4",
  initialClockMs: 60_000, // 60s Blitz per player
  createInitialState(): Connect4PvpState {
    return {
      board: new Array<number>(BOARD_CELLS).fill(0),
      activePlayer: 1,
      turnNumber: 0,
      lastMoveCol: null,
      lastMoveRow: null,
      winningCells: [],
    };
  },
  getActiveTurn(state): TurnMatchSeat {
    return state.activePlayer === 1 ? "p1" : "p2";
  },
  getTurnNumber(state): number {
    return state.turnNumber;
  },
  applyMove(state, seat, rawMove) {
    const expectedPlayer: 1 | 2 = seat === "p1" ? 1 : 2;
    if (state.activePlayer !== expectedPlayer) {
      return { ok: false, code: "NOT_YOUR_TURN", message: "Wait for your opponent to drop a disc." };
    }

    const col = typeof rawMove.col === "number" ? rawMove.col : Number.NaN;
    if (!Number.isInteger(col) || col < 0 || col >= COLS) {
      return { ok: false, code: "INVALID_COLUMN", message: "Column must be between 0 and 6." };
    }

    const row = findDropRow(state.board, col);
    if (row < 0) {
      return { ok: false, code: "COLUMN_FULL", message: "That column is already full." };
    }

    state.board[row * COLS + col] = expectedPlayer;
    state.turnNumber += 1;
    state.lastMoveCol = col;
    state.lastMoveRow = row;

    const winCells = findWinningCells(state.board, expectedPlayer);
    if (winCells) {
      state.winningCells = winCells;
      return { ok: true, state, ended: { winnerSeat: seat, reason: "win" } };
    }

    if (isBoardFull(state.board)) {
      return { ok: true, state, ended: { winnerSeat: null, reason: "draw" } };
    }

    state.activePlayer = expectedPlayer === 1 ? 2 : 1;
    return { ok: true, state };
  },
  serializeState(state) {
    return {
      boardState: {
        board: [...state.board],
        activePlayer: state.activePlayer,
        winningCells: [...state.winningCells],
      },
      lastMove:
        state.lastMoveCol !== null && state.lastMoveRow !== null
          ? { col: state.lastMoveCol, row: state.lastMoveRow }
          : null,
    };
  },
};

type CheckersPvpState = {
  board: number[];
  activePlayer: 1 | 2;
  chainFromIdx: number | null;
  quietHalfMoves: number;
  turnNumber: number;
  lastMoveFrom: number | null;
  lastMoveTo: number | null;
};

export const checkersPvpAdapter: TurnBasedPvpAdapter<CheckersPvpState, Record<string, unknown>> = {
  gameId: "checkers",
  initialClockMs: 180_000, // 3+0 Blitz per player
  createInitialState(): CheckersPvpState {
    return {
      board: createInitialCheckersBoard(),
      activePlayer: 1,
      chainFromIdx: null,
      quietHalfMoves: 0,
      turnNumber: 0,
      lastMoveFrom: null,
      lastMoveTo: null,
    };
  },
  getActiveTurn(state): TurnMatchSeat {
    return state.activePlayer === 1 ? "p1" : "p2";
  },
  getTurnNumber(state): number {
    return state.turnNumber;
  },
  applyMove(state, seat, rawMove) {
    const expectedPlayer: 1 | 2 = seat === "p1" ? 1 : 2;
    if (state.activePlayer !== expectedPlayer) {
      return { ok: false, code: "NOT_YOUR_TURN", message: "Wait for your opponent to move." };
    }

    const from = typeof rawMove.from === "number" ? rawMove.from : Number.NaN;
    const to = typeof rawMove.to === "number" ? rawMove.to : Number.NaN;
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || from >= 64 || to < 0 || to >= 64) {
      return { ok: false, code: "INVALID_MOVE", message: "Move requires valid board indices." };
    }

    const res = applyCheckersMovePure(state.board, expectedPlayer, state.chainFromIdx, from, to);
    if (!res.ok) return res;

    state.turnNumber += 1;
    state.lastMoveFrom = from;
    state.lastMoveTo = to;
    state.quietHalfMoves = res.captured || res.crowned ? 0 : state.quietHalfMoves + 1;
    state.activePlayer = res.nextPlayer;
    state.chainFromIdx = res.nextChainFromIdx;

    const terminal = evaluateCheckersTerminal(
      state.board,
      state.activePlayer,
      state.chainFromIdx,
      state.quietHalfMoves,
    );
    if (terminal.ended) {
      const winnerSeat: TurnMatchSeat | null =
        terminal.winner === 1 ? "p1" : terminal.winner === 2 ? "p2" : null;
      return { ok: true, state, ended: { winnerSeat, reason: terminal.reason } };
    }

    return { ok: true, state };
  },
  serializeState(state) {
    return {
      boardState: {
        board: [...state.board],
        activePlayer: state.activePlayer,
        chainFromIdx: state.chainFromIdx,
        quietHalfMoves: state.quietHalfMoves,
      },
      lastMove:
        state.lastMoveFrom !== null && state.lastMoveTo !== null
          ? { from: state.lastMoveFrom, to: state.lastMoveTo }
          : null,
    };
  },
};

type PvpSeatPlayer = {
  userId: string;
  username: string;
  socket: MatchmakingSocket;
};

type TurnBasedPvpSession = {
  matchId: string;
  gameId: string;
  adapter: TurnBasedPvpAdapter<any, any>;
  state: unknown;
  p1: PvpSeatPlayer;
  p2: PvpSeatPlayer;
  p1ClockMs: number;
  p2ClockMs: number;
  clockStartedAtMs: number;
  lastClockUpdateMs: number;
  ended: boolean;
  tickInterval: ReturnType<typeof setInterval>;
  onComplete: (winnerSeat: TurnMatchSeat | null, reason: TurnMatchEndReason) => void | Promise<void>;
};

const START_GRACE_MS = 3_000;
const CLOCK_TICK_INTERVAL_MS = 250;

export class TurnBasedPvpRuntime {
  private readonly adapters = new Map<string, TurnBasedPvpAdapter<any, any>>();
  private readonly sessions = new Map<string, TurnBasedPvpSession>();

  constructor(
    initialAdapters: TurnBasedPvpAdapter<any, any>[] = [
      blitzChessPvpAdapter,
      connect4PvpAdapter,
      checkersPvpAdapter,
    ],
  ) {
    for (const adapter of initialAdapters) {
      this.registerAdapter(adapter);
    }
  }

  public registerAdapter<TState, TMove>(adapter: TurnBasedPvpAdapter<TState, TMove>): void {
    this.adapters.set(adapter.gameId, adapter);
  }

  public isSupported(gameId: string): boolean {
    return this.adapters.has(gameId);
  }

  public startSession(params: {
    matchId: string;
    gameId: string;
    seed: number;
    p1: PvpSeatPlayer;
    p2: PvpSeatPlayer;
    onComplete: (winnerSeat: TurnMatchSeat | null, reason: TurnMatchEndReason) => void | Promise<void>;
  }): boolean {
    const adapter = this.adapters.get(params.gameId);
    if (!adapter) return false;

    this.cleanupSession(params.matchId);

    const now = Date.now();
    const state = adapter.createInitialState(params.seed);

    const tickInterval = setInterval(() => {
      this.tickSession(params.matchId);
    }, CLOCK_TICK_INTERVAL_MS);
    if (typeof tickInterval === "object" && tickInterval !== null && "unref" in tickInterval) {
      (tickInterval as { unref: () => void }).unref();
    }

    const session: TurnBasedPvpSession = {
      matchId: params.matchId,
      gameId: params.gameId,
      adapter,
      state,
      p1: { ...params.p1 },
      p2: { ...params.p2 },
      p1ClockMs: adapter.initialClockMs,
      p2ClockMs: adapter.initialClockMs,
      clockStartedAtMs: now + START_GRACE_MS,
      lastClockUpdateMs: now + START_GRACE_MS,
      ended: false,
      tickInterval,
      onComplete: params.onComplete,
    };

    this.sessions.set(params.matchId, session);
    this.broadcastState(session, now);
    logger.info(
      `[turn-pvp] Started session match=${params.matchId} game=${params.gameId} p1=${params.p1.username} p2=${params.p2.username}`,
    );
    return true;
  }

  public handleMove(socket: MatchmakingSocket, payload: TurnMatchMovePayload): void {
    if (!payload || typeof payload.matchId !== "string" || !payload.move || typeof payload.move !== "object") {
      return;
    }

    const session = this.sessions.get(payload.matchId);
    if (!session || session.ended) return;

    const seat = this.seatForSocket(session, socket);
    if (!seat) {
      socket.emit("turn_match:error", {
        matchId: payload.matchId,
        code: "NOT_A_PARTICIPANT",
        message: "You are not a participant in this match.",
      });
      return;
    }

    const now = Date.now();
    // If p1 moves during the initial 3s grace period, start clocks immediately.
    if (now < session.clockStartedAtMs) {
      session.clockStartedAtMs = now;
      session.lastClockUpdateMs = now;
    } else {
      this.deductElapsedClock(session, now);
    }

    const timedOutSeat = this.checkTimeout(session);
    if (timedOutSeat) {
      this.finishSession(session, timedOutSeat === "p1" ? "p2" : "p1", "timeout", now);
      return;
    }

    const activeTurn = session.adapter.getActiveTurn(session.state);
    if (activeTurn !== seat) {
      socket.emit("turn_match:error", {
        matchId: session.matchId,
        code: "NOT_YOUR_TURN",
        message: "It is currently your opponent's turn.",
      });
      return;
    }

    const result = session.adapter.applyMove(session.state, seat, payload.move);
    if (!result.ok) {
      socket.emit("turn_match:error", {
        matchId: session.matchId,
        code: result.code,
        message: result.message,
      });
      return;
    }

    session.state = result.state;
    session.lastClockUpdateMs = now;

    if (result.ended) {
      this.finishSession(session, result.ended.winnerSeat, result.ended.reason, now);
      return;
    }

    this.broadcastState(session, now);
  }

  public handleResign(socket: MatchmakingSocket, payload: TurnMatchResignPayload): void {
    if (!payload || typeof payload.matchId !== "string") return;
    const session = this.sessions.get(payload.matchId);
    if (!session || session.ended) return;

    const seat = this.seatForSocket(session, socket);
    if (!seat) return;

    const now = Date.now();
    this.deductElapsedClock(session, now);
    const winnerSeat: TurnMatchSeat = seat === "p1" ? "p2" : "p1";
    this.finishSession(session, winnerSeat, "resignation", now);
  }

  public handleSync(socket: MatchmakingSocket, payload: { matchId?: unknown }): void {
    if (!payload || typeof payload.matchId !== "string") return;
    const session = this.sessions.get(payload.matchId);
    if (!session) return;

    const seat = this.seatForSocket(session, socket);
    if (!seat) return;

    const now = Date.now();
    this.deductElapsedClock(session, now);
    if (socket.connected) {
      socket.emit("turn_match:state", this.buildStatePayload(session, seat, now));
    }
  }

  public rebindSocket(matchId: string, userId: string, newSocket: MatchmakingSocket): void {
    const session = this.sessions.get(matchId);
    if (!session) return;

    let seat: TurnMatchSeat | null = null;
    if (session.p1.userId === userId) {
      session.p1.socket = newSocket;
      seat = "p1";
    } else if (session.p2.userId === userId) {
      session.p2.socket = newSocket;
      seat = "p2";
    }

    if (seat && newSocket.connected) {
      const now = Date.now();
      this.deductElapsedClock(session, now);
      newSocket.emit("turn_match:state", this.buildStatePayload(session, seat, now));
    }
  }

  public cleanupSession(matchId: string): void {
    const session = this.sessions.get(matchId);
    if (!session) return;
    clearInterval(session.tickInterval);
    session.ended = true;
    this.sessions.delete(matchId);
  }

  public close(): void {
    for (const matchId of Array.from(this.sessions.keys())) {
      this.cleanupSession(matchId);
    }
  }

  private seatForSocket(session: TurnBasedPvpSession, socket: MatchmakingSocket): TurnMatchSeat | null {
    if (session.p1.socket === socket || session.p1.userId === socket.data.userId) return "p1";
    if (session.p2.socket === socket || session.p2.userId === socket.data.userId) return "p2";
    return null;
  }

  private deductElapsedClock(session: TurnBasedPvpSession, now: number): void {
    if (session.ended || now <= session.lastClockUpdateMs || now < session.clockStartedAtMs) return;
    const elapsed = now - session.lastClockUpdateMs;
    const activeTurn = session.adapter.getActiveTurn(session.state);
    if (activeTurn === "p1") {
      session.p1ClockMs = Math.max(0, session.p1ClockMs - elapsed);
    } else {
      session.p2ClockMs = Math.max(0, session.p2ClockMs - elapsed);
    }
    session.lastClockUpdateMs = now;
  }

  private checkTimeout(session: TurnBasedPvpSession): TurnMatchSeat | null {
    if (session.p1ClockMs <= 0) return "p1";
    if (session.p2ClockMs <= 0) return "p2";
    return null;
  }

  private tickSession(matchId: string): void {
    const session = this.sessions.get(matchId);
    if (!session || session.ended) return;

    const now = Date.now();
    this.deductElapsedClock(session, now);

    const timedOutSeat = this.checkTimeout(session);
    if (timedOutSeat) {
      this.finishSession(session, timedOutSeat === "p1" ? "p2" : "p1", "timeout", now);
    }
  }

  private buildStatePayload(
    session: TurnBasedPvpSession,
    yourSeat: TurnMatchSeat,
    now: number,
  ): TurnMatchStatePayload {
    const serialized = session.adapter.serializeState(session.state);
    return {
      matchId: session.matchId,
      gameId: session.gameId,
      yourSeat,
      activeTurn: session.adapter.getActiveTurn(session.state),
      turnNumber: session.adapter.getTurnNumber(session.state),
      p1Username: session.p1.username,
      p2Username: session.p2.username,
      p1ClockMs: Math.round(session.p1ClockMs),
      p2ClockMs: Math.round(session.p2ClockMs),
      serverTimeMs: now,
      boardState: serialized.boardState,
      lastMove: serialized.lastMove,
      inCheck: serialized.inCheck,
      ended: session.ended,
    };
  }

  private broadcastState(session: TurnBasedPvpSession, now: number): void {
    if (session.p1.socket.connected) {
      session.p1.socket.emit("turn_match:state", this.buildStatePayload(session, "p1", now));
    }
    if (session.p2.socket.connected) {
      session.p2.socket.emit("turn_match:state", this.buildStatePayload(session, "p2", now));
    }
  }

  private finishSession(
    session: TurnBasedPvpSession,
    winnerSeat: TurnMatchSeat | null,
    reason: TurnMatchEndReason,
    now: number,
  ): void {
    if (session.ended) return;
    session.ended = true;
    clearInterval(session.tickInterval);
    this.sessions.delete(session.matchId);

    const p1State = this.buildStatePayload(session, "p1", now);
    const p2State = this.buildStatePayload(session, "p2", now);

    const p1Ended: TurnMatchEndedPayload = {
      matchId: session.matchId,
      gameId: session.gameId,
      winnerSeat,
      reason,
      finalState: p1State,
    };
    const p2Ended: TurnMatchEndedPayload = {
      matchId: session.matchId,
      gameId: session.gameId,
      winnerSeat,
      reason,
      finalState: p2State,
    };

    if (session.p1.socket.connected) {
      session.p1.socket.emit("turn_match:state", p1State);
      session.p1.socket.emit("turn_match:ended", p1Ended);
    }
    if (session.p2.socket.connected) {
      session.p2.socket.emit("turn_match:state", p2State);
      session.p2.socket.emit("turn_match:ended", p2Ended);
    }

    logger.info(
      `[turn-pvp] Ended session match=${session.matchId} game=${session.gameId} winnerSeat=${winnerSeat ?? "draw"} reason=${reason}`,
    );

    void Promise.resolve(session.onComplete(winnerSeat, reason)).catch((err) => {
      logger.error(`[turn-pvp] Failed to settle completed match ${session.matchId}:`, err);
    });
  }
}

export const turnBasedPvpRuntime = new TurnBasedPvpRuntime();
