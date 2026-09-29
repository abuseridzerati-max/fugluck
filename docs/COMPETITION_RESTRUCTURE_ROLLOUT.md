# Knockout competitions — staging rollout report

## Latest verification — 2026-09-29

The recovery repair is pushed and deployed to STAGING at exact SHA `0d4ede659ec0776e46f1e583f879a234b9905331`. After the hosted tests, the temporary staging competition/knockout switches were returned to false and redeployed without changing code; the current Render deployment is `dep-datls6vlot8c73836t20` (Live), and Vercel Preview `AQyXcMmC87f8XJHEx7x4Su7nBhg2` serves the same revision at `staging.fugluck.com`. Live health, deployment identity, and CA-verified read-only database inspection report `APP_ENV=staging`, Frankfurt staging DB, and 14/14 migrations through `0013_knockout_tournaments` (head hash `a39b84386b0cfbfd5fcd7f6bdc3e7a18604d055398829bc8fb470efb9aef3a08`).

All `scripts/*-check.ts` passed after deployment: **50 scripts / 2,177 assertions / 0 failures**. Typecheck, client build, server build, and diff whitespace check passed. Hosted prep 45/45, edge cases 46/46, and closed-action guards 8/8 passed. Cyber Hopper active-Final restart recovery passed twice at 29/29 each. Space Blaster's ordinary bracket settled once for 1,800 minor units. Its restart harness stopped at 18/19 because it captured attempt 1 and later compared that stale checkpoint; independent Render Events and persisted authority/session/settlement rows verify that the active Final reconnected after the 10:32 AM Tbilisi service restart and the tournament settled once. Treat Space Blaster restart behavior as **PASS by independent corroboration; harness assertion failure retained**, not as a clean harness pass. Standard economics and Promo/GIFT qualification-cycle mechanics are covered by passing local fixture suites; no hosted mock play was allowed to earn qualification.

The final saved staging configuration has authority enabled, knockout admission disabled, all four real-money flags disabled, and all three mock deposit/withdrawal/competition action flags disabled. Live health confirms all mock action flags off; closed-action guard checks passed 8/8. Public frontend/backend TLS is valid. Public Production deployment and bundle were rechecked read-only and are unchanged; the production bundle still references the staging API. This report remains **NOT PASS / not ready for the next phase** because full hosted 8/16 progression, signed-in browser refresh persistence, and true cold-timeout/manual Retry acceptance remain open. The user replied “not yet” to provisioning twelve more owner-authorized synthetic accounts. The catalog did recover by automatic polling after the idle-first result; that does not prove the intended cold Retry path.

Historical initial rollout snapshot, September 28, 2026. **DEPLOYED; ACCEPTANCE NOT PASS; NOT READY FOR THE NEXT PHASE.** The user's exact-revision staging approval was exercised. Its first hosted restart requirement failed and was not converted to PASS by safe refunds or local tests. The later Space Blaster recovery observation is recorded above. [September 28 evidence](evidence/competition-restructure-staging-20260928.json) and [September 29 evidence](evidence/competition-restructure-staging-20260929.json) preserve the separate snapshots. Private archives, credentials, raw provider logs, synthetic-user credentials and executable one-off helpers stay outside Git.

## Historical exact deployment and containment — initial rollout

