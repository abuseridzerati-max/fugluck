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
import { Blitz2048Engine, type Blitz2048Input } from "./engine";

const COUNTDOWN_STEPS = ["3", "2", "1", "GO!"];
const COUNTDOWN_STEP_MS = 700;
const SWIPE_THRESHOLD_PX = 24;

type ModuleState = "idle" | "countdown" | "running" | "paused" | "ended";
type MoveKey = "moveUp" | "moveDown" | "moveLeft" | "moveRight";

export class Blitz2048Module extends EventTarget implements GameModule {
  private root: HTMLDivElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private countdownEl: HTMLDivElement | null = null;
  private pauseOverlay: HTMLDivElement | null = null;

  private engine!: Blitz2048Engine;
  private resizeObserver: ResizeObserver | null = null;

  private state: ModuleState = "idle";
  private fixedLoop: FixedTimestepLoop | null = null;
  private runStartTime = 0;
  private countdownTimeoutId: ReturnType<typeof setTimeout> | null = null;

  private seed = 0;
  private mode: GameMode = "practice";

  private input: Blitz2048Input = {
    moveUp: false,
    moveDown: false,
    moveLeft: false,
    moveRight: false,
  };

  private swipePointerId: number | null = null;
  private swipeStartX = 0;
  private swipeStartY = 0;
  private swipeConsumed = false;

  private clearInputs = () => {
    this.input.moveUp = false;
    this.input.moveDown = false;
    this.input.moveLeft = false;
    this.input.moveRight = false;
    this.swipePointerId = null;
    this.swipeConsumed = false;
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
    if (this.state !== "running" || e.repeat) return;
    if (e.code === "ArrowUp" || e.code === "KeyW") {
      e.preventDefault();
      this.input.moveUp = true;
    } else if (e.code === "ArrowDown" || e.code === "KeyS") {
      e.preventDefault();
      this.input.moveDown = true;
    } else if (e.code === "ArrowLeft" || e.code === "KeyA") {
      e.preventDefault();
      this.input.moveLeft = true;
    } else if (e.code === "ArrowRight" || e.code === "KeyD") {
      e.preventDefault();
      this.input.moveRight = true;
    }
  };

  private handleCanvasPointerDown = (e: PointerEvent) => {
    if (this.state !== "running") return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    if (this.swipePointerId !== null) return;
    this.swipePointerId = e.pointerId;
    this.swipeStartX = e.clientX;
    this.swipeStartY = e.clientY;
    this.swipeConsumed = false;
    try {
      this.canvas?.setPointerCapture?.(e.pointerId);
    } catch {
      // Ignore if pointer capture is unavailable
    }
  };

  private handleCanvasPointerMove = (e: PointerEvent) => {
    if (this.state !== "running") return;
    if (this.swipePointerId !== e.pointerId || this.swipeConsumed) return;
    const dx = e.clientX - this.swipeStartX;
    const dy = e.clientY - this.swipeStartY;
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX && Math.abs(dy) < SWIPE_THRESHOLD_PX) return;
    this.swipeConsumed = true;
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0) this.input.moveRight = true;
      else this.input.moveLeft = true;
    } else if (dy > 0) {
      this.input.moveDown = true;
    } else {
      this.input.moveUp = true;
    }
  };

  private handleCanvasPointerEnd = (e: PointerEvent) => {
    if (this.swipePointerId === e.pointerId) {
      this.swipePointerId = null;
      this.swipeConsumed = false;
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

  private createDirButton(label: string, ariaLabel: string, dir: MoveKey, extraClass: string): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `ac-touch-btn ${extraClass}`;
    btn.textContent = label;
    if (typeof btn.setAttribute === "function") {
      btn.setAttribute("aria-label", ariaLabel);
    }

    const release = () => {
      btn.classList?.remove("is-pressed");
    };

    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      try {
        btn.setPointerCapture?.(e.pointerId);
      } catch {
        // Ignore if pointer capture is unavailable
      }
      btn.classList?.add("is-pressed");
      if (this.state === "running") {
        this.input[dir] = true;
      }
    });
    btn.addEventListener("pointerup", release);
    btn.addEventListener("pointercancel", release);
    btn.addEventListener("lostpointercapture", release);

    return btn;
  }

  init(container: HTMLElement, mode: GameMode, _opponentSocket: WebSocket | null, seed: number): void {
    this.seed = seed;
    this.mode = mode;
    this.engine = new Blitz2048Engine(this.seed);

    this.root = document.createElement("div");
    this.root.className = "blitz-2048-root ac-game-surface";
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
      "position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-family:sans-serif;font-size:72px;font-weight:bold;color:#38bdf8;display:none;pointer-events:none;";

    this.pauseOverlay = document.createElement("div");
    this.pauseOverlay.style.cssText =
      "position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(7,10,16,0.85);display:none;flex-direction:column;align-items:center;justify-content:center;gap:16px;color:#fff;z-index:10;";
    this.pauseOverlay.innerHTML = `<h2 style="font-size:36px;margin:0;">GAME PAUSED</h2>`;
    const resumeBtn = document.createElement("button");
    resumeBtn.textContent = "RESUME";
    resumeBtn.style.cssText =
      "padding:12px 24px;min-height:44px;font-size:18px;font-weight:bold;background:#38bdf8;color:#070a10;border:none;border-radius:6px;cursor:pointer;";
    resumeBtn.onclick = () => this.resume();
    this.pauseOverlay.appendChild(resumeBtn);

    const touchDock = document.createElement("div");
    touchDock.className = "ac-touch-dock ac-touch-dock--hopper";
    if (typeof touchDock.setAttribute === "function") {
      touchDock.setAttribute("aria-label", "Touch controls");
    }

    const dpad = document.createElement("div");
    dpad.className = "ac-touch-dpad ac-touch-dpad--hopper";
    dpad.appendChild(this.createDirButton("▲", "Slide Up", "moveUp", "ac-touch-dpad__up"));
    dpad.appendChild(this.createDirButton("◀", "Slide Left", "moveLeft", "ac-touch-dpad__left"));
    dpad.appendChild(this.createDirButton("▶", "Slide Right", "moveRight", "ac-touch-dpad__right"));
    dpad.appendChild(this.createDirButton("▼", "Slide Down", "moveDown", "ac-touch-dpad__down"));
    touchDock.appendChild(dpad);

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
    const result = this.engine.update(FIXED_TIMESTEP_SEC, this.input);
    this.input.moveUp = false;
    this.input.moveDown = false;
    this.input.moveLeft = false;
    this.input.moveRight = false;

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
    window.removeEventListener("blur", this.clearInputs);
    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    this.root?.remove();
  }
}

const createBlitz2048Module: GameModuleFactory = () => new Blitz2048Module();
export default createBlitz2048Module;
