# Phase 6D Revenue Service Readiness Manifest

**Recorded:** 2026-09-25  
**Verdict:** **READY FOR USER REVIEW — manual review pending**  
**Submission readiness:** **NOT READY**; this is not a legal opinion, regulator approval, or submission package.

## Frozen candidate

| Item | Staging candidate | Verification |
|---|---|---|
| Git branch | `codex/phase-6-revenue-service-readiness` | `git branch -vv` |
| Application commit | `150c6c465a81e48bea5a11e19617b65072d22fb3` | Git history and provider deployment details |
| Frontend | `staging.fugluck.com`, revision `150c6c465a81` | Vercel deployment/domain view; authenticated staging admin Operations view |
| Backend | Render service `fugluck-api-staging` (`srv-da2c50c9v7es73db3dkg`), revision `150c6c465a81` | Render deployment `dep-daqu4co473hc73943t5g` showed Live / Deploy succeeded; `/api/health` returned healthy and database connected |
| Database | Repository migration head `0011_terminal_participant_status.sql`; admin Operations view showed latest migration time 2026-09-24 01:46:40 UTC-equivalent display | Migration journal/source and staging Operations view. The Operations view does not expose the exact active schema version; exact applied head is therefore not independently asserted here. |
| Environment | Staging-specific hostnames and service were inspected. Render's provider page displayed a `Production` environment badge and `/api/health` reports `environment: production`; admin Operations identifies the frontend as Staging. | Render/Vercel dashboards, health endpoint, and admin Operations. This is a naming/configuration ambiguity to resolve before any higher-risk release action. |

The provider views showed the frontend and backend on the same application revision. Render auto-deploy is disabled; the backend was manually deployed to the staging-specific service. The application candidate is the code commit above. This manifest commit itself is documentation-only and is not asserted as the deployed application revision.

## Staging data and product state

- **BUILT — public catalog certification filter** (verified by source inspection, `scripts/competition-admin-http-check.ts`, and live staging API/page): public catalog includes only enabled templates that pass game certification, exact rules-version, and live-template-shape checks. Admin can still inspect legacy rows.
- **BUILT — reviewable staging catalog** (verified through the documented staging admin workflow and live catalog): four eligible cards were visible: Space Blaster standard, promotional, and freeroll; Cyber Hopper standard. Entries use `space-blaster-rv001-v1` and `cyber-hopper-rv001-v1`.
- **BUILT — unsupported staging defaults blocked** (verified in admin UI and public API): Neon Runner and Pixel Ninja Dash defaults are disabled and are absent from the player catalog. Controlled Cyber Hopper and Space Blaster trial templates remain disabled.
- The visible cards distinguish `ENTRY COST` from `PREDETERMINED PRIZE`; the freeroll says `FREE`; each displays format, capacity/status and a join action. TEST / SANDBOX / NO REAL MONEY context is visible on the page. Screens were visually inspected in the signed-in staging browser at desktop width.
- The authenticated staging account showed TEST GEL ₾82.00 and Coins 1,000. No funds were granted and no competition was joined during this work. The staging reconciliation view reported balanced ledger and zero discrepancy; no historical records were fabricated.
- The footer link is labeled **Historical Diamond & Wallet Policy** and remains available as historical/legal access. Active Diamond controls and active replay architecture were not found in the current product paths based on the Phase 5.5C source and automated checks.

## Certification and sandbox boundary

| Game | Competition eligibility | Rules version |
|---|---|---|
| Space Blaster | Level 3 certified for TEST GEL | `space-blaster-rv001-v1` |
| Cyber Hopper | Level 3 certified for TEST GEL | `cyber-hopper-rv001-v1` |
| Neon Runner | Not certified; blocked | — |
| Pixel Ninja Dash | Not certified; blocked | — |
| Speed Trivia Clash | Outside current prize-bearing scope | — |
| True / False Sprint | Outside current prize-bearing scope | — |

**BUILT — simulated-money boundary** (verified by code/admin review and staging labels): this candidate uses TEST / SANDBOX GEL only. There are no real deposits, withdrawals, payment rails, bank/card/PSP integration, real-money prizes, or external Revenue Service submission in this work. No production deployment or `main` merge was performed.

## Validation results

