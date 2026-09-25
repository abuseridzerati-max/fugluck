# Current Competition Architecture

Status: current code map for the Phase 5.5C consolidation, 2026-09-25.

This document describes the checked-in implementation, not legal approval or production monetary authorization. Each **BUILT** claim below was verified by reading the named source and is being rechecked by the Phase 5.5C validation gate.

## Player domains

- **BUILT — Practice:** local game modules remain available through the normal game registry and run without a competition entry. Verified in `packages/client/src/game-loader/MatchLoader.tsx`, `packages/client/src/registry.ts`, and `games/` game modules.
- **BUILT — Casual Coins:** the legacy casual queue accepts COINS-only matches. Client-submitted casual scores can determine casual outcomes, but do not create TEST GEL prizes. New Diamond queue creation is rejected. Verified in `packages/server/src/matchmaking/matches.ts`, `packages/server/src/matchmaking/queue.ts`, `packages/server/src/wallet/ledger.ts`, and `packages/server/src/validation/matchOutcome.ts`.
- **BUILT — TEST GEL prize competitions:** entry is derived from a server template and snapshotted into an immutable instance. A participant is reserved, locked, admitted, and started only through the competition authority lifecycle. The certified runtime owns live score-bearing state and terminal results. Verified in `packages/server/src/competitions/instanceService.ts`, `lifecycleEngine.ts`, `authorityStore.ts`, and `authorityRuntime.ts`.

## Competition lifecycle

`CompetitionTemplate → immutable CompetitionInstance → participants → entry reservation → lock → capture → Level 3 authority → server result → lifecycle decision → settlement or refund → terminal participant state`.

**BUILT:** client scores cannot settle a competition. The lifecycle's legacy completion entry point fails closed with `LIVE_AUTHORITY_REQUIRED`; system void/refund remains available for recovery. Durable authority decisions and idempotent sandbox accounting own completion. Verified in `packages/server/src/competitions/lifecycleEngine.ts`, `authorityStore.ts`, and the Phase 3 lifecycle/accounting and authority checks.

**BUILT:** the active competition renderer sends controls and presents server snapshots; it does not advance engine physics or submit a final score. Unsupported competition games show a blocked screen instead of falling through to casual gameplay. Verified in `packages/client/src/game-loader/AuthorityCompetition.tsx` and `MatchLoader.tsx`.

## Game certification source of truth

| Game | Practice | Casual Coins | TEST GEL competition |
|---|---|---|---|
| Space Blaster | Available | Available | Level 3 certified (`space-blaster-rv001-v1`) |
| Cyber Hopper | Available | Available | Level 3 certified (`cyber-hopper-rv001-v1`) |
| Neon Runner | Available | Available | Not certified |
| Pixel Ninja Dash | Available | Available | Not certified |
| Speed Trivia | Available | Available | Outside current prize-bearing scope |
| True / False Sprint | Available | Available | Outside current prize-bearing scope |

**BUILT:** `GAME_COMPETITION_CERTIFICATIONS` and `isTestGelCompetitionCertified` in `packages/shared/src/competitions.ts` are the source of truth. Template creation, enablement, instance creation, and joining check certification on the server; the player UI applies the same certification map. The Phase 4 player UI check verifies the two certified games and rejects the four out-of-scope or non-certified entries.

**BUILT:** enabled templates and direct instance/join paths also fail closed unless they are two-player `HEAD_TO_HEAD` with exactly one first-place prize, which is the shape the current authority settlement supports. Accounting primitives retain multi-prize support for future formats, but such a template cannot be enabled or joined by the live runner. Verified in `templateService.ts`, `instanceService.ts`, and the Phase 5 admin integration check.

## Sandbox accounting and admin boundary

- **BUILT:** TEST GEL is an isolated simulated ledger; competition entries, refunds, prizes, promotional subsidy, margin, and reconciliation use the sandbox accounting adapter. Verified in `packages/server/src/accounting/sandboxAdapter.ts`, its lifecycle callers, and competition accounting checks.
- **BUILT:** the client and server expose test-fund grants through privileged admin/faucet paths; no live payment or withdrawal processor is present in the current runtime. This is an implementation observation, not authorization for future money movement. Verified by source search and the client payment-control audit.
- **BUILT:** legacy Diamond balances, ledger rows, match history, and schema remain readable. New Diamond grants, purchase stubs, and matchmaking are retired or rejected. Historical display surfaces must label these records `DIAMONDS — RETIRED / LEGACY`. Verified in `packages/server/src/wallet/ledger.ts`, `routes/wallet.ts`, and the historical profile/wallet views.
- **BUILT (verified by source inspection and the Phase 5 admin / Phase 6B operational checks):** the admin console includes user/test-funding, competition templates and instances, sandbox accounting/reconciliation, game eligibility, operations/health, and audit areas. This documents technical controls only; no regulator submission, live payment rail, real-value prize, withdrawal, bank/PSP/card integration, or production activation is authorized by this architecture document.
- **BUILT (verified by the Phase 6C dossier/evidence artifacts and current source):** a technical-review package is maintained separately from the older historical planning specification. It records implementation boundaries and tested evidence without reaching a legal conclusion.

## Retired verification and legacy records

- **BUILT:** active replay collection, adapters, score reconstruction, replay validation and replay result claims are removed. Historical match input-log columns and prior records remain in the database for compatibility and historical evidence. Casual results are explicitly client-reported and are not used for TEST GEL prizes.
- **BUILT:** fixed-step engines, deterministic seeds, score rules, collision code, and canonical virtual viewport remain in use where gameplay requires them. Live competition engines execute continuously under server authority; they are not reconstructed after the run.
- **HISTORICAL:** `docs/RESULT_VALIDATION_ARCHITECTURE.md` records the approved RV-001 decision and its original four-candidate scope. The current release certification table above supersedes its implementation-status and candidate-scope statements; it does not rewrite the approval history.

## Evidence and verification

The Phase 5.5B1 human/staging acceptance is preserved in `docs/PHASE_5_5B1_CYBER_HOPPER_ACCEPTANCE.md` and `docs/evidence/phase55b1-cyber-hopper/authority-run-20260925.txt`. It verifies the controlled Cyber Hopper trial only. Local automated checks do not imply that current staging is deployed at this branch or that Phase 6 is accepted.
