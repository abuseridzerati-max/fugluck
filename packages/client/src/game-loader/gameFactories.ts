import type { GameModuleFactory } from "@fugluck/shared";
import { CLIENT_GAME_PLUGINS } from "../games/registry";

/** Derived from `CLIENT_GAME_PLUGINS` for backward compatibility. */
export const gameFactories: Record<string, () => Promise<{ default: GameModuleFactory }>> = Object.fromEntries(
  Object.entries(CLIENT_GAME_PLUGINS).map(([id, plugin]) => [id, plugin.loadModule]),
);
