// Fixed-timestep accumulator loop, shared by every game module. The reason
// this exists: gameplay code should only ever see a constant dt (never real
// frame-to-frame timing), because a constant dt is what makes a recorded
// (seed, inputLog) replayable to an identical result later — variable dt
// bakes this session's frame jitter into the simulation itself.
export const FIXED_TIMESTEP_SEC = 1 / 60;
export function createFixedTimestepLoop(options) {
    const stepSec = options.stepSec ?? FIXED_TIMESTEP_SEC;
    const maxStepsPerFrame = options.maxStepsPerFrame ?? 5;
    const now = options.now ?? (() => performance.now());
    const raf = options.raf ?? ((cb) => requestAnimationFrame(cb));
    const caf = options.caf ?? ((handle) => cancelAnimationFrame(handle));
    let running = false;
    let rafId = null;
    let lastTimeMs = 0;
    let accumulator = 0;
    let tick = 0;
    function frame(nowMs) {
        if (!running)
            return;
        const rawDtSec = (nowMs - lastTimeMs) / 1000;
        lastTimeMs = nowMs;
        const dtSec = Math.min(rawDtSec, maxStepsPerFrame * stepSec);
        accumulator += dtSec;
        let steps = 0;
        while (running && accumulator >= stepSec && steps < maxStepsPerFrame) {
            options.update(tick);
            tick++;
            accumulator -= stepSec;
            steps++;
        }
        if (running) {
            options.render();
            rafId = raf(frame);
        }
    }
    return {
        start() {
            if (running)
                return;
            running = true;
            lastTimeMs = now();
            accumulator = 0;
            rafId = raf(frame);
        },
        stop() {
            running = false;
            if (rafId !== null)
                caf(rafId);
            rafId = null;
        },
        get running() {
            return running;
        },
        get tick() {
            return tick;
        },
    };
}
