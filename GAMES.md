# Games Manifest

Current status is based on the source tree and checks named below. **BUILT** means present in code; it does not imply legal approval, external review, or current staging deployment. Update this table when game capability changes.

| Game | Source | Practice | Casual Coins | TEST GEL prize competition |
|---|---|---:|---:|---|
| Neon Runner | [`games/neon-runner/`](games/neon-runner/) | BUILT | BUILT | NOT CERTIFIED |
| Pixel Ninja Dash | [`games/pixel-ninja-dash/`](games/pixel-ninja-dash/) | BUILT | BUILT | NOT CERTIFIED |
| Space Blaster | [`games/space-blaster/`](games/space-blaster/) | BUILT | BUILT | Level 3 certified; `space-blaster-rv001-v1` |
| Cyber Hopper | [`games/cyber-hopper/`](games/cyber-hopper/) | BUILT | BUILT | Level 3 certified; `cyber-hopper-rv001-v1` |
| Speed Trivia Clash | [`games/speed-trivia/`](games/speed-trivia/) | BUILT | BUILT | OUT OF CURRENT PRIZE SCOPE |
| True / False Sprint | [`games/tf-sprint/`](games/tf-sprint/) | BUILT | BUILT | OUT OF CURRENT PRIZE SCOPE |
| Sky Dodge | [`games/sky-dodge/`](games/sky-dodge/) | Legacy source retained | Not in active game catalog | Not certified |

## Verification

- **BUILT and deployed to staging at `0d4ede659ec0776e46f1e583f879a234b9905331`; Competition Restructure acceptance NOT PASS:** Space Blaster and Cyber Hopper completed genuine four-player knockout tournaments with their unchanged certified engines, 10,800-tick cap, one capture per entry and one final prize. Space Blaster passed a draw/rematch and its active-Final restart is corroborated by provider restart event, reconnect sessions, persisted bracket attempts and exactly-once final settlement; the one-off harness's stale checkpoint failure is retained. Cyber Hopper active-Final restart recovery passed twice, 29/29 each. The runtime recovery repair is deployed; all temporary mock-action and knockout test switches are OFF. Complete 2/4/8/16 bracket/economics/qualification coverage includes isolated fixtures; full hosted 8/16 play remains blocked pending twelve owner-authorized synthetic accounts, and positive real qualification was not enabled. [The rollout report](docs/COMPETITION_RESTRUCTURE_ROLLOUT.md) records exact scope and remaining findings. Game engines, canonical viewport and casual Coins/practice behavior are unchanged.

- Game IDs and runtime capability map: `packages/shared/src/gameModule.ts`, `packages/shared/src/competitions.ts`, and `packages/client/src/registry.ts`.
- TEST GEL eligibility is defined by `GAME_COMPETITION_CERTIFICATIONS` and enforced by server template, instance, and join services. The game certification and input-validation checks verify certified, not-certified, and out-of-scope cases.
- Practice/casual engine determinism is checked by `scripts/determinism-check.ts`; finite canvas rendering is checked by `scripts/canvas-render-check.ts`.
- The accepted controlled Cyber Hopper trial is limited to `tmpl_cyber_hopper_authority_trial` with `cyber-hopper-rv001-v1`. Its staging record and evidence are in [`docs/PHASE_5_5B1_CYBER_HOPPER_ACCEPTANCE.md`](docs/PHASE_5_5B1_CYBER_HOPPER_ACCEPTANCE.md). The trial was disabled after acceptance; the default `ch-1.0` template remains blocked from authority play.
- TEST GEL competition gameplay uses the Level 3 server authority renderer and terminal protocol. It is not replay reconstruction. The browser presents server snapshots and sends controls; the server owns score-bearing state, collision, and results. Casual Coins scores are client-reported and cannot produce TEST GEL prizes.

## Shared game runtime

The game engines remain game-specific. Shared utilities include seeded random generation, the fixed-step update scheduler, and the canonical 1280 × 720 viewport. These shared utilities do not make the individual engines interchangeable. Deterministic engines are useful for practice and continuous server-authoritative gameplay; no active end-of-run replay validator or replay submission path remains.

## Legacy data

Historical DIAMONDS ledger rows, prior match/settlement records, and their schema remain available for history and audit. New Diamond matchmaking, purchases, grants, and competition use are retired. Historical views must label them `DIAMONDS — RETIRED / LEGACY`.
