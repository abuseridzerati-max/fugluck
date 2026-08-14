// Canonical virtual viewport across all games — physics, obstacle spawn,
// and server-side validation are locked to this 16:9 resolution (1280x720).
// Client containers letterbox this viewport to guarantee identical physics
// and scoring regardless of client monitor size or aspect ratio.
export const VIRTUAL_VIEWPORT = { width: 1280, height: 720 };
export const GAME_REGISTRY = [
    { id: "neon-runner", name: "Neon Runner", engine: "runner", modulePath: "./neon-runner/index.ts" },
    { id: "pixel-ninja-dash", name: "Pixel Ninja Dash", engine: "reflex-timing", modulePath: "./pixel-ninja-dash/index.ts" },
    { id: "space-blaster", name: "Space Blaster", engine: "arena-shooter", modulePath: "./space-blaster/index.ts" },
    { id: "cyber-hopper", name: "Cyber Hopper", engine: "reflex-timing", modulePath: "./cyber-hopper/index.ts" },
    { id: "speed-trivia", name: "Speed Trivia Clash", engine: "quiz", modulePath: "./speed-trivia/index.ts" },
    { id: "tf-sprint", name: "True / False Sprint", engine: "quiz", modulePath: "./tf-sprint/index.ts" },
];
