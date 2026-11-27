import {
  createFixedTimestepLoop,
  FIXED_TIMESTEP_SEC,
  VIRTUAL_VIEWPORT,
  type FixedTimestepLoop,
  type GameMode,
  type GameModule,
  type GameModuleFactory,
  type GameOverPayload,
} from "@fugluck/shared";
import { BrickBreakerEngine, type BrickBreakerInput } from "./engine";

const COUNTDOWN_STEPS = ["3", "2", "1", "GO!"];
const COUNTDOWN_STEP_MS = 700;

type ModuleState = "idle" | "countdown" | "running" | "paused" | "ended";

export class BrickBreakerModule extends EventTarget implements GameModule {
  private root: HTMLDivElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private countdownEl: HTMLDivElement | null = null;
  private pauseOverlay: HTMLDivElement | null = null;

  private engine!: BrickBreakerEngine;
  private resizeObserver: ResizeObserver | null = null;

  private state: ModuleState = "idle";
  private fixedLoop: FixedTimestepLoop | null = null;
  private runStartTime = 0;
  private countdownTimeoutId: ReturnType<typeof setTimeout> | null = null;

  private seed = 0;
  private mode: GameMode = "practice";

  private keyInput: BrickBreakerInput = { left: false, right: false };
  private touchButtons: BrickBreakerInput = { left: false, right: false };
  private dragPointerId: number | null = null;
  private dragTargetX: number | null = null;

  private clearInputs = () => {
    this.keyInput.left = false;
    this.keyInput.right = false;
    this.touchButtons.left = false;
    this.touchButtons.right = false;
    this.dragPointerId = null;
    this.dragTargetX = null;
  };

