import {
  AUTHORITY_CAP_TICKS,
  FIXED_TIMESTEP_SEC,
  GAME_COMPETITION_CERTIFICATIONS,
  GAME_MANIFESTS,
  GAME_REGISTRY,
  getAvailableGenres,
  getCertifiedGameIds,
  type AuthorityControls,
  type AuthoritySnapshot,
} from "@fugluck/shared";
import { gameRegistry } from "@fugluck/games";
import {
  CLIENT_GAME_PLUGINS,
  assertClientGamePluginsValid,
} from "../packages/client/src/games/registry";
import {
  SERVER_GAME_PLUGINS,
  assertServerGamePluginsValid,
  getServerGamePlugin,
} from "../packages/server/src/games/registry";

let passed = 0;
let failed = 0;

function check(label: string, ok: boolean) {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
  if (ok) passed++;
  else failed++;
}

async function main() {
  console.log("\n--- Game Plugin Contract & Registry Verification ---\n");

  const expectedIds = [
    "neon-runner",
    "pixel-ninja-dash",
    "space-blaster",
    "cyber-hopper",
    "stack-tower",
    "2048-blitz",
    "neon-snake",
    "speed-trivia",
    "tf-sprint",
  ];

  check(
    "GAME_MANIFESTS contains all 9 registered games",
    expectedIds.every((id) => GAME_MANIFESTS.some((m) => m.id === id)) &&
      GAME_MANIFESTS.length === expectedIds.length,
  );

  check(
    "GAME_REGISTRY and @fugluck/games gameRegistry stay in sync with GAME_MANIFESTS",
    GAME_REGISTRY.map((g) => g.id).join(",") === GAME_MANIFESTS.map((m) => m.id).join(",") &&
      gameRegistry.map((g) => g.id).join(",") === GAME_MANIFESTS.map((m) => m.id).join(","),
  );

  check(
    "Exactly 2048-blitz, cyber-hopper, neon-snake, space-blaster, and stack-tower are Tournament Certified",
    getCertifiedGameIds().sort().join(",") === "2048-blitz,cyber-hopper,neon-snake,space-blaster,stack-tower",
  );

  check(
    "getAvailableGenres derives non-empty unique genre list from manifests",
    getAvailableGenres().length === 4 &&
      getAvailableGenres().includes("arena-shooter") &&
      getAvailableGenres().includes("reflex-timing") &&
      getAvailableGenres().includes("runner") &&
      getAvailableGenres().includes("quiz"),
  );

  let clientValid = true;
  try {
    assertClientGamePluginsValid();
  } catch {
    clientValid = false;
  }
  check("assertClientGamePluginsValid passes for all GAME_MANIFESTS entries", clientValid);

  let serverValid = true;
  try {
    assertServerGamePluginsValid();
  } catch {
    serverValid = false;
  }
  check("assertServerGamePluginsValid passes for all certified games", serverValid);

  for (const manifest of GAME_MANIFESTS) {
    const clientPlugin = CLIENT_GAME_PLUGINS[manifest.id];
    check(
      `ClientGamePlugin registered for '${manifest.id}' with loadComponent and loadModule`,
      Boolean(clientPlugin && typeof clientPlugin.loadComponent === "function" && typeof clientPlugin.loadModule === "function"),
    );

    if (manifest.certified) {
      const serverPlugin = getServerGamePlugin(manifest.id);
      const cert = GAME_COMPETITION_CERTIFICATIONS[manifest.id];
      check(
        `Certified game '${manifest.id}' has matching ServerGamePlugin and LEVEL_3_CERTIFIED record`,
        Boolean(
          serverPlugin &&
            manifest.authorityVersion &&
            serverPlugin.authorityVersion === manifest.authorityVersion &&
            cert?.testGelCompetition === "LEVEL_3_CERTIFIED" &&
            cert.authorityVersion === manifest.authorityVersion,
        ),
      );
    }
  }

  // Exercise ServerGamePlugin lifecycle hooks deterministically for Space Blaster and Cyber Hopper
  for (const gameId of getCertifiedGameIds()) {
    const plugin = SERVER_GAME_PLUGINS[gameId];
    const stateA = plugin.createState(123456);
    const stateB = plugin.createState(123456);
    const snapshotTimes = new Map<number, number>([[1, 1000]]);

    const controls: AuthorityControls =
      gameId === "neon-snake"
        ? {
            sessionId: "s1",
            instanceId: "i1",
            matchId: "m1",
            gameId,
            version: plugin.authorityVersion,
            nonce: "n1",
            epoch: 1,
            seq: 1,
            snapshot: 1,
            moveUp: true,
          }
        : gameId === "2048-blitz"
        ? {
            sessionId: "s1",
            instanceId: "i1",
            matchId: "m1",
            gameId,
            version: plugin.authorityVersion,
            nonce: "n1",
            epoch: 1,
            seq: 1,
            snapshot: 1,
            moveLeft: true,
          }
        : gameId === "stack-tower"
        ? {
            sessionId: "s1",
            instanceId: "i1",
            matchId: "m1",
            gameId,
            version: plugin.authorityVersion,
            nonce: "n1",
            epoch: 1,
            seq: 1,
            snapshot: 1,
            drop: false,
          }
        : gameId === "cyber-hopper"
          ? {
              sessionId: "s1",
              instanceId: "i1",
              matchId: "m1",
              gameId,
              version: plugin.authorityVersion,
              nonce: "n1",
              epoch: 1,
              seq: 1,
              snapshot: 1,
              hopUp: true,
            }
          : {
              sessionId: "s1",
              instanceId: "i1",
              matchId: "m1",
              gameId,
              version: plugin.authorityVersion,
              nonce: "n1",
              epoch: 1,
              seq: 1,
              snapshot: 1,
              left: false,
              right: true,
              up: false,
              down: false,
              fire: true,
            };

    plugin.applyInput(stateA, controls, 1050, snapshotTimes);
    plugin.applyInput(stateB, controls, 1050, snapshotTimes);

    for (let i = 0; i < 10; i++) {
      plugin.tick(stateA, FIXED_TIMESTEP_SEC, 1050 + i * 16);
      plugin.tick(stateB, FIXED_TIMESTEP_SEC, 1050 + i * 16);
    }

    check(
      `ServerGamePlugin '${gameId}' ticks deterministically with identical seed and input`,
      plugin.getTickCount(stateA) === 10 &&
        plugin.getTickCount(stateB) === 10 &&
        plugin.getScore(stateA) === plugin.getScore(stateB) &&
        !plugin.isFinished(stateA, AUTHORITY_CAP_TICKS),
    );

    const baseSnapshot: AuthoritySnapshot = {
      sessionId: "s1",
      epoch: 1,
      createdAt: 1000,
      emittedAt: 1000,
      seq: 1,
      serverTime: 1000,
      startAt: 900,
      deadline: 180900,
      state: "ACTIVE",
      tickCount: 0,
      score: 0,
      gameOver: false,
    };
    const snap = plugin.serializeSnapshot(stateA, baseSnapshot);
    check(
      `ServerGamePlugin '${gameId}' serializeSnapshot populates game-specific fields`,
      gameId === "neon-snake"
        ? Array.isArray(snap.snake) && snap.snake.length >= 4 && Boolean(snap.food) && typeof snap.ticksRemaining === "number"
        : gameId === "2048-blitz"
        ? Array.isArray(snap.board) && snap.board.length === 16 && typeof snap.ticksRemaining === "number"
        : gameId === "stack-tower"
        ? Array.isArray(snap.tower) && Boolean(snap.activeBlock) && typeof snap.cameraY === "number"
        : gameId === "cyber-hopper"
          ? typeof snap.gridX === "number" && typeof snap.gridY === "number" && Array.isArray(snap.obstacles)
          : typeof snap.shipX === "number" && typeof snap.shipY === "number" && Array.isArray(snap.bullets),
    );

    check(
      `ServerGamePlugin '${gameId}' resolveTie preserves draw semantics on equal scores`,
      plugin.resolveTie({ userId: "u1", score: 100, ticks: 500 }, { userId: "u2", score: 100, ticks: 500 }) === null,
    );
  }

  console.log(`\nGame plugin contract check: ${passed} PASS, ${failed} FAIL`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error("FAIL game-plugin-contract-check:", err);
  process.exitCode = 1;
});