All 41 repository `scripts/*-check.ts` programs completed successfully in the guarded test setup: **41/41 scripts passed; 0 failed**. The migration script's own summary is 321 assertions passed; its console also emits 12 successful migration-application markers, which are not counted as assertions. The table reports each test script's assertion/check count.

| Script | Passed | Script | Passed |
|---|---:|---|---:|
| `migration-schema-parity-check.ts` | 321 | `auth-account-lifecycle-check.ts` | 41 |
| `legal-policy-help-check.ts` | 57 | `i18n-check.ts` | 65 |
| `wallet-friends-check.ts` | 48 | `financial-reconnection-check.ts` | 17 |
| `matchmaking-check.ts` | 65 | `determinism-check.ts` | 12 |
| `score-validation-check.ts` | 12 | `canvas-render-check.ts` | 21 |
| `rate-limit-check.ts` | 11 | `sql-injection-check.ts` | 19 |
| `input-validation-check.ts` | 20 | `xss-audit-check.ts` | 17 |
| `password-security-check.ts` | 13 | `admin-security-check.ts` | 8 |
| `admin-console-check.ts` | 49 | `admin-reset-recovery-check.ts` | 11 |
| `seed-admin-check.ts` | 7 | `cors-audit-check.ts` | 20 |
| `registration-verification-check.ts` | 9 | `owner-admin-lockout-check.ts` | 10 |
| `request-logging-audit-check.ts` | 12 | `password-policy-check.ts` | 18 |
| `file-upload-audit-check.ts` | 4 | `wallet-settlement-concurrency-check.ts` | 16 |
| `wallet-settlement-integrity-check.ts` | 24 | `match-lifecycle-durability-check.ts` | 26 |
| `staging-readiness-check.ts` | 34 | `competition-phase1-domain-check.ts` | 41 |
| `competition-phase2-accounting-check.ts` | 54 | `competition-phase3-lifecycle-check.ts` | 45 |
| `competition-phase4-ui-check.ts` | 44 | `competition-phase5-admin-check.ts` | 42 |
| `competition-authority-check.ts` | 65 | `competition-admin-http-check.ts` | 38 |
| `competition-authority-latency-check.ts` | 26 | `authority-presentation-check.ts` | 24 |
| `test-database-safety-check.ts` | 18 | `atomic-wager-lifecycle-check.ts` | 38 |
| `cyber-hopper-authority-check.ts` | 42 | | |

The reported counts total **1,464 checks, 0 failures**. `npm test` completed successfully. `npm run typecheck` passed, including client production build; `npm run build:server` passed; `git diff --check` passed. Client build has a non-fatal main bundle size warning (>500 kB). Render's dependency install reported **7 dependency vulnerabilities (5 moderate, 2 high, 0 critical)**; no dependency upgrades were attempted in this release-preparation change.

## Manual review still required

- **Guest flow:** guest wording and eligibility were checked in source and `competition-phase4-ui-check.ts` (44/44), but the live browser remained signed in. An isolated guest visual review is still needed.
- **Responsive review:** responsive UI checks passed, but a narrow mobile-width staging screenshot could not be produced in the available browser session. Manual narrow-width inspection remains open.
- **Physical gameplay:** this work did not perform a physical Space Blaster play test. The accepted Cyber Hopper evidence records physical two-device gameplay, but did not intentionally verify reconnect. Do not infer additional human acceptance from the server harness.
- **Operational readiness:** no current Frankfurt database dump/restore was performed; the staging backup/restore procedure remains unverified. Render's `Production` badge/runtime label and the staging service identity should be reconciled before higher-risk operations. Admin Operations reported DB region as “Not configured” and did not expose the exact applied migration version.
- **Security review:** the 7 dependency findings need triage and an explicit upgrade decision. Automated security checks are not a third-party penetration test.
- **Legal/regulatory review:** no legal classification, licensing conclusion, regulatory approval, or Revenue Service submission is claimed.

## Final gate

**READY FOR USER REVIEW:** the candidate is deployed to the staging-specific services, frontend/backend revisions match, the eligible catalog is populated, the core automated suite/builds pass, and staging accounting reported zero discrepancy.

**NOT READY FOR SUBMISSION:** guest visual review, narrow mobile visual review, backup/restore verification, environment-label reconciliation, dependency vulnerability triage, and legal/manual acceptance remain open. No Phase 7 work was started.
