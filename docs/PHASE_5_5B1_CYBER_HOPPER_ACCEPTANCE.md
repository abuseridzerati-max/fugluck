# Phase 5.5B1 — Controlled Cyber Hopper Authority Acceptance

**Verdict: PASS**  
**Accepted:** 2026-09-25  
**Scope:** Staging-only `tmpl_cyber_hopper_authority_trial` with `cyber-hopper-rv001-v1`.

This acceptance covers the controlled two-player Cyber Hopper live-authority trial only. It does not certify the default `ch-1.0` Cyber Hopper template or authorize other games, production changes, or later phases.

## Revision and template

The staging frontend and backend were both verified at `edc949727ca0a4b690fe589141910c7aba2d605c`.

- Vercel Preview `Fxgd5kFCoAVqokPq8oSXHMK99Pg`: Ready; commit `edc9497`; branch `codex/phase-5-5b-cyber-hopper-authority`.
- `staging.fugluck.com`: Valid Configuration assigned to that branch.
- Render service `fugluck-api-staging` (`srv-da2c50c9v7es73db3dkg`): Live at the same full commit.

The newest successful controlled instance is `inst_529ae7ce-d8f2-45cf-8974-87d8d4e9ea52`, created 2026-09-25 12:41:06 local. The Admin snapshot showed `cyber-hopper`, `HEAD_TO_HEAD`, two of two participants, TEST GEL 5 entry, TEST GEL 9 first prize, and immutable rules version `cyber-hopper-rv001-v1`. The controlled template ID was `tmpl_cyber_hopper_authority_trial`.

## Admission, sessions, and server authority

The Render logs contain two separate 20-sample admission records for this exact instance. Admission limits remained p95 RTT ≤ 100 ms and p95-minus-median jitter ≤ 30 ms.

| Device session | p95 RTT | Median RTT | Jitter | Result |
|---|---:|---:|---:|---|
| A | 92.204621 ms | 73.059804 ms | 19.144817 ms | Accepted |
| B | 83.603253 ms | 69.250162 ms | 14.353090 ms | Accepted |

Both participants reached readiness; the server started the run and captured entries only after both sessions were ready. The runtime reported 606 fixed simulation ticks over 10.103 seconds, 294 accepted controls, 738 snapshots, and 296 active WebSocket snapshot deliveries attempted with zero backpressure. The logged maximum snapshot gap was 60.927 ms. The final reason was `SERVER_RESULTS`.

The server creates one authority session per locked participant and binds each to the authenticated user, instance, match, game, authority version, controller nonce, and epoch. `AuthorityRuntime` authenticates that binding for every control; a Cyber Hopper control message permits only hop directions and binding/sequence fields. The client renderer does not run game physics or submit a result. Server snapshots carry grid position, score, round count, and active obstacles. The server engine owns grid movement, seeded car/hazard simulation, collision detection, and scoring. The immutable results are collected from the server engines and determine the terminal result. Source references: `packages/server/src/competitions/authorityStore.ts`, `packages/server/src/competitions/authorityRuntime.ts`, `games/cyber-hopper/engine.ts`, and `packages/client/src/game-loader/AuthorityCompetition.tsx`.

The exact session UUIDs and controller IDs are intentionally absent from Render's sanitized operational logs and are not shown in the Admin instance detail. The two independent per-instance admission records, active-run metrics, accepted server controls, snapshots, and terminal results provide runtime evidence of both sessions participating. Local authority checks additionally exercise authenticated session/user/instance/match/game/version/nonce/epoch binding and controller replacement/reconnect fencing.

## Result, lifecycle, and accounting

Admin instance detail showed both participant projections terminal as `SUBMITTED`: scores 10 and 50; ranks 2 and 1; the rank-1 participant received the predetermined TEST GEL 9 prize. The lower score received no prize. The winner matched the server-owned scores; no unjustified winner was awarded.

The observed lifecycle completed through authority creation, both readiness/admission checks, capture/start, active gameplay, immutable server results, one terminal `SERVER_RESULTS` decision, accounting application, and `SETTLED`. Admin instance accounting reported:

- TEST GEL 10 captured (two TEST GEL 5 entries)
- TEST GEL 9 prize paid
- TEST GEL 1 platform margin
- TEST GEL 0 refunds and TEST GEL 0 promotional subsidy
- TEST GEL 0 discrepancy; instance `BALANCED (Zero Discrepancy)`

Render recorded one terminal-decision write and one terminal application for this instance, followed by one settlement summary. The existing stable decision idempotency key, transaction locking, and local duplicate-completion tests prevent duplicate settlement. The global Admin reconciliation view was `BALANCED`, `HEALTHY`, with ledger sum TEST GEL 0 and discrepancy TEST GEL 0. The global view also included unrelated active-match escrow, so this acceptance relies on the exact instance reconciliation for the trial amounts.

## Earlier latency failure comparison

The preceding same-computer browser-plus-Incognito attempt was instance `inst_329bd9ae-9781-404d-b681-8cc0ac40f2e2`. One participant measured p95 RTT 102.327556 ms, median 72.374105 ms, jitter 29.953451 ms and was correctly rejected. The second measured p95 RTT 99.261706 ms, median 75.045484 ms, jitter 24.216222 ms and passed. The instance stopped with `LATENCY_ADMISSION_FAILED`, zero ticks, and no gameplay. The later two-device trial passed both sessions: p95 values 92.204621 ms and 83.603253 ms, respectively. No latency threshold was relaxed.

## Human and operational acceptance

The user reports that on two separate physical devices Cyber Hopper started successfully, physical controls worked, and gameplay worked. No further human-only confirmation is required for this Phase 5.5B1 acceptance. This run did not capture an intentional reconnect, so reconnect behavior is supported by the focused authority suite rather than claimed as a physical result from this instance.

The inspected Render application-log window contained no instance-correlated socket, server, database, or authority exception. It did show unauthenticated `/api/auth/me` 401 polling warnings before the successful run; these were not associated with the instance and did not prevent gameplay. The physical-device browser console was not retained for direct retrospective review.

## Closure

After the successful acceptance, the staging Admin template workflow disabled `tmpl_cyber_hopper_authority_trial`; its refreshed row showed `DISABLED`. The default `tmpl_default_cyber_hopper_standard` remains a separate `ch-1.0` template and its public live-authority path remains blocked. Staging and production were not conflated; no production setting or data changed.

Preserved sanitized Render log lines and the Admin evidence summary are in [`docs/evidence/phase55b1-cyber-hopper/authority-run-20260925.txt`](evidence/phase55b1-cyber-hopper/authority-run-20260925.txt). The focused local suites on this revision passed: Cyber Hopper authority 42/42, general competition authority 65/65, authority latency 26/26, and authority presentation 24/24. The first parallel DB-backed invocation hit a disposable-test-database connection collision; individual serial reruns passed. No code or tests were changed for this acceptance.

**Phase boundary:** no main merge; no architecture-consolidation work; no Neon Runner, Pixel Ninja Dash, replay retirement, Diamond retirement, Admin 2, Phase 6, or Phase 7 work.
