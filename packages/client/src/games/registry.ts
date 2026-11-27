import { GAME_MANIFESTS, GAME_MANIFEST_MAP, type GameModuleFactory } from "@fugluck/shared";
import type { ClientGamePlugin } from "./contract";
import { createModulePluginComponent } from "./GameModuleHost";

function defineModulePlugin(
  gameId: string,
  loadModule: () => Promise<{ default: GameModuleFactory }>,
  options?: { competitionControlsKey?: string },
): ClientGamePlugin {
  const manifest = GAME_MANIFEST_MAP[gameId];
  if (!manifest) {
    throw new Error(`Client game plugin '${gameId}' has no matching entry in GAME_MANIFESTS.`);
  }
  return {
    manifest,
    loadModule,
    loadComponent: createModulePluginComponent(loadModule),
    competitionControlsKey: options?.competitionControlsKey,
  };
}

/**
 * Single client-side registry mapping every game slug to its ClientGamePlugin.
 * Add one entry here when registering a new game in GAME_MANIFESTS.
 */
export const CLIENT_GAME_PLUGINS: Readonly<Record<string, ClientGamePlugin>> = {
  "neon-runner": defineModulePlugin("neon-runner", () => import("@fugluck/games/neon-runner")),
  "pixel-ninja-dash": defineModulePlugin("pixel-ninja-dash", () => import("@fugluck/games/pixel-ninja-dash")),
  "space-blaster": defineModulePlugin("space-blaster", () => import("@fugluck/games/space-blaster"), {
    competitionControlsKey: "competition.blasterControls",
  }),
  "cyber-hopper": defineModulePlugin("cyber-hopper", () => import("@fugluck/games/cyber-hopper"), {
    competitionControlsKey: "competition.hopperControls",
  }),
  "stack-tower": defineModulePlugin("stack-tower", () => import("@fugluck/games/stack-tower"), {
    competitionControlsKey: "competition.stackTowerControls",
  }),
  "2048-blitz": defineModulePlugin("2048-blitz", () => import("@fugluck/games/2048-blitz"), {
    competitionControlsKey: "competition.blitz2048Controls",
  }),
  "neon-snake": defineModulePlugin("neon-snake", () => import("@fugluck/games/neon-snake"), {
    competitionControlsKey: "competition.neonSnakeControls",
  }),
  "speed-trivia": defineModulePlugin("speed-trivia", () => import("@fugluck/games/speed-trivia")),
  "tf-sprint": defineModulePlugin("tf-sprint", () => import("@fugluck/games/tf-sprint")),
};

export const CLIENT_GAME_PLUGIN_LIST: readonly ClientGamePlugin[] = GAME_MANIFESTS.map((manifest) => {
  const plugin = CLIENT_GAME_PLUGINS[manifest.id];
  if (!plugin) {
    throw new Error(`Missing ClientGamePlugin for manifest '${manifest.id}'.`);
  }
  return plugin;
});

export function getClientGamePlugin(gameId: string): ClientGamePlugin | undefined {
  return CLIENT_GAME_PLUGINS[gameId];
}

export function assertClientGamePluginsValid(): void {
  const missing: string[] = [];
  for (const manifest of GAME_MANIFESTS) {
    const plugin = CLIENT_GAME_PLUGINS[manifest.id];
    if (!plugin) {
      missing.push(manifest.id);
    } else if (plugin.manifest.id !== manifest.id) {
      throw new Error(`ClientGamePlugin manifest mismatch for '${manifest.id}'.`);
    }
  }
  if (missing.length > 0) {
    throw new Error(`Missing CLIENT_GAME_PLUGINS entries for: ${missing.join(", ")}`);
  }
}
