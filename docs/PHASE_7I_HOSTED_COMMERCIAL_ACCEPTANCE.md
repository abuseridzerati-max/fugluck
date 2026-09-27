# Phase 7I hosted commercial staging acceptance — 2026-09-27

**Verdict: PASS for the hosted staging mock-money E2E only. Commercial launch remains NOT READY.** The actual Render staging API and Vercel staging frontend both serve `b87036ce9394af61714e0a8920944e4a6fe247f4` from `codex/phase-7b-commercial-candidate`. Render final deploy [`dep-dasi2760tbcc73fghfgg`](https://dashboard.render.com/web/srv-da2c50c9v7es73db3dkg/deploys/dep-dasi2760tbcc73fghfgg) is Live; Vercel Preview [`GS3HnyHv8SJRmvSZ2abiqGyRif6S`](https://vercel.com/akatsuki-66a7/arcadeclash-client/GS3HnyHv8SJRmvSZ2abiqGyRif6S) is Ready and assigned to `staging.fugluck.com`. This report describes the deployed **code revision**, not any later local documentation-only commit. [Structured, sanitized evidence](evidence/phase7i-hosted-acceptance-20260927.json) includes every script count and the durable instance/ledger findings.

## Boundary and mode

**BUILT, verified by source review, environment safety tests and hosted `/health`/`/api/health`:** the staging mock mode requires `APP_ENV=staging`, Node production runtime, the registered Render staging service ID, the Frankfurt staging database routing fingerprint and verified TLS, separate 256-bit operator/provider keys, exactly two allowlisted synthetic users, and all four real-money switches false. The hosted mock provider makes no bank or payment network calls. The two fixed server-owned mock template IDs route through the existing `CompetitionAccountingPort` to `CommercialAccountingAdapter` and the append-only commercial ledger; ordinary public templates remain on the sandbox adapter. The mock routes are marked `TEST / MOCK / STAGING — NO REAL MONEY`, require session auth plus an operator header and allowlisted ownership, validate a staging Origin and JSON for mutations, and are rate-limited. Signed provider callbacks use a separate key and do not trust browser-reported success. The public catalog excludes mock templates.

**Final hosted configuration, verified by Render saved settings and live health after the final deploy:** mock mode remains installed, while its **deposit, competition-entry and withdrawal action switches are OFF**. Master real money, real deposits, real withdrawals and real-money competitions are all **OFF**. The provider callback and accepted-uncertain-withdrawal retry remain callable for existing obligations under the mock mode; there are no such outstanding obligations after acceptance. Re-enabling any mock action requires an operator-controlled staging environment change and redeploy; no client field can do so. Production code/configuration/financial resources were not changed.

**Test data and retention:** two newly created synthetic `role=user`, non-admin accounts were confined to the registered Frankfurt staging database. Their password and keys are stored only in an ignored local file with current-user-only ACLs, excluded from this repository and evidence. Financial operations use `mock_stage_` references and `tmpl_staging_mock_7i_*` templates. The six completed/voided competition records and immutable financial history remain as labeled audit evidence; no financial history was deleted or balance edited. The temporary Render environment export containing database credentials was deleted after verification; the protected synthetic test-key file and prior staging backup remain outside source. No migration was needed beyond the already applied `0012_commercial_financial_core`.

## Hosted lifecycle results

**Deposits — PASS, verified by hosted HTTP and CA-verified SQL:** two 3,000-minor-unit GEL orders were created under authenticated synthetic users, moved from `EXTERNAL_PENDING` to `CONFIRMED` only after separately signed mock provider success, and credited exactly once. Repeat request and callback were idempotent. A forged signature was rejected and a signed failed deposit did not credit funds. A third 60-minor-unit accepted order was confirmed after all new-action switches were disabled. Final data contains three confirmed deposits, one failed deposit and three `DEPOSIT_CONFIRMED` transactions.

**Space Blaster — PASS, verified by hosted Socket.IO controls, Render authority telemetry, match history and commercial SQL:** `inst_f94141f8-8f4f-4580-89c4-c6486bd84d1b` settled from genuine server results **150–31**; `inst_aedfde07-a865-488a-b0ea-1fa2d6e5436b` settled **88–5**. Each had two immutable 500-minor-unit entry reservations and captures, one 900-minor-unit predetermined prize settlement, a durable applied authority decision, and the matching winner in match history. `inst_dad1d3a8-2779-4eb8-acb6-dc1c38ad3114` ended in a genuine **23–23 draw** and refunded entries without a prize. In `inst_ea7744e8-1886-4bd3-ba1b-8809cb63d965`, a disconnected participant resumed with a rotated epoch/nonce and then expressly forfeited; the server settled the opponent once under the same fixed 900-minor-unit prize. A terminal `authority:resume` replay preserved the winner, and a second terminal forfeit was rejected. No fixture winner, client score submission or direct result write was used.

**Cyber Hopper — PASS independently, verified by hosted controls, durable authority result and SQL:** `inst_1aee79d9-84a9-4f68-848d-ba7085d7da91` produced genuine server scores **330–0**, captured both fixed 400-minor-unit entries and settled exactly one predetermined 720-minor-unit prize to the authority winner. An earlier attempt `inst_9ce909a6-8676-44b8-ac06-52120d95702b` was voided at admission: the existing guard recorded p95 RTT about 105 ms and jitter about 40 ms, beyond its unchanged limits; two entry reservations were released and no prize posted. The later attempt passed admission and settled. This is an observed latency finding, not a reason to relax the guard.

**Withdrawals — PASS, verified by hosted HTTP, signed callbacks and SQL:** after game settlement, an authenticated 200-minor-unit payout reserved funds, completed under a signed mock provider event and ignored duplicate success. A 50-minor-unit payout timed out into `SUBMISSION_UNCERTAIN` with the reserve intact; after all new-action switches were off it retried with the same operation idempotency key, completed under a signed event, and released the reserve. A provider rejection reversed its reserve; a signed provider failure did the same. An over-balance withdrawal was rejected, replay of an already completed withdrawal did not repay, a second user could not reuse its idempotency key or retry it, and a signed unknown provider reference was rejected. Final data has two completed and two reversed withdrawal operations.

**Kill switches and in-flight behavior — PASS for tested cases, verified by a same-revision Render redeploy and hosted requests:** all three separate mock action flags were switched off together. New deposits, competition joins and withdrawals each failed closed; synthetic login, status, signed callback, accepted payout retry and reconciliation still worked. An already accepted pending deposit and uncertain withdrawal both reached their proper terminal states after switch-off. The code checks the competition-entry flag only at join and routes an already admitted instance's accounting by its immutable template ID; thus toggling entry without a process restart leaves its authority run able to settle. A redeploy may instead invoke existing crash recovery and void/refund an incomplete run. **The latter in-flight deployment path was assessed from source and local authority tests, not deliberately exercised in hosted staging.** The existing admission void and draw independently prove commercial refund behavior.

**Authorization — PASS within the staging mock scope, verified by hosted negative requests and source/tests:** anonymous status was 401; an incorrect operator key was 403; a socket lacking the operator key could not join; wrong Origin and over-limit amounts were denied; a forged provider event was rejected; an unknown but correctly signed reference had no operation to credit. Fixed template economics and server-owned authority reject client-provided amount, currency, winner and final score as settlement instructions. Database constraints and 81 environment-safety assertions cover production activation failures. The authenticated Admin Operations view remains **EXTERNAL VERIFICATION BLOCKER — AUTHENTICATED ADMIN SIGN-IN REQUIRED**; no normal synthetic account was promoted to admin.

## Financial and deployment invariants

**PASS, verified by CA-authenticated read-only SQL after the final hosted transactions:** six mock instances have four `SETTLED` and two `VOIDED` applied decisions. Four prize-settlement transactions exist, exactly one per settled instance; voids have no prize and one refund transaction each. Commercial operations are 3 confirmed/1 failed deposits, 2 completed/2 reversed withdrawals, 4 settled/2 refunded competitions, and 8 captured/2 refunded/2 released entries. Seven provider events are matched `APPLIED` (3 deposit successes, 1 deposit failure, 2 payout successes, 1 payout failure). The ledger has **94 postings**, all transactions balanced, global posting sum **0**, synthetic user available liability **5,430 minor GEL**, no entry or withdrawal reserve, no duplicate prize, no unresolved financial operation and reconciliation `issues=[]`. Each instance's match-history score/winner agrees with its durable authority decision; the detailed results and transaction counts are in structured evidence.

**PASS, verified by public HTTPS and direct CA-verified PostgreSQL:** `/deployment.json`, `/health` and `/api/health` all identify the same full staging revision. `/api/health` reports database `connected` and migrations `match`; the verified Frankfurt project `gzfcucvxfzzjzjtgkwpd` has **13/13** source-matching migrations through `0012_commercial_financial_core`, head hash `9c6a81859792a4ba5ab6ce0f51eb34b195e4fa8573962d9dee55c5e2ea92fed5`. TLS validation succeeded for both public staging hosts; certificates expire **2026-11-16 18:37:05 UTC** (frontend) and **2026-11-16 22:35:57 UTC** (API). Warm catalog probes returned four public templates in **367/141/117 ms** and excluded both mock templates. The prior >15-minute idle test showed the Render Free cold-first timeout and working Retry; a new long-idle probe was not performed in this run. Commercial production architecture requires always-on capacity rather than a longer browser timeout.

**Production unchanged, verified by remote Git ref and Vercel Production overview:** `main` remains `91ca7533c8d4d3e78bc090031d69097731b03d8b`, Vercel Production [`AtViaffzmmQELvKqBn8u56mxRZ6W`](https://vercel.com/akatsuki-66a7/arcadeclash-client/AtViaffzmmQELvKqBn8u56mxRZ6W) remains Ready at that SHA, and no Production service/config/data was changed. The previously verified Production bundle still references the staging API; that unresolved cross-environment reference keeps **Phase 7A NOT PASS**. Its public asset hash was not freshly remeasured here because the provider's direct deployment host returned the dashboard shell in this session; the Vercel deployment identity and Git ref were reverified.

## Local regression and remaining gates

**VERIFIED by serial execution after implementation:** all **44/44** `scripts/*-check.ts` programs passed **1,682/1,682** assertions, with zero failures, exit failures or pass-count mismatches. The new hosted-mode check passed 12/12; environment safety increased to 81/81. Typecheck and client Vite build, separate server build, Drizzle Kit schema check with a non-connecting local placeholder URL, and `git diff --check` passed. Root dependency audit has 0 critical, 0 high, 4 moderate development-tooling findings, 0 low; runtime-only audit has zero findings. The existing client bundle-size advisory remains. Tests requiring a database ran only against a guarded disposable test database; hosted acceptance used the verified staging target intentionally.

| Script | Passed | Failed |
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
| cors-audit-check.ts | 20 | 0 |
| cyber-hopper-authority-check.ts | 42 | 0 |
| determinism-check.ts | 12 | 0 |
| environment-safety-check.ts | 81 | 0 |
| file-upload-audit-check.ts | 4 | 0 |
| financial-reconnection-check.ts | 17 | 0 |
| i18n-check.ts | 65 | 0 |
| input-validation-check.ts | 20 | 0 |
| legal-policy-help-check.ts | 86 | 0 |
| match-lifecycle-durability-check.ts | 26 | 0 |
| matchmaking-check.ts | 65 | 0 |
| migration-schema-parity-check.ts | 329 | 0 |
| owner-admin-lockout-check.ts | 10 | 0 |
| password-policy-check.ts | 18 | 0 |
| password-security-check.ts | 13 | 0 |
| rate-limit-check.ts | 11 | 0 |
| registration-verification-check.ts | 9 | 0 |
| request-logging-audit-check.ts | 12 | 0 |
| score-validation-check.ts | 12 | 0 |
| seed-admin-check.ts | 7 | 0 |
| sql-injection-check.ts | 19 | 0 |
| staging-mock-commercial-check.ts | 12 | 0 |
| staging-readiness-check.ts | 40 | 0 |
| test-database-safety-check.ts | 18 | 0 |
| wallet-friends-check.ts | 48 | 0 |
| wallet-settlement-concurrency-check.ts | 16 | 0 |
| wallet-settlement-integrity-check.ts | 24 | 0 |
| xss-audit-check.ts | 17 | 0 |

The hosted acceptance validates the mock workflow and engineering controls, not real payment readiness. **Phase 7I PASS within staging mock scope; Phase 7A NOT PASS; commercial launch NOT READY.** A legitimate admin sign-in is still needed for the read-only Admin Operations view. Real provider/bank integration, KYC/legal thresholds, production isolation, production backup/DR objectives, financial permissions and a separate production security/operations review remain external or later-phase gates. No production deployment, main merge, real-money activation or real financial resource was used.
