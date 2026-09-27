# Phase 7A.1 — Commercial Environment & Production Safety Baseline

Audit date: **2026-09-27, Asia/Tbilisi** (UTC observations begin 2026-09-26). Scope: the current repository, visible provider accounts, deployed staging and production frontend, and Phase 7A safety implementation. This is the single Phase 7A baseline report, not commercial launch acceptance. Sections 1–9 below preserve the pre-deployment audit snapshot; the rollout addendum records the later staging state.

Sanitized pre-deployment structured evidence and per-script results: [phase7a-baseline.json](evidence/phase7a-baseline.json). The post-deployment rerun uses the same explicit 42-script count table in §8 and is recorded below. Private connection files, database exports and row-level data are excluded.

**Current verdict: Phase 7A.1 NOT PASS despite a verified Phase 7B staging rollout.** Staging now runs `39debbfa9dfb99a2f38c1c99fa19b5f58f7333c3` with 13/13 matching migrations and all real-money operations OFF. The unchanged Production frontend still embeds the staging API; independent production resources, provider isolation and the production recovery policy remain unaccepted. The mock financial engine has no hosted mutation route. [Controlled staging acceptance](PHASE_7B_STAGING_ACCEPTANCE.md) is the current rollout record; the earlier 12-migration observations below are historical.

Evidence labels used here:

- **VERIFIED**: inspected source, executed command, authenticated provider UI, or read-only database query in this session; the method is stated.
- **BUILT locally**: implemented and checked in the working tree; this does not mean deployed.
- **PLANNED / MISSING**: an unimplemented decision or an acceptance item without evidence. Historical records are identified explicitly.

## Current controlled staging state — Phase 7B rollout on 2026-09-27

**VERIFIED by CA-backed backup/restore, official migration, Git, authenticated provider dashboards and live public HTTP:** a fresh 423,312-byte Frankfurt staging archive was created at 2026-09-27 12:15:38 UTC with SHA-256 `211e7fd301b3db80ad7bf6715983c0a754966b1e0edb3b0e69d311543831991f`; an isolated restore matched all 24 application table fingerprints, schema objects, 12 prior journal rows and zero-discrepancy sandbox accounting. The archive is protected and ignored. Migration `0012_commercial_financial_core` then advanced only the staging database to **13/13**, head hash `9c6a81859792a4ba5ab6ce0f51eb34b195e4fa8573962d9dee55c5e2ea92fed5`, with eight commercial tables and 15 triggers. Existing sandbox accounting remained balanced.

