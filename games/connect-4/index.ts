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
import { clientPointToColumn, COLS } from "./constants";
import { Connect4Engine, connect4Sounds, type Connect4Input } from "./engine";

const COUNTDOWN_STEPS = ["3", "2", "1", "GO!"];
const COUNTDOWN_STEP_MS = 700;

type ModuleState = "idle" | "countdown" | "running" | "paused" | "ended";

export class Connect4Module extends EventTarget implements GameModule {
  private root: HTMLDivElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private countdownEl: HTMLDivElement | null = null;
  private pauseOverlay: HTMLDivElement | null = null;
  private muteBtn: HTMLButtonElement | null = null;

  private engine!: Connect4Engine;
  private resizeObserver: ResizeObserver | null = null;

  private state: ModuleState = "idle";
  private fixedLoop: FixedTimestepLoop | null = null;
  private runStartTime = 0;
  private countdownTimeoutId: ReturnType<typeof setTimeout> | null = null;

  private seed = 0;
  private mode: GameMode = "practice";

  private pendingInput: Connect4Input = {};

  private clearInputs = () => {
    this.pendingInput = {};
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
    if (this.state !== "running") return;
    if (e.code === "ArrowLeft" || e.code === "KeyA") {
      e.preventDefault();
      this.engine.hoverCol = (this.engine.hoverCol + COLS - 1) % COLS;
    } else if (e.code === "ArrowRight" || e.code === "KeyD") {
      e.preventDefault();
      this.engine.hoverCol = (this.engine.hoverCol + 1) % COLS;
    } else if (e.code === "Space" || e.code === "Enter" || e.code === "ArrowDown") {
      e.preventDefault();
      if (this.engine.activePlayer === 1 && this.engine.canDropInColumn(this.engine.hoverCol)) {
        this.pendingInput = { dropCol: this.engine.hoverCol };
      }
    } else if (e.key >= "1" && e.key <= "7") {
      const col = Number(e.key) - 1;
      this.engine.hoverCol = col;
      if (this.engine.activePlayer === 1 && this.engine.canDropInColumn(col)) {
        this.pendingInput = { dropCol: col };
      }
    }
  };

  private handlePointerMove = (e: PointerEvent) => {
    if (this.state !== "running" || !this.canvas) return;
    if (typeof this.canvas.getBoundingClientRect !== "function") return;
    const col = clientPointToColumn(this.canvas.getBoundingClientRect(), e.clientX, e.clientY);
    if (col !== null) {
      this.engine.hoverCol = col;
    }
  };

  private handlePointerDown = (e: PointerEvent) => {
    if (this.state !== "running" || !this.canvas) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    if (typeof this.canvas.getBoundingClientRect !== "function") return;
    const col = clientPointToColumn(this.canvas.getBoundingClientRect(), e.clientX, e.clientY);
    if (col === null) return;
    this.engine.hoverCol = col;
    if (this.engine.activePlayer === 1 && this.engine.canDropInColumn(col)) {
      this.pendingInput = { dropCol: col };
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

  init(container: HTMLElement, mode: GameMode, _opponentSocket: WebSocket | null, seed: number): void {
    this.seed = seed;
    this.mode = mode;
    this.engine = new Connect4Engine(this.seed);

    this.root = document.createElement("div");
    this.root.className = "connect-4-root ac-game-surface";
    this.root.style.cssText =
      "position:relative;width:100%;height:100%;background:#070a10;overflow:hidden;display:flex;flex-direction:column;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;overscroll-behavior:none;";

    this.canvas = document.createElement("canvas");
    this.canvas.style.cssText =
      "display:block;flex:1;min-height:0;width:100%;height:100%;object-fit:contain;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;overscroll-behavior:none;cursor:pointer;";
    this.ctx = this.canvas.getContext("2d");

    this.canvas.addEventListener("pointermove", this.handlePointerMove);
    this.canvas.addEventListener("pointerdown", this.handlePointerDown);

    this.muteBtn = document.createElement("button");
    this.muteBtn.type = "button";
    const syncMuteLabel = () => {
      if (!this.muteBtn) return;
      const muted = connect4Sounds.isMuted();
      this.muteBtn.textContent = muted ? "🔇" : "🔊";
      this.muteBtn.title = muted ? "Unmute audio" : "Mute audio";
      if (typeof this.muteBtn.setAttribute === "function") {
        this.muteBtn.setAttribute("aria-label", muted ? "Unmute audio" : "Mute audio");
      }
    };
    syncMuteLabel();
    this.muteBtn.style.cssText =
      "position:absolute;top:12px;right:12px;z-index:6;width:36px;height:36px;border-radius:8px;border:1px solid rgba(255,255,255,0.16);background:rgba(30,29,26,0.9);color:#f5f5f4;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;";
    this.muteBtn.onclick = () => {
      connect4Sounds.toggleMute();
      syncMuteLabel();
    };

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

    this.root.appendChild(this.canvas);
    if (this.muteBtn) this.root.appendChild(this.muteBtn);
    this.root.appendChild(this.countdownEl);
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
    const input = this.pendingInput;
    this.pendingInput = {};
    const result = this.engine.update(FIXED_TIMESTEP_SEC, input);

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
    this.canvas?.removeEventListener("pointermove", this.handlePointerMove);
    this.canvas?.removeEventListener("pointerdown", this.handlePointerDown);
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("blur", this.clearInputs);
    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    this.root?.remove();
  }
}

const createConnect4Module: GameModuleFactory = () => new Connect4Module();
export default createConnect4Module;
