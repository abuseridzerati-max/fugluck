# Competition join stays on the grid — 2026-09-30

**Current follow-up, BUILT locally and verified in source/browser:** Join now enters immediately without the original confirmation dialog; see [Immediate competition join](COMPETITION_IMMEDIATE_JOIN.md). The verification below records the earlier inline-lobby candidate.

**BUILT locally, verified by source inspection and local browser UI fixtures:** confirming Join mounts the existing authority connection inside the catalog. While entrants are pending, the catalog renders the server-confirmed participant count, green occupied slots, green joined card/button, waiting message, and Leave action. The game view replaces the grid only on an `authority:session` event. That transition retains the same socket and renderer. Later tournament rounds retain the game view rather than returning to the initial lobby.

**BUILT locally, verified with the local browser fixture:** refreshing a pending entry discovers the user's room and resumes it without sending another join. Filtering to another game pins the pending card so Leave remains accessible. A rejected join displays the existing translated error without showing a confirmed green seat. Cancellation returns to the grid after the server acknowledges it.

**Verification scope:** desktop at 1440 × 1000 and mobile at 390 × 844 used a synthetic local HTTP/Socket.IO fixture, not hosted competition admission, gameplay, or wallet acceptance. Nine scripted UI checks passed. The initial game-transition checkpoint sampled the asynchronous ready acknowledgement too early; subsequent in-app-browser inspection verified the grid was removed, the game view was visible, connections remained 5 before/after, and ready acknowledgements changed from 0 to 1. Browser error logs were empty. Together these verify all 11 UI assertions; the initial timing failure is retained in the temporary harness output. Screenshots are in `Temp/competition-inline-lobby/joined-desktop.png` and `joined-mobile.png`.

The original candidate retained entry confirmation. The immediate-join follow-up removes that component and moves auth/balance feedback into the catalog. Socket payloads, server game/financial decisions, and frozen Entry/Prize terms were inspected in source and remain in use. No backend, migration, engine, or money-enable switch was edited. This is a local candidate; no push or deployment was performed. Earlier staging/restructure acceptance limitations remain as recorded in the rollout report.

Build verification: `npm run typecheck` passed, including the client production build; `npm run build:server` passed. The client retains its existing large-chunk advisory.

Temporary local browser/mock/Vite services were stopped. The disposable database was identity-checked and checkpointed, then stopped through native process control; no graceful PostgreSQL shutdown is claimed. `netstat` confirmed ports 55439, 4000 and 5173 no longer listening.

## Complete regression results

Verified by executing every `scripts/*-check.ts` against the identity-checked disposable loopback PostgreSQL cluster. All **50 scripts / 2,177 assertions / 0 failures**, with no nonzero exits or expected-count mismatches. [Sanitized execution evidence](evidence/competition-inline-lobby-20260930.json).

| Script | Passing assertions | Failed |
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
| `competition-player-ux-check.ts` | 110 | 0 |
| `cors-audit-check.ts` | 20 | 0 |
| `cyber-hopper-authority-check.ts` | 42 | 0 |
| `determinism-check.ts` | 12 | 0 |
| `environment-safety-check.ts` | 89 | 0 |
| `file-upload-audit-check.ts` | 4 | 0 |
| `financial-reconnection-check.ts` | 17 | 0 |
| `i18n-check.ts` | 65 | 0 |
| `input-validation-check.ts` | 20 | 0 |
| `legal-policy-help-check.ts` | 86 | 0 |
| `match-lifecycle-durability-check.ts` | 26 | 0 |
| `matchmaking-check.ts` | 65 | 0 |
| `migration-schema-parity-check.ts` | 338 | 0 |
| `owner-admin-lockout-check.ts` | 10 | 0 |
| `password-policy-check.ts` | 18 | 0 |
| `password-security-check.ts` | 13 | 0 |
| `rate-limit-check.ts` | 11 | 0 |
| `registration-verification-check.ts` | 9 | 0 |
| `request-logging-audit-check.ts` | 12 | 0 |
| `score-validation-check.ts` | 12 | 0 |
| `seed-admin-check.ts` | 7 | 0 |
| `shutdown-lifecycle-check.ts` | 4 | 0 |
| `sql-injection-check.ts` | 19 | 0 |
| `staging-mock-commercial-check.ts` | 13 | 0 |
| `staging-readiness-check.ts` | 40 | 0 |
| `test-database-safety-check.ts` | 18 | 0 |
| `tournament-authority-check.ts` | 34 | 0 |
| `tournament-domain-check.ts` | 97 | 0 |
| `tournament-recovery-check.ts` | 52 | 0 |
| `tournament-rules-check.ts` | 180 | 0 |
| `wallet-friends-check.ts` | 48 | 0 |
| `wallet-settlement-concurrency-check.ts` | 16 | 0 |
| `wallet-settlement-integrity-check.ts` | 24 | 0 |
| `xss-audit-check.ts` | 17 | 0 |