- Approved, pushed, frontend and backend revision: `ce45607257f52c882b86292c1e62fe42ad57e385`, branch `codex/competition-restructure`, descended from UI `4ae3fc3290bfbb1b367c57caeb01bd68140ead03` and all required commercial/authority ancestors.
- Vercel `arcadeclash-client` Preview: `5uV1zbnJSBHgFt2qGp14s8gNguMr`, Ready, `staging.fugluck.com`. Only the feature branch's Preview environment was set to staging with API `https://api-staging.fugluck.com`; Production scopes and aliases were untouched.
- Render `fugluck-api-staging`, `srv-da2c50c9v7es73db3dkg`, Frankfurt, Free plan, automatic deployment OFF. Final deployment: **dep-datbcafavr4c73cs5h60** at **2026-09-28T18:47:41Z**. The staging start command is `exec node --import tsx packages/server/src/index.ts`, verified by a direct-launch local smoke check and hosted startup. It makes the application receive SIGTERM; it does not by itself fix the transport-drain race.
- Final saved/runtime settings: `APP_ENV=staging`, `NODE_ENV=production`, authority enabled; **all four `REAL_MONEY_*` flags false; all three staging mock action flags false; `ENABLE_KNOCKOUT_TOURNAMENTS=false`**. The installed mock mode and four-user synthetic allowlist remain private; no real provider/bank was added. Closing admission does not erase history or undo accepted obligations.
- Final public identity, database readiness, migration reporting, TLS, staging-origin CORS, production-origin denial, host-only Secure/HttpOnly/SameSite=Lax cookie and unauthenticated admin denial passed. Exact final values and timings are in evidence. Both staging TLS chains remain authorized.

The compatible 0013 runtime remains deployed with new knockout admission closed. Do not automatically redeploy the old 13-migration binary: its strict journal gate and recovery model do not support the new schema. No backup was restored over staging and no test history was deleted.

## Fresh protected backup, restore and migration

Verified target: Supabase Frankfurt staging project `gzfcucvxfzzjzjtgkwpd`, registered routing fingerprint `6b2e32ee04be948ac7015fe81ff6e32ca09ffee7491aade8e69041fcd18eb926`. Connection used the configured provider CA and `rejectUnauthorized: true`. No production database was opened.

| Backup fact | Verified value |
|---|---|
| Snapshot/archive started | `2026-09-28T17:28:51.623Z` |
| Archive completed | `2026-09-28T17:29:00.664Z` |
| Size | 195,691 bytes |
| SHA-256 | `3f705d9d4786ca1c9822fb72a82664a677a6002824d4e815a5e060021679375a` |
| Scope | 32 tables across `public` and `drizzle`, archive and manifest sharing one exported snapshot |
| Protection | Ignored private directory; inheritance disabled; current user and SYSTEM only |
| Restore | Fresh isolated PostgreSQL 17.11 cluster, loopback 55440, disposable `knockout_restore_20260928`, single transaction, stop on error |
| Parity | Rows/content, columns, constraints, indexes, triggers, functions, sequences, migration history, reconciliation, operations and balances matched |
| Rehearsal | Official 0013 applied to restored copy; 14-entry head, nine new tables, all 31 prior public tables unchanged |
| Cleanup | Isolated restore server stopped; protected archive retained |

The first restore at 17:26 stopped the rollout because strict CHECK-definition text comparison failed. PostgreSQL 17.6 and 17.11 printed casts differently for five existing commercial constraints. The source/restored expressions were parsed on the same isolated server: canonical definitions and **78 truth probes**, including null and disallowed values, matched. No constraint was removed or weakened. A **fresh** backup and complete restore/rehearsal were then performed, passing all comparisons. Both the failed first attempt and the equivalence proof remain in evidence. This application backup does not certify Supabase Auth/Storage, secrets or external-provider disaster recovery.

Final 0013 review found **no DROP TABLE, TRUNCATE, DELETE or legacy data rewrite**. The intentional DROP removes only the old unconditional authority-instance unique constraint, replaced by legacy-only uniqueness and bracket-attempt/live-run uniqueness. The official migrator required the exact prior 13 entries before applying the new entry.

- Applied on Frankfurt staging: `2026-09-28T17:32:48.763Z`–`2026-09-28T17:32:50.202Z`.
- Head: `0013_knockout_tournaments`, **14/14** entries.
- Applied LF SHA-256: `a39b84386b0cfbfd5fcd7f6bdc3e7a18604d055398829bc8fb470efb9aef3a08`.
- Exact accepted CRLF equivalent: `b071114af85a28c5c43a8bcb83246943190ed860e07aa0c981204c54e46c0914`.
- Journal version timestamp: `1790400000000`; this is not the application wall-clock time.
- Immediately after migration, all 31 prior public table hashes/counts matched. After hosted acceptance, all prior rows in all eight commercial tables still match their backup content, including **94 prior postings and 39 prior transactions**.
- Final reconciliation: **216 postings / 88 transactions**, all transaction groups balanced, no negative user balances, reserved funds, prize obligations, unresolved provider events, duplicate prizes, open competitions, active authority runs or unapplied decisions. Existing historical mock withdrawals were preserved; this rollout did not enable withdrawals.

