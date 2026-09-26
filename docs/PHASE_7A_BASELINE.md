# Phase 7A.1 — Commercial Environment & Production Safety Baseline

Audit date: **2026-09-27, Asia/Tbilisi** (UTC observations begin 2026-09-26). Scope: the current repository, visible provider accounts, deployed staging and production frontend, and a local safety implementation. This is the single Phase 7A baseline report, not commercial launch acceptance.

Sanitized structured evidence and per-script results: [phase7a-baseline.json](evidence/phase7a-baseline.json). Private connection files, database exports and row-level data are excluded.

**Verdict: NOT PASS for the live Phase 7A.1 exit gate.** The audit resolves the configured database target and migration history, verifies client TLS with the provider CA, and proves a fresh application-data backup/isolated restore. The safety implementation has not been deployed: frontend/backend revisions still differ, live `APP_ENV` is absent, and a production frontend points at the staging API. Provider isolation and the production recovery policy remain unaccepted. **Phase 7B has not started. Real money remains unavailable.**

Evidence labels used here:

- **VERIFIED**: inspected source, executed command, authenticated provider UI, or read-only database query in this session; the method is stated.
- **BUILT locally**: implemented and checked in the working tree; this does not mean deployed.
- **PLANNED / MISSING**: an unimplemented decision or an acceptance item without evidence. Historical records are identified explicitly.

## 1. Repository identity and change boundary

Verified by `git status --short --branch`, `git branch -vv`, `git log`, `git ls-remote origin`, and branch comparison:

| Item | Observed state |
|---|---|
| Starting branch | `codex/phase-6-revenue-service-readiness` |
| Starting HEAD | `a17a45c126e91cfaac46456f5ca368f8cff78cd3` |
| Live origin Phase 6 | `f2ce3ddef71ca5369c1479da48236ccd202b4f52` |
| Local-only commits at start | `343b1ed` (APP_ENV implementation), `a17a45c` (gate documentation) |
| Local and origin main | `91ca7533c8d4d3e78bc090031d69097731b03d8b` |
| Origin | `abuseridzerati-max/fugluck` on GitHub |
| New local work branch | `codex/phase-7a-environment-safety`, created from the inspected HEAD |
| Pre-existing changes | `AGENTS.md`, `PROGRESS.md`, untracked `.agents/`; preserved |

No reset, merge, branch rewrite, production deployment, payment operation, or staging database mutation was performed. Provider SQL used `BEGIN READ ONLY`. The public catalog was already populated (eight total template records verified by SQL). No competition was joined and no test funds were granted. The operations visual fixture used synthetic data only.

## 2. Deployed services and revisions

Verified in the authenticated Vercel, Render and Supabase dashboards, not inferred from handoff text:

| Surface | Current verified identity | Result |
|---|---|---|
| Staging frontend | Vercel `arcadeclash-client`; Preview `7FZ4mMAo9MjAp9xc11SDWEA6kKMB`; alias `staging.fugluck.com`; full SHA `f2ce3ddef71ca5369c1479da48236ccd202b4f52` | VERIFIED |
| Staging backend | Render `fugluck-api-staging`, `srv-da2c50c9v7es73db3dkg`, deploy `dep-daqu4co473hc73943t5g`; `api-staging.fugluck.com`; full SHA `150c6c465a81e48bea5a11e19617b65072d22fb3` | VERIFIED; differs from frontend |
| Render environment | Project `prj-da2c502jnfac73ae92k0`, environment `evm-da2c502jnfac73ae92kg` labeled **Production**; only one service in that project | Ambiguous label remains; no second production API in the inspected workspace |
| Runtime configuration | Render keys include `NODE_ENV`, whose value is `production`; no `APP_ENV` key was listed. `/health` and `/api/health` return `environment: production` without a revision | Old environment reporting remains deployed |
| Staging database project | Supabase `fugluck-staging-frankfurt`, `gzfcucvxfzzjzjtgkwpd`, `eu-central-1`, nano, Free plan | VERIFIED provider project |
| Legacy database project | Supabase `fugluck-staging`, `wgdsdjzcekpkocblzikn`, `ap-northeast-1`, retained | VERIFIED; not the configured Render target |
| Production frontend | Vercel deployment `AtViaffzmmQELvKqBn8u56mxRZ6W`, main SHA `91ca7533c8d4d3e78bc090031d69097731b03d8b`, Ready | A production frontend **does exist** |
| Production API/database | No separately named production service/project in the inspected Render workspace or Supabase organization | Not provisioned/accepted in this inventory; not proof about other accounts |

