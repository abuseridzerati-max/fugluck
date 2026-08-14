import { createFixedTimestepLoop, FIXED_TIMESTEP_SEC, VIRTUAL_VIEWPORT, } from "@arcadeclash/shared";
import { CyberHopperEngine } from "./engine";
const COUNTDOWN_STEPS = ["3", "2", "1", "GO!"];
const COUNTDOWN_STEP_MS = 700;
export class CyberHopperModule extends EventTarget {
    root = null;
    canvas = null;
    ctx = null;
    hud = null;
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
    forfeitConfirmTimeoutId = null;
    input = {
        hopUp: false,
        hopDown: false,
        hopLeft: false,
        hopRight: false,
    };
    logInput(action) {
        if (!this.fixedLoop)
            return;
        this.inputLog.push({ tick: this.fixedLoop.tick, action, wallMs: performance.now() - this.runStartTime });
    }
    handleKeyDown = (e) => {
        if (e.code === "ArrowUp" || e.code === "KeyW" || e.code === "Space") {
            e.preventDefault();
            this.input.hopUp = true;
            this.logInput("hopUp");
        }
        else if (e.code === "ArrowDown" || e.code === "KeyS") {
            e.preventDefault();
            this.input.hopDown = true;
            this.logInput("hopDown");
        }
        else if (e.code === "ArrowLeft" || e.code === "KeyA") {
            e.preventDefault();
            this.input.hopLeft = true;
            this.logInput("hopLeft");
        }
        else if (e.code === "ArrowRight" || e.code === "KeyD") {
            e.preventDefault();
            this.input.hopRight = true;
            this.logInput("hopRight");
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
    init(container, mode, _opponentSocket, seed) {
        this.seed = seed;
        this.mode = mode;
        this.engine = new CyberHopperEngine(this.seed);
        this.root = document.createElement("div");
        this.root.className = "cyber-hopper-root";
        this.root.style.cssText =
            "position:relative;width:100%;height:100%;background:#060913;overflow:hidden;user-select:none;";
        this.canvas = document.createElement("canvas");
        this.canvas.width = VIRTUAL_VIEWPORT.width;
        this.canvas.height = VIRTUAL_VIEWPORT.height;
        this.canvas.style.cssText = "display:block;width:100%;height:100%;object-fit:contain;";
        this.ctx = this.canvas.getContext("2d");
        this.hud = document.createElement("div");
        this.hud.style.cssText =
            "position:absolute;top:16px;left:24px;font-family:monospace;font-size:24px;font-weight:bold;color:#00ff66;pointer-events:none;";
        this.hud.textContent = "SCORE 0";
        this.countdownEl = document.createElement("div");
        this.countdownEl.style.cssText =
            "position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-family:sans-serif;font-size:72px;font-weight:bold;color:#00ff66;display:none;pointer-events:none;";
        this.pauseOverlay = document.createElement("div");
        this.pauseOverlay.style.cssText =
            "position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(6,9,19,0.85);display:none;flex-direction:column;align-items:center;justify-content:center;gap:16px;color:#fff;";
        this.pauseOverlay.innerHTML = `<h2 style="font-size:36px;margin:0;">GAME PAUSED</h2>`;
        const resumeBtn = document.createElement("button");
        resumeBtn.textContent = "RESUME";
        resumeBtn.style.cssText =
            "padding:12px 24px;font-size:18px;font-weight:bold;background:#00ff66;color:#060913;border:none;border-radius:6px;cursor:pointer;";
        resumeBtn.onclick = () => this.resume();
        this.pauseOverlay.appendChild(resumeBtn);
        this.root.appendChild(this.canvas);
        this.root.appendChild(this.hud);
        this.root.appendChild(this.countdownEl);
        this.root.appendChild(this.pauseOverlay);
        container.appendChild(this.root);
        this.resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                if (width > 0 && height > 0) {
                    this.lastResizeWidth = width;
                    this.lastResizeHeight = height;
                    this.engine.resize(width, height);
                }
            }
        });
        this.resizeObserver.observe(container);
        window.addEventListener("keydown", this.handleKeyDown);
        document.addEventListener("visibilitychange", this.handleVisibilityChange);
        this.lastResizeWidth = VIRTUAL_VIEWPORT.width;
        this.lastResizeHeight = VIRTUAL_VIEWPORT.height;
        this.engine.resize(VIRTUAL_VIEWPORT.width, VIRTUAL_VIEWPORT.height);
    }
    start() {
        if (this.state !== "idle")
            return;
        this.state = "countdown";
        this.inputLog = [];
        this.runStartTime = performance.now();
        this.runCountdown(0);
    }
    runCountdown(stepIndex) {
        if (!this.countdownEl)
            return;
        if (stepIndex >= COUNTDOWN_STEPS.length) {
            this.countdownEl.style.display = "none";
            this.beginRun();
            return;
        }
        this.countdownEl.style.display = "block";
        this.countdownEl.textContent = COUNTDOWN_STEPS[stepIndex];
        this.countdownTimeoutId = setTimeout(() => this.runCountdown(stepIndex + 1), COUNTDOWN_STEP_MS);
    }
    beginRun() {
        this.state = "running";
        this.runStartTime = performance.now();
        this.engine.reset();
        this.fixedLoop = createFixedTimestepLoop({
            update: (tick) => this.tick(tick),
            render: () => this.render(),
        });
        this.fixedLoop.start();
    }
    tick(_tick) {
        const result = this.engine.update(FIXED_TIMESTEP_SEC, this.input);
        this.input.hopUp = false;
        this.input.hopDown = false;
        this.input.hopLeft = false;
        this.input.hopRight = false;
        if (result === "collision") {
            this.endRun("collision");
        }
    }
    render() {
        if (this.ctx)
            this.engine.render(this.ctx);
        if (this.hud)
            this.hud.textContent = `SCORE ${this.engine.score}`;
    }
    resume() {
        if (this.state !== "paused")
            return;
        this.state = "running";
        if (this.pauseOverlay)
            this.pauseOverlay.style.display = "none";
        this.fixedLoop?.start();
    }
    pause() {
        if (this.mode === "match")
            return;
        if (this.state !== "running")
            return;
        this.state = "paused";
        this.fixedLoop?.stop();
        if (this.pauseOverlay)
            this.pauseOverlay.style.display = "flex";
    }
    endRun(reason) {
        this.state = "ended";
        this.fixedLoop?.stop();
        if (this.pauseOverlay)
            this.pauseOverlay.style.display = "none";
        if (this.forfeitConfirmTimeoutId) {
            clearTimeout(this.forfeitConfirmTimeoutId);
            this.forfeitConfirmTimeoutId = null;
        }
        const payload = {
            score: this.engine.score,
            reason,
            durationMs: Math.round(performance.now() - this.runStartTime),
            seed: this.seed,
            inputLog: this.inputLog,
            viewport: { width: this.lastResizeWidth, height: this.lastResizeHeight },
        };
        this.dispatchEvent(new CustomEvent("gameOver", { detail: payload }));
    }
    destroy() {
        this.fixedLoop?.stop();
        this.fixedLoop = null;
        if (this.countdownTimeoutId !== null)
            clearTimeout(this.countdownTimeoutId);
        if (this.forfeitConfirmTimeoutId !== null)
            clearTimeout(this.forfeitConfirmTimeoutId);
        this.resizeObserver?.disconnect();
        window.removeEventListener("keydown", this.handleKeyDown);
        document.removeEventListener("visibilitychange", this.handleVisibilityChange);
        this.root?.remove();
    }
}
const createCyberHopperModule = () => new CyberHopperModule();
export default createCyberHopperModule;
