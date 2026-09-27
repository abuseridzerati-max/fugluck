# Phase 7B controlled commercial staging acceptance — 2026-09-27

**Later verified state:** [Phase 7I hosted commercial staging acceptance](PHASE_7I_HOSTED_COMMERCIAL_ACCEPTANCE.md) supersedes this document's statements that hosted commercial routes and live game-to-commercial settlement do not exist. The Phase 7I code revision is `b87036ce9394af61714e0a8920944e4a6fe247f4`; full hosted mock E2E passed with all real-money flags OFF, and the three mock action switches were left OFF. This Phase 7B record remains the historical migration/backup baseline for revision `39debbfa9dfb99a2f38c1c99fa19b5f58f7333c3`.

## Historical Phase 7B verdict

**Verdict: PARTIAL STAGING MOCK ACCEPTANCE; COMMERCIAL LAUNCH NOT READY.** The approved candidate `39debbfa9dfb99a2f38c1c99fa19b5f58f7333c3` is deployed to the existing staging frontend and API with migration `0012_commercial_financial_core`. Real-money, deposit, withdrawal and competition switches remain OFF. The hosted API deliberately exposes no commercial mutation routes; the mock financial engine was exercised from a trusted workstation against temporary schemas in the verified staging PostgreSQL project. No real provider or external funds were used. [Sanitized structured evidence](evidence/phase7b-staging-acceptance-20260927.json) records the exact checks.

## Recovery and migration

The source was the registered Frankfurt staging project `gzfcucvxfzzjzjtgkwpd`, pooler routing fingerprint `6b2e32ee04be948ac7015fe81ff6e32ca09ffee7491aade8e69041fcd18eb926`. The rotated Render credential, staging identity, official CA and four false financial flags were checked without printing credential values. The temporary credential export was deleted after the staging database checks. A read-only, repeatable-read export used verified TLS and an exported snapshot. `pg_dump 17.11` produced a 423,312-byte protected, ignored local archive at **2026-09-27 12:15:38 UTC**, SHA-256 `211e7fd301b3db80ad7bf6715983c0a754966b1e0edb3b0e69d311543831991f`. The archive is private and is not committed.

An empty isolated local PostgreSQL 17.11 cluster on `127.0.0.1:55438` restored the archive in one transaction. All **24 table row counts/content fingerprints**, columns, constraints, indexes, the 12-record pre-migration journal, and sandbox reconciliation matched the source snapshot. Ledger sum, escrow, reserved funds, open instances and unbalanced accounting groups were all zero. The disposable server was stopped. The first restore helper stalled because Windows child process pipes remained open after `pg_ctl` exited; process handling was repaired in the ignored helper, and the unchanged backup then restored successfully. This rehearsal does not cover Supabase-managed Auth/Storage, roles, secrets, provider state, off-site retention or an accepted production RPO/RTO.

Final SQL/source review found eight additive commercial tables, indexes, constraints, balance/append-only triggers and no legacy row rewrite, destructive `DROP`/`TRUNCATE`, Coins/Diamonds conversion or production-provider assumption. The official Drizzle migrator applied only 0012 after the 12-entry chain and backup gate matched. A CA-verified post-migration query found **13/13 source-matching migrations**, head `0012_commercial_financial_core`, hash `9c6a81859792a4ba5ab6ce0f51eb34b195e4fa8573962d9dee55c5e2ea92fed5`, eight new tables, 15 application triggers and zero legacy sandbox imbalance/open instances. No real-money balances were seeded.

## Deployment and live boundary

