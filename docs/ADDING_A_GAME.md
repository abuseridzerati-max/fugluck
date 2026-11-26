# Adding a New Game to Fugluck

Fugluck uses a standardized **Game Plugin Contract** across `@fugluck/shared`, `@fugluck/client`, and `@fugluck/server` so new games can be registered in minutes without editing scattered `switch (gameId)` statements or hardcoded game lists.

---

## Architecture Overview

| Layer | Contract | Registry |
| --- | --- | --- |
| **Shared** | `GameManifest` (`packages/shared/src/games/contract.ts`) | `GAME_MANIFESTS` (`packages/shared/src/games/registry.ts`) |
| **Client** | `ClientGamePlugin` (`packages/client/src/games/contract.ts`) | `CLIENT_GAME_PLUGINS` (`packages/client/src/games/registry.ts`) |
| **Server** *(certified only)* | `ServerGamePlugin` (`packages/server/src/games/contract.ts`) | `SERVER_GAME_PLUGINS` (`packages/server/src/games/registry.ts`) |

Adding a game to `GAME_MANIFESTS` automatically propagates to:
- `GAME_REGISTRY` and `@fugluck/games` (`gameRegistry`)
- `GAME_COMPETITION_CERTIFICATIONS` and `GAME_COMPETITION_ELIGIBILITY_REGISTRY`
- Home lobby catalog, genre filter pills, `LaunchModal`, and `NotFoundPage`
- Server matchmaking queue game-ID validation (`packages/server/src/matchmaking/queue.ts`)
- Competitions page filters and tournament catalogs (when `certified: true`)

---

## Track A: Adding a Practice & Casual Game (3 Steps)

### Step 1 — Implement the Game Module & Add Its Manifest
1. Create your game directory under `games/<game-id>/` implementing `GameModule` (`init`, `start`, `pause`, `destroy`) at the canonical `1280x720` virtual viewport (`VIRTUAL_VIEWPORT`).
2. Export it in `games/package.json` under `"exports"`:
   ```json
   "./<game-id>": {
     "import": "./<game-id>/index.ts",
     "default": "./<game-id>/index.ts"
   }
   ```
3. Append a `GameManifest` entry to `GAME_MANIFESTS` in `packages/shared/src/games/registry.ts`:
   ```ts
   {
     id: "my-new-game",
     title: "My New Game",
     tagline: "Short one-line pitch for the lobby card",
     genre: "reflex-timing",
     certified: false,
     modes: ["practice", "casual"],
     i18nKeyPrefix: "games.myNewGame",
     thumbnail: "my-new-game",
     modulePath: "./my-new-game/index.ts",
     certificationScope: "NOT_CERTIFIED",
     matchConfig: {
       defaultDurationSec: 180,
       tieBreaker: "draw",
       minPlayers: 2,
       maxPlayers: 2,
     },
   }
   ```

### Step 2 — Register the Client Plugin & Artwork
1. Add one entry to `CLIENT_GAME_PLUGINS` in `packages/client/src/games/registry.ts`:
   ```ts
   "my-new-game": defineModulePlugin("my-new-game", () => import("@fugluck/games/my-new-game")),
   ```
   *(If your game is a native React component rather than a vanilla `GameModule`, implement `ClientGamePlugin` directly with `loadComponent` accepting `GamePluginComponentProps`: `mode`, `matchContext`, `onScoreUpdate`, `onGameOver`, `onReady`, `onError`.)*
2. Add the matching SVG artwork renderer key (`"my-new-game"`) in `ARTWORK_BY_KEY` inside `packages/client/src/components/GameArtwork.tsx`.

### Step 3 — Add i18n Keys & Verify
1. If you introduce a new genre, add `home.filters.<genre>` to `en.json`, `ka.json`, and `ru.json` under `packages/client/src/locales/` (and a badge color in `packages/theme`).
2. Add any game-specific translations under your `i18nKeyPrefix` in all three locale files (`en.json`, `ka.json`, `ru.json`) so `scripts/i18n-check.ts` stays in parity.
3. Verify:
   ```bash
   npm run typecheck
   npm --workspace=@fugluck/client run lint
   npm run test:read-only
   ```

---

## Track B: Promoting a Game to Tournament Certified (+2 Steps)

Only games with a deterministic, fixed-timestep (`60Hz`) server-authoritative engine are eligible for Coins Knockout Tournaments and Level 3 competitions.

### Step 1 — Implement & Register `ServerGamePlugin`
1. Export your deterministic engine from `games/package.json` (e.g. `"./<game-id>/engine": "./<game-id>/engine.ts"`).
2. Add an authority version constant in `packages/shared/src/authority.ts` (e.g. `export const MY_GAME_AUTHORITY_VERSION = 'my-new-game-rv001-v1'`).
3. Update the game's manifest in `packages/shared/src/games/registry.ts`:
   - `certified: true`
   - `modes: ["practice", "casual", "tournament"]`
   - `authorityVersion: MY_GAME_AUTHORITY_VERSION`
   - `certificationScope: "LEVEL_3_CERTIFIED"`
4. Implement `ServerGamePlugin<TState>` (`createState`, `applyInput`, `tick`, `getScore`, `getTickCount`, `isFinished`, `serializeSnapshot`, `resetControls`, `getLastInputAt`, `resolveTie`) and register it in `SERVER_GAME_PLUGINS` in `packages/server/src/games/registry.ts`.

### Step 2 — Run Certification & Startup Invariant Checks
1. At server startup (`packages/server/src/config/startup.ts`), `assertServerGamePluginsValid()` automatically verifies that every `certified: true` game in `GAME_MANIFESTS` has a matching entry in `SERVER_GAME_PLUGINS` with an identical `authorityVersion`.
2. Run the full verification suite:
   ```bash
   npm run typecheck
   npm --workspace=@fugluck/client run lint
   npm run test:read-only
   ```
   `scripts/game-plugin-contract-check.ts` verifies that every `certified: true` manifest has matching entries in both `CLIENT_GAME_PLUGINS` and `SERVER_GAME_PLUGINS` and exercises the server plugin lifecycle hooks deterministically.
