import { GAME_MANIFESTS, type GameGenre } from "@fugluck/shared";

export type GameEngine = GameGenre;

export type GameRegistryEntry = {
  id: string;
  name: string;
  engine: GameEngine;
  modulePath: string;
};

/** Derived from the single source-of-truth `GAME_MANIFESTS` registry in `@fugluck/shared`. */
export const gameRegistry: GameRegistryEntry[] = GAME_MANIFESTS.map((manifest) => ({
  id: manifest.id,
  name: manifest.title,
  engine: manifest.genre,
  modulePath: manifest.modulePath,
}));