Render staging deploy [`dep-dasgkhjncjis73a2g9r0`](https://dashboard.render.com/web/srv-da2c50c9v7es73db3dkg/deploys/dep-dasgkhjncjis73a2g9r0) is **Live**. Vercel Preview [`98vgUR1jHJgJQhPhcMdV7kjyht8m`](https://vercel.com/akatsuki-66a7/arcadeclash-client/98vgUR1jHJgJQhPhcMdV7kjyht8m) is **Ready** and bound to `staging.fugluck.com`. Both and their public health/deployment responses identify `39debbfa9dfb99a2f38c1c99fa19b5f58f7333c3`. `/api/health` reports database `connected`, migrations `match`, APP_ENV `staging`; master/deposit/withdrawal/competition financial actions remain OFF. Valid edge TLS, staging-only credentialed CORS, host-only Secure/HttpOnly/Lax logout cookie, unauthenticated Admin Operations 401 and a four-card warm catalog were verified. After more than 15 minutes idle, the first catalog visit timed out and showed Retry; one Retry recovered all four cards, so cold-first availability is a staging finding. The post-rollout regression passed **43/43 scripts, 1,661/1,661 assertions**, with exact per-script counts in [the current staging record](PHASE_7B_STAGING_ACCEPTANCE.md). Signed mock flows passed **76/76 Space Blaster** and **76/76 Cyber Hopper** against temporary isolated schemas in the live staging database, which were removed; public commercial tables remain empty. This is a database-backed mock exercise with fixture authority decisions, **not** a hosted financial-route or physical Level 3 gameplay test.

**Phase 7A exit remains blocked:** Vercel Production is still `AtViaffzmmQELvKqBn8u56mxRZ6W` on main `91ca7533c8d4d3e78bc090031d69097731b03d8b`; the same public asset hash `394007635f52addd95f3f886bb17594069486d12400f73a6e81ec9d741fb5e59` still embeds `https://api-staging.fugluck.com`. No Production configuration, deployment, data or main ref was changed. Independent production resources and production recovery remain PLANNED, requiring separate authorization. Authenticated Admin Operations still requires a legitimate sign-in. Exact current acceptance scope and remaining engineering are in [the Phase 7B staging record](PHASE_7B_STAGING_ACCEPTANCE.md).

## Prior Phase 7A.1 staging rollout addendum — 2026-09-27 (historical)

**Post-rotation recovery addendum, verified 2026-09-27:** Render Live deployment [`dep-dasen7t9fdbs73d4aj8g`](https://dashboard.render.com/web/srv-da2c50c9v7es73db3dkg/deploys/dep-dasen7t9fdbs73d4aj8g) is the latest successful redeploy of the same approved SHA after credential rotation. Public `/health` and `/api/health` returned HTTP 200 with `environment=staging`, revision `542c594c1891784c7dd90efa458cb0f05e8fc9ec`, database `connected`, migrations `match`, and all commercial actions denied. The running service therefore connects with its rotated private configuration; the new credential was never printed or read into a report. A bounded read-only TLS connection using the older ignored local URI failed with PostgreSQL authentication code `28P01`, confirming that local credential is invalid. The startup guard at the deployed SHA accepts only the registered Frankfurt project `gzfcucvxfzzjzjtgkwpd`, routing fingerprint `6b2e32ee04be948ac7015fe81ff6e32ca09ffee7491aade8e69041fcd18eb926`, and the complete 12-migration chain; the public readiness result corroborates those checks without exposing the URI. Direct post-rotation SQL under the new credential was not available to this session. Frontend `/deployment.json` still reports the same SHA and staging API origin. A warm catalog request returned four templates with HTTP 200. Fresh edge TLS validation passed for both staging hosts; both certificates expire 2026-11-16 UTC. A staging-origin CORS preflight returned 204 with the staging origin and credentials; an unapproved origin had no allow-origin header. Logout emitted a host-only, HttpOnly, Secure, SameSite=Lax cookie. These are live read-only checks; no production service or configuration was changed.

**Phase 7B worktree distinction:** migration `0012_commercial_financial_core` and mock-only financial code are being built locally after the approved staging deployment. The live service remains at its 12-migration head `0011_terminal_participant_status`; migration 0012 has not been applied to staging. Any later staging rollout of new code must migrate a reviewed backup first, then deploy matching backend/frontend revisions. The current staging 12/12 readiness is valid for its deployed SHA, not for the newer worktree.

**Local security follow-up, verified by package install, typecheck/client build, Drizzle migration checker and fresh audits:** the worktree upgraded `drizzle-orm` to `0.45.3` and `drizzle-kit` to `0.31.11`. The patched ORM removes the prior high advisory from the local dependency tree. Root audit is now **0 critical, 0 high, 4 moderate, 0 low**; runtime-only audit is **0 findings**. The four remaining moderate findings are in the development migration-tooling/esbuild chain. `drizzle-kit check` passed with a nonfunctional localhost fixture URL. The deployed staging SHA predates these package changes, so its dependency remediation is **not deployed**.

**BUILT and deployed to staging; verified by Git refs, provider deployment pages and public responses:** `codex/phase-7a-environment-safety` points to `542c594c1891784c7dd90efa458cb0f05e8fc9ec`. Render deploy [`dep-dasd24h7lnhs738m1t6g`](https://dashboard.render.com/web/srv-da2c50c9v7es73db3dkg/deploys/dep-dasd24h7lnhs738m1t6g) was Live at that SHA before credential rotation; the newer Live deployment is recorded above. Vercel Preview [`Cd1TVmXmunanBSSaPnbMKtSgUkom`](https://vercel.com/akatsuki-66a7/arcadeclash-client/Cd1TVmXmunanBSSaPnbMKtSgUkom) is Ready at the same SHA; `staging.fugluck.com` is assigned to its feature branch. The first automatic Preview build failed closed because `VITE_APP_ENV` was not yet set; redeployment after adding branch-scoped `VITE_APP_ENV=staging` and `VITE_API_URL=https://api-staging.fugluck.com` succeeded. Render's existing environment `evm-da2c502jnfac73ae92kg`, with only the staging API service, was renamed from `Production` to `Staging`. Auto-deploy remains off on Render.

**VERIFIED by live public HTTP:** [`/deployment.json`](https://staging.fugluck.com/deployment.json) reports `environment=staging`, the full approved SHA, `apiOrigin=https://api-staging.fugluck.com`, and `commercialMoneyEnabled=false`. Backend [`/health`](https://api-staging.fugluck.com/health) reports the same SHA, `environment=staging`, `runtimeMode=production`, implementation `unavailable`, master money OFF, and deposits/withdrawals/competitions denied as `MONEY_DISABLED`. [`/api/health`](https://api-staging.fugluck.com/api/health) returns HTTP 200, database `connected`, migrations `match`. This proves live code/configuration parity and runtime readiness, while `/health` alone remains liveness only.

**VERIFIED by Render variable inventory, source review, and fresh read-only TLS query:** the service has `APP_ENV`, Frankfurt region, exact target fingerprint, official CA, and all four financial switches; `COOKIE_DOMAIN` and the reserved payment/payout provider secret names are absent. Source startup validation rejects any other staging project, origin, fingerprint, or enabled financial flag before connection. The public ready process thus passed those guards; negative configurations were exercised in the post-deployment local safety suite, not injected into the live service. Direct read-only inspection of the registered Frankfurt project `gzfcucvxfzzjzjtgkwpd` matched all **12/12** migrations, head `0011_terminal_participant_status`, head hash `053be642bb379a9ac3c0853c4efeffa2bc1af681674de34aa7100d534c75c199`, using verified client-to-pooler TLS. The same read-only accounting adapter reports zero ledger discrepancy, zero reserved entry funds, zero active instances and `systemReconciled=true`. Authenticated live Admin Operations could not be inspected without a fresh admin sign-in; the public readiness and independent database checks cover its database/migration/accounting claims, but not its authenticated UI.

**VERIFIED staging resource boundary within the inspected accounts:** the served client points only to `api-staging.fugluck.com`; the API's accepted startup identity binds its database to the Frankfurt staging project and its browser origin to `staging.fugluck.com`. The visible Render variable inventory has no reserved payment/payout provider secrets, and no separately identified production financial provider or database is present in the inspected Render/Supabase inventory. This is a scoped observation, not proof about inaccessible accounts or provider IAM. The legacy shared Vercel `VITE_SUPABASE_*` settings are unused by current client source (source search); they still need production-only separation before future use.

**VERIFIED TLS:** certificate policy validation returned `None` for `staging.fugluck.com` and `api-staging.fugluck.com`; both certificates are valid through 2026-11-16 UTC. This is edge TLS validation; the separate CA-backed database query proves client-to-pooler certificate validation, not provider-internal transport.

**VERIFIED catalog from idle and warm state:** after more than 15 minutes without an app request, a fresh browser load of `/competitions` showed the bounded six-second timeout message and `Retry` button. After the Render Free instance woke, `Retry` displayed exactly four certified templates (three Space Blaster, one Cyber Hopper). Three warm public API requests returned HTTP 200 with four templates in **626 / 118 / 117 ms**. The cold request did not meet the six-second target, so free-instance latency remains a hosting limitation even though the UI recovers correctly.

**VERIFIED deployed boundary behavior:** a staging-origin CORS preflight returned HTTP 204 and `Access-Control-Allow-Origin: https://staging.fugluck.com`; the unchanged Production frontend origin received HTTP 500 with no allow-origin header. An unauthenticated logout response set an expired host-only `ac_session` cookie with `HttpOnly; Secure; SameSite=Lax` and no `Domain`. Unauthenticated Admin Operations returned HTTP 401. The successful hosted boot and these live probes corroborate the guard code; the full negative-configuration matrix was tested locally at the same deployed SHA, not by injecting invalid settings into staging.

**VERIFIED complete post-deployment acceptance run:** all **42/42** `scripts/*-check.ts` programs completed with exit code 0 and the same **1,576/1,576 passing assertions, zero failures** as the explicit per-script table in §8 (cross-checked against every result filename). The suite ran serially on the guarded disposable test database, not the staging database. `npm run typecheck` (including client build), `npm run build:server`, and `git diff --check` passed. The client build retains its existing >500 kB bundle warning. A fresh root `npm audit --json` still reports **0 critical, 1 high, 4 moderate, 0 low**; the high Drizzle runtime finding remains open. These tests do not replace the separate production and credential gates.

**CREDENTIAL-HANDLING FINDING CLOSED for the old local URI:** a staging database URI became visible in an internal provider-inspection tool transcript during rollout. Its value is excluded from reports and tracked files. The user reported rotation and successful backend redeployment; independent live readiness confirms the new service connection, and a CA-verified read-only attempt with the older local URI failed with authentication code `28P01`. Do not copy the old credential into any environment. Future secret-store and provider-IAM isolation remain separate production requirements.

**PLANNED / BLOCKED without separate production authorization:** the Production Vercel deployment remains `AtViaffzmmQELvKqBn8u56mxRZ6W` at main `91ca7533c8d4d3e78bc090031d69097731b03d8b`. Its served `/assets/index-BMOhywaz.js` still contains `https://api-staging.fugluck.com` (public asset read again after rotation; prior SHA-256 `394007635f52addd95f3f886bb17594069486d12400f73a6e81ec9d741fb5e59`). The old Vercel `VITE_API_URL` remains scoped to Production and Preview; the new staging override is branch-scoped. Main source routes catalog, auth/account, admin, wallet, friends, invites, matchmaking and authority sockets through the central API URL, so the production-hosted frontend's interactive features depend on the staging backend. It is an older, non-commercial deployment; the production Vercel client exists, but no separate production API/database or financial provider was found in the inspected account inventory. Other accounts cannot be excluded. Current feature source blocks a future Production build until a separate target is accepted; it cannot alter the old live deployment. A separately approved production action should first retire/disable that public frontend if no independent stack is ready, or provision and validate an independent API/database/secret store, then set a Production-only API origin and build/deploy with money OFF. Remove the old shared Production/Preview override during that controlled action; do not repoint to an arbitrary target. Production configuration, alias, deployment and `main` were not changed.

The remaining historical sections record the observations **before** the approved staging rollout. Their old live SHA, missing `APP_ENV`, provider label and pending-deployment statements are not the current state. The unresolved production separation and commercial readiness findings remain applicable.

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

| Surface | Pre-rollout verified identity | Result |
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

| Assertion | BUILT locally before rollout | Pre-rollout live evidence |
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

The approved staging SHA's original per-script counts are recorded below. The runner executes every `scripts/*-check.ts` program serially; it does not run seed/reset utilities as tests. Database-backed scripts use the existing disposable-database guard.

**Approved-SHA result: 42 scripts, 1576 passing assertions, zero remaining failures.** The canonical runner contained 39 scripts; the three standalone checks are included below. Server build and typecheck (including the client production build) passed. The existing Vite main-bundle warning above 500 kB remains.

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

**Latest local candidate run after credential rotation (2026-09-27): 43/43 scripts, 1,661 passing assertions, zero failures.** This serial run includes every program in `scripts/*-check.ts` on the guarded disposable database. The added commercial test used a temporary isolated schema; it passed 76/76 and cleaned up its fixtures. Migration parity passed 329/329 and admin HTTP passed 44/44; the other per-script counts above were unchanged. [Sanitized candidate evidence](evidence/phase7a-commercial-candidate-20260927.json) records all 43 exact pass counts and durations. Typecheck/client production build, server build, the package-local Drizzle migration checker, and `git diff --check` passed. The root dependency audit is 0 critical, 0 high, 4 moderate, 0 low; runtime-only audit has 0 findings. This validates the local candidate, **not** a deployment of migration 0012 or financial code. The live staging revision and Phase 7A production-separation blocker are unchanged.

During the original 42-script Phase 7A baseline, an admin HTTP fixture used a 42-character revision and was correctly rejected. Correcting that fixture produced the historical **43/43** admin HTTP result shown in the table. The newer commercial-candidate run above passed the expanded admin HTTP check at **44/44**.

The operations component was inspected at default desktop size and a 320px viewport using synthetic data. DOM layout reported `clientWidth=scrollWidth=305` (the viewport minus scrollbar), with no horizontal overflow. This verifies component layout only, not an authenticated live deployment. The temporary preview was not added to the application routes.

## 9. Required architecture decisions before commercial activation

These decisions are **not accepted** merely because listed. The Phase 7B–7I work below is a local simulation candidate, not a hosted financial path:

1. **Environment ownership:** decide how to retire/isolate the existing production frontend that references staging and establish independent production provider credentials/roles. Render's environment label and approved Preview branch scope were corrected during the staging rollout. Do not activate production by copying the staging project or financial history.
2. **Production topology:** retain the monorepo and current competition/accounting boundary unless measured needs justify a change. Choose the production frontend/API/database providers, region, always-on capacity, pooling, TLS trust, access controls, migration operator and secret stores. No specific paid plan is purchased or accepted by this report.
3. **Recovery contract:** select backup frequency/retention, encrypted off-site copies, production restore destination, approved RPO/RTO, and an operator who runs and records restore/reconciliation drills. The application-data rehearsal above supplies current staging evidence, not the production operating contract.
4. **Commercial accounting contract:** **BUILT locally and tested on a guarded disposable database** behind `CompetitionAccountingPort`: integer minor units, available/reserved accounts, append-only balanced transactions, idempotency/provider references, compensating corrections and promotional subsidy with predetermined prizes independent of entry revenue. Migration `0012_commercial_financial_core` and the mock-only code have not been deployed or accepted for real money; production role separation and accounting sign-off remain **PLANNED**.
5. **Financial gating:** approve a server-only master/action switch contract, obligation-completion policy during incidents, eligibility/limits hooks and audit requirements. Actual legal/KYC thresholds, supported currencies and approved bank/provider rails require external decisions; they are not invented here.
6. **Release/operations contract:** require full frontend/backend SHA parity, database/migration attestation, reconciliation, monitored errors/latency/authority/settlement, rollback ownership and incident response. Process-local health telemetry does not satisfy durable monitoring.
7. **Security remediation:** **BUILT locally and verified by audit/builds:** Drizzle ORM `0.45.3` and Drizzle Kit `0.31.11` remove the prior high runtime advisory from the candidate; four moderate development-tooling findings remain. This is not in the deployed staging SHA. Provider SSL/network/role controls and further commercial security review remain **PLANNED**. The verified CA/TLS settings were installed on the staging service during rollout.

## 10. Remaining blockers after the staging rollout

- **PHASE 7A EXIT BLOCKER — production separation:** the unchanged Production frontend still calls staging for interactive features. No independent production API/database was identified in the inspected accounts. A separately approved production action must isolate or retire that frontend; this cannot be cured by another staging deployment. Production changes require separate approval.
- **AUTHENTICATED ACCEPTANCE GAP — Admin Operations:** no fresh legitimate admin session was available after the environment-bound JWT rollout. Public readiness and prior read-only database checks corroborate the underlying signals, and the unauthenticated endpoint returned 401; its authenticated browser view remains unverified.
- **STAGING INFRASTRUCTURE LIMITATION / PRODUCTION ARCHITECTURE REQUIREMENT — cold start:** after idle, the six-second catalog request timed out, a later wake request returned four templates, and the next warm request completed in 296 ms. The Retry UI was previously verified at the same frontend SHA. Always-on production capacity and a latency target still need acceptance; this is not evidence of an application correctness failure.
- **COMMERCIAL PRODUCTION GATES:** independent production database/role/secret store, backup and restore policy with approved RPO/RTO, monitoring, provider/legal decisions and financial security review remain unaccepted. They prohibit launch, regardless of local engineering progress.
- **CLOSED — staging credential rotation:** the redeployed backend passed readiness with the rotated credential, and the older local credential failed with PostgreSQL `28P01` over CA-verified TLS. No credential value is in tracked evidence.

The user approved feature-branch/staging deployment of `542c594c1891784c7dd90efa458cb0f05e8fc9ec`; that deployment and credential recovery are complete. Phase 7B–7I engineering proceeds on a separate local branch. No real-money activation, main merge or production deployment/promotion occurred. Phase 7A remains **NOT PASS** because the Production frontend still depends on staging.
