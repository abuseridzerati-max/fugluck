# Phase 5.5A remediation — 2026-09-24

## Scope and evidence status

This focused branch starts at the tested implementation `5a6d4847c6efc77feb64d0305d4ccfe1b7edc0ad`. The previous acceptance record remains in local commit `3b91ccfdc7c54a35857a499fe048a60c43dc6307` on `codex/phase-5-5a-live-authority`. Neither historical commit was rewritten. Main merging, production deployment, the other games, replay/Diamond retirement and Phases 6/7 are excluded.

**Final staging acceptance: NOT PASS.** The remediated runtime starts and settles real staging games, but intermittent transport latency, incomplete narrow-screen control verification and newly exposed admin reconciliation/state defects prevent acceptance. Local test success is not manual acceptance.

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
| 1 | 2 | 59.743 | 20.246 | 0.1122 / 1.5579 | 814.49 | 422 | 110.59 |
| 10 | 20 | 59.922 | 20.140 | 0.0256 / 0.3296 | 814.94 | 1031 | 84.00 |
| 20 | 40 | 60.262 | 19.977 | 0.0160 / 1.0989 | 811.59 | 1532 | 90.88 |


Target 60 Hz / 20 Hz. No tick waits on the injected 800 ms heartbeat; lease loss test stops safely. These are three-second active measurement windows with real sockets and engines, not sustained capacity certification. The separate real-database authority run passed 55/55, averaging 0.0722 ms per run tick, maximum 1.0251 ms; its maximum heartbeat across all phases was 1,295.4 ms. Normal terminal accounting still takes seconds and remains durable.

## Deployed revision and live trial evidence

Source commit **`996c9b4cb97ee364508558350a0d3d5df3595bbf`** was pushed to `codex/phase-5-5a-remediation`; local and remote implementation HEAD matched. Render deployment **`dep-daqeqmqd0e5s73aas9a0`** reports Live at that exact SHA. Vercel Preview deployment **6634516210** reports success for the same SHA, at `arcadeclash-client-ncsrclqhx-akatsuki-66a7.vercel.app`. Provider UI confirms only `staging.fugluck.com` was reassigned to the remediation Preview branch. The loaded client asset is `index-BqIXOLB0.js`. Backend `/api/health` reports database connected; the warm catalog returned in 585 ms. Production/main was not deployed or merged.

The existing controlled template `tmpl_af4e8de1-f347-4cdf-84b5-87ad48eefa47` was edited through the admin UI to **Phase 5.5A — Controlled Space Blaster Remediation Trial**; its rules, 500-minor-unit entry and 900-minor-unit predetermined prize were retained. Actual edit/enable/disable/re-enable/cleanup-disable operations succeeded. Other templates were not changed. Three QA sessions were created through staging signup and the existing simulated faucet. One initial setup HTTP request timed out; retry completed without raising the request or admission limit. The first timed-out request's exact stage is unproven. No login/password-manager recording was made, and screenshots exclude account identifiers.

Seven new trials were performed, separate from the four prior trials. Full IDs and measured evidence are in `docs/evidence/phase55a-remediation/`.

| Trial / instance prefix | Result | Evidence / limitation |
|---|---|---|
| Socket/security, `inst_cb44ceb9` | SETTLED / SERVER_RESULTS | 15/15 checks, earned score 242; active reconnect 815.8 ms, rotated epoch/nonce; fabricated score and stale/duplicate/excessive input rejected; duplicate terminal request rejected. |
| Desktop browser, `inst_20e5ca4d` | SETTLED / SERVER_RESULTS | Visible ship, asteroids, score progression and natural opponent-win screen. Partner scored 143. Active controls appeared; sustained manual steering/smoothness was not conclusively demonstrated. |
| 375px browser, `inst_d8fa63f8` | SETTLED / SERVER_RESULTS | Actual `innerWidth=375`, Fire click produced a visible projectile; active screenshot saved. Partner scored 62. Movement action reached a completed run, so it is not claimed as verified steering. |
| First 320px attempt, `inst_de27280c` | VOIDED / LATENCY_ADMISSION_FAILED | Both RTT windows failed: p95 331.4/362.7 ms; jitter 226.6/237.8 ms. Entry released; no game started. |
| 320px retry, `inst_9327bc9c` | SETTLED / SERVER_RESULTS | Actual `innerWidth=320`, no horizontal document overflow; completed canvas/layout observed, partner scored 211. Active button interaction was not captured before the browser player's collision. Ordinary partner controls encountered INPUT_STALE and a 517.3 ms snapshot gap. |
| Both active clients disconnected, `inst_a7273f68` | VOIDED / BOTH_DISCONNECTED | 9/9 checks; no winner; durable outcome retrieved after reconnect; both captured entries refunded. |
| Readiness expiry, `inst_86ad7004` | VOIDED / READY_EXPIRED | 9/9 checks; legacy fake score did not complete the session; late terminal request rejected. |

