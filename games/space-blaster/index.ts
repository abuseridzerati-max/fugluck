import {
  createFixedTimestepLoop,
  FIXED_TIMESTEP_SEC,
  VIRTUAL_VIEWPORT,
  type FixedTimestepLoop,
  type GameOverPayload,
  type GameMode,
  type GameModule,
  type GameModuleFactory,
} from "@fugluck/shared";
import { SpaceBlasterEngine, type SpaceBlasterInput } from "./engine";

const COUNTDOWN_STEPS = ["3", "2", "1", "GO!"];
const COUNTDOWN_STEP_MS = 700;

type ModuleState = "idle" | "countdown" | "running" | "paused" | "ended";
type TouchControl = "left" | "right" | "up" | "down" | "fire";

export class SpaceBlasterModule extends EventTarget implements GameModule {
  private root: HTMLDivElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private hud: HTMLDivElement | null = null;
  private countdownEl: HTMLDivElement | null = null;
  private pauseOverlay: HTMLDivElement | null = null;

  private engine!: SpaceBlasterEngine;
  private resizeObserver: ResizeObserver | null = null;

  private state: ModuleState = "idle";
  private fixedLoop: FixedTimestepLoop | null = null;
  private runStartTime = 0;
  private countdownTimeoutId: ReturnType<typeof setTimeout> | null = null;

  private seed = 0;
  private mode: GameMode = "practice";
  private forfeitConfirmTimeoutId: ReturnType<typeof setTimeout> | null = null;

  private input: SpaceBlasterInput = {
    moveLeft: false,
    moveRight: false,
    moveUp: false,
    moveDown: false,
    shootPressed: false,
  };
  private leftKeyDown = false;
  private rightKeyDown = false;
  private upKeyDown = false;
  private downKeyDown = false;
  private spaceKeyDown = false;
  private activeTouchPointers = new Map<number, TouchControl>();

  private syncInputFromSources() {
    let touchLeft = false;
    let touchRight = false;
    let touchUp = false;
    let touchDown = false;
    for (const control of this.activeTouchPointers.values()) {
      if (control === "left") touchLeft = true;
      else if (control === "right") touchRight = true;
      else if (control === "up") touchUp = true;
      else if (control === "down") touchDown = true;
    }
    this.input.moveLeft = this.leftKeyDown || touchLeft;
    this.input.moveRight = this.rightKeyDown || touchRight;
    this.input.moveUp = this.upKeyDown || touchUp;
    this.input.moveDown = this.downKeyDown || touchDown;
  }

  private hasTouchFireHeld(): boolean {
    for (const control of this.activeTouchPointers.values()) {
      if (control === "fire") return true;
    }
    return false;
  }

