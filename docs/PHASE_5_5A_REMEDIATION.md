# Phase 5.5A remediation — 2026-09-24

## Scope and evidence status

This focused branch starts at the tested implementation `5a6d4847c6efc77feb64d0305d4ccfe1b7edc0ad`. The previous acceptance record remains in local commit `3b91ccfdc7c54a35857a499fe048a60c43dc6307` on `codex/phase-5-5a-live-authority`. Neither historical commit was rewritten. Main merging, production deployment, the other games, replay/Diamond retirement and Phases 6/7 are excluded.

**Acceptance remains NOT PASS pending the new staging trials.** Local tests cannot establish browser or network playability.

## Credential rotation and infrastructure

- Rotation was performed and confirmed by the user. They updated Render and confirmed successful deployment. We did not copy the new credential. Independent `/api/health` returned database connected and the catalog returned six templates. The old credential was not retried.
- Authenticated Render UI showed the successful restart deployment `dep-daqe7l8u01pc73frmdr0`, running the original `5a6d484`, Frankfurt (EU Central), Free instance. This is the credential restart, not the remediation deployment.
- Authenticated Supabase Infrastructure UI independently showed staging project `wgdsdjzcekpkocblzikn`, primary **Tokyo / ap-northeast-1**, `t3.nano`, no read replicas. Database settings showed shared pooler pool size 15, maximum clients 200. Frankfurt to Tokyo is a material region mismatch.
- Source inspection: normal PostgreSQL pool is reused; authority has a separate max-one lease pool, prewarmed on run creation. Renewals batch run IDs every 500 ms. No per-frame connection creation. A region move, paid plan or infrastructure migration was not performed. Cold-start contribution to the historical tail latency is unproven.

## Root cause and admission policy

Source and prior staging logs establish that admission measured **server-clock Socket.IO acknowledgement RTT**: 20 probes, one every 250 ms, 6.5-second deadline. Sorted index 18 (nearest-rank p95) must be at most 100 ms; p95 minus index 9 (median) at most 30 ms. The probe has no database call. Network transport, client processing and event-loop scheduling contribute to RTT; DB query duration is not added to it.

Previous staging logs recorded p95 102.88–301.99 ms and jitter 26.46–225.17 ms for rejected measurements. One replacement connection passed 80.6 / 6.25 ms. Read-only authenticated staging SQL independently confirmed three prior competitions voided for admission and one for READY_EXPIRED, with all four decisions applied; the latter was the deliberate readiness-expiry test. Therefore "all four failed latency" was an imprecise handoff statement. Local loopback does not reproduce the deployed network path.

The verified old design flaw was sampling once at socket connection and caching that verdict for the connection lifetime. An early tail spike or later network deterioration could make that cached decision inappropriate at readiness. **BUILT, source-reviewed:** readiness now measures a fresh 20-sample window, binds it to the current controller epoch, blocks duplicate pending requests and reauthenticates after waiting. A replaced controller cannot ready or void its successor. Incomplete/invalid samples reject. Thresholds, lease expiry, simulation-lag limits and authority fencing are unchanged. Historical logs do not prove whether early connection warmup caused the rejected spikes.

Classification: **G** verified client/server RTT/jitter exceeded policy; **E** corrected stale sampling time, while the underlying metric was already network RTT. **C** verified region mismatch is an operational DB latency risk, not a direct admission measurement. **A** is ruled out by code; **B** is unproven; **D** applies deliberately to durable transitions but not ordinary ticks; **F** cannot be judged as overly strict without actual playability evidence. No threshold was raised to manufacture a pass.

## Tick, snapshot and durability trace

**BUILT, source-reviewed:** timer → in-memory current-input validation → fixed-step engine update → current snapshot publication → return. The ordinary tick does not await a query. Separately, the renewal timer submits an asynchronous batched lease update. Acknowledgement updates the conservative local lease clock; missing it for 1.9 seconds stops authority, with a two-second database lease. This architecture was already present and is retained.