The feature branch `codex/phase-7b-commercial-candidate` was pushed at the exact approved SHA; `main` was not merged. Render staging service `srv-da2c50c9v7es73db3dkg` deploy [`dep-dasgkhjncjis73a2g9r0`](https://dashboard.render.com/web/srv-da2c50c9v7es73db3dkg/deploys/dep-dasgkhjncjis73a2g9r0) reports **Deploy succeeded | Live** at that SHA. The automatic candidate Vercel Preview initially failed closed because the new branch lacked `VITE_APP_ENV`; branch-only Preview values `VITE_APP_ENV=staging` and `VITE_API_URL=https://api-staging.fugluck.com` were added, with Production deselected. Rebuilt Preview [`98vgUR1jHJgJQhPhcMdV7kjyht8m`](https://vercel.com/akatsuki-66a7/arcadeclash-client/98vgUR1jHJgJQhPhcMdV7kjyht8m) is **Ready** at the same SHA, and `staging.fugluck.com` is assigned to this branch.

Live `/deployment.json`, `/health` and `/api/health` all report the same full SHA and `staging`; backend `runtimeMode=production`, database `connected`, migrations `match`. The API reports commercial implementation `unavailable`, master money `false`, and deposit/withdrawal/competition actions denied with `MONEY_DISABLED`. The approved staging origin gets credentialed CORS; a Production frontend origin gets no allow-origin header. Logout sets a host-only Secure/HttpOnly/SameSite=Lax cookie. Unauthenticated Admin Operations returns 401. Both staging hosts have valid edge TLS through 2026-11-16 UTC, and the direct staging database checks verified certificate trust. A warm catalog returned four certified templates with HTTP 200 in **104/92/132 ms**; the deployed browser rendered three Space Blaster and one Cyber Hopper card with explicit sandbox/no-real-money copy. After more than 15 minutes idle, a fresh browser visit to `/competitions` timed out at the client and displayed Retry; clicking Retry recovered and rendered all four cards. **Cold-first catalog availability remains a finding** on the current staging service. These checks establish positive runtime guards and externally visible denial. Invalid hosted settings were tested in the environment safety suite, not injected into the live service.

## Mock financial exercise and its limit

Two isolated schema runs in the **live Frankfurt staging PostgreSQL database** used the candidate's local mock provider, commercial ledger and accounting adapter: **Space Blaster 76/76**, **Cyber Hopper 76/76**, zero failures. Each run cloned only the legacy fixture tables into its own schema and applied the reviewed 0012 SQL there. Tests covered signed deposits and exactly-once credit, failure/retry/timeout/mismatch, available balances, reserved/uncertain/rejected/completed withdrawals, insufficient funds, entry reservation/capture, predetermined standard/promotional/freeroll prize settlement, duplicate terminal settlement, void/refund/release, reconciliation mismatch detection, negative-balance and zero-sum constraints, immutability, explicit compensation, risk case authorization, and concurrent idempotency. The competition authority decision was **seeded as a fixture**; this did not replay a physical two-player Level 3 game through the deployed service.

Both temporary schemas were dropped. A separate CA-verified post-test query found **zero** leftover `commercial_staging_%` schemas and zero rows in the live public commercial transaction/posting/operation/provider-event/risk-case tables; migration count remained 13 and the sandbox ledger sum remained zero. Thus the test proves the mock code and database constraints work against staging PostgreSQL, **not** that a hosted deposit, withdrawal or commercial competition endpoint exists. The application intentionally rejects hosted construction of those mock components. A full hosted commercial staging E2E requires an explicitly designed safe test integration, public-route authorization/CSRF/rate-limit review, and actual authority gameplay before Phase 7I can pass. These are unfinished engineering gates, not permission to turn on real-money switches.

## Post-rollout regression and security

Typecheck across shared/theme/games/server and the client production build passed; the separate server build and Drizzle schema checker passed. The existing client main-chunk size warning remains. Fresh dependency audits found **0 critical / 0 high / 4 moderate / 0 low** in the full tree and **0 findings** in runtime-only dependencies. The moderate findings are in the development migration-tooling/esbuild chain; no forced upgrade was made. The entire serial `scripts/*-check.ts` suite runs against the guarded disposable test database, except the separate isolated-schema staging mock runs described above.

**Post-rollout complete regression: 43/43 scripts, 1,661/1,661 assertions passed; zero failures, exit failures or pass-count mismatches.**

| Script | Passed | Failed |
|---|---:|---:|
| `admin-console-check.ts` | 49 | 0 |
| `admin-reset-recovery-check.ts` | 11 | 0 |
| `admin-security-check.ts` | 8 | 0 |
| `atomic-wager-lifecycle-check.ts` | 38 | 0 |
| `auth-account-lifecycle-check.ts` | 41 | 0 |
| `authority-presentation-check.ts` | 24 | 0 |
| `canvas-render-check.ts` | 21 | 0 |
| `commercial-financial-check.ts` | 76 | 0 |
| `competition-admin-http-check.ts` | 44 | 0 |
| `competition-authority-check.ts` | 65 | 0 |
| `competition-authority-latency-check.ts` | 26 | 0 |
| `competition-phase1-domain-check.ts` | 41 | 0 |
| `competition-phase2-accounting-check.ts` | 54 | 0 |
| `competition-phase3-lifecycle-check.ts` | 45 | 0 |
| `competition-phase4-ui-check.ts` | 44 | 0 |
| `competition-phase5-admin-check.ts` | 42 | 0 |
| `cors-audit-check.ts` | 20 | 0 |
| `cyber-hopper-authority-check.ts` | 42 | 0 |
| `determinism-check.ts` | 12 | 0 |
| `environment-safety-check.ts` | 72 | 0 |
| `file-upload-audit-check.ts` | 4 | 0 |
| `financial-reconnection-check.ts` | 17 | 0 |
| `i18n-check.ts` | 65 | 0 |
| `input-validation-check.ts` | 20 | 0 |
| `legal-policy-help-check.ts` | 86 | 0 |
| `match-lifecycle-durability-check.ts` | 26 | 0 |
| `matchmaking-check.ts` | 65 | 0 |
| `migration-schema-parity-check.ts` | 329 | 0 |
| `owner-admin-lockout-check.ts` | 10 | 0 |
| `password-policy-check.ts` | 18 | 0 |
| `password-security-check.ts` | 13 | 0 |
| `rate-limit-check.ts` | 11 | 0 |
| `registration-verification-check.ts` | 9 | 0 |
| `request-logging-audit-check.ts` | 12 | 0 |
| `score-validation-check.ts` | 12 | 0 |
| `seed-admin-check.ts` | 7 | 0 |
| `sql-injection-check.ts` | 19 | 0 |
| `staging-readiness-check.ts` | 40 | 0 |
| `test-database-safety-check.ts` | 18 | 0 |
| `wallet-friends-check.ts` | 48 | 0 |
| `wallet-settlement-concurrency-check.ts` | 16 | 0 |
| `wallet-settlement-integrity-check.ts` | 24 | 0 |
| `xss-audit-check.ts` | 17 | 0 |

## Acceptance limits and phase verdicts

Authenticated Admin Operations was not completed because no legitimate admin session was available: **EXTERNAL VERIFICATION BLOCKER — AUTHENTICATED ADMIN SIGN-IN REQUIRED**. The unauthenticated route correctly returned 401, and the financial summary source is read-only. The cold-first catalog timeout is a separate staging reliability finding; retry recovered, but that does not establish cold-first success.

| Phase | Status after this rollout |
|---|---|
| 7A — environment/production separation | **NOT PASS**: staging controls pass; the unchanged Production frontend still references staging. |
| 7B — real-money accounting adapter | **PARTIAL / mock staged**: balanced append-only commercial model tested; no real-money acceptance, production role or audit export. |
| 7C — provider/banking | **NOT PASS**: signed mock provider only; no selected real provider or bank. |
| 7D — deposits/withdrawals | **PARTIAL / mock tested**: state machines tested in isolated staging schemas; hosted operations OFF. |
| 7E — KYC/limits/fraud | **PARTIAL**: policy hooks, signals and mock review tested; legal thresholds and verified identity services absent. |
| 7F — financial admin/reconciliation | **PARTIAL**: read-only summary and mock reconciliation built; authenticated live view and production controls unverified. |
| 7G — security/infrastructure/backup | **PARTIAL**: staging TLS/guards/recovery and regression checked; independent production stack, durable backup/monitoring and security acceptance absent. |
| 7H — legal/support/policies | **PARTIAL draft**: support/dispute framework exists; operator/legal decisions remain external. |
| 7I — full commercial staging acceptance | **NOT PASS**: mock database exercise passed; hosted financial lifecycle and live Level 3 game-to-settlement were not exercised. |

The Vercel Production deployment remains [`AtViaffzmmQELvKqBn8u56mxRZ6W`](https://vercel.com/akatsuki-66a7/arcadeclash-client/AtViaffzmmQELvKqBn8u56mxRZ6W) on `main` `91ca7533c8d4d3e78bc090031d69097731b03d8b`, confirmed in the project dashboard and remote ref. Its unchanged public asset retains SHA-256 `394007635f52addd95f3f886bb17594069486d12400f73a6e81ec9d741fb5e59` and still embeds the staging API. Production configuration and deployments were not changed. Remediation remains a separately approved retirement or an independent money-disabled production stack, never a staging alias or database reuse.
