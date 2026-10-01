# Security staging release — 2026-10-01

**Result: NOT PASS; main not merged or pushed.** The complete local regression/builds pass and migration 0014 is applied to staging. The hosted per-IP guest limiter fails. This is a concrete release blocker, not permission to enable money or deploy Production. [Sanitized evidence](evidence/security-staging-release-20261001.json).

## Repository disposition

Verified by Git status, complete working diff/history and explicit staged allowlists: no initial unpushed commit and no deletion. Inline Join UX was already pushed in eb984a184c77d578ce831e8dac5119348e3db3b3; socket repair was c8dd9176b78c03a7dee8f76fd5fa7bd99959d675. Created/pushed 3618cc898d3adea3b3d476fdc538ea5e90d68aaf (competition/socket release documentation), then ea22611358d3e31bbdf734ebb5053efeec5b2e0c (security/migration/tests). No rewrite/reset, broad add or deletion occurred. This report is a subsequent documentation-only follow-up; its own commit SHA is available from Git, and final matching staging deployment is verified after its push.

AGENTS.md remains modified for local JevRouter installation; .agents/ remains untracked with the installed local skill and no tracked history; the literal how --stat --oneline HEAD file remains untracked as a diagnostic capture. All three are intentionally preserved. Ignored Temp/, credentials, protected backup/restore cluster, dependencies and build outputs are not source.

## Validation

Verified by fresh execution before commits: **52 scripts / 2,270 passing assertions / 0 failures / 0 exit failures / 0 count mismatches**. Typecheck, explicit client build and server build exit 0. Schema parity 338, commercial accounting 76, competition accounting 54 and security boundary 75 assertions passed. No application source changed after these runs. The existing client chunk advisory and development esbuild advisory remain; production audit was clean in the preceding local security audit.

| Script | Pass | Fail |
|---|---:|---:|
| admin-console-check.ts | 49 | 0 |
| admin-reset-recovery-check.ts | 11 | 0 |
| admin-security-check.ts | 8 | 0 |
| atomic-wager-lifecycle-check.ts | 38 | 0 |
| auth-account-lifecycle-check.ts | 41 | 0 |
| authority-presentation-check.ts | 24 | 0 |
| canvas-render-check.ts | 21 | 0 |
| commercial-financial-check.ts | 76 | 0 |
| competition-admin-http-check.ts | 44 | 0 |
| competition-authority-check.ts | 65 | 0 |
| competition-authority-latency-check.ts | 26 | 0 |
| competition-phase1-domain-check.ts | 41 | 0 |
| competition-phase2-accounting-check.ts | 54 | 0 |
| competition-phase3-lifecycle-check.ts | 45 | 0 |
| competition-phase4-ui-check.ts | 44 | 0 |
| competition-phase5-admin-check.ts | 42 | 0 |
| competition-player-ux-check.ts | 110 | 0 |
| competition-socket-session-check.ts | 18 | 0 |
| cors-audit-check.ts | 20 | 0 |
| cyber-hopper-authority-check.ts | 42 | 0 |
| determinism-check.ts | 12 | 0 |
| environment-safety-check.ts | 89 | 0 |
| file-upload-audit-check.ts | 4 | 0 |
| financial-reconnection-check.ts | 17 | 0 |
| i18n-check.ts | 65 | 0 |
| input-validation-check.ts | 20 | 0 |
| legal-policy-help-check.ts | 86 | 0 |
| match-lifecycle-durability-check.ts | 26 | 0 |
| matchmaking-check.ts | 65 | 0 |
| migration-schema-parity-check.ts | 338 | 0 |
| owner-admin-lockout-check.ts | 10 | 0 |
| password-policy-check.ts | 18 | 0 |
| password-security-check.ts | 13 | 0 |
| rate-limit-check.ts | 11 | 0 |
| registration-verification-check.ts | 9 | 0 |
| request-logging-audit-check.ts | 12 | 0 |
| score-validation-check.ts | 12 | 0 |
| security-boundary-check.ts | 75 | 0 |
| seed-admin-check.ts | 7 | 0 |
| shutdown-lifecycle-check.ts | 4 | 0 |
| sql-injection-check.ts | 19 | 0 |
| staging-mock-commercial-check.ts | 13 | 0 |
| staging-readiness-check.ts | 40 | 0 |
| test-database-safety-check.ts | 18 | 0 |
| tournament-authority-check.ts | 34 | 0 |
| tournament-domain-check.ts | 97 | 0 |
| tournament-recovery-check.ts | 52 | 0 |
| tournament-rules-check.ts | 180 | 0 |
| wallet-friends-check.ts | 48 | 0 |
| wallet-settlement-concurrency-check.ts | 16 | 0 |
| wallet-settlement-integrity-check.ts | 24 | 0 |
| xss-audit-check.ts | 17 | 0 |

## Staging migration and deployment

**BUILT/deployed, verified by CA-validated database identity, official Drizzle migrator, owner checks and complete history:** staging project gzfcucvxfzzjzjtgkwpd (Frankfurt), current head 0014_security_boundaries, 15/15 migrations, SQL hash 04554bb41ab1eb7e96fdb5cc539ddfb57a573a385113ef87bc4b3e548724e7fe. Existing public rows/counts/hashes were unchanged by migration. Direct application-table browser grants became zero; current creator defaults were revoked. This does not prove every inherited role, object creator, future function or separate Supabase subsystem is safe. No Production database was accessed or changed.

