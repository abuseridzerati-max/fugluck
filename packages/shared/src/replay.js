// Generic, game-agnostic replay driver — shared by scripts/determinism-check.ts
// (compares two replays of the same log to each other) and the server's score
// validator (compares one replay to a claimed score). Contains zero
// game-specific logic; each game supplies a ReplayAdapter (see
// games/<id>/replay.ts) that knows its own engine, its own action-string
// vocabulary, and its own terminal conditions. Adding a new game means
// writing that game's adapter and registering it in games/replayAdapters.ts —
// nothing in this file changes.
import { FIXED_TIMESTEP_SEC } from "./fixedTimestepLoop";
// A run this size or larger is rejected before replay ever starts — see
// packages/server/src/validation/scoreValidator.ts for the derivation
// (measured per-tick engine cost x this project's own 60-180s round-length
// design target). Exported from here, not the validator, so
// determinism-check.ts's hand-authored test logs can be checked against the
// same ceiling the real validator enforces, rather than a second copy of the
// number drifting out of sync.
export const MAX_REPLAY_TICKS = 21_600; // 360s at 60Hz — 2x this project's stated round-length upper bound
export const MAX_INPUT_LOG_ENTRIES = 10_000;
// Thrown by replayEngine when an inputLog entry's action string isn't one
// the adapter recognizes — a shape problem checkReplayRequestShape can't
// catch on its own (it has no adapter, so no vocabulary to check against).
// Callers should treat this the same as any other malformed-log rejection.
export class UnrecognizedActionError extends Error {
    action;
    tick;
    constructor(action, tick) {
        super(`Unrecognized action "${action}" at tick ${tick}`);
        this.name = "UnrecognizedActionError";
        this.action = action;
        this.tick = tick;
    }
}
// Pre-replay shape/size checks — cheap, run before any engine is constructed.
// Returns a rejection reason, or null if the log is worth attempting to
// replay at all.
export function checkReplayRequestShape(inputLog) {
    if (!Array.isArray(inputLog))
        return "input_log_not_array";
    if (inputLog.length > MAX_INPUT_LOG_ENTRIES)
        return "log_size_exceeded";
    let lastTick = -1;
    for (const entry of inputLog) {
        if (typeof entry !== "object" ||
            entry === null ||
            typeof entry.tick !== "number" ||
            !Number.isInteger(entry.tick) ||
            entry.tick < 0 ||
            typeof entry.action !== "string") {
            return "malformed_entry";
        }
        if (entry.tick > MAX_REPLAY_TICKS)
            return "tick_cap_exceeded";
        if (entry.tick < lastTick)
            return "unsorted_log";
        lastTick = entry.tick;
    }
    return null;
}
export function replayEngine(adapter, seed, inputLog, viewport, maxTicks = MAX_REPLAY_TICKS) {
    const engine = adapter.createEngine(seed);
    adapter.resize(engine, viewport.width, viewport.height);
    const engineWithReset = engine;
    engineWithReset.reset();
    const input = adapter.createInitialInput();
    let logIdx = 0;
    for (let tick = 0; tick < maxTicks; tick++) {
        while (logIdx < inputLog.length && inputLog[logIdx].tick === tick) {
            const recognized = adapter.applyAction(input, inputLog[logIdx].action);
            if (!recognized)
                throw new UnrecognizedActionError(inputLog[logIdx].action, tick);
            logIdx++;
        }
        const result = adapter.update(engine, FIXED_TIMESTEP_SEC, input);
        adapter.clearPulses(input);
        if (adapter.isTerminal(result)) {
            return { finalScore: engine.score, finalTick: tick, terminal: true, engine };
        }
    }
    return { finalScore: engine.score, finalTick: maxTicks, terminal: false, engine };
}