## Acceptance matrix

| Requirement | Evidence and result |
|---|---|
| Standard 2/4/8/16 | All twelve hosted public products have correct terms. Full four-player games for both engines; hosted two-player forfeit/no-show; hosted partial 4/8/16 admission, duplicate join and cancellation. Complete 2/4/8/16 progression passes isolated domain fixtures. Full hosted 8/16-player play remains unverified. |
| 10% margin / 90% frozen prize | Hosted four-seat Space: 4 × 500 capture, 1,800 award; Cyber: 4 × 400 capture, 1,440 award. Local rules cover all capacities, games, rounding and configuration freeze. PASS within those scopes. |
| Promo six-hour / GIFT daily cycles | Hosted cycle projections and locked admission PASS. Local schedule/cutoff/timezone/rotation fixtures PASS. GIFT zero-entry/subsidy and Promo paid/subsidy settlement pass isolated commercial fixtures. |
| Five/ten Standard completions | Positive qualification is isolated-fixture PASS. Hosted mock/sandbox correctly earns zero credit and special admission is rejected. No fake hosted commercial qualification was inserted. |
| Next-cycle-only, expiry, no stockpiling | Isolated rules/domain/recovery tests PASS; hosted positive entitlement activation is not permitted by the current sandbox financial boundary. |
| One completion per tournament | Isolated three-run semifinal/Final fixture records one event per participant; hosted mock/sandbox records none. PASS at those scopes. |
| 2/4/8/16 bracket generation | Domain fixtures verify N−1 slots, no byes and one champion; actual hosted four-seat brackets contain three completed slots. |
| Durable server seeding | Seed commitments/order survive retries and both failed restart exercises; ordinary hosted games and local recovery fixtures PASS. Seeds are absent from player projections. |
| Duplicate terminal delivery | Hosted repeated terminal resume and duplicate forfeit create no second award; domain tests cover duplicate/stale advancement and final retry. PASS. |
| Tie/rematch | Hosted Space semifinal 9–9 draw created a fresh attempt for the same pair, then 155–11 win. PASS. |
| Forfeit/no-show | Hosted Space voluntary forfeit and Cyber ready/no-show advance and settle once; no-show has zero-tick receipts and no qualification. PASS. |
| Active tournament restart | Cyber Hopper: **PASS twice**, 29/29 each. Space Blaster: **PASS by independent corroboration**, with the harness's captured attempt-1 checkpoint mismatch retained as a failed harness check; after Render restarted the service, clients resumed active Final match `comp_match_63da405d-05dd-428c-9967-58fec49f66a8`, attempt 12 was fenced as `OWNER_STATE_LOST`, attempt 13 completed the same final slot, and one prize settled. |
| Final prize once / no round fees | Both ordinary hosted four-player finals settle exactly once, four captures each, no semifinal award or per-round fee. PASS. |
| Space Blaster | Genuine unchanged-engine hosted authority → bracket → final award PASS; active-Final recovery corroborated after staging service restart, with a stale harness checkpoint defect retained. |
| Cyber Hopper | Ordinary genuine hosted four-player authority → bracket → final award PASS. Active-Final hosted recovery PASS twice on the deployed repair, 29/29 each. |
| Real money/provider boundary | All real-money flags OFF throughout; mock withdrawals OFF; final mock actions OFF. Negative action guards and reconciliation PASS. No bank connected. |