Verified backup: fresh consistent read-only snapshot at 2026-10-01T18:19:56.895Z, 423753 bytes, SHA-256 2c3e164c32c5a0b35e076ab46c65cfaf50002535651c54047f899de813d0460d; retained only in ignored local private recovery storage. A fresh isolated loopback restore matched rows, migration history, sequences, operations, balances and reconciliation. Five PostgreSQL 17.6/17.11 CHECK-format differences were proved canonically equivalent with matching truth tables (26/12/14/14/12 probes); columns/indexes/triggers/functions matched. Local migration rehearsal also preserved prior public data and rejected deliberately granted browser access. Final backup ACL inspection verified only owner, SYSTEM and Administrators, with inheritance disabled on the private directory.

Verified by provider UI and fresh public revision endpoints: Vercel **Preview** 4C4tNn8yRdjGaDuzPRobYQnk2WmK Ready, Render dep-davacl7lot8c73cudi0g Live, frontend/backend exact security SHA ea22611358d3e31bbdf734ebb5053efeec5b2e0c. Health reports staging, connected database and matching migrations. **PLANNED at this document's snapshot:** deploy this documentation-only follow-up to the same staging targets and verify exact parity before the final response. No environment variable was changed. Authority/knockout/mock-competition switches were already enabled and were left as found; mock deposits/withdrawals and all real-money flags stayed false.

## Hosted acceptance

Verified by real staging HTTP/Socket.IO tests: **40 pass / 1 fail**. Old pre-release sessions fail closed, normal sign-in works, logout revokes copied cookies and active sockets, password change/reset invalidates old credentials, reset replay fails, cross-user/query-ID and ordinary-admin requests are rejected, HTTP/WS Origin checks hold, signed guest ownership prevents impersonation/wagering, private responses are no-store, and security headers are present. The existing synthetic fixture's password was restored. Recovery used a controlled expiring one-use token bound to that fixture through the real API; EMAIL_PROVIDER=logger is confirmed in Render and actual mail delivery remains unverified.

**Confirmed blocker:** first 21 sequential guest-ticket requests all returned 200. A separate 25-request run completed in 2444 ms with 25 distinct issued proofs, all HTTP 200 and no 429, exceeding the configured 20/minute limit. Staging TRUST_PROXY=1 is verified in provider UI; current logs show the same client resolving to three different private 10/8 req.ip addresses. The limiter keys by req.ip, so it lacks a stable original-client identity at this hosted boundary. No trust-all, arbitrary hop count or raw caller-supplied forwarded header was substituted.

Verified in the actual signed-in staging browser: immediate Join without confirmation, green inline waiting, refresh retaining one seat, Leave restoring TEST GEL 47.20 → 42.20 → 47.20, and both competition-game practice canvases rendering. Error/warning logs were empty for these paths; no CSP break observed. Full asset policy remains Report-Only and this is not exhaustive all-device/all-game certification.

Verified by live public SANDBOX gameplay and independent read-only database audit: **23 pass / 0 fail**, Space Blaster and Cyber Hopper both settled from positive-tick server engine receipts, fixed 10800-tick caps, two exact captured entries and one exact frozen winner payout each. Submitted financial/score overrides did not determine entries, prizes or authoritative receipts. Space Blaster's legitimate draws/latency rejection retried in the same final slot; no per-attempt entry charge or duplicate prize. Final global sandbox/commercial reconciliation is zero, with no reservations, active authority, pending decision, unresolved provider operation, duplicate prize or negative user balance.

The first STAGING_MOCK attempt lacked one fixture's simulated funds; reservations expired/released. Alternate funded fixtures correctly failed the unchanged mock allowlist. Public-game harness assumptions about one attempt and event name PRIZE_AWARD were corrected by the independent audit of actual PRIZE_PAYOUT postings; original failed harness artifacts are retained privately. No test was weakened, game cap shortened, flag expanded, deposit enabled or provider transaction made.

## Required next steps and main safety

**PLANNED:** instrument only the staging request boundary with protected diagnostics to establish the actual trusted proxy/header chain on custom and provider URLs. Fix stable non-spoofable client identity/limiter keys, test forged forwarding headers and 429/Retry-After across replicas/restarts, rerun all local scripts/builds after any source edit, deploy matching feature revisions, and repeat hosted acceptance. Do not guess a proxy count or trust all forwarding headers. Configure/verify a real staging mail transport under separate provider setup authorization; a generic recovery reply is not delivery proof. Remaining broader cloud/legacy-password/monitoring/dev-tool gates are in the original [security audit](SECURITY_AUDIT.md).

Verified Vercel Production environment says every main commit creates a Production Deployment; main and automatic Production-domain assignment are selected. **Pushing main would trigger Production.** Main/origin main remain 91ca7533c8d4d3e78bc090031d69097731b03d8b. Because staging acceptance fails, no local merge was performed. Once acceptance passes, local merge/revalidation is authorized; before any remote main push, the owner must separately authorize and disable automatic Production deployment/domain assignment, then verify that a main push cannot deploy Production. Do not change Production settings as part of this task.

Verified by performed actions, live health and unchanged saved flags: Production deployment NOT PERFORMED; real money, deposits and withdrawals OFF; Keepz/bank not activated. Local PostgreSQL identities and CHECKPOINTs were verified before native process stop; ports 55439/55440/4000/5173 have no listeners. Clusters and backup are preserved; no graceful shutdown is claimed.
