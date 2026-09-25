// Deterministic engine and fixed-step scheduler checks. Reproducibility is a
// gameplay property only; this suite does not retain or reconstruct input histories.
import { createFixedTimestepLoop, FIXED_TIMESTEP_SEC } from "@fugluck/shared";
import { RunnerEngine } from "../games/neon-runner/engine.ts";
import { DashEngine } from "../games/pixel-ninja-dash/engine.ts";
import { SkyDodgeEngine } from "../games/sky-dodge/engine.ts";
import { SpaceBlasterEngine } from "../games/space-blaster/engine.ts";
import { CyberHopperEngine } from "../games/cyber-hopper/engine.ts";
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
sameSeedRun("sky-dodge", seed => {
  const e = new SkyDodgeEngine(seed); e.resize(1280, 720); e.reset();
  for (let i=0; i<TICKS; i++) e.update(FIXED_TIMESTEP_SEC, { moveLeft:false, moveRight:false, boostPressed:false });
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
for (const [name, Engine] of [["space-blaster",SpaceBlasterEngine],["cyber-hopper",CyberHopperEngine]] as const) {
  const run=(seed:number)=>{const e=new Engine(seed);for(let i=0;i<5400;i++)e.update(FIXED_TIMESTEP_SEC,{});return JSON.stringify(e);};
  check(`${name}: 90-second fixed-step state is repeatable`,run(SEED)===run(SEED));
}
console.log(`\n${failures===0?"ALL PASS":`${failures} FAILURE(S)`}`);
process.exit(failures===0?0:1);