  private clearAllInputs = () => {
    this.leftKeyDown = false;
    this.rightKeyDown = false;
    this.upKeyDown = false;
    this.downKeyDown = false;
    this.spaceKeyDown = false;
    this.activeTouchPointers.clear();
    this.input.moveLeft = false;
    this.input.moveRight = false;
    this.input.moveUp = false;
    this.input.moveDown = false;
    this.input.shootPressed = false;
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
      if (!this.leftKeyDown) {
        this.leftKeyDown = true;
        this.syncInputFromSources();
      }
    } else if (e.code === "ArrowRight" || e.code === "KeyD") {
      e.preventDefault();
      if (!this.rightKeyDown) {
        this.rightKeyDown = true;
        this.syncInputFromSources();
      }
    } else if (e.code === "ArrowUp" || e.code === "KeyW") {
      e.preventDefault();
      if (!this.upKeyDown) {
        this.upKeyDown = true;
        this.syncInputFromSources();
      }
    } else if (e.code === "ArrowDown" || e.code === "KeyS") {
      e.preventDefault();
      if (!this.downKeyDown) {
        this.downKeyDown = true;
        this.syncInputFromSources();
      }
    } else if (e.code === "Space") {
      e.preventDefault();
      this.spaceKeyDown = true;
      this.input.shootPressed = true;
    }
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    if (e.code === "ArrowLeft" || e.code === "KeyA") {
      this.leftKeyDown = false;
      this.syncInputFromSources();
    } else if (e.code === "ArrowRight" || e.code === "KeyD") {
      this.rightKeyDown = false;
      this.syncInputFromSources();
    } else if (e.code === "ArrowUp" || e.code === "KeyW") {
      this.upKeyDown = false;
      this.syncInputFromSources();
    } else if (e.code === "ArrowDown" || e.code === "KeyS") {
      this.downKeyDown = false;
      this.syncInputFromSources();
    } else if (e.code === "Space") {
      this.spaceKeyDown = false;
    }
  };

  private handleVisibilityChange = () => {
    if (document.hidden) {
      this.clearAllInputs();
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

  private createTouchButton(label: string, ariaLabel: string, control: TouchControl, extraClass = ""): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `ac-touch-btn${extraClass ? ` ${extraClass}` : ""}`;
    btn.textContent = label;
    if (typeof btn.setAttribute === "function") {
      btn.setAttribute("aria-label", ariaLabel);
    }

    const release = (e: PointerEvent) => {
      if (this.activeTouchPointers.delete(e.pointerId)) {
        btn.classList?.remove("is-pressed");
        this.syncInputFromSources();
      }
    };

    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      try {
        btn.setPointerCapture?.(e.pointerId);
      } catch {
        // Ignore if pointer capture is unavailable
      }
      this.activeTouchPointers.set(e.pointerId, control);
      btn.classList?.add("is-pressed");
      this.syncInputFromSources();
      if (control === "fire") {
        this.input.shootPressed = true;
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
    this.engine = new SpaceBlasterEngine(this.seed);

    this.root = document.createElement("div");
    this.root.className = "space-blaster-root ac-game-surface";
    this.root.style.cssText =
      "position:relative;width:100%;height:100%;background:#090d16;overflow:hidden;display:flex;flex-direction:column;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;overscroll-behavior:none;";

    this.canvas = document.createElement("canvas");
    this.canvas.style.cssText =
      "display:block;flex:1;min-height:0;width:100%;height:100%;object-fit:contain;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;overscroll-behavior:none;";
    this.ctx = this.canvas.getContext("2d");

    this.hud = document.createElement("div");
    this.hud.style.cssText =
      "position:absolute;top:12px;left:16px;font-family:monospace;font-size:20px;font-weight:bold;color:#00f0ff;pointer-events:none;";
    this.hud.textContent = "SCORE 0";

    this.countdownEl = document.createElement("div");
    this.countdownEl.style.cssText =
      "position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-family:sans-serif;font-size:72px;font-weight:bold;color:#00f0ff;display:none;pointer-events:none;";

    this.pauseOverlay = document.createElement("div");
    this.pauseOverlay.style.cssText =
      "position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(9,13,22,0.85);display:none;flex-direction:column;align-items:center;justify-content:center;gap:16px;color:#fff;z-index:10;";
    this.pauseOverlay.innerHTML = `<h2 style="font-size:36px;margin:0;">GAME PAUSED</h2>`;
    const resumeBtn = document.createElement("button");
    resumeBtn.textContent = "RESUME";
    resumeBtn.style.cssText =
      "padding:12px 24px;min-height:44px;font-size:18px;font-weight:bold;background:#00f0ff;color:#090d16;border:none;border-radius:6px;cursor:pointer;";
    resumeBtn.onclick = () => this.resume();
    this.pauseOverlay.appendChild(resumeBtn);

    const touchDock = document.createElement("div");
    touchDock.className = "ac-touch-dock ac-touch-dock--shooter";
    if (typeof touchDock.setAttribute === "function") {
      touchDock.setAttribute("aria-label", "Touch controls");
    }

    const dpad = document.createElement("div");
    dpad.className = "ac-touch-dpad";
    const upBtn = this.createTouchButton("▲", "Move Up", "up", "ac-touch-dpad__up");
    const leftBtn = this.createTouchButton("◀", "Move Left", "left", "ac-touch-dpad__left");
    const rightBtn = this.createTouchButton("▶", "Move Right", "right", "ac-touch-dpad__right");
    const downBtn = this.createTouchButton("▼", "Move Down", "down", "ac-touch-dpad__down");
    dpad.appendChild(upBtn);
    dpad.appendChild(leftBtn);
    dpad.appendChild(rightBtn);
    dpad.appendChild(downBtn);

    const fireBtn = this.createTouchButton("FIRE", "Fire", "fire", "ac-touch-btn--fire");
    touchDock.appendChild(dpad);
    touchDock.appendChild(fireBtn);

    this.root.appendChild(this.canvas);
    this.root.appendChild(this.hud);
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
    window.addEventListener("blur", this.clearAllInputs);
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
    if (this.spaceKeyDown || this.hasTouchFireHeld()) {
      this.input.shootPressed = true;
    }
    const result = this.engine.update(FIXED_TIMESTEP_SEC, this.input);
    this.input.shootPressed = false;

    if (result === "collision") {
      this.endRun("collision");
    }
  }

  private render() {
    if (this.ctx) this.engine.render(this.ctx);
    if (this.hud) this.hud.textContent = `SCORE ${this.engine.score}`;
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
    if (this.forfeitConfirmTimeoutId) {
      clearTimeout(this.forfeitConfirmTimeoutId);
      this.forfeitConfirmTimeoutId = null;
    }

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
    if (this.countdownTimeoutId !== null) clearTimeout(this.countdownTimeoutId);
    if (this.forfeitConfirmTimeoutId !== null) clearTimeout(this.forfeitConfirmTimeoutId);
    this.clearAllInputs();
    this.resizeObserver?.disconnect();
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    window.removeEventListener("blur", this.clearAllInputs);
    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    this.root?.remove();
  }
}

const createSpaceBlasterModule: GameModuleFactory = () => new SpaceBlasterModule();
export default createSpaceBlasterModule;