The production Vercel alias `arcadeclash-client.vercel.app` returned HTTP 200. Its served asset `/assets/index-BMOhywaz.js` contains `https://api-staging.fugluck.com` (verified by reading the public build asset). Vercel lists `VITE_API_URL`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_ANON_KEY` under **Production and Preview**, with no `VITE_APP_ENV` variable. This is shared configuration, not accepted environment isolation. The provider-listed `www.fugluck.com` failed DNS resolution from the audit machine (`ENOTFOUND`); its public reachability is not accepted.

Render currently allows only `https://staging.fugluck.com` in `ALLOWED_ORIGINS` and `CLIENT_ORIGIN` (verified by revealing those non-secret values). That limits browser access from the production frontend, but does not make its configured staging API appropriate. `COOKIE_DOMAIN=.fugluck.com` remains configured. No provider configuration was saved or altered in this audit.

Provider evidence surfaces: [Vercel staging deployment](https://vercel.com/akatsuki-66a7/arcadeclash-client/7FZ4mMAo9MjAp9xc11SDWEA6kKMB), [Render staging deployment](https://dashboard.render.com/web/srv-da2c50c9v7es73db3dkg/deploys/dep-daqu4co473hc73943t5g), [Supabase Frankfurt project](https://supabase.com/dashboard/project/gzfcucvxfzzjzjtgkwpd). These require the operator's provider account.

## 3. Database identity and migration identity

**VERIFIED configured Render target:** the database setting was inspected in the provider UI, returning only routing metadata. Its hostname is `aws-0-eu-central-1.pooler.supabase.com`, port `5432`, database `postgres`, and tenant matches the Frankfurt project. The credential was neither printed nor saved in evidence and the secret viewer was closed. This closes the earlier uncertainty about the provider-configured target. It is not yet a runtime attestation from the new diagnostic.

The non-secret routing fingerprint is:

```text
sha256:6b2e32ee04be948ac7015fe81ff6e32ca09ffee7491aade8e69041fcd18eb926
```

Definition: SHA-256 of JSON `[normalized hostname, normalized port, database, decoded database username]`. The username includes the pooler project tenant, so projects sharing a pooler hostname/database do not collide. Passwords and arbitrary query parameters are excluded. Routing overrides in query parameters are rejected by the new guard. A fingerprint identifies configuration; provider control of the project, TLS, runtime verification and restricted credentials remain necessary.

Other environment targets, verified by parsing only private routing fields:

| Environment | Non-secret target fingerprint | Evidence boundary |
|---|---|---|
| Local development | `8654d5007c93c9e17490cd3eca2fead25142b3671bdcd1f47b930bb3e0689ab0` | Configured Neon development database |
| Disposable tests | `ca82ef11b3bc18d868509b4e8c5ee4c6c09a76b33cf6fd8a02fb280eed196ae0` | Separate `arcadeclash_atomic_test` database; all database test programs enforce the disposable-target guard |
| Legacy Tokyo staging | `a46de125d8d4004066c2afdcc1085f926c54f0ac7d0a3d940c718261f2d61f0b` | Retained raw-URI configuration only; not connected during this audit |
| Production | None independently registered | Existing frontend points to staging API; no separate production data target is accepted |

**VERIFIED Frankfurt migration history:** read-only SQL in the project-bound Supabase SQL editor returned 12 records, journal head `1790200000000`, matching `0011_terminal_participant_status`, with head hash:

```text
053be642bb379a9ac3c0853c4efeffa2bc1af681674de34aa7100d534c75c199
```

All 12 recorded hashes match one of the exact LF/CRLF representations of their current source SQL. The database contains a historical mixture of Windows and Linux hashes. The raw ordered `md5(string_agg(hash || ':' || created_at, ',' ORDER BY created_at))` is `520fceb5eec5ccfa8f74f4f36b32485f`. MD5 here is only an audit comparison value, not a security primitive. The new runtime verifier compares every timestamp and SHA-256, rejects missing/extra/changed/duplicate rows, and reports expected/applied heads. It does not rewrite migration metadata. Drizzle's `created_at` is a journal version timestamp, **not the actual migration execution time**.

Local configuration was inspected without printing secret values. `packages/server/.env` points to a separate Neon development database; its disposable test database is `arcadeclash_atomic_test`. **Correction to the earlier handoff and initial inspection:** the two ignored staging files contain raw connection URIs, not dotenv key/value entries. A dotenv-only inspection incorrectly classified them as empty. `.env.staging.local` identifies the legacy Tokyo target and was not used. `.env.staging-eu.local` identifies the independently verified Frankfurt routing tuple and was successfully authenticated over verified TLS. No credential was printed or committed.

The direct read-only preflight with Node's default trust store failed with `SELF_SIGNED_CERT_IN_CHAIN`. Downloading the official certificate from the project's Database Settings and supplying it explicitly made certificate/hostname verification succeed (`rejectUnauthorized=true`, TLS socket `authorized=true`). The CA SHA-256 fingerprint is `80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`, valid until 2031-04-26. The current source's full migration comparator returned **match, 12/12**, head `0011_terminal_participant_status`, and expected canonical chain fingerprint `e925c6ca535f941d36e052ca71d2bda836659f6b60b75c558b68a2949ee5a44e`.

This proves the audited client-to-session-pooler connection. `pg_stat_ssl` for the pooler's upstream database session returned `ssl=false`; it must not be described as end-to-end TLS. The provider UI also showed SSL enforcement off and network access allowed from all IP addresses. No setting was toggled. Provider-internal transport guarantees, network restrictions, least-privilege runtime roles and mandatory inbound SSL are production-hardening decisions. [Supabase's connection documentation](https://supabase.com/docs/guides/database/connecting-to-postgres) describes explicit CA trust and certificate verification.

## 4. Catalog first-request and warm behavior

Verified by timed public HTTP requests and the signed-in staging browser without entering a competition:

| Observation | Result |
|---|---|
| First `/health` request in this audit | HTTP 200 after **32,501 ms** |
| Following `/api/health` | HTTP 200 after **94 ms**, database connected |
| Later browser catalog load | Reached the existing timeout message and Retry button |
| Two six-second API catalog probes | Timed out after **6,014 ms** and **6,012 ms** |
| Browser Retry after warm-up | Four cards rendered: Space Blaster standard, promotional and freeroll; Cyber Hopper standard |
| Three later catalog API probes | HTTP 200; **223 / 98 / 89 ms**; four templates across the two certified games |

These observations demonstrate a working warm catalog and functional timeout/retry, **not** a cold-start latency guarantee or new gameplay certification. Render's service page identifies a Free instance and warns about inactivity spin-down. Its [Free service documentation](https://render.com/docs/free) describes that behavior. No plan purchase or server restart was used to conceal the first-request failures. Paid always-on hosting and an explicit latency/capacity target remain production decisions.

## 5. Backup, restore and recovery state

**VERIFIED:** the Frankfurt dashboard's Backups page states that Free does not include project backups, and its overview reports no backups. Current [Supabase backup documentation](https://supabase.com/docs/guides/platform/backups) recommends regular logical exports and off-site copies for Free projects. Managed-backup availability is not restore acceptance.

**Historical artifact, verified only by current file metadata:** ignored `Temp/phase55a-round2/staging-before-move.dump` exists, 387,156 bytes, last modified 2026-09-24 10:35:19 UTC. It is the pre-move archive described in earlier sessions, not a fresh export of today's Frankfurt database. PostgreSQL client executables are present under the earlier task's private tooling directory. Their presence does not establish a successful current backup or restore.

**VERIFIED fresh application recovery rehearsal:** `pg_dump 17.11` exported a consistent read-only snapshot from Frankfurt with `sslmode=verify-full` and the official provider CA. The new archive is **423,312 bytes**, SHA-256 `58e82b4b0beff86c8f1f001ba842b79e3ccf9900822a3c9d3bb83d26a0d21a1d`; export took **21,137 ms**. It is stored under ignored `Temp/phase7a/recovery/`, whose inherited ACL was removed and access restricted to the current Windows user. It contains private data and must not be committed, attached, or made public.

A new PostgreSQL cluster was initialized solely for the rehearsal at `127.0.0.1:55437`, with a generated local password and an empty `phase7a_restore` database. The `public` and `drizzle` schemas were restored using one transaction and stop-on-error. **All 24 table counts/content fingerprints, column definitions, constraints, indexes, migration rows and reconciliation aggregates matched the exported snapshot.** Restore plus comparison took **589 ms**, excluding download/tool preparation/cluster initialization; this is not an accepted RTO. Source and restored checks both found ledger sum **0**, escrow **0**, reserved **0**, open instances **0**, and unbalanced accounting-reference groups **0**. The isolated server was stopped and no listener remained on 55437.

The first restore attempt exposed missing bootstrap support files in the previously extracted local client tools. Missing support files were extracted from the existing archive after verifying its PostgreSQL binary matched the installed tools. A Windows child-process pipe then held the helper open after the isolated server started; only that helper was stopped, the new cluster's exact directory/role was verified, and the restore completed. Neither issue required changing the source database or relaxing TLS.

**PLANNED / MISSING:** managed backup configuration, encrypted off-site copies, retention, production restore infrastructure, operator-approved RPO/RTO and recurring drills. The local rehearsal covers application schemas; provider roles, Supabase-managed Auth/Storage, external objects, secrets and application deployment recovery were not restored. The protected local archive/cluster are not a production disaster-recovery system. No backup was restored over an existing database.

## 6. Dependency and security baseline

Verified with fresh `npm audit --json`, workspace-filtered audits, `npm ls`, source search and two targeted dependency updates. No `npm audit fix --force` or Drizzle major/minor-line migration was performed.

| Audit scope | High | Moderate | Total |
|---|---:|---:|---:|
| Initial root tree | 2 | 5 | 7 |
| After targeted fixes: root | 1 | 4 | 5 |
| Server workspace | 1 | 4 | 5 |
| Client workspace | 0 | 0 | 0 |
| Games workspace | 0 | 0 | 0 |
| Runtime dependencies (`--omit=dev`) | 1 | 0 | 1 |

All audits reported zero critical findings. Scopes overlap and must not be added together. `nanoid` was updated from `3.3.16` to `3.3.19`, and `qs` from `6.15.3` to `6.16.0`, within their existing dependency ranges; the lockfile change removes their reported findings. These are local dependency results, not a claim about already deployed packages.

Remaining findings:

- **High, runtime:** `drizzle-orm@0.33.0`, GHSA-gpj5-g38j-94v9. The [maintainer advisory](https://github.com/drizzle-team/drizzle-orm/security/advisories/GHSA-gpj5-g38j-94v9) describes improper identifier escaping when untrusted names/aliases are passed into identifier-building APIs. Source search found no `sql.identifier()`/dynamic `.as()` use in server source; this is a limited reachability observation, not proof of non-exploitability. A reviewed upgrade to a patched ORM line with full database regressions is still required before commercial security acceptance.
- **Four moderate package findings, migration tooling:** `drizzle-kit@0.24.2`, `@esbuild-kit/esm-loader`, `@esbuild-kit/core-utils`, and old nested `esbuild`. These overlap the esbuild development-server advisory chain; they are not four independent production exploits. The server start path uses `tsx` with current esbuild, while Drizzle Kit remains development/migration tooling. Targeted tooling upgrade and migration compatibility checks remain open.

**BUILT locally:** hosted database certificate verification and bounded connection/query timeouts. **VERIFIED against the live pooler:** the candidate's connection settings work with the official CA; the read-only migration check and full backup succeeded. **NOT INSTALLED on Render:** the new TLS settings and CA. The old deployed database client disables certificate validation. Do not deploy around a TLS error by restoring that bypass. Automated security suites are not a penetration test, and no commercial security acceptance is claimed.

## 7. Local implementation and safety assertions

Verified through source review, executable environment tests, server/process checks, existing regression suites, and the local operations component preview:

| Assertion | BUILT locally | Current live evidence |
|---|---|---|
| Staging identity cannot silently inherit `NODE_ENV=production` | Explicit hosted `APP_ENV`, full Git revision, service/project/origin validation; separate `VITE_APP_ENV` | Old backend still lacks APP_ENV; candidate not deployed |
| Production cannot start against staging financial data | Production startup/build is blocked until a separately reviewed production target is registered | Existing production frontend still contains staging API configuration |
| No future production financial credentials in staging | Reserved payment/payout secret names are rejected in this release | Provider IAM/secret-store separation is PLANNED; absence of known variable names cannot prove future access restrictions |
| Money defaults OFF | Master and three action flags default off; malformed/enabling values refuse startup; no real adapter/rail exists | Existing source is sandbox-only; new switch report not deployed |
| Deposits independently disabled | `REAL_MONEY_DEPOSITS_ENABLED` + server gate | No deposit implementation exists |
| Withdrawals independently disabled | `REAL_MONEY_WITHDRAWALS_ENABLED` + server gate | No withdrawal implementation exists |
| Real-money entries independently disabled | `REAL_MONEY_COMPETITIONS_ENABLED` + server gate | Existing TEST GEL path remains sandbox; no commercial adapter wired |
| Exact deployed code identifiable | Full SHA in health/operations; static frontend `/deployment.json`; parity display | Provider SHAs verified; current health does not report revision |
| Database identifiable without credential disclosure | Authenticated operations fingerprint/project/expected-target checks; read-only CLI; query routing overrides refused | Provider-configured routing verified; candidate runtime attestation pending |
| Migration identity is trustworthy | Complete timestamp/hash chain checked before recovery/listen; mismatch/unavailable readiness returns 503 | Frankfurt project history verified separately |
| Session environments remain separate | Host-only cookie requirement and environment-specific JWT issuer/audience; cross-environment tokens refused even with a reused signing key | Broad parent-domain cookie remains in old deployment; sign-in required after rollout |

The feature-switch contract intentionally has no configuration-only activation path. `true` cannot enable money in this release. In future phases every financial entry point and background/provider worker must call the relevant server gate; eligibility, legal approval, adapter acceptance, and credential scoping remain additional prerequisites. Disabling new money activity must not strand accepted obligations: future settlement/reconciliation and compensation workflows need a separately reviewed incident policy.

The competition/accounting boundary, independent Entry Fee and Predetermined Prize, immutable competition terms, two-game certification, live server authority, historical financial records, and TEST GEL ledger behavior were not redesigned. No provider-specific payment code, commercial ledger, deposit/withdrawal endpoint, new game authority, or schema migration was added.

## 8. Validation

Final per-script counts and build results are recorded below after execution. The runner executes every `scripts/*-check.ts` program serially; it does not run seed/reset utilities as tests. Database-backed scripts use the existing disposable-database guard.

**Final result: 42 scripts, 1576 passing assertions, zero remaining failures.** The canonical runner contains 39 scripts; the three standalone checks are included below. Server build and typecheck (including the client production build) passed. The existing Vite main-bundle warning above 500 kB remains.

| Script | Passed | Failed |
|---|---:|---:|
| `migration-schema-parity-check.ts` | 321 | 0 |
| `auth-account-lifecycle-check.ts` | 41 | 0 |
| `legal-policy-help-check.ts` | 86 | 0 |
| `i18n-check.ts` | 65 | 0 |
| `wallet-friends-check.ts` | 48 | 0 |
| `financial-reconnection-check.ts` | 17 | 0 |
| `matchmaking-check.ts` | 65 | 0 |
| `determinism-check.ts` | 12 | 0 |
| `score-validation-check.ts` | 12 | 0 |
| `canvas-render-check.ts` | 21 | 0 |
| `rate-limit-check.ts` | 11 | 0 |
| `sql-injection-check.ts` | 19 | 0 |
| `input-validation-check.ts` | 20 | 0 |
| `xss-audit-check.ts` | 17 | 0 |
| `password-security-check.ts` | 13 | 0 |
| `admin-security-check.ts` | 8 | 0 |
| `admin-console-check.ts` | 49 | 0 |
| `admin-reset-recovery-check.ts` | 11 | 0 |
| `seed-admin-check.ts` | 7 | 0 |
| `cors-audit-check.ts` | 20 | 0 |
| `registration-verification-check.ts` | 9 | 0 |
| `owner-admin-lockout-check.ts` | 10 | 0 |
| `request-logging-audit-check.ts` | 12 | 0 |
| `password-policy-check.ts` | 18 | 0 |
| `file-upload-audit-check.ts` | 4 | 0 |
| `wallet-settlement-concurrency-check.ts` | 16 | 0 |
| `wallet-settlement-integrity-check.ts` | 24 | 0 |
| `match-lifecycle-durability-check.ts` | 26 | 0 |
| `staging-readiness-check.ts` | 40 | 0 |
| `competition-phase1-domain-check.ts` | 41 | 0 |
| `competition-phase2-accounting-check.ts` | 54 | 0 |
| `competition-phase3-lifecycle-check.ts` | 45 | 0 |
| `competition-phase4-ui-check.ts` | 44 | 0 |
| `competition-phase5-admin-check.ts` | 42 | 0 |
| `competition-authority-check.ts` | 65 | 0 |
| `competition-admin-http-check.ts` | 43 | 0 |
| `competition-authority-latency-check.ts` | 26 | 0 |
| `authority-presentation-check.ts` | 24 | 0 |
| `environment-safety-check.ts` | 72 | 0 |
| `atomic-wager-lifecycle-check.ts` | 38 | 0 |
| `cyber-hopper-authority-check.ts` | 42 | 0 |
| `test-database-safety-check.ts` | 18 | 0 |

The first all-script run found one failure in the admin HTTP fixture: a supposedly full revision contained 42 characters and was correctly rejected. The fixture was corrected to 40 characters, safe condition diagnostics were added, and the complete HTTP script reran successfully at **43/43**. Other scripts all completed successfully; the environment suite includes the final TLS-query parsing regression. `git diff --check` also passed.

The operations component was inspected at default desktop size and a 320px viewport using synthetic data. DOM layout reported `clientWidth=scrollWidth=305` (the viewport minus scrollbar), with no horizontal overflow. This verifies component layout only, not an authenticated live deployment. The temporary preview was not added to the application routes.

## 9. Required architecture decisions before Phase 7B

These are **PLANNED**, not accepted merely because listed:

1. **Environment ownership:** confirm how to retire/isolate the existing production frontend that references staging, correct Render's environment label, scope Preview configuration to the approved branch, and establish independent production provider credentials/roles. Do not activate production by copying the staging project or financial history.
2. **Production topology:** retain the monorepo and current competition/accounting boundary unless measured needs justify a change. Choose the production frontend/API/database providers, region, always-on capacity, pooling, TLS trust, access controls, migration operator and secret stores. No specific paid plan is purchased or accepted by this report.
3. **Recovery contract:** select backup frequency/retention, encrypted off-site copies, production restore destination, approved RPO/RTO, and an operator who runs and records restore/reconciliation drills. The application-data rehearsal above supplies current staging evidence, not the production operating contract.
4. **Commercial accounting contract:** preserve `CompetitionAccountingPort`; define integer minor units, available/reserved/pending accounts, append-only balanced transactions, idempotency/provider references, compensating corrections, promotional subsidy and prize liabilities independently from entry revenue. No pot-minus-rake assumption and no direct balance mutation.
5. **Financial gating:** approve a server-only master/action switch contract, obligation-completion policy during incidents, eligibility/limits hooks and audit requirements. Actual legal/KYC thresholds, supported currencies and approved bank/provider rails require external decisions; they are not invented here.
6. **Release/operations contract:** require full frontend/backend SHA parity, database/migration attestation, reconciliation, monitored errors/latency/authority/settlement, rollback ownership and incident response. Process-local health telemetry does not satisfy durable monitoring.
7. **Security remediation:** select and validate a patched Drizzle ORM/tooling pair, install the verified CA/TLS settings, address provider SSL/network/role controls, and define further commercial security review. Dependency residuals have not been accepted as permanent risk.

## 10. Remaining blockers and concrete rollout boundary

- **BLOCKER — deployed identity:** install the reviewed candidate and non-secret settings from [DEPLOYMENT.md](../DEPLOYMENT.md) on matching staging revisions; then re-run health, runtime DB/migration, operations and catalog checks. The provider badge and old APP_ENV problem are still live.
- **BLOCKER — production separation:** the currently deployed production frontend references staging; production backend/database architecture and credential isolation are not accepted. Production changes belong to an explicit reviewed plan.
- **BLOCKER — deployed TLS and production recovery:** install the verified CA on Render and verify the deployed connection; choose managed/off-site backups, production restoration and RPO/RTO. The fresh local application-data restore passed within its stated scope.
- **BLOCKER — commercial hosting/security/operations decisions:** always-on capacity, current ORM/tooling findings, durable observability, operator legal/provider inputs and production recovery remain unresolved.

The repository deployment rule requires an **explicitly approved feature-branch commit** before staging release. A branch push can auto-build Vercel Preview, so it is part of rollout, not just a harmless synchronization step. This session prepares a reviewable local candidate and records the exact required settings; it does not claim that those settings or runtime changes are already installed. No real-money activation, main merge, production promotion or Phase 7B work is authorized by this report.