The three socket suites report **15 + 9 + 9 passing assertions** (including repeated security cases). This does not count the failed browser admission as a pass. Five of six actual readiness attempts reached ACTIVE; the seventh trial deliberately never readied. Reliable entry is therefore not established.

### Live timing

| Measurement | Observed staging result |
|---|---|
| Accepted admission p95 RTT | 67.5–85.7 ms; jitter 2.6–15.9 ms |
| Rejected admission p95 RTT | 331.4 / 362.7 ms; jitter 226.6 / 237.8 ms |
| Received tick rate, four natural games | 59.991–59.999 Hz |
| Received snapshots, four natural games | 19.997–20.000 Hz |
| Client snapshot maximum gap | 289.0 / 163.3 / 129.5 / **517.3 ms** |
| Maximum server snapshot scheduling gap | 80.2 ms across these trials; 53.9 ms during the failed admission |
| Maximum server tick computation | 1.3375 ms |
| Active heartbeat maxima | 230.5–268.6 ms |
| Waiting / finalizing heartbeat maxima | 252.9 / 1,658.4 ms |
| Result receipt write maximum | 1,681.7 ms |
| Durable terminal-decision writes | 1.807–1.909 seconds; see raw metrics |
| End-to-end finish/settlement | 6.153–7.833 seconds after play ends |
| Durable binding maximum / full reconnect | 240.0 / 815.8 ms |

The high client RTT and received-frame gaps are not accompanied by a comparable server snapshot pause or DB heartbeat spike. This supports a client/transport-path delay rather than a synchronous simulation query. The exact contribution of the local host, client scheduling, routing or provider transport is **not isolated**. The fresh sampling fix removes a stale verdict; it does not eliminate those real tail delays. Moving the Tokyo database would not by itself prove this independent problem solved. Thresholds were not relaxed and no infrastructure migration was attempted.

### Accounting and newly exposed blockers

Authenticated read-only staging SQL verified **7 decisions applied, 4 WIN, 3 VOID, exactly 4 correct 900-minor-unit winner credits**, with algebraic trial ledger sum zero. Each winner has the expected 1,000 captured / 900 prize / 100 margin settlement. Duplicate completion was rejected, and the existing local real-database tests separately prove idempotent accounting application. We did not invoke internal accounting methods directly against staging with a copied database credential.

For the active disconnect void, direct SQL verified two REFUNDED reservations, 1,000 minor units credited back to players, zero escrow remaining and zero ledger sum. **However, the admin instance report displays a false 1,000-minor-unit discrepancy.** Source inspection of `sandboxAdapter.ts:815` shows the per-instance formula counts captured inflow minus prizes/margin but omits ENTRY_REFUND outflow. The independent global double-entry check is zero. These are different checks; a balanced global ledger does not make the instance report pass.

The same terminal VOIDED instance still displays participants as **PLAYING**, with rank 1. `AuthorityStore.apply()` updates rank/prize but does not transition participant status for that system void. These records were preserved; no history was rewritten to conceal the defect. Additional observed UI defects are a `Total: 0` instance count despite 11 displayed records and a no-op “Cancel waiting entry” button after a player's run has completed. These findings were not corrected in this deployed remediation revision and remain explicit follow-up work.

Final SQL verified **global ledger sum 0, escrow 0, reserved balance 0, open controlled trials 0, controlled template disabled**. Existing player/admin browser console error/warning collections were empty. Expected adversarial socket rejections and ordinary INPUT_STALE warnings are distinguished in the trial logs. The old Render recovery warnings at 12:38–12:46 belonged to the earlier credential-failure process, not this deployment. The temporary QA session-token file was removed; accounts, historical results, ledger and audit records remain intact. No new staging database credential file was created.

### Acceptance decision

**NOT PASS.** Actual play, earned winners, authority timing, reconnect, safe failure decisions and admin template HTTP methods now have evidence. Acceptance remains blocked by intermittent admission/transport latency, incomplete desktop/320px steering and smoothness verification, and incorrect per-instance refund reconciliation/terminal participant reporting. Screenshots and local/server statistics do not substitute for the missing playability acceptance. As requested, work stops at this Phase 5.5A verdict; no next phase or main merge follows.

## Required 33-field completion report

