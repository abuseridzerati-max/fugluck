# Phase 5.5A — common authority foundation and Space Blaster

Status: common foundation and Space Blaster reference implemented; local validation passed. Staging/manual acceptance is unperformed; full Phase 5.5 is not complete.
Initial verified Git state: `main`, HEAD/main/origin-main at `2cbc429caed07dc4e8ece05bbb4662fb27667018`, with only the three architecture documents uncommitted. Remote was fetched before implementation.
Architecture decision commit: `1361cce1e5d2b5b83701ccd6e2935ce05c530a16`.
Branch: `codex/phase-5-5a-live-authority`.

## Pre-change runtime audit (source inspected before runtime edits)

1. `useMatchSocket` sends `competition:join(templateId)`. Socket authentication derives user identity. `instanceService.joinCompetitionQueue` reserves entry and locks a full instance.
2. `matchmaking/index.ts` immediately invokes `activateLockedCompetition`, captures entries and creates a `comp_match_*` history row. It emits both competition and legacy `matched` messages, without registering legacy match maps.
3. `MatchLoader` instantiates the browser game module. Space Blaster's module runs `engine.update`, computes score/collision, records inputs and sends gameOver to the generic `submitScore` event.
4. That event reaches `matchmaking/matches.ts`, requiring legacy `socketToMatch`/`matches` entries. Competition instances are not registered there; no production caller connects completion to competition lifecycle submission.
5. The direct lifecycle submission service uses replay, writes invalid scores as zero, then begins settlement after both submissions; its response says SETTLED even when settlement voids a tie. The activated-match retry path returns seed zero.
6. Existing sandbox accounting uses transaction locks, unique identities and compensating postings. Lifecycle state writes are separate from those transactions; durable outcome arbitration/recovery is required before claiming exactly-once completion.
7. Socket and participant HTTP cancellation lacked an ownership check before cancelling an unfilled instance. This must be fixed at the same session boundary.

## Implementation boundary

BUILT, verified by source inspection and the checks recorded below: additive authority run/session/result/decision records; live fixed-step Space Blaster state; nonce/connection fencing; current snapshots; trusted terminal decisions through existing accounting; real socket integration and adversarial/load tests. Reference runtime is opt-in via `ENABLE_COMPETITION_AUTHORITY`; all other competition games remain blocked at entry. No migration of other games, deletion of replay/history, Diamond cleanup, deployment or Phase 6/7 work.

Legacy direct-service and casual tests retain their historical behavior. Public competition entry cannot fall back to that path. Space Blaster competition rendering uses current server state without running a local scoring simulation or collecting inputs for reconstruction.

## Implemented flow and ownership

1. Authenticated `competition:join` checks the feature flag, Space Blaster, HEAD_TO_HEAD, capacity two, and `space-blaster-rv001-v1` rules **before reserving funds**. Existing template/instance services still own admission and snapshots of financial terms.
2. When the instance locks, one database transaction creates a match, run and two player sessions. No legacy `matched` event is emitted. The common store records the game/version, seeded configuration, actual cap, match/instance/user relationships, owner lease and terminal references.
3. Each controller receives a random 192-bit nonce; only its hash is persisted. Rebinding an authenticated participant rotates nonce and connection epoch. Old socket IDs and old bindings reject; the client cannot override identity with message fields.
4. Both clients pass 20 server-measured ping samples over five seconds (p95 at most 100 ms; p95 minus median at most 30 ms), then acknowledge ready. Readiness expires after 30 seconds. Entry capture happens after both are ready. A common three-second countdown precedes gameplay.
5. The owner runs the existing Space Blaster engine at 60 fixed steps/second against 1280×720. It owns movement, shooting cadence, bullets, seeded asteroid generation, collisions, score and death. The versioned cap is 10,800 ticks (180 seconds); the final tick is applied, with natural collision taking precedence over cap completion.
6. A live result writes an immutable receipt and participant score, then moves the instance to VERIFYING. Once both results exist, the database serializes one WIN/DRAW decision. Forfeit writes current server results and a FORFEIT decision. Uncertain state produces VOID. Exact ties refund both entries.
7. The immutable decision calls the existing sandbox accounting port with a stable idempotency key. Only a successful accounting response permits SETTLED/VOIDED and history/prize updates. A failed response leaves the same decision pending for retry. Repeated application cannot change the decision or produce another financial effect.