Hosted counted suites: preparation/catalog/provider/guards **45/45**; Space ordinary tournament **23/23**; Cyber ordinary tournament **26/26** including final reconciliation checks; edge cases **46/46**; final closed-action guards **8/8**. The latest Space restart harness itself reported 18/19 because its first-run checkpoint went stale during repeated draws; the Render restart event and DB run/session/decision/payout evidence independently verify post-restart reconnection and exactly-once settlement. The prior two Cyber restart failures remain historical evidence for the earlier deployed revision; the two later Cyber recovery runs passed on the repair. Failed attempts and harness output are retained, not removed from the result.

## Earlier hosted games and restart failures (historical; superseded for recovery status above)

Space instance `inst_e1047648-0509-48af-ae7f-0711d47021bd` settled at `2026-09-28T17:54:46.095Z`, Final run `5024c8fe-fe4c-4046-85e2-b8fe20345c27`, final score **66–32**, award **1,800**. The real draw/rematch produced four authority runs for three bracket slots. Cyber ordinary instance `inst_5deead7a-05fb-4a4c-8f32-0069c5f48e71` settled at `2026-09-28T18:21:02.636Z`, Final run `809402af-128c-4124-be76-b964133ed6e5`, final **10–0**, award **1,440**. Ordinary clients acknowledged probes and sent controls; no score, winner, result or ledger row was directly injected. The hosted cap stayed **10,800 ticks**; neutral Cyber participants reached that cap.

1. Original start command: active Cyber Final in `inst_5e64f350-72c6-44d3-8dfa-63db0f320be5` became `BOTH_DISCONNECTED` during Render restart and was refunded.
2. Direct Node start command: active Final run `5c5ca7f9-44e6-44bc-b7a3-fd981e17c14c` in `inst_e38aad82-edce-48d3-b600-bb36d0b1d69c` did the same. At **18:11:56 UTC**, provider logs show `BOTH_DISCONNECTED` immediately before the application's SIGTERM log. Shutdown then emitted `ERR_SERVER_NOT_RUNNING` because Socket.IO had already closed HTTP. All four 400-minor entries were refunded; no Final prize was paid.

An intervening attempt encountered legitimate `LATENCY_ADMISSION_FAILED` retries. The helper incorrectly required two total historical runs, then disconnected clients when fresh attempts made four. It was corrected to count only live runs (`terminal_at IS NULL`). Existing p95/jitter limits (100/30 ms) were unchanged. This attempt also safely refunded and is not counted as a completed tournament.

