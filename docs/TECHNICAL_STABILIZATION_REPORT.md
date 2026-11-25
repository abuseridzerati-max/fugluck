# Technical stabilization — 2026-10-22

**TECHNICAL STABILIZATION COMPLETE within the authorized local scope.** All 55 discovered regression scripts passed at the final source fingerprint: **2,409 assertions, zero failures, zero unsuccessful exits, no skips**. All applicable builds/type checks passed, including a clean installation copy. Full and production dependency audits now report zero findings. Staging acceptance remains **PARTIAL** and Production remains **NOT READY**.

The complete result is in [sanitized evidence](evidence/technical-stabilization-20261022.json). Raw local logs/screenshots remain in ignored `Temp/technical-stabilization-20261022/` and `Temp/regression/`. Those local logs are not release artifacts. **BUILT** below means inspected implementation plus the specified execution evidence; **PLANNED** means remaining work. Passing scoped tests is not commercial approval or a general security certification.

## A. Baseline and scope

- Read all 57 handoff sections, the current GAMES manifest and latest PROGRESS handoff, relevant referenced acceptance/security/rollout documents, workspace/configuration files, migration chain and regression inventory. Actual source takes precedence over obsolete replay, Legacy token, Supabase-browser-auth and six-test claims.
- Read-only Git: branch **main**, HEAD **3dea8a10bab04b56b22efd5e3084532beb7125bd**. No branch/index/history/remote mutation was performed.
- Pre-existing work preserved: modified `AGENTS.md`, `PROGRESS.md`; untracked `.agents/`, `docs/FULL_PROJECT_HANDOFF.md`, `docs/evidence/full-project-inventory-20261012.json`, and literal file `how --stat --oneline HEAD`. The requested handoff/progress files were updated additively; the other pre-existing items were not edited.
- Initial runtime: Windows PowerShell, Node **24.18.0**, npm **11.16.0**. Validated dependency workflow now uses npm **11.21.1**. No global npm installation was changed.
- Before edits: `npm audit --json` exit **1** (1 critical, 2 high, 4 moderate); `npm audit --omit=dev --json` exit **1** (1 critical); `npm ls --all --json` exit **1** (TypeScript 6.0.3 violates the installed i18next/react-i18next optional peer range `^5`).
- Baseline `npm run typecheck` exit **0**, including all existing workspace checks and frontend build; client lint exit **0**, 17 warnings. All **25 safe scripts / 850 assertions** passed before source edits, using unreachable loopback application/test DB placeholders. The 28 DB-writing scripts were deferred until isolation was proved.
- No tracked GitHub Actions workflow was found. Vercel main auto-deployment guard, Render deployment configuration and repository exclusions were preserved.

## B. Dependency remediation

| Scope | Critical before → after | High | Moderate | Low | Total |
|---|---:|---:|---:|---:|---:|
| All dependencies | 1 → 0 | 2 → 0 | 4 → 0 | 0 → 0 | 7 → 0 |
| Production dependencies | 1 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | 1 → 0 |

Fresh audits and dependency tree commands exited **0**. The historical October 12 audit had six package entries; Vite advisories account for the seventh reproduced entry. Package findings are not independent exploit counts: four moderate entries share one old esbuild root cause, and Vite groups five advisories under one high entry.