### Protocol and runtime limits

| Message | Meaning |
|---|---|
| `authority:session` | Server-issued session/instance/match/game/version/nonce/epoch binding |
| `authority:ready` | Bound readiness acknowledgement; no score or identity selection |
| `authority:controls` | Monotonic sequence, recent snapshot reference, held directions, one fire pulse |
| `authority:snapshot` | Current tick, score, ship, active bullets/asteroids, state and timing |
| `authority:resume` | Authenticated participant rebind or durable terminal outcome retrieval |
| `authority:forfeit` | Explicit bound surrender, separate from a client death/score claim |
| `authority:outcome` | Applied terminal decision; delivered without requiring client result acknowledgement |

Accepted messages are limited to 1 KiB. Controls use 60/second with burst 12; snapshot references expire after 500 ms. Held controls become neutral after 250 ms without a heartbeat. A fire pulse is consumed once and discarded. There is no stored input history, post-game reconstruction, rewind or replay call in this path. Generic legacy score submission cannot complete an authority instance.

Snapshots are full current state at approximately 20 Hz, with volatile transport to avoid queuing old frames for slow clients. The browser reuses `SpaceBlasterEngine.render` but never calls `update` in competition mode. It sends current controls every 50 ms, supports keyboard and pointer controls, clears held directions on blur, and keeps the public instance ID in session storage for reload recovery. Nonces are not stored there.

Acceptance review added bounded per-run operational measurements: heartbeat round-trip maxima by request phase (waiting, active, finalizing), start/capture duration, settlement duration, accepted-control count, maximum simulation tick cost and snapshot scheduling gap. Logs contain the public instance ID, not account identifiers, nonces or control payloads. Unexpected database errors are sanitized before emitting authority socket errors. These measurements do not change the lease, admission, input or gameplay timing rules.

### Failure and recovery policy

- A database-time lease lasts two seconds and renews every 500 ms. Missing acknowledgement for 1.9 seconds stops simulation conservatively. A run more than 250 ms behind its due tick is voided. Session/result writes use atomic SQL statements. A prewarmed, bounded database channel renews all live runs in one batch, keeping lease heartbeats separate from accounting pool traffic. The local bound is conservative from request-send time and stays inside the approved two-second lease.
- Disconnect neutralizes input immediately. A reconnect within ten seconds preserves live state and rotates the controller binding. The simulation continues. A completed result is retained during the grace period.
- Expired reconnect can forfeit only with a healthy opponent (recent control heartbeat or an already completed result). Both disconnected players or uncertain opponent connectivity cause VOID/refund.
- Recovery never reconstructs active gameplay. An expired owner with two durable result receipts can finalize those results; otherwise it voids/refunds. An existing decision is reapplied unchanged. Administrative void requests use this same decision record and cannot replace a committed winner.
- Legacy match recovery skips all competition-linked history. Legacy competition recovery skips authority runs. Public socket and HTTP waiting cancellation now verify participant ownership.

## Scope remaining and staging procedure

The feature flag defaults off. No staging or production configuration was changed. All four games remain blocked for release acceptance. Space Blaster is the sole implementation candidate for a separately authorized staging trial after the checks below pass.

For that trial: apply migration `0010_competition_authority.sql` through the existing documented migration workflow, explicitly enable `ENABLE_COMPETITION_AUTHORITY` on the staging backend, and use the existing staging admin template workflow to create an enabled sandbox Space Blaster HEAD_TO_HEAD template with capacity two and rules version `space-blaster-rv001-v1`. Its confirmation discloses the 180-second cap, server scoring, tie refund and leaving/forfeit rules. Use two staging test accounts and simulated funding. This document does not authorize deployment or data changes.

