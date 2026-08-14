import { DashEngine } from "./engine";
export const pixelNinjaDashReplayAdapter = {
    createEngine(seed) {
        return new DashEngine(seed);
    },
    resize(engine, width, height) {
        engine.resize(width, height);
    },
    createInitialInput() {
        return { dashPressed: false };
    },
    applyAction(input, action) {
        if (action === "dashPressed")
            input.dashPressed = true;
        else
            return false;
        return true;
    },
    clearPulses(input) {
        input.dashPressed = false;
    },
    update(engine, dtSec, input) {
        return engine.update(dtSec, input);
    },
    isTerminal(result) {
        return result === "finished" || result === "timeout";
    },
};
