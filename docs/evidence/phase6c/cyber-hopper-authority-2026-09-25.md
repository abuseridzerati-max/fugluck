# Cyber Hopper Authority Evidence

- Evidence ID: `PH6C-CH-AUTH-20260925`
- Source revision: `3d8922fd251ffbeb6d0ededade578fd3c6b8bbaa`
- Run date: 2026-09-25 UTC (the test harness does not retain an exact start timestamp; this evidence record was compiled at 2026-09-25 01:50 UTC)
- Command: `npx tsx scripts/cyber-hopper-authority-check.ts`
- Environment: local real WebSocket/Socket.IO integration against the guarded disposable PostgreSQL test database; no staging or production use
- Result: **42 passed, 0 failed**

## What the check demonstrated

- Server-engine grid movement and score rules, seeded hazard determinism, car/hazard collision and game termination, one-shot hop input, sequence checks, malformed-input rejection and idle-control neutralization.
- Local real-socket benchmarks at 1, 10 and 20 sessions ran near 60 ticks/s and near 20 snapshots/s per session; this run measured 59.46, 59.60 and 59.65 ticks/s respectively. At 20 sessions the maximum batch-tick time was 2.131 ms and the test's 250 ms lag-budget and 2.5 KB snapshot-size assertions passed.
- Session bindings used `cyber-hopper-rv001-v1`; wrong session/version/user and old-controller use were rejected. Reconnect preserved the run and rotated epoch/nonce.
- Controls cannot provide arbitrary score/winner fields or Space Blaster-specific inputs. The legacy score service cannot complete the competition.
- Server results settle a natural winner once; the test verifies the predetermined TEST GEL 9 prize and TEST GEL 1 margin in its fixture, zero instance reconciliation, and terminal participant states. Forfeit, timeout/tie, reconnect expiry, and both-disconnected cases also use the expected terminal and refund behavior.
- Duplicate completion/result operations do not double settle; system failure does not create an unjustified winner; both-disconnect refund reconciliation remains zero.

## Physical staging evidence

The user-confirmed two-device trial, exact admission measurements, instance-level settlement and disabled controlled template are documented separately in [Phase 5.5B1 Cyber Hopper Acceptance](../../PHASE_5_5B1_CYBER_HOPPER_ACCEPTANCE.md). That run verified physical start and gameplay, but not intentional reconnect. Do not interpret this local 6C suite as another staging trial.

## Source map and limits

`games/cyber-hopper/engine.ts`; `packages/server/src/competitions/authorityRuntime.ts`; `authorityStore.ts`; `authorityAdmission.ts`; `packages/client/src/game-loader/AuthorityCompetition.tsx`; `scripts/cyber-hopper-authority-check.ts`.

This is automated local evidence, not cloud capacity certification. Dynamic synthetic IDs, account names, tokens and database connection details are excluded.
