// Lightweight Web Audio API Connect 4 sound synthesizer (zero external audio files).
// Safely guarded for Node / headless test environments.

const MUTE_STORAGE_KEY = "fugluck_connect4_muted";

class Connect4SoundSynthesizer {
  private ctx: AudioContext | null = null;
  private muted = false;

  constructor() {
    this.muted = this.readStoredMute();
  }

  private readStoredMute(): boolean {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage?.getItem(MUTE_STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  }

  private getAudioContext(): AudioContext | null {
    if (this.muted || typeof window === "undefined") return null;
    const AudioCtx =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!this.ctx) {
      try {
        this.ctx = new AudioCtx();
      } catch {
        return null;
      }
    }
    if (this.ctx.state === "suspended") {
      void this.ctx.resume().catch(() => undefined);
    }
    return this.ctx;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (typeof window !== "undefined") {
      try {
        window.localStorage?.setItem(MUTE_STORAGE_KEY, muted ? "1" : "0");
      } catch {
        // Ignore storage errors
      }
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  /** Crisp plastic disc clack with subtle bounce tap */
  public playDrop(): void {
    const ctx = this.getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const taps = [
      { offset: 0, fStart: 320, fEnd: 135, vol: 0.22, dur: 0.055 },
      { offset: 0.052, fStart: 270, fEnd: 150, vol: 0.11, dur: 0.04 },
    ];

    for (const tap of taps) {
      const start = now + tap.offset;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(tap.fStart, start);
      osc.frequency.exponentialRampToValueAtTime(tap.fEnd, start + tap.dur);

      gain.gain.setValueAtTime(tap.vol, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + tap.dur);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + tap.dur + 0.01);
    }
  }

  /** Bright ascending 4-in-a-row win fanfare */
  public playWin(): void {
    const ctx = this.getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      const start = now + i * 0.075;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.16, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.3);
    });
  }

  /** Clean neutral draw chime */
  public playDraw(): void {
    const ctx = this.getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const notes = [440, 554.37];
    notes.forEach((freq, i) => {
      const start = now + i * 0.09;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.14, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.26);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.28);
    });
  }
}

export const connect4Sounds = new Connect4SoundSynthesizer();