| # | Field | Result |
|---:|---|---|
| 1 | DB rotation | User completed reset and Render update; connectivity/schema independently verified. New secret not copied, old secret not retried. |
| 2 | Exact latency cause | Measured socket RTT/jitter exceeded policy; stale connection-time sampling corrected. Remaining transport/client tail-delay source not isolated; no direct DB term in RTT. |
| 3 | Old admission | One 20-sample connection-time result cached for the entire socket connection. |
| 4 | New admission | Fresh readiness window, same 100 ms p95 / 30 ms jitter limits, complete samples required, controller reauthentication and bounded ack callbacks. |
| 5 | Heartbeat before/after | Already asynchronous batched 500 ms renewal via separate prewarmed pool; preserved, with richer timings and failure-duration logging. |
| 6 | Synchronous DB in loop | No awaited ordinary tick/snapshot query. Binding, startup/capture and terminal durability remain awaited transitions. |
| 7 | Regions | Render Frankfurt Free; Supabase Tokyo Nano, shared pool 15/max clients 200; mismatch retained and disclosed. |
| 8 | Admin methods | Wrong client PATCH replaced by existing PUT edit / POST enable / POST disable; live UI actions succeeded. |
| 9 | Added regression tests | Real admin HTTP 14 assertions; real socket/engine latency and lease fault injection 26 assertions. Existing durability/idempotency checks retained. |
| 10 | Local performance | 1/10/20 sessions: 59.743/59.922/60.262 Hz ticks; 20.246/20.140/19.977 Hz snapshots; full table above. |
| 11 | Remediation commit | `996c9b4cb97ee364508558350a0d3d5df3595bbf`; pushed. Final acceptance documentation is a separate local-only commit. |
| 12 | Frontend revision | Same `996c9b4`, Vercel Preview 6634516210; staging hostname only. |
| 13 | Backend revision | Same `996c9b4`, Render `dep-daqeqmqd0e5s73aas9a0`, Live/DB connected. |
| 14 | Desktop | Visibly active and naturally completed; sustained steering/smoothness acceptance incomplete. |
| 15 | Mobile | 375px active Fire/projectile verified; 320px one admission rejection, retry completed but active steering not conclusively verified; no physical-device claim. |
| 16 | Reconnect | Active authenticated reconnect passed at 815.8 ms; nonce/epoch replacement and old-controller fencing passed. |
| 17 | Winner payout | Four actual server-results WIN decisions, one correct 900-minor-unit credit per winner, expected margin 100 each. |
| 18 | Client/server RTT | Accepted p95 67.5–85.7 ms; failed p95 331.4/362.7 ms. |
| 19 | Tick rate | Four natural trials 59.991–59.999 Hz received progress. |
| 20 | Snapshot rate | 19.997–20.000 Hz average; worst observed delivery gap 517.3 ms, so average rate alone does not pass smoothness. |
| 21 | DB heartbeat | Active max 268.6 ms; waiting max 252.9; finalizing max 1,658.4. |
| 22 | Settlement latency | 6.153–7.833 seconds; durable decision write 1.807–1.909 seconds. |
| 23 | Accounting/reconciliation | Actual postings/refunds/escrow balance verified; global sum 0. Admin per-instance refunded trial falsely reports TEST GEL 10 discrepancy: FAIL. |
| 24 | Errors | No captured browser console errors/warnings; real transport/stale-input failures remain. Admin refund/state/count presentation defects documented. |
| 25 | Final verdict | **Phase 5.5A NOT PASS.** |
| 26 | Remaining blockers | Transport reliability and full control/smoothness evidence; correct refund reconciliation and terminal participant reporting, with focused regressions before new acceptance. |
| 27 | Final Git | Runtime remote remains `996c9b4`; final docs/evidence committed locally only, one commit ahead, clean tree. Prior local `3b91ccf` preserved separately. |
| 28 | Main merge | None; remote main independently rechecked at `2cbc429`. |
| 29 | Other games | Runner, Dash and Hopper not migrated. |
| 30 | Replay retirement | Not started. |
| 31 | Diamond retirement | Not started. |
| 32 | Phase 6 | Not started. |
| 33 | Phase 7 | Not started. |

## Redacted visual evidence

- [375px live play / visible projectile](evidence/phase55a-remediation/mobile-375-active.png)
- [Desktop entry and separate prize](evidence/phase55a-remediation/desktop-entry-confirmation.png)
- [Desktop normal terminal result](evidence/phase55a-remediation/desktop-terminal-result.png)
- [375px entry confirmation](evidence/phase55a-remediation/mobile-375-entry-confirmation.png)
- [320px latency void/refund](evidence/phase55a-remediation/mobile-320-latency-refund.png)
- [Admin refund reconciliation blocker, cropped to exclude accounts](evidence/phase55a-remediation/admin-refund-reconciliation-blocker.png)
- [Raw bounded authority timings](evidence/phase55a-remediation/authority-metrics.txt)
- [SQL cleanup verification](evidence/phase55a-remediation/cleanup-sql.txt)
