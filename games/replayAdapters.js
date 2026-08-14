import { neonRunnerReplayAdapter } from "./neon-runner/replay";
import { pixelNinjaDashReplayAdapter } from "./pixel-ninja-dash/replay";
import { spaceBlasterReplayAdapter } from "./space-blaster/replay";
import { cyberHopperReplayAdapter } from "./cyber-hopper/replay";
import { speedTriviaReplayAdapter } from "./speed-trivia/replay";
import { tfSprintReplayAdapter } from "./tf-sprint/replay";
import { gameRegistry } from "./registry";
// `any` here is deliberate type erasure — each game's adapter has its own
// concrete TInput/TEngine, and this map has to hold all of them uniformly;
// callers only ever get an adapter back and pass it straight to
// replayEngine(), never touch its type parameters directly.
export const replayAdapters = {
    "neon-runner": neonRunnerReplayAdapter,
    "pixel-ninja-dash": pixelNinjaDashReplayAdapter,
    "space-blaster": spaceBlasterReplayAdapter,
    "cyber-hopper": cyberHopperReplayAdapter,
    "speed-trivia": speedTriviaReplayAdapter,
    "tf-sprint": tfSprintReplayAdapter,
};
// Fails fast at module load if a registry entry has no matching adapter (or
// vice versa) rather than failing silently the first time someone submits a
// score for the mismatched game.
const registryIds = new Set(gameRegistry.map((g) => g.id));
const adapterIds = new Set(Object.keys(replayAdapters));
for (const id of registryIds) {
    if (!adapterIds.has(id))
        throw new Error(`games/replayAdapters.ts: no replay adapter registered for "${id}"`);
}
for (const id of adapterIds) {
    if (!registryIds.has(id))
        throw new Error(`games/replayAdapters.ts: adapter registered for unknown game id "${id}"`);
}
