// Deterministic engine and fixed-step scheduler checks. Reproducibility is a
// gameplay property only; this suite does not retain or reconstruct input histories.
import { createFixedTimestepLoop, FIXED_TIMESTEP_SEC } from "@fugluck/shared";
import { RunnerEngine } from "../games/neon-runner/engine.ts";
import { DashEngine } from "../games/pixel-ninja-dash/engine.ts";
import { SpaceBlasterEngine } from "../games/space-blaster/engine.ts";
import { CyberHopperEngine } from "../games/cyber-hopper/engine.ts";
import { StackTowerEngine } from "../games/stack-tower/engine.ts";
import { Blitz2048Engine } from "../games/2048-blitz/engine.ts";
import { NeonSnakeEngine } from "../games/neon-snake/engine.ts";
import { MinesweeperSprintEngine } from "../games/minesweeper-sprint/engine.ts";
import { BrickBreakerEngine } from "../games/brick-breaker/engine.ts";
import { BlitzChessEngine } from "../games/blitz-chess/engine.ts";
import { SpeedTriviaEngine } from "../games/speed-trivia/engine.ts";
import { TFSprintEngine } from "../games/tf-sprint/engine.ts";

const SEED = 424242;
const TICKS = 600;
let failures = 0;
function check(label: string, pass: boolean) {
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${label}`);
  if (!pass) failures++;
}
function sameSeedRun(name: string, run: (seed: number) => unknown) {
  const a = JSON.stringify(run(SEED));
  const b = JSON.stringify(run(SEED));
  check(`${name}: same seed and live updates produce identical engine state`, a === b);
}

console.log("Deterministic gameplay checks (no input recording or replay)\n");

sameSeedRun("neon-runner", seed => {
  const e = new RunnerEngine(seed); e.resize(1280, 720); e.reset();
  for (let i=0; i<TICKS; i++) e.update(FIXED_TIMESTEP_SEC, { jumpPressed:false, jumpReleased:false, slidePressed:false });
  return e;
});
sameSeedRun("pixel-ninja-dash", seed => {
  const e = new DashEngine(seed); e.resize(1280, 720); e.reset();
  for (let i=0; i<TICKS; i++) e.update(FIXED_TIMESTEP_SEC, { dashPressed:false });
  return e;
});
sameSeedRun("space-blaster", seed => {
  const e = new SpaceBlasterEngine(seed);
  for (let i=0; i<TICKS; i++) e.update(FIXED_TIMESTEP_SEC, { moveLeft:false, moveRight:false, moveUp:false, moveDown:false, shootPressed:false });
  return e;
});
sameSeedRun("cyber-hopper", seed => {
  const e = new CyberHopperEngine(seed);
  for (let i=0; i<TICKS; i++) e.update(FIXED_TIMESTEP_SEC, {});
  return e;
});
sameSeedRun("stack-tower", seed => {
  const e = new StackTowerEngine(seed);
  for (let i=0; i<TICKS; i++) {
    const top = e.tower[e.tower.length - 1];
    const aligned = Math.abs(e.activeBlock.x - top.x) <= 4;
    e.update(FIXED_TIMESTEP_SEC, { drop: i > 0 && i % 45 === 0 && aligned });
  }
  return e;
});
sameSeedRun("2048-blitz", seed => {
  const e = new Blitz2048Engine(seed);
  for (let i=0; i<TICKS; i++) {
    const step = i % 16;
    e.update(FIXED_TIMESTEP_SEC, {
      moveLeft: step === 0,
      moveDown: step === 4,
      moveRight: step === 8,
      moveUp: step === 12,
    });
  }
  return e;
});
sameSeedRun("neon-snake", seed => {
  const e = new NeonSnakeEngine(seed);
  for (let i=0; i<TICKS; i++) {
    const phase = i % 120;
    e.update(FIXED_TIMESTEP_SEC, {
      moveDown: phase === 30,
      moveLeft: phase === 60,
      moveUp: phase === 90,
      moveRight: phase === 0,
    });
  }
  return e;
});
sameSeedRun("minesweeper-sprint", seed => {
  const e = new MinesweeperSprintEngine(seed);
  for (let i=0; i<TICKS; i++) {
    if (i > 0 && i % 40 === 0 && !e.gameOver) {
      const safe = e.findFirstHiddenSafeCell();
      e.update(FIXED_TIMESTEP_SEC, safe ? { action: "reveal", col: safe.col, row: safe.row } : {});
    } else {
      e.update(FIXED_TIMESTEP_SEC, {});
    }
  }
  return e;
});
sameSeedRun("brick-breaker", seed => {
  const e = new BrickBreakerEngine(seed);
  for (let i=0; i<TICKS; i++) {
    e.update(FIXED_TIMESTEP_SEC, {
      left: e.ballX < e.paddleX - 8,
      right: e.ballX > e.paddleX + 8,
    });
  }
  return e;
});
sameSeedRun("blitz-chess", seed => {
  const e = new BlitzChessEngine(seed);
  for (let i=0; i<TICKS; i++) {
    if (i > 0 && i % 60 === 0 && !e.gameOver && e.getActiveTurn() === "w") {
      const m = e.getFirstLegalWhiteMove();
      e.update(FIXED_TIMESTEP_SEC, m ? { moveFrom: m.from, moveTo: m.to } : {});
    } else {
      e.update(FIXED_TIMESTEP_SEC, {});
    }
  }
  return e.getTurnState();
});
sameSeedRun("speed-trivia", seed => {
  const e = new SpeedTriviaEngine(seed);
  for (let i=0; i<TICKS; i++) e.update(FIXED_TIMESTEP_SEC, {});
  return e;
});
sameSeedRun("true-false-sprint", seed => {
  const e = new TFSprintEngine(seed);
  for (let i=0; i<TICKS; i++) e.update(FIXED_TIMESTEP_SEC, {});
  return e;
});

console.log("\nFixed-step scheduler boundaries\n");
function runClock(deltas: number[], ticks: number) {
  let now=0, pending: ((at:number)=>void)|null=null, count=0;
  const loop=createFixedTimestepLoop({update:()=>{count++; if(count>=ticks) loop.stop();},render:()=>{},now:()=>now,raf:cb=>{pending=cb;return 0;},caf:()=>{pending=null;}});
  loop.start(); let i=0;
  while(pending){now+=deltas[i++%deltas.length];const cb=pending;pending=null;cb(now);}
  return {count,tick:loop.tick};
}
const target=300;
check("smooth fixed-step clock runs exactly 300 updates", runClock([1000/60],target).count===target);
check("jittery clock with a 400ms stall runs the same bounded 300 updates", runClock([16,50,8,400,16,33,9,41],target).count===target);
let now=0, frame:((at:number)=>void)|null=null;
const bounded=createFixedTimestepLoop({update:()=>{},render:()=>{},now:()=>now,raf:cb=>{frame=cb;return 0;},caf:()=>{frame=null;}});
bounded.start();now+=5000;frame?.(now);
check("single 5s frame stall is bounded to five catch-up ticks", bounded.tick<=5);bounded.stop();

console.log("\nLong-run seeded engine determinism\n");
for (const [name, Engine] of [["space-blaster",SpaceBlasterEngine],["cyber-hopper",CyberHopperEngine],["stack-tower",StackTowerEngine],["2048-blitz",Blitz2048Engine],["neon-snake",NeonSnakeEngine],["minesweeper-sprint",MinesweeperSprintEngine],["brick-breaker",BrickBreakerEngine],["blitz-chess",BlitzChessEngine]] as const) {
  const run=(seed:number)=>{const e=new Engine(seed);for(let i=0;i<5400;i++)e.update(FIXED_TIMESTEP_SEC,{});return JSON.stringify(e);};
  check(`${name}: 90-second fixed-step state is repeatable`,run(SEED)===run(SEED));
}
console.log(`\n${failures===0?"ALL PASS":`${failures} FAILURE(S)`}`);
process.exit(failures===0?0:1);