  private syncCanvasResolution() {
    if (!this.canvas) return;
    const dpr = Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 2);
    const targetW = Math.round(VIRTUAL_VIEWPORT.width * dpr);
    const targetH = Math.round(VIRTUAL_VIEWPORT.height * dpr);
    if (this.canvas.width !== targetW || this.canvas.height !== targetH) {
      this.canvas.width = targetW;
      this.canvas.height = targetH;
    }
    this.engine.resize(VIRTUAL_VIEWPORT.width, VIRTUAL_VIEWPORT.height);
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    if (e.code === "ArrowLeft" || e.code === "KeyA") {
      e.preventDefault();
      this.keyInput.left = true;
    } else if (e.code === "ArrowRight" || e.code === "KeyD") {
      e.preventDefault();
      this.keyInput.right = true;
    }
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    if (e.code === "ArrowLeft" || e.code === "KeyA") {
      this.keyInput.left = false;
    } else if (e.code === "ArrowRight" || e.code === "KeyD") {
      this.keyInput.right = false;
    }
  };

  private clientXToVirtualX(clientX: number): number | null {
    if (!this.canvas || typeof this.canvas.getBoundingClientRect !== "function") return null;
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const targetRatio = VIRTUAL_VIEWPORT.width / VIRTUAL_VIEWPORT.height;
    const boxRatio = rect.width / rect.height;
    const drawW = boxRatio > targetRatio ? rect.height * targetRatio : rect.width;
    const offsetX = (rect.width - drawW) / 2;
    return ((clientX - rect.left - offsetX) / drawW) * VIRTUAL_VIEWPORT.width;
  }

  private handleCanvasPointerDown = (e: PointerEvent) => {
    if (this.state !== "running") return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    this.dragPointerId = e.pointerId;
    this.dragTargetX = this.clientXToVirtualX(e.clientX);
    try {
      this.canvas?.setPointerCapture?.(e.pointerId);
    } catch {
      // Ignore if pointer capture is unavailable
    }
  };

  private handleCanvasPointerMove = (e: PointerEvent) => {
    if (this.dragPointerId !== e.pointerId) return;
    this.dragTargetX = this.clientXToVirtualX(e.clientX);
  };

  private handleCanvasPointerEnd = (e: PointerEvent) => {
    if (this.dragPointerId === e.pointerId) {
      this.dragPointerId = null;
      this.dragTargetX = null;
    }
  };

  private handleVisibilityChange = () => {
    if (document.hidden) {
      this.clearInputs();
      if (this.state === "running") {
        if (this.mode === "match") {
          this.endRun("backgrounded");
          this.dispatchEvent(new CustomEvent("visibilityHidden", { detail: { matchForfeited: true } }));
        } else {
          this.pause();
        }
      }
    }
  };

  private createPaddleButton(label: string, ariaLabel: string, dir: "left" | "right"): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ac-touch-btn";
    btn.textContent = label;
    btn.style.cssText = "min-width:110px;min-height:52px;font-size:20px;";
    if (typeof btn.setAttribute === "function") {
      btn.setAttribute("aria-label", ariaLabel);
    }

    const release = () => {
      btn.classList?.remove("is-pressed");
      this.touchButtons[dir] = false;
    };

    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      try {
        btn.setPointerCapture?.(e.pointerId);
      } catch {
        // Ignore if pointer capture is unavailable
      }
      btn.classList?.add("is-pressed");
      this.touchButtons[dir] = true;
    });
    btn.addEventListener("pointerup", release);
    btn.addEventListener("pointercancel", release);
    btn.addEventListener("lostpointercapture", release);

    return btn;
  }

  init(container: HTMLElement, mode: GameMode, _opponentSocket: WebSocket | null, seed: number): void {
    this.seed = seed;
    this.mode = mode;
    this.engine = new BrickBreakerEngine(this.seed);

    this.root = document.createElement("div");
    this.root.className = "brick-breaker-root ac-game-surface";
    this.root.style.cssText =
      "position:relative;width:100%;height:100%;background:#070a10;overflow:hidden;display:flex;flex-direction:column;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;overscroll-behavior:none;";

    this.canvas = document.createElement("canvas");
    this.canvas.style.cssText =
      "display:block;flex:1;min-height:0;width:100%;height:100%;object-fit:contain;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;overscroll-behavior:none;";
    this.ctx = this.canvas.getContext("2d");

    this.canvas.addEventListener("pointerdown", this.handleCanvasPointerDown);
    this.canvas.addEventListener("pointermove", this.handleCanvasPointerMove);
    this.canvas.addEventListener("pointerup", this.handleCanvasPointerEnd);
    this.canvas.addEventListener("pointercancel", this.handleCanvasPointerEnd);
    this.canvas.addEventListener("lostpointercapture", this.handleCanvasPointerEnd);

    this.countdownEl = document.createElement("div");
    this.countdownEl.style.cssText =
      "position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-family:sans-serif;font-size:72px;font-weight:bold;color:#10b981;display:none;pointer-events:none;";

    this.pauseOverlay = document.createElement("div");
    this.pauseOverlay.style.cssText =
      "position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(7,10,16,0.85);display:none;flex-direction:column;align-items:center;justify-content:center;gap:16px;color:#fff;z-index:10;";
    this.pauseOverlay.innerHTML = `<h2 style="font-size:36px;margin:0;">GAME PAUSED</h2>`;
    const resumeBtn = document.createElement("button");
    resumeBtn.textContent = "RESUME";
    resumeBtn.style.cssText =
      "padding:12px 24px;min-height:44px;font-size:18px;font-weight:bold;background:#10b981;color:#070a10;border:none;border-radius:6px;cursor:pointer;";
    resumeBtn.onclick = () => this.resume();
    this.pauseOverlay.appendChild(resumeBtn);

    const touchDock = document.createElement("div");
    touchDock.className = "ac-touch-dock ac-touch-dock--hopper";
    if (typeof touchDock.setAttribute === "function") {
      touchDock.setAttribute("aria-label", "Touch controls");
    }
    touchDock.appendChild(this.createPaddleButton("◀", "Move Paddle Left", "left"));
    touchDock.appendChild(this.createPaddleButton("▶", "Move Paddle Right", "right"));

    this.root.appendChild(this.canvas);
    this.root.appendChild(this.countdownEl);
    this.root.appendChild(touchDock);
    this.root.appendChild(this.pauseOverlay);
    container.appendChild(this.root);

    this.syncCanvasResolution();
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          this.syncCanvasResolution();
        }
      }
    });
    this.resizeObserver.observe(container);

    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    window.addEventListener("blur", this.clearInputs);
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
  }

  start(): void {
    if (this.state !== "idle") return;
    this.state = "countdown";
    this.runStartTime = performance.now();
    this.runCountdown(0);
  }

  private runCountdown(stepIndex: number) {
    if (!this.countdownEl) return;
    if (stepIndex >= COUNTDOWN_STEPS.length) {
      this.countdownEl.style.display = "none";
      this.beginRun();
      return;
    }
    this.countdownEl.style.display = "block";
    this.countdownEl.textContent = COUNTDOWN_STEPS[stepIndex];
    this.countdownTimeoutId = setTimeout(() => this.runCountdown(stepIndex + 1), COUNTDOWN_STEP_MS);
  }

  private beginRun() {
    this.state = "running";
    this.runStartTime = performance.now();
    this.engine.reset();
    this.fixedLoop = createFixedTimestepLoop({
      update: (tick) => this.tick(tick),
      render: () => this.render(),
    });
    this.fixedLoop.start();
  }

  private tick(_tick: number) {
    let dragLeft = false;
    let dragRight = false;
    if (this.dragTargetX !== null) {
      const diff = this.dragTargetX - this.engine.paddleX;
      if (diff < -10) dragLeft = true;
      else if (diff > 10) dragRight = true;
    }

    const combined: BrickBreakerInput = {
      left: Boolean(this.keyInput.left || this.touchButtons.left || dragLeft),
      right: Boolean(this.keyInput.right || this.touchButtons.right || dragRight),
    };

    const result = this.engine.update(FIXED_TIMESTEP_SEC, combined);
    if (result === "collision") {
      this.endRun("collision");
    }
  }

  private render() {
    if (this.ctx) this.engine.render(this.ctx);
  }

  private resume() {
    if (this.state !== "paused") return;
    this.state = "running";
    if (this.pauseOverlay) this.pauseOverlay.style.display = "none";
    this.fixedLoop?.start();
  }

  pause(): void {
    if (this.mode === "match") return;
    if (this.state !== "running") return;
    this.state = "paused";
    this.fixedLoop?.stop();
    if (this.pauseOverlay) this.pauseOverlay.style.display = "flex";
  }

  private endRun(reason: "collision" | "quit" | "backgrounded") {
    this.state = "ended";
    this.fixedLoop?.stop();
    if (this.pauseOverlay) this.pauseOverlay.style.display = "none";

    const payload: GameOverPayload = {
      score: this.engine.score,
      reason,
      durationMs: Math.round(performance.now() - this.runStartTime),
      seed: this.seed,
    };
    this.dispatchEvent(new CustomEvent("gameOver", { detail: payload }));
  }

  destroy(): void {
    this.fixedLoop?.stop();
    this.fixedLoop = null;
    if (this.countdownTimeoutId !== null) {
      clearTimeout(this.countdownTimeoutId);
      this.countdownTimeoutId = null;
    }
    this.clearInputs();
    this.resizeObserver?.disconnect();
    this.canvas?.removeEventListener("pointerdown", this.handleCanvasPointerDown);
    this.canvas?.removeEventListener("pointermove", this.handleCanvasPointerMove);
    this.canvas?.removeEventListener("pointerup", this.handleCanvasPointerEnd);
    this.canvas?.removeEventListener("pointercancel", this.handleCanvasPointerEnd);
    this.canvas?.removeEventListener("lostpointercapture", this.handleCanvasPointerEnd);
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    window.removeEventListener("blur", this.clearInputs);
    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    this.root?.remove();
  }
}

const createBrickBreakerModule: GameModuleFactory = () => new BrickBreakerModule();
export default createBrickBreakerModule;
