// This game's own neon palette — see games/neon-runner/constants.ts for why
// each game owns its palette independent of the app-shell theme.
export const PALETTE = {
    bg: "#05060a",
    track: "#1a1c2e",
    cyan: "#2de2ff",
    magenta: "#ff36e0",
    purple: "#9256ff",
    lime: "#c6ff3d",
    text: "#f0f2ff",
    danger: "#ff3b5c",
};
// Timing windows around each obstacle's ideal "beat" moment.
export const TIMING = {
    leadTimeMs: 900,
    perfectWindowMs: 80,
    goodWindowMs: 180,
};
export const WORLD = {
    baseSpeed: 220, // units/sec — fixed pace, per spec (no difficulty ramp)
    stumbleSpeedFactor: 0.15,
    stumbleDurationMs: 550,
    dashFlashDurationMs: 180,
    trackLength: 11000,
    raceTimeLimitSec: 60,
    obstacleSpacingMin: 320,
    obstacleSpacingMax: 460,
};
export const SCORE = {
    perfectBonus: 15,
    goodBonus: 8,
    finishBonusPerSecRemaining: 10,
};
export const PLAYER = {
    xFraction: 0.22,
    width: 30,
    height: 46,
};
