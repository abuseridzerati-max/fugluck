import type { ComponentType } from "react";
import type { GameManifest, GameModuleFactory, GameOverPayload, GamePlayMode } from "@fugluck/shared";

export interface GamePluginMatchContext {
  seed: number;
  matchId?: string;
  opponentSocket?: WebSocket | null;
  templateId?: string;
}

export interface GamePluginComponentProps {
  mode: GamePlayMode;
  matchContext: GamePluginMatchContext;
  onScoreUpdate?: (score: number) => void;
  onGameOver: (payload: GameOverPayload) => void;
  onReady?: () => void;
  onError?: (error: Error) => void;
}

export interface ClientGamePlugin {
  /** Shared metadata manifest from `GAME_MANIFESTS`. */
  manifest: GameManifest;
  /** Lazy-loaded React component implementing the standardized plugin props contract. */
  loadComponent: () => Promise<{ default: ComponentType<GamePluginComponentProps> }>;
  /** Underlying vanilla `GameModule` factory loader (used by GameLoader / MatchLoader). */
  loadModule: () => Promise<{ default: GameModuleFactory }>;
  /** Optional i18n key for competition controls text (certified games). */
  competitionControlsKey?: string;
}
