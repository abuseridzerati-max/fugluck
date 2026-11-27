// Exercise real module initialization, ResizeObserver callbacks and teardown.
// Engine-only tests cannot detect a host passing physical pixels into physics.
import { VIRTUAL_VIEWPORT } from '@fugluck/shared';
import { SpaceBlasterModule } from '../games/space-blaster';
import { SpaceBlasterEngine } from '../games/space-blaster/engine';
import { CyberHopperModule } from '../games/cyber-hopper';
import { CyberHopperEngine } from '../games/cyber-hopper/engine';
import { StackTowerModule } from '../games/stack-tower';
import { StackTowerEngine } from '../games/stack-tower/engine';
import { Blitz2048Module } from '../games/2048-blitz';
import { Blitz2048Engine } from '../games/2048-blitz/engine';
import { NeonSnakeModule } from '../games/neon-snake';
import { NeonSnakeEngine } from '../games/neon-snake/engine';
import { MinesweeperSprintModule } from '../games/minesweeper-sprint';
import { MinesweeperSprintEngine } from '../games/minesweeper-sprint/engine';
import { BrickBreakerModule } from '../games/brick-breaker';
import { BrickBreakerEngine } from '../games/brick-breaker/engine';
import { BlitzChessModule } from '../games/blitz-chess';
import { BlitzChessEngine } from '../games/blitz-chess/engine';
import { SpeedTriviaModule } from '../games/speed-trivia';
import { SpeedTriviaEngine } from '../games/speed-trivia/engine';

let passed = 0, failed = 0;
function check(label: string, ok: boolean) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`);
  ok ? passed++ : failed++;
}

class ElementFixture extends EventTarget {
  style = { cssText: '', display: '' };
  children: ElementFixture[] = [];
  parent: ElementFixture | null = null;
  listeners = new Map<string, Set<EventListenerOrEventListenerObject>>();
  width = 0; height = 0; textContent = ''; innerHTML = ''; className = '';
  constructor(readonly tagName = 'div') { super(); }
  appendChild(child: ElementFixture) { child.parent = this; this.children.push(child); return child; }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); }
  getContext() { return {}; }
  override addEventListener(type: string, listener: EventListenerOrEventListenerObject | null) {
    if (!listener) return;
    const set = this.listeners.get(type) ?? new Set(); set.add(listener); this.listeners.set(type, set);
    super.addEventListener(type, listener);
  }
  override removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null) {
    if (!listener) return;
    this.listeners.get(type)?.delete(listener); super.removeEventListener(type, listener);
  }
  get listenerCount() { return [...this.listeners.values()].reduce((sum, set) => sum + set.size, 0); }
}

const originals = new Map<string, PropertyDescriptor | undefined>();
function replaceGlobal(name: string, value: unknown) {
  originals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
}
const windowFixture = new ElementFixture();
const documentFixture = Object.assign(new ElementFixture(), { hidden: false, createElement: (tag: string) => new ElementFixture(tag) });
const timers = new Map<number, unknown>();
let nextTimer = 0;
const observers: ObserverFixture[] = [];
class ObserverFixture {
  connected = false;
  constructor(readonly callback: ResizeObserverCallback) { observers.push(this); }
  observe() { this.connected = true; }
  disconnect() { this.connected = false; }
  resize(width: number, height: number) {
    if (this.connected) this.callback([{ contentRect: { width, height } } as ResizeObserverEntry], this as unknown as ResizeObserver);
  }
}

replaceGlobal('window', windowFixture);
replaceGlobal('document', documentFixture);
replaceGlobal('ResizeObserver', ObserverFixture);
replaceGlobal('setTimeout', (callback: unknown) => { const id = ++nextTimer; timers.set(id, callback); return id; });
replaceGlobal('clearTimeout', (id: number) => { timers.delete(id); });

try {
  for (const [name, Module, Engine] of [
    ['space-blaster', SpaceBlasterModule, SpaceBlasterEngine],
    ['cyber-hopper', CyberHopperModule, CyberHopperEngine],
    ['stack-tower', StackTowerModule, StackTowerEngine],
    ['2048-blitz', Blitz2048Module, Blitz2048Engine],
    ['neon-snake', NeonSnakeModule, NeonSnakeEngine],
    ['minesweeper-sprint', MinesweeperSprintModule, MinesweeperSprintEngine],
    ['brick-breaker', BrickBreakerModule, BrickBreakerEngine],
    ['blitz-chess', BlitzChessModule, BlitzChessEngine],
    ['speed-trivia', SpeedTriviaModule, SpeedTriviaEngine],
  ] as const) {
    const calls: number[][] = [];
    const prototype: { resize(width: number, height: number): void } = Engine.prototype;
    const originalResize = prototype.resize;
    prototype.resize = function(width: number, height: number) {
      calls.push([width, height]); originalResize.call(this, width, height);
    };
    const module = new Module();
    const container = new ElementFixture();
    try {
      module.init(container as unknown as HTMLElement, 'practice', null, 424242);
      const observer = observers.at(-1)!;
      const canvas = container.children[0].children.find(child => child.tagName === 'canvas')!;
      const canonical = () => calls.at(-1)?.[0] === VIRTUAL_VIEWPORT.width && calls.at(-1)?.[1] === VIRTUAL_VIEWPORT.height;
      check(`${name}: initialization uses canonical physics coordinates`, canonical());
      observer.resize(375, 812);
      check(`${name}: mobile resize preserves canonical physics coordinates`, canonical());
      observer.resize(2560, 1080);
      check(`${name}: ultrawide resize preserves canonical physics coordinates`, canonical());
      const beforeHidden = calls.length; observer.resize(0, 0);
      check(`${name}: hidden container does not resize physics`, calls.length === beforeHidden);
      check(`${name}: canvas backing dimensions remain 1280x720`, canvas.width === 1280 && canvas.height === 720);
      check(`${name}: canvas preserves contained presentation`, canvas.style.cssText.includes('object-fit:contain'));
      module.start();
      check(`${name}: start schedules one countdown`, timers.size === 1);
      module.destroy();
      check(`${name}: destroy cancels countdown`, timers.size === 0);
      check(`${name}: destroy removes input listeners`, windowFixture.listenerCount === 0 && documentFixture.listenerCount === 0 && canvas.listenerCount === 0);
      check(`${name}: destroy removes DOM and disconnects observer`, container.children.length === 0 && !observer.connected);
    } finally {
      module.destroy(); prototype.resize = originalResize;
    }
  }
} finally {
  for (const [name, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
}
console.log(`Game module lifecycle: ${passed} PASS, ${failed} FAIL`);
if (failed) process.exitCode = 1;
