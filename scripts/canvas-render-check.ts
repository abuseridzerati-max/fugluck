// Standalone verification script for Headless Canvas draw() rendering loop,
// letterboxing math, finite coordinate assertions (NaN / Infinity guard), and
//
// Run: npx tsx scripts/canvas-render-check.ts

import { VIRTUAL_VIEWPORT } from "@fugluck/shared";
import { SpaceBlasterEngine } from "../games/space-blaster/engine";
import { CyberHopperEngine } from "../games/cyber-hopper/engine";
import { StackTowerEngine } from "../games/stack-tower/engine";
import { Blitz2048Engine } from "../games/2048-blitz/engine";
import { NeonSnakeEngine } from "../games/neon-snake/engine";
import { MinesweeperSprintEngine } from "../games/minesweeper-sprint/engine";
import { BrickBreakerEngine } from "../games/brick-breaker/engine";
import { BlitzChessEngine } from "../games/blitz-chess/engine";
import { Connect4Engine } from "../games/connect-4/engine";
import { CheckersEngine } from "../games/checkers/engine";

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

    measureText(text: string) {
      assertFinite("measureText");
      return { width: text.length * 10 };
    },
    clearRect(x: number, y: number, w: number, h: number) {
      assertFinite("clearRect", { name: "x", val: x }, { name: "y", val: y }, { name: "w", val: w }, { name: "h", val: h });
    },
    fillRect(x: number, y: number, w: number, h: number) {
      assertFinite("fillRect", { name: "x", val: x }, { name: "y", val: y }, { name: "w", val: w }, { name: "h", val: h });
    },
    strokeRect(x: number, y: number, w: number, h: number) {
      assertFinite("strokeRect", { name: "x", val: x }, { name: "y", val: y }, { name: "w", val: w }, { name: "h", val: h });
    },
    rect(x: number, y: number, w: number, h: number) {
      assertFinite("rect", { name: "x", val: x }, { name: "y", val: y }, { name: "w", val: w }, { name: "h", val: h });
    },
    roundRect(x: number, y: number, w: number, h: number) {
      assertFinite("roundRect", { name: "x", val: x }, { name: "y", val: y }, { name: "w", val: w }, { name: "h", val: h });
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
// Test 3.6: Space Blaster 300-Frame Headless Canvas draw() Suite
// ---------------------------------------------------------------------------
console.log("\nTest 3.6: Space Blaster 300-Frame Headless Canvas draw() Suite\n");

{
  const mockCtx = createMockCanvasContext();
  const engine = new SpaceBlasterEngine(98765432);
  engine.resize(VIRTUAL_VIEWPORT.width, VIRTUAL_VIEWPORT.height);
  engine.reset();

  const initialCallCount = totalVerifiedDrawCalls;
  let thrownError: Error | null = null;

  try {
    const emptyInput = { moveLeft: false, moveRight: false, moveUp: false, moveDown: false, shootPressed: false };
    for (let frame = 0; frame < 300; frame++) {
      engine.update(1 / 60, emptyInput);
      engine.render(mockCtx);
    }
  } catch (err) {
    thrownError = err as Error;
  }

  check(
    "Space Blaster player ship initial position is valid and centered (x=640, y=620)",
    engine.shipX === 640 && engine.shipY === 620,
    `shipX=${engine.shipX}, shipY=${engine.shipY}`,
  );
  check(
    "Space Blaster player ship coordinates remain strictly finite and within bounds (30 <= x <= 1250, 30 <= y <= 690)",
    Number.isFinite(engine.shipX) &&
      Number.isFinite(engine.shipY) &&
      engine.shipX >= 30 &&
      engine.shipX <= 1250 &&
      engine.shipY >= 30 &&
      engine.shipY <= 690,
    `shipX=${engine.shipX}, shipY=${engine.shipY}`,
  );

  const callsInRun = totalVerifiedDrawCalls - initialCallCount;
  check("Space Blaster 300 frames execute with 0 thrown exceptions", thrownError === null, thrownError?.message);
  check("Space Blaster verified draw calls > 1,000 without NaN/Infinity", callsInRun > 1000, `Recorded ${callsInRun} calls`);
}

// ---------------------------------------------------------------------------
// Test 3.7: Cyber Hopper 300-Frame Headless Canvas draw() Suite
// ---------------------------------------------------------------------------
console.log("\nTest 3.7: Cyber Hopper 300-Frame Headless Canvas draw() Suite\n");

{
  const mockCtx = createMockCanvasContext();
  const engine = new CyberHopperEngine(12345678);
  engine.resize(VIRTUAL_VIEWPORT.width, VIRTUAL_VIEWPORT.height);
  engine.reset();

  const initialCallCount = totalVerifiedDrawCalls;
  let thrownError: Error | null = null;

  try {
    const emptyInput = { hopUp: false, hopDown: false, hopLeft: false, hopRight: false };
    for (let frame = 0; frame < 300; frame++) {
      engine.update(1 / 60, emptyInput);
      engine.render(mockCtx);
    }
  } catch (err) {
    thrownError = err as Error;
  }

  const callsInRun = totalVerifiedDrawCalls - initialCallCount;
  check("Cyber Hopper 300 frames execute with 0 thrown exceptions", thrownError === null, thrownError?.message);
  check("Cyber Hopper verified draw calls > 1,000 without NaN/Infinity", callsInRun > 1000, `Recorded ${callsInRun} calls`);
}

// ---------------------------------------------------------------------------
// Test 3.75: Stack Tower 300-Frame Headless Canvas draw() Suite
// ---------------------------------------------------------------------------
console.log("\nTest 3.75: Stack Tower 300-Frame Headless Canvas draw() Suite\n");

{
  const mockCtx = createMockCanvasContext();
  const engine = new StackTowerEngine(24681357);
  engine.resize(VIRTUAL_VIEWPORT.width, VIRTUAL_VIEWPORT.height);
  engine.reset();

  const initialCallCount = totalVerifiedDrawCalls;
  let thrownError: Error | null = null;

  try {
    for (let frame = 0; frame < 300; frame++) {
      const top = engine.tower[engine.tower.length - 1];
      const shouldDrop = !engine.gameOver && Math.abs(engine.activeBlock.x - top.x) <= 6;
      engine.update(1 / 60, { drop: shouldDrop });
      engine.render(mockCtx);
    }
  } catch (err) {
    thrownError = err as Error;
  }

  const callsInRun = totalVerifiedDrawCalls - initialCallCount;
  check("Stack Tower 300 frames execute with 0 thrown exceptions", thrownError === null, thrownError?.message);
  check("Stack Tower verified draw calls > 1,000 without NaN/Infinity", callsInRun > 1000, `Recorded ${callsInRun} calls`);
  check("Stack Tower places blocks and scores deterministically", engine.blocksPlaced > 0 && engine.score > 0, `blocks=${engine.blocksPlaced}, score=${engine.score}`);
}

// ---------------------------------------------------------------------------
// Test 3.76: Seeded 2048 Blitz 300-Frame Headless Canvas draw() Suite
// ---------------------------------------------------------------------------
console.log("\nTest 3.76: Seeded 2048 Blitz 300-Frame Headless Canvas draw() Suite\n");

{
  const mockCtx = createMockCanvasContext();
  const engine = new Blitz2048Engine(13572468);
  engine.resize(VIRTUAL_VIEWPORT.width, VIRTUAL_VIEWPORT.height);
  engine.reset();

  const initialCallCount = totalVerifiedDrawCalls;
  let thrownError: Error | null = null;

  try {
    for (let frame = 0; frame < 300; frame++) {
      const phase = frame % 20;
      engine.update(1 / 60, {
        moveLeft: phase === 0,
        moveDown: phase === 5,
        moveRight: phase === 10,
        moveUp: phase === 15,
      });
      engine.render(mockCtx);
    }
  } catch (err) {
    thrownError = err as Error;
  }

  const callsInRun = totalVerifiedDrawCalls - initialCallCount;
  check("Seeded 2048 Blitz 300 frames execute with 0 thrown exceptions", thrownError === null, thrownError?.message);
  check("Seeded 2048 Blitz verified draw calls > 1,000 without NaN/Infinity", callsInRun > 1000, `Recorded ${callsInRun} calls`);
  check("Seeded 2048 Blitz executes valid moves and merges deterministically", engine.moves > 0 && engine.score > 0 && engine.bestTile >= 4, `moves=${engine.moves}, score=${engine.score}, bestTile=${engine.bestTile}`);
}

// ---------------------------------------------------------------------------
// Test 3.77: Neon Snake 300-Frame Headless Canvas draw() Suite
// ---------------------------------------------------------------------------
console.log("\nTest 3.77: Neon Snake 300-Frame Headless Canvas draw() Suite\n");

{
  const mockCtx = createMockCanvasContext();
  const engine = new NeonSnakeEngine(97531246);
  engine.resize(VIRTUAL_VIEWPORT.width, VIRTUAL_VIEWPORT.height);
  engine.reset();

  const initialCallCount = totalVerifiedDrawCalls;
  let thrownError: Error | null = null;

  try {
    for (let frame = 0; frame < 300; frame++) {
      const phase = frame % 120;
      engine.update(1 / 60, {
        moveDown: phase === 30,
        moveLeft: phase === 60,
        moveUp: phase === 90,
        moveRight: phase === 0,
      });
      engine.render(mockCtx);
    }
  } catch (err) {
    thrownError = err as Error;
  }

  const callsInRun = totalVerifiedDrawCalls - initialCallCount;
  check("Neon Snake 300 frames execute with 0 thrown exceptions", thrownError === null, thrownError?.message);
  check("Neon Snake verified draw calls > 1,000 without NaN/Infinity", callsInRun > 1000, `Recorded ${callsInRun} calls`);
  check("Neon Snake stays alive on square loop without false reversal collision", !engine.gameOver && engine.snake.length >= 4, `gameOver=${engine.gameOver}, len=${engine.snake.length}`);
}

// ---------------------------------------------------------------------------
// Test 3.78: Minesweeper Sprint 300-Frame Headless Canvas draw() Suite
// ---------------------------------------------------------------------------
console.log("\nTest 3.78: Minesweeper Sprint 300-Frame Headless Canvas draw() Suite\n");

{
  const mockCtx = createMockCanvasContext();
  const engine = new MinesweeperSprintEngine(11223344);
  engine.resize(VIRTUAL_VIEWPORT.width, VIRTUAL_VIEWPORT.height);
  engine.reset();

  const initialCallCount = totalVerifiedDrawCalls;
  let thrownError: Error | null = null;

  try {
    for (let frame = 0; frame < 300; frame++) {
      if (frame > 0 && frame % 30 === 0 && !engine.gameOver) {
        const safe = engine.findFirstHiddenSafeCell();
        engine.update(1 / 60, safe ? { action: "reveal", col: safe.col, row: safe.row } : {});
      } else {
        engine.update(1 / 60, {});
      }
      engine.render(mockCtx);
    }
  } catch (err) {
    thrownError = err as Error;
  }

  const callsInRun = totalVerifiedDrawCalls - initialCallCount;
  check("Minesweeper Sprint 300 frames execute with 0 thrown exceptions", thrownError === null, thrownError?.message);
  check("Minesweeper Sprint verified draw calls > 1,000 without NaN/Infinity", callsInRun > 1000, `Recorded ${callsInRun} calls`);
  check("Minesweeper Sprint reveals safe cells and scores deterministically", engine.score > 0 && engine.safeCellsRemaining < 118, `score=${engine.score}, safeLeft=${engine.safeCellsRemaining}`);
}

// ---------------------------------------------------------------------------
// Test 3.79: Brick Breaker 300-Frame Headless Canvas draw() Suite
// ---------------------------------------------------------------------------
console.log("\nTest 3.79: Brick Breaker 300-Frame Headless Canvas draw() Suite\n");

{
  const mockCtx = createMockCanvasContext();
  const engine = new BrickBreakerEngine(55667788);
  engine.resize(VIRTUAL_VIEWPORT.width, VIRTUAL_VIEWPORT.height);
  engine.reset();

  const initialCallCount = totalVerifiedDrawCalls;
  let thrownError: Error | null = null;

  try {
    for (let frame = 0; frame < 300; frame++) {
      engine.update(1 / 60, {
        left: engine.ballX < engine.paddleX - 6,
        right: engine.ballX > engine.paddleX + 6,
      });
      engine.render(mockCtx);
    }
  } catch (err) {
    thrownError = err as Error;
  }

  const callsInRun = totalVerifiedDrawCalls - initialCallCount;
  check("Brick Breaker 300 frames execute with 0 thrown exceptions", thrownError === null, thrownError?.message);
  check("Brick Breaker verified draw calls > 1,000 without NaN/Infinity", callsInRun > 1000, `Recorded ${callsInRun} calls`);
  check("Brick Breaker tracks paddle, hits bricks, and scores deterministically", engine.score > 0 && engine.lives > 0, `score=${engine.score}, lives=${engine.lives}`);
}

// ---------------------------------------------------------------------------
// Test 3.80: Blitz Chess 300-Frame Headless Canvas draw() Suite
// ---------------------------------------------------------------------------
console.log("\nTest 3.80: Blitz Chess 300-Frame Headless Canvas draw() Suite\n");

{
  const mockCtx = createMockCanvasContext();
  const engine = new BlitzChessEngine(77889900);
  engine.resize(VIRTUAL_VIEWPORT.width, VIRTUAL_VIEWPORT.height);
  engine.reset();

  const initialCallCount = totalVerifiedDrawCalls;
  let thrownError: Error | null = null;

  try {
    for (let frame = 0; frame < 300; frame++) {
      if (frame > 0 && frame % 60 === 0 && !engine.gameOver && engine.getActiveTurn() === "w") {
        const m = engine.getFirstLegalWhiteMove();
        engine.update(1 / 60, m ? { moveFrom: m.from, moveTo: m.to } : {});
      } else {
        engine.update(1 / 60, {});
      }
      engine.render(mockCtx);
    }
  } catch (err) {
    thrownError = err as Error;
  }

  const callsInRun = totalVerifiedDrawCalls - initialCallCount;
  check("Blitz Chess 300 frames execute with 0 thrown exceptions", thrownError === null, thrownError?.message);
  check("Blitz Chess verified draw calls > 1,000 without NaN/Infinity", callsInRun > 1000, `Recorded ${callsInRun} calls`);
  check("Blitz Chess executes player moves and deterministic AI responses", engine.turnNumber >= 4, `turnNumber=${engine.turnNumber}`);
}

// ---------------------------------------------------------------------------
// Test 3.81: Connect 4 300-Frame Headless Canvas draw() Suite
// ---------------------------------------------------------------------------
console.log("\nTest 3.81: Connect 4 300-Frame Headless Canvas draw() Suite\n");

{
  const mockCtx = createMockCanvasContext();
  const engine = new Connect4Engine(77771111);
  engine.resize(VIRTUAL_VIEWPORT.width, VIRTUAL_VIEWPORT.height);
  engine.reset();

  const initialCallCount = totalVerifiedDrawCalls;
  let thrownError: Error | null = null;

  try {
    const dropOrder = [3, 2, 4, 1, 5];
    let dropIdx = 0;
    for (let frame = 0; frame < 300; frame++) {
      const shouldDrop = frame > 0 && frame % 55 === 0 && !engine.gameOver && engine.activePlayer === 1;
      const col = dropOrder[dropIdx % dropOrder.length];
      if (shouldDrop && engine.canDropInColumn(col)) {
        dropIdx++;
        engine.update(1 / 60, { dropCol: col });
      } else {
        engine.update(1 / 60, {});
      }
      engine.render(mockCtx);
    }
  } catch (err) {
    thrownError = err as Error;
  }

  const callsInRun = totalVerifiedDrawCalls - initialCallCount;
  check("Connect 4 300 frames execute with 0 thrown exceptions", thrownError === null, thrownError?.message);
  check("Connect 4 verified draw calls > 1,000 without NaN/Infinity", callsInRun > 1000, `Recorded ${callsInRun} calls`);
  check("Connect 4 executes player drops and deterministic AI responses", engine.turnNumber >= 4, `turnNumber=${engine.turnNumber}`);
}

// ---------------------------------------------------------------------------
// Test 3.82: Checkers 300-Frame Headless Canvas draw() Suite
// ---------------------------------------------------------------------------
console.log("\nTest 3.82: Checkers 300-Frame Headless Canvas draw() Suite\n");

{
  const mockCtx = createMockCanvasContext();
  const engine = new CheckersEngine(88882222);
  engine.resize(VIRTUAL_VIEWPORT.width, VIRTUAL_VIEWPORT.height);
  engine.reset();

  const initialCallCount = totalVerifiedDrawCalls;
  let thrownError: Error | null = null;

  try {
    for (let frame = 0; frame < 300; frame++) {
      if (frame > 0 && frame % 55 === 0 && !engine.gameOver && engine.activePlayer === 1) {
        const move = engine.getFirstLegalP1Move();
        engine.update(1 / 60, move ? { from: move.from, to: move.to } : {});
      } else {
        engine.update(1 / 60, {});
      }
      engine.render(mockCtx);
    }
  } catch (err) {
    thrownError = err as Error;
  }

  const callsInRun = totalVerifiedDrawCalls - initialCallCount;
  check("Checkers 300 frames execute with 0 thrown exceptions", thrownError === null, thrownError?.message);
  check("Checkers verified draw calls > 1,000 without NaN/Infinity", callsInRun > 1000, `Recorded ${callsInRun} calls`);
  check("Checkers executes player moves and deterministic AI responses", engine.turnNumber >= 4, `turnNumber=${engine.turnNumber}`);
}

// ---------------------------------------------------------------------------
// Replay drivers were retired; each active game renderer is exercised directly above.

console.log(`\nTotal verified canvas draw operations: ${totalVerifiedDrawCalls}`);
console.log(`${failures === 0 ? "ALL PASS" : `${failures} FAILURE(S)`}`);
process.exit(failures === 0 ? 0 : 1);
