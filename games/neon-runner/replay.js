import { RunnerEngine } from "./engine";
export const neonRunnerReplayAdapter = {
    createEngine(seed) {
        return new RunnerEngine(seed);
    },
    resize(engine, width, height) {
        engine.resize(width, height);
    },
    createInitialInput() {
        return { jumpPressed: false, jumpReleased: false, slidePressed: false };
    },
    applyAction(input, action) {
        if (action === "jumpPressed")
            input.jumpPressed = true;
        else if (action === "jumpReleased")
            input.jumpReleased = true;
        else if (action === "slidePressed")
            input.slidePressed = true;
        else
            return false;
        return true;
    },
    clearPulses(input) {
        input.jumpPressed = false;
        input.jumpReleased = false;
        input.slidePressed = false;
    },
    update(engine, dtSec, input) {
        return engine.update(dtSec, input);
    },
    isTerminal(result) {
        return result === "collision";
    },
};
