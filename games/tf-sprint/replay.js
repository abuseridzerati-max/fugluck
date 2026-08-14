import { TFSprintEngine } from "./engine";
export const tfSprintReplayAdapter = {
    createEngine(seed) {
        return new TFSprintEngine(seed);
    },
    resize(engine, width, height) {
        engine.resize(width, height);
    },
    createInitialInput() {
        return {};
    },
    applyAction(input, action) {
        if (action === "selectTrue") {
            input.selectTrue = true;
        }
        else if (action === "selectFalse") {
            input.selectFalse = true;
        }
        else {
            return false;
        }
        return true;
    },
    clearPulses(input) {
        input.selectTrue = undefined;
        input.selectFalse = undefined;
    },
    update(engine, dtSec, input) {
        return engine.update(dtSec, input);
    },
    isTerminal(result) {
        return result === "ended";
    },
};
