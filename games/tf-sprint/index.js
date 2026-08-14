import { createFixedTimestepLoop, FIXED_TIMESTEP_SEC, VIRTUAL_VIEWPORT, } from "@arcadeclash/shared";
import { TFSprintEngine } from "./engine";
import { renderTFSprint } from "./render";
const COUNTDOWN_STEPS = ["3", "2", "1", "TRUE OR FALSE!"];
const COUNTDOWN_STEP_MS = 700;
export class TFSprintModule extends EventTarget {
    root = null;
    canvas = null;
    ctx = null;
    countdownEl = null;
    pauseOverlay = null;
    engine;
    resizeObserver = null;
    state = "idle";
    fixedLoop = null;
    runStartTime = 0;
    countdownTimeoutId = null;
    seed = 0;
    inputLog = [];
    mode = "practice";
    lastResizeWidth = VIRTUAL_VIEWPORT.width;
    lastResizeHeight = VIRTUAL_VIEWPORT.height;
    input = {};
    logInput(action) {
        if (!this.fixedLoop)
            return;
        this.inputLog.push({ tick: this.fixedLoop.tick, action, wallMs: performance.now() - this.runStartTime });
    }
    handleKeyDown = (e) => {
        if (this.state === "ended" && e.code === "Space") {
            e.preventDefault();
            this.resetGame();
            this.startCountdown();
            return;
        }
        if (this.state !== "running")
            return;
        if (e.code === "KeyT" || e.code === "ArrowLeft" || e.code === "Digit1") {
            e.preventDefault();
            this.input.selectTrue = true;
            this.logInput("selectTrue");
        }
        else if (e.code === "KeyF" || e.code === "ArrowRight" || e.code === "Digit2") {
            e.preventDefault();
            this.input.selectFalse = true;
            this.logInput("selectFalse");
        }
    };
    handleCanvasClick = (e) => {
        if (this.state !== "running" || !this.canvas)
            return;
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = VIRTUAL_VIEWPORT.width / rect.width;
        const scaleY = VIRTUAL_VIEWPORT.height / rect.height;
        const clickX = (e.clientX - rect.left) * scaleX;
        const clickY = (e.clientY - rect.top) * scaleY;
        // Left Card [TRUE]: x = 50..610, y = 325..635
        if (clickX >= 50 && clickX <= 610 && clickY >= 325 && clickY <= 635) {
            this.input.selectTrue = true;
            this.logInput("selectTrue");
        }
        // Right Card [FALSE]: x = 670..1230, y = 325..635
        else if (clickX >= 670 && clickX <= 1230 && clickY >= 325 && clickY <= 635) {
            this.input.selectFalse = true;
            this.logInput("selectFalse");
        }
    };
    handleVisibilityChange = () => {
        if (document.hidden && this.state === "running") {
            if (this.mode === "match") {
                this.endRun("backgrounded");
                this.dispatchEvent(new CustomEvent("visibilityHidden", { detail: { matchForfeited: true } }));
            }
            else {
                this.pause();
            }
        }
    };
    mount(container) {
        container.innerHTML = "";
        this.root = document.createElement("div");
        this.root.style.cssText = "position:relative;width:100%;height:100%;background:#090d16;overflow:hidden;user-select:none;";
        const wrapper = document.createElement("div");
        wrapper.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;";
        this.canvas = document.createElement("canvas");
        this.canvas.width = VIRTUAL_VIEWPORT.width;
        this.canvas.height = VIRTUAL_VIEWPORT.height;
        this.canvas.style.cssText = "width:100%;height:100%;max-width:100%;max-height:100%;aspect-ratio:16/9;object-fit:contain;cursor:pointer;";
        this.ctx = this.canvas.getContext("2d");
        wrapper.appendChild(this.canvas);
        this.root.appendChild(wrapper);
        // Countdown Overlay
        this.countdownEl = document.createElement("div");
        this.countdownEl.style.cssText =
            "position:absolute;inset:0;display:none;align-items:center;justify-content:center;font-size:72px;font-weight:bold;color:#f8fafc;background:rgba(9,13,22,0.85);z-index:20;font-family:sans-serif;letter-spacing:2px;";
        this.root.appendChild(this.countdownEl);
        // Pause Overlay
        this.pauseOverlay = document.createElement("div");
        this.pauseOverlay.style.cssText =
            "position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;background:rgba(9,13,22,0.85);z-index:30;color:#f8fafc;font-family:sans-serif;";
        this.pauseOverlay.innerHTML =
            '<div style="font-size:48px;font-weight:bold;margin-bottom:16px;">PAUSED</div><div style="font-size:18px;color:#94a3b8;">Press RESUME or ESC to continue</div>';
        this.root.appendChild(this.pauseOverlay);
        container.appendChild(this.root);
        window.addEventListener("keydown", this.handleKeyDown);
        this.canvas.addEventListener("click", this.handleCanvasClick);
        document.addEventListener("visibilitychange", this.handleVisibilityChange);
        this.resizeObserver = new ResizeObserver(() => {
            if (this.root) {
                this.lastResizeWidth = this.root.clientWidth || VIRTUAL_VIEWPORT.width;
                this.lastResizeHeight = this.root.clientHeight || VIRTUAL_VIEWPORT.height;
                this.engine?.resize(VIRTUAL_VIEWPORT.width, VIRTUAL_VIEWPORT.height);
            }
        });
        this.resizeObserver.observe(this.root);
    }
    unmount() {
        this.destroy();
    }
    init(container, mode, _opponentSocket, seed) {
        this.mount(container);
        this.mode = mode;
        this.seed = seed;
        this.resetGame();
        this.renderCurrentFrame();
    }
    start() {
        this.startCountdown();
    }
    resetGame() {
        this.inputLog = [];
        this.input = {};
        this.engine = new TFSprintEngine(this.seed);
        this.state = "idle";
    }
    startCountdown() {
        if (this.state !== "idle")
            return;
        this.state = "countdown";
        if (this.countdownEl) {
            this.countdownEl.style.display = "flex";
        }
        let stepIndex = 0;
        const showStep = () => {
            if (stepIndex >= COUNTDOWN_STEPS.length) {
                if (this.countdownEl)
                    this.countdownEl.style.display = "none";
                this.run();
                return;
            }
            if (this.countdownEl) {
                this.countdownEl.textContent = COUNTDOWN_STEPS[stepIndex];
            }
            stepIndex++;
            this.countdownTimeoutId = setTimeout(showStep, COUNTDOWN_STEP_MS);
        };
        showStep();
    }
    run() {
        if (this.state === "running")
            return;
        this.state = "running";
        this.runStartTime = performance.now();
        this.fixedLoop = createFixedTimestepLoop({
            update: () => {
                const result = this.engine.update(FIXED_TIMESTEP_SEC, this.input);
                this.input.selectTrue = undefined;
                this.input.selectFalse = undefined;
                if (result === "ended") {
                    this.endRun("completed");
                }
            },
            render: () => {
                this.renderCurrentFrame();
            },
        });
        this.fixedLoop.start();
    }
    pause() {
        if (this.state !== "running")
            return;
        this.state = "paused";
        this.fixedLoop?.stop();
        if (this.pauseOverlay)
            this.pauseOverlay.style.display = "flex";
        this.dispatchEvent(new CustomEvent("stateChange", { detail: { state: "paused" } }));
    }
    resume() {
        if (this.state !== "paused")
            return;
        this.state = "running";
        if (this.pauseOverlay)
            this.pauseOverlay.style.display = "none";
        this.fixedLoop?.start();
        this.dispatchEvent(new CustomEvent("stateChange", { detail: { state: "running" } }));
    }
    destroy() {
        if (this.countdownTimeoutId)
            clearTimeout(this.countdownTimeoutId);
        this.fixedLoop?.stop();
        this.fixedLoop = null;
        window.removeEventListener("keydown", this.handleKeyDown);
        if (this.canvas)
            this.canvas.removeEventListener("click", this.handleCanvasClick);
        document.removeEventListener("visibilitychange", this.handleVisibilityChange);
        this.resizeObserver?.disconnect();
        this.resizeObserver = null;
        if (this.root && this.root.parentElement) {
            this.root.parentElement.innerHTML = "";
        }
        this.root = null;
        this.canvas = null;
        this.ctx = null;
        this.state = "idle";
    }
    renderCurrentFrame() {
        if (this.ctx && this.engine) {
            renderTFSprint(this.ctx, this.engine);
        }
    }
    endRun(reason) {
        if (this.state === "ended")
            return;
        this.state = "ended";
        this.fixedLoop?.stop();
        this.renderCurrentFrame();
        const payload = {
            score: this.engine.score,
            durationMs: Math.round(performance.now() - this.runStartTime),
            reason,
            seed: this.seed,
            inputLog: this.inputLog,
            viewport: { width: this.lastResizeWidth, height: this.lastResizeHeight },
        };
        this.dispatchEvent(new CustomEvent("gameOver", { detail: payload }));
    }
}
const factory = () => new TFSprintModule();
export default factory;