| Package/path | Before → after | Disposition and applicability | Verification |
|---|---|---|---|
| Express → proxy-addr (transitive runtime) | 2.0.7 → 2.0.8 | Critical GHSA-jqcg-44mw-7w3h. Malformed IPv4-mapped IPv6 subnet trust can expand to arbitrary IPv4. Existing Fugluck custom trust callback did not demonstrate the affected compiled-subnet precondition; patch still applied. No hosted exploit attempted. | Four new Express prefix checks plus full proxy/rate suite **86/86**, HTTP/socket integrations, production audit 0. |
| Vite/PostCSS → source-map-js (transitive development) | 1.2.1 → 1.2.2 | High GHSA-68fv-2mgg-jv7q, malicious indexed source-map offsets can cause DoS. No customer map-ingestion endpoint was found. | Scoped patch, production builds, clean install, all-dependency audit 0. |
| Vite (direct development) | 8.1.5 → exact 8.1.6 | Patches GHSA-698v-4r3x-3vcv, GHSA-r825-w8mm-5pxw, GHSA-587h-7wmj-h5pm, GHSA-9jrq-w75r-8gcw and GHSA-rq7h-c2jc-7f22. Windows editor execution issues are relevant to this workstation; custom middleware/path cases depend on configuration. No dev server was exposed externally for testing. | Build and local optimized preview; exact patch pin avoids pulling unrelated 8.3 changes. |
| Drizzle Kit → esm-loader → core-utils → esbuild (development) | nested 0.18.20 → 0.25.12 | Moderate GHSA-67mh-4wv8-2f99 dev-server CORS advisory. Four package entries resolved by one narrowly version-matched root override. Inspected core-utils uses transform/transformSync, not esbuild serve. Deprecated loader remains, but the affected esbuild version does not. | Official migration CLI on a second empty DB after override, clean install/build/tree, audit 0. Drizzle Kit stays 0.31.11. |
| TypeScript (development compatibility) | 6.0.3 → 5.9.3 | Satisfies current i18next 24.2.3/react-i18next 15.7.4 peer contract without upgrading runtime localization. Root dependency gives all workspace checks the same compiler. | All strict workspace/new-tooling checks and clean-copy builds; tree exit 0. |

