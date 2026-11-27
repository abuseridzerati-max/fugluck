import { useEffect, useRef, type ComponentType } from "react";
import type { GameMode, GameModule, GameModuleFactory, GameOverPayload } from "@fugluck/shared";
import type { GamePluginComponentProps } from "./contract";

/**
 * Adapts a lazy-loaded vanilla `GameModuleFactory` into a standardized
 * React `ClientGamePlugin` component accepting `GamePluginComponentProps`.
 */
export function createModulePluginComponent(
  loadModule: () => Promise<{ default: GameModuleFactory }>,
): () => Promise<{ default: ComponentType<GamePluginComponentProps> }> {
  return async () => {
    const modExports = await loadModule();
    const factory = modExports.default;

    const ModulePluginComponent: ComponentType<GamePluginComponentProps> = ({
      mode,
      matchContext,
      onScoreUpdate,
      onGameOver,
      onReady,
      onError,
    }) => {
      const containerRef = useRef<HTMLDivElement | null>(null);
      const callbacksRef = useRef({ onScoreUpdate, onGameOver, onReady, onError });
      callbacksRef.current = { onScoreUpdate, onGameOver, onReady, onError };

      useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        let instance: GameModule | null = null;
        try {
          instance = factory();
          const handleGameOver: EventListener = (event) => {
            const detail = (event as CustomEvent<GameOverPayload>).detail;
            callbacksRef.current.onGameOver(detail);
          };
          const handleScoreUpdate: EventListener = (event) => {
            const detail = (event as CustomEvent<{ score?: number }>).detail;
            if (typeof detail?.score === "number") {
              callbacksRef.current.onScoreUpdate?.(detail.score);
            }
          };

          instance.addEventListener("gameOver", handleGameOver);
          instance.addEventListener("scoreUpdate", handleScoreUpdate);

          const moduleMode: GameMode = mode === "practice" ? "practice" : "match";
          instance.init(container, moduleMode, matchContext.opponentSocket ?? null, matchContext.seed);
          instance.start();
          callbacksRef.current.onReady?.();
        } catch (err) {
          callbacksRef.current.onError?.(err instanceof Error ? err : new Error(String(err)));
        }

        return () => {
          instance?.destroy();
        };
      }, [mode, matchContext.seed, matchContext.opponentSocket]);

      return (
        <div
          ref={containerRef}
          className="ac-game-surface"
          style={{
            width: "100%",
            height: "100%",
            position: "relative",
            touchAction: "none",
            userSelect: "none",
            overscrollBehavior: "none",
          }}
        />
      );
    };

    return { default: ModulePluginComponent };
  };
}