**Not yet verified:** actual staging network admission, mobile/desktop browser playability, long-duration capacity, multi-host operational deployment and visual/manual acceptance. The current client renders full snapshots without interpolation; smoothness must be reviewed. Tests use a two-second cap, one-second reconnect window and fifteen-second ready timeout through server-constructor options only, never from client input. A fixed server seed provides an asteroid in the firing lane so real control messages can prove an earned score-based winner; no score/hit/result is injected. Production uses a cryptographically generated seed and the approved 180/10/30-second defaults. The database result trigger prevents UPDATE; application APIs expose no receipt deletion, but privileged database administrators retain fixture/retention control.

**Retained:** browser practice and casual legacy matchmaking; legacy `submitScore`/`validateScore`, shared replay driver, adapters, game input collection and historical columns; COINS/DIAMONDS queue, ledger, wallet and related routes. Space Blaster competition mode bypasses these result-validation paths. Dash, Hopper and Runner have no authority engine integration. Phase 6 evidence generation and Phase 7 remain unstarted.

## Verification

Exact per-script results and final Git state are recorded below. Failed development runs led to explicit timestamp parsing, atomic state writes, and isolated batched lease heartbeats. The approved two-second lease and 250 ms lag limit remain.

### Final validation results (2026-09-23)

The complete canonical command exited successfully: **35 scripts, 1,310 assertions, zero failures**. Separate atomic accounting (**37**) and database safety (**18**) checks also exited successfully: **37 distinct scripts, 1,365 assertions, zero failures**. Focused reruns are not counted again. No existing test was removed, weakened or bypassed. Migration parity gained the new table/column/trigger checks.

| Script in `scripts/` | Passed | Failed |
|---|---:|---:|
| migration-schema-parity-check.ts | 321 | 0 |
| auth-account-lifecycle-check.ts | 41 | 0 |
| legal-policy-help-check.ts | 53 | 0 |
| i18n-check.ts | 65 | 0 |
| wallet-friends-check.ts | 48 | 0 |
| financial-reconnection-check.ts | 19 | 0 |
| matchmaking-check.ts | 65 | 0 |
| determinism-check.ts | 31 | 0 |
| score-validation-check.ts | 42 | 0 |
| canvas-render-check.ts | 28 | 0 |
| rate-limit-check.ts | 11 | 0 |
| sql-injection-check.ts | 19 | 0 |
| input-validation-check.ts | 16 | 0 |
| xss-audit-check.ts | 17 | 0 |
| password-security-check.ts | 13 | 0 |
| admin-security-check.ts | 8 | 0 |
| admin-console-check.ts | 49 | 0 |
| admin-reset-recovery-check.ts | 11 | 0 |
| seed-admin-check.ts | 7 | 0 |
| cors-audit-check.ts | 20 | 0 |
| registration-verification-check.ts | 9 | 0 |
| owner-admin-lockout-check.ts | 10 | 0 |
| request-logging-audit-check.ts | 12 | 0 |
| password-policy-check.ts | 18 | 0 |
| file-upload-audit-check.ts | 4 | 0 |
| wallet-settlement-concurrency-check.ts | 16 | 0 |
| wallet-settlement-integrity-check.ts | 23 | 0 |
| match-lifecycle-durability-check.ts | 26 | 0 |
| staging-readiness-check.ts | 34 | 0 |
| competition-phase1-domain-check.ts | 40 | 0 |
| competition-phase2-accounting-check.ts | 51 | 0 |
| competition-phase3-lifecycle-check.ts | 43 | 0 |
| competition-phase4-ui-check.ts | 43 | 0 |
| competition-phase5-admin-check.ts | 42 | 0 |
| competition-authority-check.ts | 55 | 0 |
| atomic-wager-lifecycle-check.ts | 37 | 0 |
| test-database-safety-check.ts | 18 | 0 |

