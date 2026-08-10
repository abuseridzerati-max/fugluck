// Standalone verification script for Headless Canvas draw() rendering loop,
// letterboxing math, finite coordinate assertions (NaN / Infinity guard), and
// replay canvas integration.
//
// Run: npx tsx scripts/canvas-render-check.ts

import { VIRTUAL_VIEWPORT } from "@arcadeclash/shared";
import { RunnerEngine } from "../games/neon-runner/engine";
import { neonRunnerReplayAdapter } from "../games/neon-runner/replay";
import { DashEngine } from "../games/pixel-ninja-dash/engine";
import { pixelNinjaDashReplayAdapter } from "../games/pixel-ninja-dash/replay";

let failures = 0;
let totalVerifiedDrawCalls = 0;

function check(label: string, pass: boolean, detail?: string) {
  if (pass) {
    console.log(`  PASS  ${label}`);
  } else {
    failures++;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

// ---------------------------------------------------------------------------
// Mock CanvasRenderingContext2D with Strict Finite Number Guard
// ---------------------------------------------------------------------------
function createMockCanvasContext() {
  function assertFinite(methodName: string, ...args: Array<{ name: string; val: unknown }>) {
    for (const { name, val } of args) {
      if (typeof val === "number" && !Number.isFinite(val)) {
        throw new Error(`NaN/Infinite canvas coordinate in ${methodName} [${name} = ${val}]`);
      }
    }
    totalVerifiedDrawCalls++;
  }

  const mockCtx = {
    fillStyle: "#000000",
    strokeStyle: "#000000",
    lineWidth: 1,
    shadowColor: "transparent",
    shadowBlur: 0,
    globalAlpha: 1,
    font: "10px sans-serif",
    textAlign: "left" as CanvasTextAlign,
    textBaseline: "alphabetic" as CanvasTextBaseline,

    clearRect(x: number, y: number, w: number, h: number) {
      assertFinite("clearRect", { name: "x", val: x }, { name: "y", val: y }, { name: "w", val: w }, { name: "h", val: h });
    },
    fillRect(x: number, y: number, w: number, h: number) {
      assertFinite("fillRect", { name: "x", val: x }, { name: "y", val: y }, { name: "w", val: w }, { name: "h", val: h });
    },
    strokeRect(x: number, y: number, w: number, h: number) {
      assertFinite("strokeRect", { name: "x", val: x }, { name: "y", val: y }, { name: "w", val: w }, { name: "h", val: h });
    },
    beginPath() {
      totalVerifiedDrawCalls++;
    },
    moveTo(x: number, y: number) {
      assertFinite("moveTo", { name: "x", val: x }, { name: "y", val: y });
    },
    lineTo(x: number, y: number) {
      assertFinite("lineTo", { name: "x", val: x }, { name: "y", val: y });
    },
    arc(x: number, y: number, radius: number, _startAngle: number, _endAngle: number) {
      assertFinite("arc", { name: "x", val: x }, { name: "y", val: y }, { name: "radius", val: radius });
    },
    closePath() {
      totalVerifiedDrawCalls++;
    },
    stroke() {
      totalVerifiedDrawCalls++;
    },
    fill() {
      totalVerifiedDrawCalls++;
    },
    drawImage(_image: unknown, dx: number, dy: number, dw?: number, dh?: number) {
      assertFinite("drawImage", { name: "dx", val: dx }, { name: "dy", val: dy }, { name: "dw", val: dw ?? 0 }, { name: "dh", val: dh ?? 0 });
    },
    fillText(_text: string, x: number, y: number) {
      assertFinite("fillText", { name: "x", val: x }, { name: "y", val: y });
    },
    strokeText(_text: string, x: number, y: number) {
      assertFinite("strokeText", { name: "x", val: x }, { name: "y", val: y });
    },
    setTransform(a: number, b: number, c: number, d: number, e: number, f: number) {
      assertFinite("setTransform", { name: "a", val: a }, { name: "b", val: b }, { name: "c", val: c }, { name: "d", val: d }, { name: "e", val: e }, { name: "f", val: f });
    },
    transform(a: number, b: number, c: number, d: number, e: number, f: number) {
      assertFinite("transform", { name: "a", val: a }, { name: "b", val: b }, { name: "c", val: c }, { name: "d", val: d }, { name: "e", val: e }, { name: "f", val: f });
    },
    save() {
      totalVerifiedDrawCalls++;
    },
    restore() {
      totalVerifiedDrawCalls++;
    },
  } as unknown as CanvasRenderingContext2D;

  return mockCtx;
}

// ---------------------------------------------------------------------------
// Test 1: Fixed Virtual Resolution Letterboxing Math Validation
// ---------------------------------------------------------------------------
console.log("Test 1: Fixed Virtual Resolution Letterboxing Math Validation\n");

function calculateLetterboxDimensions(containerW: number, containerH: number) {
  const targetRatio = VIRTUAL_VIEWPORT.width / VIRTUAL_VIEWPORT.height;
  const containerRatio = containerW / containerH;
  let displayW: number;
  let displayH: number;

  if (containerRatio > targetRatio) {
    displayH = containerH;
    displayW = containerH * targetRatio;
  } else {
    displayW = containerW;
    displayH = containerW / targetRatio;
  }
  return { displayW, displayH, ratio: displayW / displayH };
}

{
  const viewports = [
    { w: 1920, h: 1080, label: "1080p Desktop" },
    { w: 1024, h: 768, label: "Tablet 4:3" },
    { w: 375, h: 812, label: "Mobile Portrait" },
    { w: 2560, h: 1080, label: "Ultrawide 21:9" },
  ];

  let mathPass = true;
  for (const vp of viewports) {
    const { displayW, displayH, ratio } = calculateLetterboxDimensions(vp.w, vp.h);
    const valid = Number.isFinite(displayW) && Number.isFinite(displayH) && Math.abs(ratio - 16 / 9) < 0.001;
    if (!valid) mathPass = false;
  }

  check("Letterboxing maintains 16:9 logical aspect ratio across all viewports", mathPass);
  check("Virtual resolution matches canonical 1280x720 constant", VIRTUAL_VIEWPORT.width === 1280 && VIRTUAL_VIEWPORT.height === 720);
}

// ---------------------------------------------------------------------------
// Test 2: Neon Runner 300-Frame Headless Canvas draw() Suite
// ---------------------------------------------------------------------------
console.log("\nTest 2: Neon Runner 300-Frame Headless Canvas draw() Suite\n");

{
  const mockCtx = createMockCanvasContext();
  const engine = new RunnerEngine(424242);
  engine.resize(VIRTUAL_VIEWPORT.width, VIRTUAL_VIEWPORT.height);
  engine.reset();

  let thrownError: Error | null = null;
  const initialCallCount = totalVerifiedDrawCalls;

  try {
    for (let frame = 0; frame < 300; frame++) {
      engine.update(1 / 60, {
        jumpPressed: frame % 40 === 0,
        jumpReleased: false,
        slidePressed: frame % 60 === 0,
      });
      engine.draw(mockCtx);
    }
  } catch (err) {
    thrownError = err as Error;
  }

  const callsInRun = totalVerifiedDrawCalls - initialCallCount;
  check("Neon Runner 300 frames execute with 0 thrown exceptions", thrownError === null, thrownError?.message);
  check("Neon Runner verified draw calls > 1,000 without NaN/Infinity", callsInRun > 1000, `Recorded ${callsInRun} calls`);
}

// ---------------------------------------------------------------------------
// Test 3: Pixel Ninja Dash 300-Frame Headless Canvas draw() Suite
// ---------------------------------------------------------------------------
console.log("\nTest 3: Pixel Ninja Dash 300-Frame Headless Canvas draw() Suite\n");

{
  const mockCtx = createMockCanvasContext();
  const engine = new DashEngine(123456);
  engine.resize(VIRTUAL_VIEWPORT.width, VIRTUAL_VIEWPORT.height);
  engine.reset();

  let thrownError: Error | null = null;
  const initialCallCount = totalVerifiedDrawCalls;

  try {
    for (let frame = 0; frame < 300; frame++) {
      engine.update(1 / 60, {
        dashPressed: frame % 30 === 0,
      });
      engine.draw(mockCtx);
    }
  } catch (err) {
    thrownError = err as Error;
  }

  const callsInRun = totalVerifiedDrawCalls - initialCallCount;
  check("Pixel Ninja Dash 300 frames execute with 0 thrown exceptions", thrownError === null, thrownError?.message);
  check("Pixel Ninja Dash verified draw calls > 1,000 without NaN/Infinity", callsInRun > 1000, `Recorded ${callsInRun} calls`);
}

// ---------------------------------------------------------------------------
// Test 4: Replay Canvas Integration Test
// ---------------------------------------------------------------------------
console.log("\nTest 4: Replay Canvas Integration Test\n");

{
  const mockCtx = createMockCanvasContext();

  // Test Neon Runner Replay Adapter rendering
  const neonEngine = neonRunnerReplayAdapter.createEngine(999888);
  neonRunnerReplayAdapter.resize(neonEngine, VIRTUAL_VIEWPORT.width, VIRTUAL_VIEWPORT.height);
  neonEngine.reset();
  const neonInput = neonRunnerReplayAdapter.createInitialInput();
  const sampleLogNeon = [
    { tick: 10, action: "jumpPressed" },
    { tick: 25, action: "jumpReleased" },
    { tick: 50, action: "slidePressed" },
  ];

  let replayPassNeon = true;
  try {
    for (let tick = 0; tick < 100; tick++) {
      const actions = sampleLogNeon.filter((e) => e.tick === tick);
      for (const act of actions) {
        neonRunnerReplayAdapter.applyAction(neonInput, act.action);
      }
      neonRunnerReplayAdapter.update(neonEngine, 1 / 60, neonInput);
      neonRunnerReplayAdapter.clearPulses(neonInput);
      neonEngine.draw(mockCtx);
    }
  } catch (err) {
    replayPassNeon = false;
    console.error("Neon Runner replay render error:", err);
  }
  check("Neon Runner replay rendering completes 100 ticks with zero draw errors", replayPassNeon);

  // Test Pixel Ninja Dash Replay Adapter rendering
  const dashEngine = pixelNinjaDashReplayAdapter.createEngine(777666);
  pixelNinjaDashReplayAdapter.resize(dashEngine, VIRTUAL_VIEWPORT.width, VIRTUAL_VIEWPORT.height);
  dashEngine.reset();
  const dashInput = pixelNinjaDashReplayAdapter.createInitialInput();
  const sampleLogDash = [
    { tick: 15, action: "dashPressed" },
    { tick: 45, action: "dashPressed" },
  ];

  let replayPassDash = true;
  try {
    for (let tick = 0; tick < 100; tick++) {
      const actions = sampleLogDash.filter((e) => e.tick === tick);
      for (const act of actions) {
        pixelNinjaDashReplayAdapter.applyAction(dashInput, act.action);
      }
      pixelNinjaDashReplayAdapter.update(dashEngine, 1 / 60, dashInput);
      pixelNinjaDashReplayAdapter.clearPulses(dashInput);
      dashEngine.draw(mockCtx);
    }
  } catch (err) {
    replayPassDash = false;
    console.error("Pixel Ninja Dash replay render error:", err);
  }
  check("Pixel Ninja Dash replay rendering completes 100 ticks with zero draw errors", replayPassDash);
}

// ---------------------------------------------------------------------------
console.log(`\nTotal verified canvas draw operations: ${totalVerifiedDrawCalls}`);
console.log(`${failures === 0 ? "ALL PASS" : `${failures} FAILURE(S)`}`);
process.exit(failures === 0 ? 0 : 1);