Render documents SIGTERM during service shutdown in [its deploy lifecycle](https://render.com/docs/deploys); the exact transport/signal ordering above is established by this service's logs. **Local repair `e339f339e6f7c71adbe04200681a0401bdd49b52`** grants both disconnected players the existing reconnect window before voiding, fixes duplicate HTTP close, and permits successful cleanup to exit naturally. The new Windows-compatible lifecycle test emits SIGTERM in the child application; it is not a claim of Linux host-signal acceptance. The strengthened genuine local Cyber test disconnects clients before shutdown and resumes a new attempt. At the time of the original `ce45607` approval, this repair was local and undeployed. It was later pushed as a descendant and deployed at `0d4ede659ec0776e46f1e583f879a234b9905331`; latest staging recovery results are stated at the top of this report.

## Browser, idle and environment evidence

Anonymous staging Chromium checks passed: twelve cards, independent Entry/Prize, compact Join sign-in confirmation, Rules/details, hard refresh, EN/KA/RU rendering, desktop width 1265 with no overflow and mobile viewport 390 × 844 (content width 375, no overflow). Those are browser viewport observations, not physical-device certification.

The normal sign-in form displayed the test account, but My Competitions returned its Retry error and hard refresh signed out in the in-app browser. Independent normal cookie HTTP checks (without mock operator authorization) returned `/auth/me` **200**, `/competitions/mine` **200 / eight own instances**, and special eligibility `QUALIFY`. Browser session acceptance is **UNVERIFIED**; the available browser did not retain the session, and its client blocked a direct API-page diagnostic. That block was not bypassed and no browser-security or cookie rule was relaxed. Further independent browser verification is required before calling the signed-in UX accepted.

Warm knockout catalog: **115 / 108 / 110 ms**, twelve templates, all 200. After 16 minutes 10 seconds without agent application traffic, twelve cards were visible by the 17.861-second follow-up. Actual cold-provider state, the first six-second deadline and cold Retry remain **UNVERIFIED**. Final warm catalog and TLS values are in structured evidence. A successful warm request is not cold-start evidence.

Production remains unchanged: Vercel current Production `AtViaffzmmQELvKqBn8u56mxRZ6W`, main `91ca7533c8d4d3e78bc090031d69097731b03d8b`, asset `/assets/index-BMOhywaz.js`, SHA-256 `394007635f52addd95f3f886bb17594069486d12400f73a6e81ec9d741fb5e59`. Its staging API reference persists. Current source already fails closed for unregistered Production deployment; changing this staging branch cannot repair the old Production bundle. A separately approved Production retirement or independent disabled-money Production target remains required. No production deployment/configuration/database action was performed.

## Complete post-deployment regression

All **49 scripts / 2,172 assertions / zero failures** ran after staging deployment for the approved source. After the local recovery repair, all **50 scripts / 2,177 assertions / zero failures** ran. Both runs had zero exit failures or expected-count mismatches. Tests used guarded disposable loopback PostgreSQL; they were not pointed at the staging database. Typecheck/client production build and server build passed before and after the repair; Git whitespace check passed. No dependency, engine, financial rule or migration changed in the repair. Existing Vite bundle-size advisory remains.

| Script | Approved candidate PASS | Local repair PASS | Failures |
|---|---:|---:|---:|
| `admin-console-check.ts` | 49 | 49 | 0 |
| `admin-reset-recovery-check.ts` | 11 | 11 | 0 |
| `admin-security-check.ts` | 8 | 8 | 0 |
| `atomic-wager-lifecycle-check.ts` | 38 | 38 | 0 |
| `auth-account-lifecycle-check.ts` | 41 | 41 | 0 |
| `authority-presentation-check.ts` | 24 | 24 | 0 |
| `canvas-render-check.ts` | 21 | 21 | 0 |
| `commercial-financial-check.ts` | 76 | 76 | 0 |
| `competition-admin-http-check.ts` | 44 | 44 | 0 |
| `competition-authority-check.ts` | 65 | 65 | 0 |
| `competition-authority-latency-check.ts` | 26 | 26 | 0 |
| `competition-phase1-domain-check.ts` | 41 | 41 | 0 |
| `competition-phase2-accounting-check.ts` | 54 | 54 | 0 |
| `competition-phase3-lifecycle-check.ts` | 45 | 45 | 0 |
| `competition-phase4-ui-check.ts` | 44 | 44 | 0 |
| `competition-phase5-admin-check.ts` | 42 | 42 | 0 |
| `competition-player-ux-check.ts` | 110 | 110 | 0 |
| `cors-audit-check.ts` | 20 | 20 | 0 |
| `cyber-hopper-authority-check.ts` | 42 | 42 | 0 |
| `determinism-check.ts` | 12 | 12 | 0 |
| `environment-safety-check.ts` | 89 | 89 | 0 |
| `file-upload-audit-check.ts` | 4 | 4 | 0 |
| `financial-reconnection-check.ts` | 17 | 17 | 0 |
| `i18n-check.ts` | 65 | 65 | 0 |
| `input-validation-check.ts` | 20 | 20 | 0 |
| `legal-policy-help-check.ts` | 86 | 86 | 0 |
| `match-lifecycle-durability-check.ts` | 26 | 26 | 0 |
| `matchmaking-check.ts` | 65 | 65 | 0 |
| `migration-schema-parity-check.ts` | 338 | 338 | 0 |
| `owner-admin-lockout-check.ts` | 10 | 10 | 0 |
| `password-policy-check.ts` | 18 | 18 | 0 |
| `password-security-check.ts` | 13 | 13 | 0 |
| `rate-limit-check.ts` | 11 | 11 | 0 |
| `registration-verification-check.ts` | 9 | 9 | 0 |
| `request-logging-audit-check.ts` | 12 | 12 | 0 |
| `score-validation-check.ts` | 12 | 12 | 0 |
| `seed-admin-check.ts` | 7 | 7 | 0 |
| `shutdown-lifecycle-check.ts` | not yet added | 4 | 0 |
| `sql-injection-check.ts` | 19 | 19 | 0 |
| `staging-mock-commercial-check.ts` | 13 | 13 | 0 |
| `staging-readiness-check.ts` | 40 | 40 | 0 |
| `test-database-safety-check.ts` | 18 | 18 | 0 |
| `tournament-authority-check.ts` | 33 | 34 | 0 |
| `tournament-domain-check.ts` | 97 | 97 | 0 |
| `tournament-recovery-check.ts` | 52 | 52 | 0 |
| `tournament-rules-check.ts` | 180 | 180 | 0 |
| `wallet-friends-check.ts` | 48 | 48 | 0 |
| `wallet-settlement-concurrency-check.ts` | 16 | 16 | 0 |
| `wallet-settlement-integrity-check.ts` | 24 | 24 | 0 |
| `xss-audit-check.ts` | 17 | 17 | 0 |

## Remaining gates and Git state

- **BLOCKED:** full hosted 8/16-player play until twelve additional distinct synthetic staging accounts are authorized by their owners, complete terms acceptance themselves, and are explicitly allowlisted. The user replied “not yet”; no other database users were substituted.
- **UNVERIFIED:** signed-in browser persistence/history/result flow, cold timeout and user-operated Retry, physical devices and owner-authenticated Admin Operations. Positive qualification remains intentionally fixture-only while real financial activation is disabled.
- **OUTSIDE APPROVAL:** production frontend isolation/remediation, real money, bank/provider credentials and policy/business decisions. Phase 7A remains NOT PASS.
- **IDLE FINDING:** Idle availability observed: 12 cards visible by 17.861 seconds after 16 minutes 10 seconds without agent application traffic. Actual cold-provider state, first 6-second deadline and cold Retry remain UNVERIFIED.
- Remote feature branch is at `0d4ede659ec0776e46f1e583f879a234b9905331`; current documentation/evidence updates are local and unpushed. `main` is unchanged. Unrelated AGENTS.md, .agents/ and the pre-existing Session 91 PROGRESS tail are preserved outside the deployment/code changes.

The retained procedure below is the approved rollout contract, now executed with the failures and narrower evidence scopes documented above. Any repeat is a new exact-revision staging rollout; the original approval does not silently authorize a different revision or any production work.


## Retained approved procedure (historical contract)

1. **Approve the exact release and scope.** Confirm feature-branch Preview/staging deployment, explicit 0013 application and controlled four-user mock acceptance. Review the full local report, builds, migration parity, audit and findings. Record pre-change frontend/API revisions, provider deployment IDs, staging alias/branch, journal, TLS, financial flags and production deployment/config fingerprints read-only.
2. **Prepare a staging maintenance window.** Keep all four `REAL_MONEY_*` flags false and mock action flags off. Verify unfinished deposits/payouts, reserved entries and active matches; let accepted obligations finish first. Do not erase history or force winners. Preserve existing secrets, region and a single game-owning server process.
3. **Take a fresh protected application backup.** Reuse the reviewed Phase 7B transaction-consistent backup workflow with the current verified URI/CA. Export `public` and `drizzle`, journal and schema/constraint/index/trigger inventories. The source manifest and `pg_dump --format=custom --schema=public --schema=drizzle --no-owner --no-acl` must share the same exported PostgreSQL snapshot. Record counts/content fingerprints for every application table, ledger totals, reservations, operations and outstanding instances. Keep credentials/archive outside Git in an access-restricted location; record only archive SHA-256 and sanitized manifest results. Old backups are insufficient.
4. **Prove restore before staging migration.** Restore into a newly created, independently verified isolated PostgreSQL 17 database on loopback using `pg_restore --single-transaction --exit-on-error --no-owner --no-acl`. Compare all table counts/content fingerprints, schema, constraints, indexes, triggers, 13-entry journal and financial reconciliation to the source snapshot. Apply the official candidate migration chain in that restored target and require 14 exact journal entries, nine new tables and authority indexes/immutability triggers; confirm old financial content and zero-sum accounting remain intact. Preserve backup and rehearsal evidence. Application backup does not establish Supabase-managed Auth/Storage, roles/secrets or external-provider recovery.
5. **Prepare Preview settings, then push.** Scope `VITE_APP_ENV=staging` and `VITE_API_URL=https://api-staging.fugluck.com` specifically to `codex/competition-restructure` Preview, with the provider's full Git revision metadata enabled. Do not alter Production settings/aliases. Confirm Render auto-deploy is off. Only after approval and backup/restore gates, push this feature branch.
6. **Apply exactly 0013 through the official migrator.** Use `drizzle-orm/node-postgres/migrator` with the validated `db/client.ts` connection, `rejectUnauthorized: true` and the provider CA. Before `migrate(db, { migrationsFolder: 'packages/server/drizzle' })`, require the stored journal to equal the candidate's first 13 entries, including exact accepted hashes/timestamps. Adapt/review the existing Phase 7B migration helper for this precondition and a 14-entry postcondition before executing it. Record actual application time. No reset, journal repair, schema-sync command, TLS weakening or test script pointed at staging is allowed. The old runtime may fail readiness until the matching candidate starts; plan for that maintenance interval.
7. **Deploy the same approved SHA to both services.** Deploy Render staging and Vercel Preview, assigning only `staging.fugluck.com`. Preserve `APP_ENV=staging`, `NODE_ENV=production`, verified DB region/fingerprint/CA, staging-only origins and host-only cookies. Initially set `ENABLE_KNOCKOUT_TOURNAMENTS=false` and verify the existing boundary. For the approved exercise, enable it with `ENABLE_COMPETITION_AUTHORITY=true`; leave every real-money flag false.
8. **Verify deployed identity and UX.** Require matching full SHA at frontend `/deployment.json`, backend `/health` and `/api/health`; explicit staging identity; intended database; matching 14-entry journal; valid TLS; production-origin denial; and financial guards. Exercise warm and genuine idle-first catalog/Retry, the 12 cards, frozen terms, EN/KA/RU mobile/desktop flow, refresh/reconnect and own bracket/results. A warm response does not prove cold availability.
9. **Run genuine four-user hosted mock acceptance.** Privately extend the synthetic allowlist to exactly four approved distinct users; retain separate operator/provider secrets. Enable only mock deposits/competitions as needed; withdrawals can remain off. Call protected `POST /api/staging-mock-commercial/tournaments/ensure`, which creates fixed four-seat Standard products for both certified games. Fund through signed mock-provider deposit events, join four authenticated users and drive genuine authority gameplay through semifinals and Final. Prove one capture per entry, one frozen final award, duplicate/recovery safety and balanced commercial postings. Never insert a winner, supply a client prize, or bypass qualification. Record this as new tournament evidence, separate from historical Phase 7I duel acceptance.
10. **Close, reconcile and record.** Complete all admitted obligations, reconcile, return all three mock action flags to false and disable the knockout admission flag unless continuing sandbox use was explicitly approved. Verify saved settings and matching deployed revisions. Compare production fingerprints to step 1 without changing production. Update the report, `DEPLOYMENT.md` and `PROGRESS.md` with exact hosted results and remaining findings.

## Retained rollback and stopping rules

Any failure of target identity, CA, backup/restore parity, journal, revision or financial reconciliation stops dependent work. Fix reversible candidate defects locally and validate them before another approved rollout.

After 0013, **do not redeploy the old 13-migration binary as an automatic rollback**: its strict migration gate rejects the added entry, and its recovery code does not understand tournaments. First contain with the reviewed 0013-compatible runtime and new admission disabled, allowing accepted obligations to settle/refund. Prefer a forward fix. Restoring a backup or removing schema after new activity can discard audit history and requires a separate concrete recovery decision and approval.

The existing Production frontend → staging API blocker remains outside this task. This plan authorizes no production deployment, main merge, real-money activation, bank connection, production data access or financial/provider setting change.
