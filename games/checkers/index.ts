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
import { clientPointToCheckersIndex, clientPointToVirtual } from "./constants";
import { CheckersEngine, checkersSounds, ownerOfPiece, type CheckersInput } from "./engine";

const COUNTDOWN_STEPS = ["3", "2", "1", "GO!"];
const COUNTDOWN_STEP_MS = 700;

type ModuleState = "idle" | "countdown" | "running" | "paused" | "ended";

export class CheckersModule extends EventTarget implements GameModule {
  private root: HTMLDivElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private countdownEl: HTMLDivElement | null = null;
  private pauseOverlay: HTMLDivElement | null = null;
  private muteBtn: HTMLButtonElement | null = null;

  private engine!: CheckersEngine;
  private resizeObserver: ResizeObserver | null = null;

  private state: ModuleState = "idle";
  private fixedLoop: FixedTimestepLoop | null = null;
  private runStartTime = 0;
  private countdownTimeoutId: ReturnType<typeof setTimeout> | null = null;

  private seed = 0;
  private mode: GameMode = "practice";

  private pendingInput: CheckersInput = {};
  private pointerDrag: {
    pointerId: number;
    from: number;
    piece: number;
    startX: number;
    startY: number;
    wasAlreadySelected: boolean;
    dragging: boolean;
  } | null = null;

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
    if (e.code === "Escape") {
      this.engine.selectedIdx = null;
      this.engine.legalTargets = [];
      this.engine.dragState = null;
      this.pointerDrag = null;
    }
  };

  private handlePointerDown = (e: PointerEvent) => {
    if (this.state !== "running" || !this.canvas) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    if (typeof this.canvas.getBoundingClientRect !== "function") return;

    const idx = clientPointToCheckersIndex(
      this.canvas.getBoundingClientRect(),
      e.clientX,
      e.clientY,
      this.engine.orientation,
    );
    if (idx === null) {
      this.engine.selectedIdx = null;
      this.engine.legalTargets = [];
      return;
    }

    if (this.engine.activePlayer !== 1) return;

    if (this.engine.selectedIdx !== null && this.engine.legalTargets.includes(idx)) {
      this.pendingInput = { from: this.engine.selectedIdx, to: idx };
      this.engine.selectedIdx = null;
      this.engine.legalTargets = [];
      this.engine.dragState = null;
      this.pointerDrag = null;
      return;
    }

    const piece = this.engine.board[idx] ?? 0;
    const targets = this.engine.getLegalTargetsForIndex(idx, 1);
    if (targets.length > 0 && ownerOfPiece(piece) === 1) {
      const wasAlreadySelected = this.engine.selectedIdx === idx;
      this.engine.selectedIdx = idx;
      this.engine.legalTargets = targets;
      this.pointerDrag = {
        pointerId: e.pointerId,
        from: idx,
        piece,
        startX: e.clientX,
        startY: e.clientY,
        wasAlreadySelected,
        dragging: false,
      };
      if (typeof this.canvas.setPointerCapture === "function") {
        try {
          this.canvas.setPointerCapture(e.pointerId);
        } catch {
          // Ignore capture errors
        }
      }
    } else {
      this.engine.selectedIdx = null;
      this.engine.legalTargets = [];
      this.engine.dragState = null;
      this.pointerDrag = null;
    }
  };

  private handlePointerMove = (e: PointerEvent) => {
    const drag = this.pointerDrag;
    if (!drag || drag.pointerId !== e.pointerId || !this.canvas) return;
    if (typeof this.canvas.getBoundingClientRect !== "function") return;
    if (!drag.dragging && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < 6) return;

    drag.dragging = true;
    const pt = clientPointToVirtual(this.canvas.getBoundingClientRect(), e.clientX, e.clientY);
    if (pt) {
      this.engine.dragState = {
        from: drag.from,
        piece: drag.piece,
        vx: pt.vx,
        vy: pt.vy,
      };
    }
  };

  private handlePointerUp = (e: PointerEvent) => {
    const drag = this.pointerDrag;
    if (!drag || drag.pointerId !== e.pointerId || !this.canvas) return;
    this.pointerDrag = null;

    if (typeof this.canvas.releasePointerCapture === "function") {
      try {
        this.canvas.releasePointerCapture(e.pointerId);
      } catch {
        // Ignore release errors
      }
    }

    const wasDragging = drag.dragging;
    this.engine.dragState = null;

    if (!wasDragging) {
      if (drag.wasAlreadySelected && this.engine.chainFromIdx === null) {
        this.engine.selectedIdx = null;
        this.engine.legalTargets = [];
      }
      return;
    }

    if (typeof this.canvas.getBoundingClientRect !== "function") return;
    const targetIdx = clientPointToCheckersIndex(
      this.canvas.getBoundingClientRect(),
      e.clientX,
      e.clientY,
      this.engine.orientation,
    );
    if (targetIdx !== null && targetIdx !== drag.from && this.engine.legalTargets.includes(targetIdx)) {
      this.engine.skipNextAnimation = true;
      this.pendingInput = { from: drag.from, to: targetIdx };
      this.engine.selectedIdx = null;
      this.engine.legalTargets = [];
    }
  };

  private handlePointerCancel = () => {
    this.pointerDrag = null;
    this.engine.dragState = null;
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
    this.engine = new CheckersEngine(this.seed);

    this.root = document.createElement("div");
    this.root.className = "checkers-root ac-game-surface";
    this.root.style.cssText =
      "position:relative;width:100%;height:100%;background:#070a10;overflow:hidden;display:flex;flex-direction:column;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;overscroll-behavior:none;";

    this.canvas = document.createElement("canvas");
    this.canvas.style.cssText =
      "display:block;flex:1;min-height:0;width:100%;height:100%;object-fit:contain;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;overscroll-behavior:none;cursor:pointer;";
    this.ctx = this.canvas.getContext("2d");

    this.canvas.addEventListener("pointerdown", this.handlePointerDown);
    this.canvas.addEventListener("pointermove", this.handlePointerMove);
    this.canvas.addEventListener("pointerup", this.handlePointerUp);
    this.canvas.addEventListener("pointercancel", this.handlePointerCancel);

    this.muteBtn = document.createElement("button");
    this.muteBtn.type = "button";
    const syncMuteLabel = () => {
      if (!this.muteBtn) return;
      const muted = checkersSounds.isMuted();
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
      checkersSounds.toggleMute();
      syncMuteLabel();
    };

    this.countdownEl = document.createElement("div");
    this.countdownEl.style.cssText =
      "position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-family:sans-serif;font-size:72px;font-weight:bold;color:#f59e0b;display:none;pointer-events:none;";

    this.pauseOverlay = document.createElement("div");
    this.pauseOverlay.style.cssText =
      "position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(7,10,16,0.85);display:none;flex-direction:column;align-items:center;justify-content:center;gap:16px;color:#fff;z-index:10;";
    this.pauseOverlay.innerHTML = `<h2 style="font-size:36px;margin:0;">GAME PAUSED</h2>`;
    const resumeBtn = document.createElement("button");
    resumeBtn.textContent = "RESUME";
    resumeBtn.style.cssText =
      "padding:12px 24px;min-height:44px;font-size:18px;font-weight:bold;background:#f59e0b;color:#070a10;border:none;border-radius:6px;cursor:pointer;";
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
    this.pointerDrag = null;
    this.resizeObserver?.disconnect();
    this.canvas?.removeEventListener("pointerdown", this.handlePointerDown);
    this.canvas?.removeEventListener("pointermove", this.handlePointerMove);
    this.canvas?.removeEventListener("pointerup", this.handlePointerUp);
    this.canvas?.removeEventListener("pointercancel", this.handlePointerCancel);
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("blur", this.clearInputs);
    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    this.root?.remove();
  }
}

const createCheckersModule: GameModuleFactory = () => new CheckersModule();
export default createCheckersModule;
