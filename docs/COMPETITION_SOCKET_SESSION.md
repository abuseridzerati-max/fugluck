# Competition socket session repair — 2026-09-30

**BUILT locally, verified in source and real HTTP/Socket.IO regression:** competition connections obtain a sixty-second socket-only credential through the existing authenticated HTTP session before connecting. The server verifies its signature, environment, purpose, expiry and current account status. Missing/invalid explicit proof is rejected rather than converted to a guest. Existing cookie-only sockets and free guest play remain supported. The credential cannot authenticate an HTTP session and is never written to browser storage. Existing HttpOnly/Secure/SameSite/host-only cookie configuration remains unchanged.

**BUILT locally, verified in source and browser:** Join waits for initial account restoration; connection failures offer Retry. The credential is refreshed for each connection and the HTTP bootstrap has a six-second abort deadline plus unmount cleanup. Join still happens immediately without entry confirmation and retains the green inline lobby.

**VERIFIED in the in-app browser against the real local backend and disposable database:** normal cookie login, one-click Join, green joined card/button, no sign-in error or confirmation dialog, refresh restoring the same entry, and Leave restoring the balance. The database contained exactly one 500-minor cancelled entry, no prize, and a released reservation after refresh/cancel. Browser error logs were empty. Screenshot: ignored Temp/competition-auth-fix/joined.jpg. This is not hosted gameplay acceptance.

**ASSUMED original hosted failure mechanism:** the reported sign-in message maps to a guest socket rejection; an absent/invalid initial socket session is the inferred cause. The owner's Chrome cookie/header was not inspected. The regression explicitly reproduces authentication when the socket has no cookie, then proves that the HTTP-issued credential restores the account.

**VERIFIED environment obstacle and recovery:** Windows Code Integrity events 3033/3077 blocked pg_ctl.exe from loading libpq.dll. The archive DLL is a valid x64 PE; no corruption is claimed. PostgreSQL's server executable does not import this client DLL and ran directly on verified loopback port 55439. No Windows protection was disabled. Automatic approval rejected background Node helper launches; the real local servers were instead run in managed foreground command sessions.

**VERIFIED builds:** npm run typecheck including client production build and npm run build:server passed. Existing client chunk advisory remains. No game engine, migration, economics, payment/provider configuration or money flag changed. VERIFIED deployed to staging: origin branch, Vercel Preview CMjPEGScKPnkWPmPBdXoCyR85KYd (Ready), Render dep-dau3oanavr4c73figq40 (Live), frontend identity and backend health all match c8dd9176b78c03a7dee8f76fd5fa7bd99959d675. Hosted authentication passed 9/9: existing fixture HTTP login/session, cookie-issued short-lived proof, cookie-free WebSocket accepted as authenticated, and anonymous proof/admission denied. Only an empty invalid join payload was sent; no valid entry, wallet operation or hosted gameplay occurred. Main and Production remain untouched; real money, deposits and withdrawals remain disabled. Screenshot: ignored Temp/competition-auth-fix/staging-live.jpg.

## Every-script regression results

Verified by running every scripts/*-check.ts against the identity-checked disposable loopback cluster. **51 scripts / 2,195 passing assertions / 0 failures / 0 nonzero exits / 0 expected-count mismatches.** [Sanitized evidence](evidence/competition-socket-session-20260930.json).

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
| `competition-socket-session-check.ts` | 18 | 0 |
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