Typecheck (shared, theme, games, server and client), client production build, separate server build and `git diff --check` pass. Vite still reports its existing large-chunk advisory. Tests used the configured guarded disposable database; staging/production databases and configuration were not changed.

The authority test covers legal movement/clamping; fire cadence; seeded spawns; bullet/asteroid collision, survival/kill score and death; current-control consumption/neutralization; sequence, stale, malformed and rate rejection; authenticated socket session/user/instance/match/game/version/nonce binding; controller replacement and reconnect; ready/capture/countdown/live cap completion; inability to choose score/winner or bypass through the legacy service; immutable/duplicate result and decision protection; normal earned win, tie refund, explicit forfeit, readiness expiry, isolated abandonment and both-disconnect void; history scores without input logs; process-loss recovery; and exactly-once accounting.

### Measured local feasibility

Five wall-clock seconds with **20 simultaneous engine states**, using current controls and full current snapshot serialization:

| Measurement | Observed |
|---|---:|
| Tick frequency | 59.83 Hz |
| Mean tick cost, all 20 engines | 0.1194 ms |
| Maximum tick cost, all 20 engines | 2.7352 ms |
| Mean engine cost per player per tick | 0.0060 ms |
| Snapshot frequency per player | 19.94 Hz |
| Approximate payload bandwidth per player | 14.37 KB/s |
| Total measured process CPU | 202 ms |
| Approximate process CPU per player-second | 2.01 ms |

The separate real socket run measured **0.0737 ms mean / 0.5510 ms maximum** per competition simulation tick. It emitted 1,680 snapshots (347,970 JSON payload bytes) across ready, active and terminal phases. Its longest observed database lease round trip was **1,325 ms**, illustrating the importance of the separate prewarmed lease channel and staging database/network verification.

A final focused repeat, including the strengthened old-versus-new nonce assertion, passed **55/55** again. That repeat measured **0.0774 ms mean / 1.0591 ms maximum** simulation tick cost and a **2,657 ms maximum database lease round trip**. These heartbeat metrics include readiness and finalization, not just active simulation. This observed database latency spike is a material staging/capacity limitation; active play must stop/refund when its conservative lease bound is exceeded. Passing local tests does not establish that the staging network/database path meets the operational latency budget.

These are early feasibility measurements, not capacity certification: the 20-state benchmark excludes Socket.IO/TLS/database overhead, lasts five seconds and does not prove sustained production load. Actual staging RTT, browser smoothness and mobile playability remain unverified.

### Changed files and final Git state

Created:

- `docs/PHASE_5_5A_AUTHORITY.md`
- `packages/shared/src/authority.ts`
- `packages/server/drizzle/0010_competition_authority.sql`
- `packages/server/src/competitions/authorityStore.ts`
- `packages/server/src/competitions/authorityRuntime.ts`
- `packages/client/src/game-loader/AuthorityCompetition.tsx`
- `scripts/competition-authority-check.ts`

Modified:

- `PROGRESS.md`, `GAMES.md`
- `package.json`, `games/package.json`
- `packages/shared/src/index.ts`, `packages/shared/src/matchmaking.ts`
- `packages/server/.env.example`, `packages/server/drizzle/meta/_journal.json`
- `packages/server/src/db/schema.ts`
- `packages/server/src/competitions/lifecycleEngine.ts`
- `packages/server/src/matchmaking/index.ts`, `packages/server/src/matchmaking/matches.ts`
- `packages/server/src/routes/competitions.ts`
- `packages/client/src/game-loader/MatchLoader.tsx`
- `packages/client/src/components/CompetitionConfirmationModal.tsx`
- `scripts/migration-schema-parity-check.ts`

Deleted: none.