Binding/epoch changes, READY/start capture, immutable terminal receipts, terminal decisions and accounting application remain durable. An engine terminal state starts a result-write promise; settlement waits for receipts before committing the decision. Terminal persistence failure produces uncertainty handling instead of an unjustified award. No result is trusted from a client score.

Stress testing exposed an additional concrete scheduling defect: resetting the 50 ms snapshot anchor to the current timer time accumulated drift, producing approximately 16 Hz on this Windows runtime. **BUILT:** advance the existing schedule by whole 50 ms intervals and publish only the latest state; avoid burst catch-up. Focused reruns reached approximately 20 Hz. This snapshot issue did not cause the historical admission rejection.

## Admin contract and instrumentation

**BUILT, real HTTP tested:** edit uses existing `PUT /api/admin/competitions/templates/:id`; enable/disable use existing `POST .../:id/enable` and `/disable`. The client previously sent PATCH for both operations. RBAC, audit history and server routes are retained.

Bounded structured metrics now include tick duration, snapshot publication duration/gap/count, fresh RTT summary, waiting/active/finalizing heartbeat latency, durable bind duration, result-write duration, terminal decision-write duration, accounting application duration and total finish duration. They omit credentials, nonces, controls and account names. Durations are server-side measurements, not a claim of visual smoothness.

## Regression coverage

- New admin HTTP check: 14 assertions using the real router, authentication middleware and guarded disposable database. Covers persisted edit/enable/disable, anonymous/player denial, wrong methods, unchanged state and exact audit actions. Fixture OWNER role is released in `finally` while preserving its audit history. The first canonical attempt exposed this cleanup omission; that attempt is not a pass.
- New latency check: 26 assertions, actual authority runtime, Socket.IO, engines and timers with an explicitly injected asynchronous store. Real socket admission is enabled. At 1/10/20 sessions an 800 ms heartbeat must leave ticks/snapshots running; a 2.5-second renewal must stop authority and void. Boundary/missing/invalid/jitter admission cases are included. Database durability and settlement idempotency remain covered by the existing real-database 55-assertion authority suite.
- Stress windows last three seconds at each population, after readiness. They establish a bounded regression result, not sustained capacity certification or staging acceptance.

## Validation and deployment

Fresh canonical execution passed **37 scripts / 1,350 assertions / zero failures**. Separate atomic accounting passed **37** and database safety **18**: **39 distinct scripts / 1,405 assertions**. Typecheck/client production build, server build and diff checks passed. Existing Vite large-chunk advisory remains. A final staging-readiness focused repeat also passed 34/34 after deployment-document edits; focused reruns are not double-counted. All database tests used the guarded disposable Neon database, not staging.

| Script in scripts/ | Passed | Failed |
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
| competition-admin-http-check.ts | 14 | 0 |
| competition-authority-latency-check.ts | 26 | 0 |

### Final local stress measurements

| Sessions | Players | Tick Hz | Snapshot Hz | Mean / max tick ms | Max heartbeat ms | CPU ms | RSS MiB |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 2 | 59,743 | 20,246 | 0,1122 / 1,5579 | 814,49 | 422 | 110,59 |
| 10 | 20 | 59,922 | 20,140 | 0,0256 / 0,3296 | 814,94 | 1031 | 84,00 |
| 20 | 40 | 60,262 | 19,977 | 0,0160 / 1,0989 | 811,59 | 1532 | 90,88 |


Target 60 Hz / 20 Hz. No tick waits on the injected 800 ms heartbeat; lease loss test stops safely. These are three-second active measurement windows with real sockets and engines, not sustained capacity certification. The separate real-database authority run passed 55/55, averaging 0.0722 ms per run tick, maximum 1.0251 ms; its maximum heartbeat across all phases was 1,295.4 ms. Normal terminal accounting still takes seconds and remains durable.

Remediation deployment and live staging trials are pending. Revision IDs and the final 33-field verdict will follow actual execution.