Primary references: [proxy-addr advisory](https://github.com/jshttp/proxy-addr/security/advisories/GHSA-jqcg-44mw-7w3h), [source-map-js patch](https://github.com/7rulnik/source-map-js/releases/tag/v1.2.2), [Vite 8.1.6](https://github.com/vitejs/vite/releases/tag/v8.1.6), [esbuild advisory](https://github.com/evanw/esbuild/security/advisories/GHSA-67mh-4wv8-2f99), [npm overrides](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/#overrides). Exact advisory identifiers and dependency version changes are retained in the evidence and baseline audit log.

**Reproducibility:** `packageManager: npm@11.21.1`, Node `>=22.12.0`, npm `>=11.21.1 <12`. The installed older npm 11.16.0 did not apply the root override consistently to the workspace dependency; a clean copy with npm 11.21.1 did. Tested Node is 24.18.0; other supported operating systems/Node versions were not exercised. Use the pinned npm for install/tree/audit, including future separately authorized release preparation. Cloud runtime settings were not changed.

An isolated copy without `.git`, saved private environment files, or existing node_modules passed `npm ci --ignore-scripts --no-audit --no-fund` (200 packages), `npm ls --all --json`, audit and full builds. Working node_modules was retained. Its lockfile matches the workspace byte-for-byte. The changed lock nodes are the five logical version updates above plus esbuild optional platform packages; root esbuild 0.28.1 and Drizzle's other 0.25.12 copy are retained. No React/Express/Socket.IO runtime upgrade, forced audit downgrade, or blanket update was adopted.

## C. Type and build matrix

All final commands below passed at source fingerprint **b5c5cac536b7145529a60060d0d9f45771fe278a328bf634c48d9ce6122cc59f**. The final full suite verified those source/config hashes before and after execution. Documentation changes after execution are excluded from that source fingerprint.

| Target | Command / verification | Exit/result |
|---|---|---|
| Shared | `tsc --project packages/shared/tsconfig.json --noEmit` | 0 / PASS |
| Theme | `tsc --project packages/theme/tsconfig.json --noEmit` | 0 / PASS |
| Games | `tsc --project games/tsconfig.json --noEmit` | 0 / PASS |
| Server | `npm run build:server` → server tsc noEmit | 0 / PASS |
| Tooling/new or modified TS checks | `npm run typecheck:tooling` | 0 / PASS |
| Runner JS | `node --check scripts/run-regression.mjs` | 0 / PASS |
| Client | `npm --workspace=@fugluck/client run build` → `tsc -b && vite build` | 0 / PASS |
| Combined workspace gate | `npm run typecheck` (now includes tooling) | 0 / PASS |
| Client lint | `npm --workspace=@fugluck/client run lint` | 0 errors / 17 existing warnings |
| Clean installation copy | Combined gate + separate server build | Both exit 0 / PASS |

Builds used optimized `NODE_ENV=production` with **VITE_APP_ENV=test** and the explicit loopback API. Main minified bundle is **731.97 kB / 195.18 kB gzip**; the existing >500 kB warning remains. Code splitting/performance budgets are future optimization, not a concealed build failure. No warning rule or compiler strictness was disabled.

The backend's supported build is **noEmit type checking**; deployment runs TS through tsx, so there is no invented standalone server binary. A local NODE_ENV=production backend is intentionally rejected by current hosted identity gates. Smoke instead used APP_ENV=test/NODE_ENV=test with actual HTTP and Socket.IO, and tested those deployment guards in the environment suites. Hosted-equivalent TLS/cookie/domain behavior remains separately scoped.

Artifact inspection found **no source maps**, no injected local server-secret markers, and no Node/pg/Express/Drizzle imports in the client bundle. Client source only references expected public build/API environment values; no active browser Supabase auth import was found. Generated client dist and TS caches remain ignored. No JS/declaration/map emission was introduced into source folders. This scan is not an exhaustive secret-history audit.

## D. Regression results

| Suite | Historical | Final fresh scripts | Passing assertions | Failed / unsuccessful | Status |
|---|---|---:|---:|---:|---|
| Database-independent subset | 25 / 850 | 27 | 907 | 0 / 0 | PASS |
| Database-writing subset | 28 / 1,502 | 28 | 1,502 | 0 / 0 | PASS |
| Complete discovered suite | 53 / 2,352 | 55 | 2,409 | 0 / 0 | PASS; no skips |

Inventory reconciliation: **+30** game module assertions, **+16** runner assertions, **+7** database URL guard cases and **+4** proxy patch cases = **+57**. No historical assertion was removed or reduced. Every row below ran in the final complete serial invocation, rather than combining separate passing fragments. All exit codes were 0. All suites require only local processes/fixtures; no real external service was required. “DB” means an isolated database-writing dependency, including indirect helpers. Operational seed/reset/hosted-burst utilities are not regression scripts and were not invoked against ordinary data.

Exact final invocation: `node --import tsx Temp/technical-stabilization-20261022/local-runtime.mjs regression`. That local evidence wrapper checks the recorded source hashes, supplies the verified disposable destination and calls `scripts/run-regression.mjs`'s `main([])`, the same entry used by `npm test`, then checks the hashes again. Completion: **2026-10-22 13:08:20 UTC**. Per-script raw output: `Temp/regression/2026-10-22T13-01-11-630Z/`; final structured result: `Temp/technical-stabilization-20261022/regression-final.json`.

| Script (under scripts/) | Category | DB writes | Oct 2 passes | Oct 22 passes | Result |
|---|---|---|---:|---:|---|
| admin-console-check.ts | Identity/admin | No | 49 | 49 | PASS |
| admin-reset-recovery-check.ts | Identity/admin | Yes | 11 | 11 | PASS |
| admin-security-check.ts | Identity/admin | No | 8 | 8 | PASS |
| atomic-wager-lifecycle-check.ts | Accounting/concurrency | Yes | 38 | 38 | PASS |
| auth-account-lifecycle-check.ts | Identity/admin | Yes | 41 | 41 | PASS |
| authority-presentation-check.ts | Realtime authority/session | No | 24 | 24 | PASS |
| canvas-render-check.ts | Game/runtime | No | 21 | 21 | PASS |
| commercial-financial-check.ts | Accounting/concurrency | Yes | 76 | 76 | PASS |
| competition-admin-http-check.ts | Competition | Yes | 44 | 44 | PASS |
| competition-authority-check.ts | Realtime authority/session | Yes | 65 | 65 | PASS |
| competition-authority-latency-check.ts | Realtime authority/session | Yes | 26 | 26 | PASS |
| competition-phase1-domain-check.ts | Competition | No | 41 | 41 | PASS |
| competition-phase2-accounting-check.ts | Competition | Yes | 54 | 54 | PASS |
| competition-phase3-lifecycle-check.ts | Competition | Yes | 45 | 45 | PASS |
| competition-phase4-ui-check.ts | Competition | Yes | 44 | 44 | PASS |
| competition-phase5-admin-check.ts | Competition | Yes | 42 | 42 | PASS |
| competition-player-ux-check.ts | Competition | Yes | 110 | 110 | PASS |
| competition-socket-session-check.ts | Realtime authority/session | No | 18 | 18 | PASS |
| cors-audit-check.ts | Security/API | No | 20 | 20 | PASS |
| cyber-hopper-authority-check.ts | Realtime authority/session | Yes | 42 | 42 | PASS |
| determinism-check.ts | Game/runtime | No | 12 | 12 | PASS |
| environment-safety-check.ts | Environment/operations | No | 89 | 89 | PASS |
| file-upload-audit-check.ts | Security/API | No | 4 | 4 | PASS |
| financial-reconnection-check.ts | Accounting/concurrency | Yes | 17 | 17 | PASS |
| game-module-lifecycle-check.ts | Game/runtime | No | New | 30 | PASS |
| i18n-check.ts | Product/policy | No | 65 | 65 | PASS |
| input-validation-check.ts | Security/API | No | 20 | 20 | PASS |
| legal-policy-help-check.ts | Product/policy | Yes | 86 | 86 | PASS |
| match-lifecycle-durability-check.ts | Casual lifecycle | Yes | 26 | 26 | PASS |
| matchmaking-check.ts | Casual lifecycle | Yes | 65 | 65 | PASS |
| migration-schema-parity-check.ts | Schema/migrations | Yes | 338 | 338 | PASS |
| owner-admin-lockout-check.ts | Identity/admin | Yes | 10 | 10 | PASS |
| password-policy-check.ts | Identity/admin | No | 18 | 18 | PASS |
| password-security-check.ts | Identity/admin | No | 13 | 13 | PASS |
| proxy-rate-limit-check.ts | Security/API | No | 82 | 86 | PASS |
| rate-limit-check.ts | Security/API | No | 11 | 11 | PASS |
| registration-verification-check.ts | Identity/admin | No | 9 | 9 | PASS |
| regression-runner-check.ts | Test isolation/runner | No | New | 16 | PASS |
| request-logging-audit-check.ts | Security/API | No | 12 | 12 | PASS |
| score-validation-check.ts | Game/runtime | No | 12 | 12 | PASS |
| security-boundary-check.ts | Security/API | Yes | 75 | 75 | PASS |
| seed-admin-check.ts | Identity/admin | Yes | 7 | 7 | PASS |
| shutdown-lifecycle-check.ts | Environment/operations | Yes | 4 | 4 | PASS |
| sql-injection-check.ts | Security/API | No | 19 | 19 | PASS |
| staging-mock-commercial-check.ts | Environment/operations | Yes | 13 | 13 | PASS |
| staging-readiness-check.ts | Environment/operations | No | 40 | 40 | PASS |
| test-database-safety-check.ts | Test isolation/runner | No | 18 | 25 | PASS |
| tournament-authority-check.ts | Realtime authority/session | Yes | 34 | 34 | PASS |
| tournament-domain-check.ts | Tournament | Yes | 97 | 97 | PASS |
| tournament-recovery-check.ts | Tournament | Yes | 52 | 52 | PASS |
| tournament-rules-check.ts | Tournament | No | 180 | 180 | PASS |
| wallet-friends-check.ts | Accounting/concurrency | No | 48 | 48 | PASS |
| wallet-settlement-concurrency-check.ts | Accounting/concurrency | Yes | 16 | 16 | PASS |
| wallet-settlement-integrity-check.ts | Accounting/concurrency | Yes | 24 | 24 | PASS |
| xss-audit-check.ts | Security/API | No | 17 | 17 | PASS |

**Timing failure retained:** a preceding full run on the same final source executed all 55 scripts but had one unsuccessful script: authority stopped at 57 of 65 assertions after a **1,856 ms SERVER_TICK_LAG** void and condition timeout; 2,401 assertions passed overall, no printed FAIL assertion, process exit 1. Build/browser work overlapped that attempt. Its relation to host contention is an inference, not a measured causal proof. The runner correctly reported failure and continued the remaining scripts. Final verification ran with local app/preview and build/browser work stopped and passed **65/65 authority plus the entire 55-script suite**. No authority lag threshold, timeout expectation, scoring rule or test expectation was weakened. Capacity under competing load is not certified by this rerun.

## E. Database and migrations

**BUILT / fresh execution:** all **28 database-writing scripts actually ran** against a newly created local database. Isolation was not inferred from an environment variable name:

1. Started the retained local PostgreSQL **17.11** test-cluster executable, bound to **127.0.0.1:55439**; checked the owning process and listener.
2. Queried server address, port, database and `data_directory`, and matched the actual directory to `C:/Users/abuse/Fugluck/Temp/competition-restructure/pgdata` before creation/use.
3. Created `fugluck_stabilization_20261022_test` and `fugluck_stabilization_smoke_test` from **template0**. Each had **zero application tables** immediately after creation, so no copied customer records existed.
4. Used only these explicit process-local targets. Saved .env files and hosted URLs were not edited or used as test destinations. Child application DB points at an unreachable loopback placeholder until the guarded suite selects its isolated target. Email uses logger; provider secrets and money switches are empty/false.
5. Applied the official `npm run db:migrate` chain to each empty DB; the second run used the patched loader. Both succeeded. The local final identity query reports **15/15**, head **0014_security_boundaries**, **41 public tables**, **69 check constraints**, **58 foreign keys**, **41 primary keys**, **18 unique constraints** and **2 constraint triggers**. Schema-parity regression adds **338/338** checks.

The local applied head hash is **8c0753a0a89b4f0fab3312cc4e1c3f4ebb07d4afc604b0b290a2297d0abb1a41** (reviewed Windows CRLF representation). The canonical LF SQL hash remains **04554bb41ab1eb7e96fdb5cc539ddfb57a573a385113ef87bc4b3e548724e7fe**. The existing identity validator intentionally recognizes these exact representations; final chain status is **match**. The journal timestamp is a version marker, not migration application time. Historical migrations were not rewritten and no schema migration was needed.

The initdb executable was blocked by this machine's executable policy (exit -1058471934); no policy bypass was attempted. Creating fresh databases inside the identified retained test cluster provided equivalent data isolation. Test fixtures/evidence are local; no old database was dropped or customer data removed.

Cleanup verified the owned process executable/data-directory before shutdown. pg_ctl was also blocked by the executable policy, so a successful SQL CHECKPOINT was followed by native PowerShell Stop-Process on the owned PostgreSQL PID. Final process/listener checks found no remaining local app, preview or test-DB listener on 4000/5173/55439. The app itself completed its SIGTERM shutdown path; PostgreSQL was terminated after checkpoint rather than claiming a graceful pg_ctl shutdown. Disposable files/databases were retained, not deleted.

Financial evidence includes atomic wager **38**, commercial accounting **76**, competition accounting **54**, lifecycle **45**, wallet concurrency **16**, wallet settlement integrity **24**, durable casual lifecycle **26**, reconnection **17**, tournament domain **97** and recovery **52** passing assertions. These cover integer minor-unit accounting, transaction rollback, nonnegative/double-entry constraints, unique operation identities, duplicate/concurrent settlement, reservations/prizes/refunds, immutable terminal evidence and process-loss recovery in their named scopes. They are simulated/internal money checks, not provider settlement certification.

## F. Confirmed security and resource fixes

- **BUILT — test target guard:** pg-connection-string can override URI routing with query parameters. A parse-only reproduction showed the old guard approved loopback while the driver selected a different host; no remote connection was attempted. Rejecting seven routing override names fixes that confirmed comparison gap. The new full runner additionally permits only reviewed URL options, loopback and matching actual server identity. Guard **25/25**, runner **16/16**.
- **BUILT — canonical viewport:** the three modules' ResizeObserver callbacks passed physical sizes into engines that mutate physics bounds. The new real-module fixture failed **six mobile/ultrawide cases** before the three-line fix; final **30/30** also covers hidden containers, backing dimensions, contained rendering, countdown teardown, input listeners and observer/DOM cleanup. No game scoring/rebalance/design change.
- **BUILT — bounded empty queue storage:** pairing and cancellation now delete empty composite-key buckets. Verified by reading both Map mutation paths and **65/65** existing matchmaking assertions. This is not a measured heap/load benchmark.
- **BUILT — dependency fixes and proxy coverage:** dispositions in section B; targeted proxy **86/86** includes real HTTP rate buckets and spoof resistance. The malformed-prefix cases exercise Express's actual trust compilation.

Other fresh security suites: security boundaries **75**, environment safety **89**, admin HTTP **44**, socket sessions **18**, CORS **20**, input validation **20**, SQL-injection checks **19**, XSS checks **17**, password security **13**, password policy **18**, request logging **12**, rate limiting **11**, owner lockout **10**, registration verification **9**, file upload checks **4**, plus complete auth lifecycle **41** and admin reset recovery **11**. Coverage mixes source assertions and real integrations; the report does not present every source check as penetration testing.

Source review/test evidence retains server-side identity/ownership/role checks, user/admin/socket purpose separation, session revocation, cookie/Origin/CORS boundaries, invalid/duplicate action rejection, redacted errors/logs, canonical authority input, money-disabled startup gates and protected admin/developer actions. No authentication, authorization, accounting or environment gate was relaxed.

**Remaining risks / PLANNED:** full hosted security/role/IAM acceptance, actual mail delivery and operator policy for legacy raw-bcrypt long-password accounts, full CSP enforcement/report collection after browser validation, finance-admin MFA/dual control, durable alerts/DR, and shared rate limiting before replicas. None is represented as newly completed. Zero npm findings is point-in-time package evidence; it does not eliminate these operational controls. Existing lint warnings and bundle size warning remain disclosed.

## G. Staging acceptance matrix

| Check | Local evidence | Hosted state |
|---|---|---|
| Optimized frontend startup and assets | PASS; production bundle with test API, six catalog games, game chunks render | New changes not deployed |
| API and migrations | PASS; actual local readiness, migration identity, startup/shutdown | PASS on bounded retry at 13:15 UTC: healthy, DB connected, migrations match; initial 15s timeout retained, retry took 32.6s |
| Authentication/session/Socket.IO | PASS; integrated **19/19** smoke plus auth/security suites | Historical hosted 87/87 only; not rerun |
| Practice launch/input/exit | PASS; Space Blaster, Cyber Hopper result screen, Speed Trivia question/score progression | Current hosted gameplay **NOT TESTED** |
| Authoritative game result integrity | PASS; Space Blaster **65**, Cyber Hopper **42**, latency **26**, presentation **24** | Historical four-player/recovery evidence retained; no fresh hosted match |
| Tournament lifecycle/settlement/recovery | PASS; rules **180**, domain **97**, recovery **52**, authority **34**, wider competition suites | Full hosted 8/16, genuine qualification, owner Retry/operations acceptance **PENDING** |
| Money-disabled behavior | PASS; health denies all commercial actions, Legacy token purchase 410, environment **89**, mock gates **13** | Frontend metadata and fresh backend health both report money disabled; deposits/withdrawals/commercial competitions denied |
| Deployment identity | Local identifies itself as test/local, never claims a deployed SHA | Frontend GET 200 at **3a24ea02df7dc9bfa4d06d4d19d13439ae517073**, same exact backend SHA on the successful health retry; new local fixes are not deployed |
| Real delivery/payment, Production isolation | Outside permitted local task | **NOT TESTED / BLOCKED** pending separate scope and provider/operator inputs |

Hosted access was limited to unauthenticated GET of the documented staging `deployment.json` and `/api/health`, with no redirects, cookies or writes. The first 15-second health request timed out; one bounded 45-second retry returned 200 after **32,598 ms** at **2026-10-22 13:15:05 UTC**. It confirmed staging/production runtime, healthy DB, matching migrations and exact client/server revision parity. All real-money actions were denied; mock competitions were enabled and mock deposits/withdrawals disabled. The slow response warrants availability/cold-start measurement, but its cause was not established. A point-in-time success is not an uptime guarantee. No hosted registration, authenticated /me, catalog materialization, queue/tournament entry, load/security burst, migration or email was run. Full hosted security **87/87** remains explicitly **historical**.

Local HTTP smoke covered synthetic signup/current 1,000-Coin grant, verification without sending email, cookie profile reuse, logout revocation, login, socket-ticket handshake, Legacy token retirement and five SPA deep links. Separate browser observations cover the three changed canvases and no-real-money notice. Supplemental smoke **19/19 is not added to the 2,409 regression count**. Local app/preview processes exited cleanly after smoke; authority load tests were rerun with them stopped.

## H. Reproducible validation workflow

Use Node 24.18.0 as the tested runtime and npm 11.21.1 (or revalidate another declared supported version). On this machine prepend `C:\Program Files\nodejs` to PATH. A temporary pinned invocation is `npx --yes --package=npm@11.21.1 npm <command>`; global npm was not replaced.

1. In an isolated clean copy, run `npm ci --ignore-scripts --no-audit --no-fund`, then `npm ls --all --json` and both audits. Actual build/migration execution verifies the native optional packages work despite skipped lifecycle scripts.
2. Set process-local safe public build environment (VITE_APP_ENV=test, loopback VITE_API_URL) and NODE_ENV=production for optimized frontend verification; run `npm run typecheck`, `npm run build:server` and client lint. Do not use hosted identities to bypass the local/hosted startup contract.
3. `npm run test:read-only` runs the reviewed DB-independent subset without reading saved application URLs. It deliberately reports the other 28 as skipped; this subset alone is not complete regression.
4. For the full suite, first provision an empty dedicated local *_test DB and verify its actual listener/data directory. Supply **TEST_DATABASE_URL** and **FUGLUCK_TEST_DATA_DIRECTORY** in the calling process, then `npm test`. Do not copy production/staging secrets into test commands or use the saved remote test URL.
5. The runner validates actual DB identity before launching children, discovers every *-check.ts, runs migration parity first, sanitizes inherited variables, bounds each process at 180 seconds, preserves failures/exceptions/zero-assertion outcomes, continues the rest, and writes logs/progress/summary under ignored Temp/regression. Windows timeout termination targets only its own child PID and descendants.
6. Run builds and browser/load work separately from wall-clock authority tests. Keep the final source fingerprint, all script counts/exit codes and any failed attempts; do not stitch partial runs into acceptance.

No CI/deployment trigger was introduced. A future hosted CI job needs an isolated PostgreSQL service and the pinned npm; changes involving provider credentials/deployment remain PLANNED and separately authorized. New checks default into the full inventory; adding one to read-only requires explicit review of its data dependencies.

## I. Changed-file inventory

Paths are repository-relative. Existing AGENTS, .agents, prior evidence and diagnostic-file changes are excluded from this session inventory. Ignored validation logs, screenshots, clean-copy dependencies and newly created disposable DB files are local evidence/runtime state, not source changes.

| Path | Change | Reason | Validation |
|---|---|---|---|
| package.json | Pin supported compiler/npm expectations; add guarded discovery runner and tooling checks; use local tsc. | Peer compatibility, complete test execution and reproducibility. | Clean install, full builds, runner 16, full suite. |
| package-lock.json | Scope Vite/proxy/source-map/old nested esbuild patches and TS 5.9.3. | Remove all seven dependency findings and incompatible compiler peers. | Audit 0, tree exit 0, isolated ci/build, migration CLI. |
| packages/client/package.json | Vite 8.1.6 and TypeScript ~5.9.3. | Patch advisory range without unrelated Vite minor upgrades; satisfy i18n peers. | Client optimized build, lint, browser smoke. |
| packages/server/package.json | TypeScript ~5.9.3. | Use the same supported compiler across workspaces. | Server noEmit build and full integrations. |
| games/space-blaster/index.ts | Pass canonical viewport to ResizeObserver engine.resize. | Physical host size must not change physics. | Lifecycle regression 30; canvas 21; determinism 12; browser smoke. |
| games/cyber-hopper/index.ts | Pass canonical viewport to ResizeObserver engine.resize. | Physical host size must not change physics. | Lifecycle regression 30; canvas 21; determinism 12; browser smoke. |
| games/speed-trivia/index.ts | Pass canonical viewport to ResizeObserver engine.resize. | Physical host size must not change physics. | Lifecycle regression 30; canvas 21; determinism 12; browser smoke. |
| packages/server/src/matchmaking/queue.ts | Remove empty queue buckets after pairing/cancellation. | Prevent empty stake-key accumulation during process lifetime. | Read Map mutation paths; matchmaking 65 and full suite. |
| scripts/test-database-safety.ts | Reject URL query routing overrides before destination comparison. | pg query parameters could redirect an approved-looking URL. | Old/new parser reproduction without connecting; guard 25. |
| scripts/test-database-safety-check.ts | Add seven routing-override rejection cases. | Cover confirmed isolation-boundary defect. | 25/25, tooling typecheck. |
| scripts/proxy-rate-limit-check.ts | Add four Express trust-prefix patch regressions. | Protect proxy-addr fix at actual Express integration boundary. | 86/86, tooling typecheck. |
| scripts/run-regression.mjs | New serial discovery runner, loopback/actual-cluster preflight, sanitized child env, watchdog and JSON evidence. | Replace brittle hardcoded chain and unsafe inherited environment. | 16 runner assertions, syntax check, full 55-script execution. |
| scripts/regression-runner-check.ts | New discovery, refusal, failure propagation, environment and real child timeout checks. | Ensure zero assertions, exceptions and hangs cannot pass silently. | 16/16, tooling typecheck. |
| scripts/game-module-lifecycle-check.ts | New real-module init/resize/countdown/destroy fixtures. | Engine-only tests missed host resize behavior. | Before: 24 pass/6 fail; after: 30/30; tooling typecheck. |
| scripts/tsconfig.json | Strict noEmit configuration for new/changed TS tooling and tests. | Include supporting validation code in root typecheck. | Workspace and clean-copy tooling tsc PASS. |
| docs/TECHNICAL_STABILIZATION_REPORT.md | This report, all counts, dispositions, commands and limitations. | Evidence-based session handoff. | Generated from final structured results; reviewed against logs. |
| docs/evidence/technical-stabilization-20261022.json | Sanitized machine-readable evidence and source fingerprint. | Keep reproducible results without tokens or raw private logs. | Parsed JSON; cross-checked totals and hashes. |
| docs/FULL_PROJECT_HANDOFF.md | Dated stabilization update; correct current versions, test/security/staging status; retain 57 sections. | Supersede stale current claims while preserving historical evidence. | Section count and exact replacement checks; source/results review. |
| PROGRESS.md | Prepend Session 113 with verification methods. | Required self-contained next-session handoff. | Prior Session 112 and earlier history preserved. |
| GAMES.md | Record canonical resize fix and scoped fresh game checks. | Distinguish current local verification from older staging claims. | Code, regression logs and browser observation. |

## J. Execution log and remaining actions

1. **A COMPLETE:** captured branch/dirty baseline, handoff/source/test inventory, audit/tree failure, passing baseline build/lint and 25/850 safe tests before source edits.
2. **B COMPLETE:** applied scoped patches and compatible compiler; rejected an overly broad Vite update and did not retain it. npm 11.16 override resolution was inadequate; isolated npm 11.21.1 install/tree/audit/build verified the final lock. No audit --force operation.
3. **C COMPLETE:** all workspace/new-tooling checks, server noEmit and optimized client build; clean-copy repeat, artifact inspection and disclosed existing warnings.
4. **D/E COMPLETE:** initdb policy block retained; identified local cluster, created two fresh empty DBs, applied 15 migrations and ran every integration. First expanded full run passed 55/2,409; a later final-source attempt exposed the timing failure documented above; final full rerun passed at one unchanged fingerprint.
5. **F/G COMPLETE:** parse-only DB guard defect reproduction, six pre-fix resize failures, narrow resource fix, exact security/game/authority/financial regressions. No gameplay/financial policy change.
6. **H COMPLETE for allowed local scope:** browser and 19 HTTP/socket smoke checks; hosted read-only metadata and health/parity succeeded after an initial timeout and a 32.6-second retry. Early one-off smoke harness assumptions (balance property/grant and socketTicket field) were corrected to the inspected contract; those failed harness attempts are retained. No application assertion was weakened to match a failure.
7. **I COMPLETE:** pinned tooling expectations, guarded discovered inventory, bounded serial failure propagation and sanitized evidence; no cloud trigger/config changes.
8. **J COMPLETE:** final audits/tree/builds and final 55-script source-consistent execution, documented limits and updated handoffs.

Highest-priority remaining technical work:

1. **PLANNED:** separately authorize review/release of these local changes to staging using pinned npm; reconfirm client/server SHA parity after that release, measure the observed slow readiness response, then rerun hosted 87-check security and full 8/16/qualification/recovery acceptance with approved synthetic fixtures.
2. **PLANNED:** independently inventory and resolve the recorded Production→staging coupling; accept isolated API/DB/secrets with money OFF before any Production use. No Production access was performed here.
3. **PLANNED:** configure/test real transactional email under separate authorization and settle legacy credential remediation policy; logger output is not email delivery.
4. **PLANNED:** close least-privilege/IAM, admin MFA/dual control and fuller CSP/browser/reporting acceptance, preserving current server checks.
5. **PLANNED:** establish monitoring, alerts, backup restore/RPO/RTO and measured authority capacity/geographic latency. The observed scheduling void reinforces running time-sensitive acceptance on a controlled host; shared limiting is required before multiple replicas.

Keepz APIs/approval, KYC/AML/legal/tax decisions and real financial rails remain outside the implemented scope. Nothing here enables them.

**Restrictions:** Git mutation commands, commits, pushes, PRs, deployments, Production access, hosted DB writes, cloud configuration changes, saved .env changes, real-money activation, Keepz integration and external messages: **NONE**. Main guard and exclusions unchanged. Ordinary local source/dependency/test/document changes and disposable local writes only.