Implementation remains uncommitted on `codex/phase-5-5a-live-authority`: **16 modified tracked files and 7 new files**. HEAD is the separate architecture documentation commit `1361cce1e5d2b5b83701ccd6e2935ce05c530a16`; that commit does not contain the runtime work. Local main also points to the documentation commit; the fetched origin/main baseline is `2cbc429caed07dc4e8ece05bbb4662fb27667018`. No push, merge, staging/production deployment, real-money operation, other-game migration, replay deletion, Diamond retirement, Phase 6 implementation or Phase 7 work occurred.

**Verdict:** Phase 5.5A is a local implementation candidate for a separately authorized manual staging trial. **Staging/manual acceptance is NOT PASS / not performed.** Full Phase 5.5 is not complete.

## Requested 24-field completion summary

| # | Field | Result |
|---|---|---|
| 1 | Initial Git state | `main` = HEAD = fetched origin/main = `2cbc429`; three architecture documents uncommitted. |
| 2 | Documentation commit | `1361cce1e5d2b5b83701ccd6e2935ce05c530a16`, separate from runtime work. |
| 3 | Implementation branch | `codex/phase-5-5a-live-authority`. |
| 4 | Runtime audit | Browser score → legacy socket handler was disconnected from competition lifecycle; separate service used replay. Pre-change audit above. |
| 5 | Schema | Four additive authority tables; immutable result/decision updates; lease/controller metadata; original history retained. |
| 6 | Migration | `0010_competition_authority.sql`, journal entry 10; parity passes 321 assertions. |
| 7 | Session foundation | Authenticated user, instance/match/game/version, random nonce/hash, epochs, readiness, live timing, owner lease, immutable results and one decision. |
| 8 | Protocol | Bound ready/current controls/resume/forfeit; full current snapshots and durable outcome; no trusted client score. |
| 9 | Space Blaster | Existing engine reused server-side; client renderer never runs scoring physics; versioned 180-second competition cap. |
| 10 | Real completion | Authenticated Socket.IO → ready/capture/countdown → live engine → receipts → accounting → terminal outcome passed, including a normal firing-earned win. |
| 11 | Lifecycle | LOCKED → ACTIVE → VERIFYING → SETTLED/VOIDED; explicit forfeit and failure alternatives; legacy completion cannot bypass authority. |
| 12 | Settlement | Predetermined 900-minor-unit prize / 100 margin fixture, tie refunds, exactly-once application and recovery verified. All funds simulated. |
| 13 | Adversarial tests | Binding, ownership, nonce/epoch, sequence/rate/stale/malformed input, fake score/winner, duplicates, expiry, disconnect and recovery included in 55 authority assertions. |
| 14 | Exact counts | 37 distinct scripts / 1,365 assertions / zero failures; every script listed above. Builds/typecheck/diff check pass. |
| 15 | Performance | 20-state wall-clock benchmark: 59.83 Hz ticks, 19.94 Hz snapshots, 0.0060 ms mean engine tick/player, about 14.37 KB/s/player. Limits above. |
| 16 | Replay remaining | Shared replay driver/adapters, legacy score service and casual input collection/history remain. New authority path does not use them. |
| 17 | Diamond remaining | Legacy Diamond queue, stake, ledger, wallet and related backend paths retained. No retirement in this step. |
| 18 | File changes | Seven created, sixteen modified, none deleted; exact list above. |
| 19 | Progress update | PROGRESS.md Session 79 and GAMES.md updated with verified scope, counts and limitations. |
| 20 | Final Git state | Runtime work uncommitted; HEAD remains documentation commit. No push/merge/deploy. |
| 21 | Manual staging readiness | Candidate ready for a separately authorized controlled trial. Flag off; deployment, network/mobile/browser acceptance unperformed. |
| 22 | Other three games | Not migrated; public authority entry remains blocked for all three. |
| 23 | Phase 6 | Implementation/evidence generation not started. |
| 24 | Phase 7 | Not started. |
