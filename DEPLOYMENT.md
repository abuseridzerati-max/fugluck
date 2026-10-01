# Fugluck — Staging Deployment Guide

## Security staging release — 2026-10-01 (latest verified snapshot)

**BUILT on staging, verified by official migration/history and provider/public identity checks:** 0014_security_boundaries is applied, 15/15 migrations. Vercel Preview 4C4tNn8yRdjGaDuzPRobYQnk2WmK and Render dep-davacl7lot8c73cudi0g serve matching ea22611358d3e31bbdf734ebb5053efeec5b2e0c. The documentation-only follow-up is PLANNED for matching staging deployment before final response. [Release report and every script count](docs/SECURITY_STAGING_RELEASE.md).

**Acceptance NOT PASS:** 52 local scripts/2,270 assertions and builds pass; hosted security 40/41 passes and live authority/accounting audit 23/23 passes, but the guest limiter issues 25 proofs in 2.4 seconds without 429. Current TRUST_PROXY=1 resolves changing internal proxy addresses; verified trusted client-IP remediation/retest remains PLANNED. Recovery session handling passed through a controlled fixture token; EMAIL_PROVIDER=logger and actual mail delivery remain unresolved.

**Verified safeguards:** no environment flags changed; existing authority/knockout/mock competitions remain enabled as found, all real-money/deposit/withdrawal flags (including mock deposit/withdrawal) stay false. Keepz/bank inactive. No Production data/configuration/deployment change. Vercel explicitly auto-deploys main to Production; do not push main. Main was not merged because staging acceptance fails. Owner must separately authorize disabling and verifying automatic Production deployment before a future main push.

Older dated configuration snapshots below are historical when they conflict with this section.

## Final staging configuration — 2026-09-29

**Verified current Render STAGING deploy:** [`dep-datot8u0tbcc73enmlmg`](https://dashboard.render.com/web/srv-da2c50c9v7es73db3dkg/deploys/dep-datot8u0tbcc73enmlmg) is Live and retains exact approved source SHA `0d4ede659ec0776e46f1e583f879a234b9905331` on `codex/competition-restructure`; this was an environment-only redeploy. Public frontend/backend revision endpoints verify the same SHA and `APP_ENV=staging`. The staging database is the Frankfurt target; the live journal matches 14/14 migrations at `0013_knockout_tournaments`.

The final saved staging settings have `ENABLE_COMPETITION_AUTHORITY=true`, `ENABLE_KNOCKOUT_TOURNAMENTS=false`, all `REAL_MONEY_*` flags false, all staging mock action flags false, and the original four-user mock allowlist restored. Live public health reports real-money/deposit/withdrawal/competition actions unavailable. Frontend/backend TLS validates. The service's auto-deploy remains off. No main merge, Production deployment/configuration/database change, real-money activation, or real financial provider use occurred.

Latest acceptance passed Space Blaster Standard 8/16 hosted tournament audits (15/15 each), hosted negative Promo/GIFT enforcement (10/10), and final restricted-action guards (8/8); all 50 local scripts passed 2,177 assertions / 0 failures on 2026-09-29. Phase 7A and Competition Restructure remain NOT PASS: Production still serves a frontend bundle that references the staging API, and cold manual Retry, signed-in browser refresh, and a fresh repeat active-Final Space Blaster restart remain open. See [the current rollout report](docs/COMPETITION_RESTRUCTURE_ROLLOUT.md), [Phase 7A baseline](docs/PHASE_7A_BASELINE.md), and [sanitized evidence](docs/evidence/competition-restructure-staging-20260929.json). The deployment snapshot below is historical where it conflicts with this addendum.

## Earlier staging deployment snapshot — 2026-09-29 (superseded above)

**VERIFIED deployed identity (Render and public frontend/backend HTTP):** branch `codex/competition-restructure`, frontend and backend SHA `0d4ede659ec0776e46f1e583f879a234b9905331`; after testing switches were reset, current Render staging deploy [`dep-datls6vlot8c73836t20`](https://dashboard.render.com/web/srv-da2c50c9v7es73db3dkg/deploys/dep-datls6vlot8c73836t20) is Live; Vercel Preview `AQyXcMmC87f8XJHEx7x4Su7nBhg2` serves `staging.fugluck.com`. Public `deployment.json`, `/health`, and `/api/health` agree on the full SHA and staging identity. Render auto-deploy remains OFF. The approved feature deployment and staging-only environment redeploys used no main merge or Production setting.

**VERIFIED backup and migration:** fresh protected Frankfurt backup at `2026-09-28T17:28:51.623Z`, SHA-256 `3f705d9d4786ca1c9822fb72a82664a677a6002824d4e815a5e060021679375a`; its isolated PostgreSQL 17.11 restore and migration rehearsal passed before migration 0013. Supabase project `gzfcucvxfzzjzjtgkwpd`, routing fingerprint `6b2e32ee04be948ac7015fe81ff6e32ca09ffee7491aade8e69041fcd18eb926`, validated CA/TLS. The applied head is **14/14**, `0013_knockout_tournaments`, LF hash `a39b84386b0cfbfd5fcd7f6bdc3e7a18604d055398829bc8fb470efb9aef3a08`. Final read-only reconciliation verified all pre-backup commercial rows unchanged, no imbalance, reservations, open instances, unresolved provider items or duplicate prizes.

**VERIFIED final staging safeguards:** `APP_ENV=staging`, `NODE_ENV=production`, `ENABLE_COMPETITION_AUTHORITY=true`; all four real-money flags false, all three staging mock action flags false, and `ENABLE_KNOCKOUT_TOURNAMENTS=false`. Render's saved values and live health confirm the two temporary test switches returned to false; the 8/8 post-reset guard suite rejected mock deposits, withdrawals and tournament admission without creating operations. The post-close public catalog returned the four legacy templates. Historical financial test rows carry only `mock_stage_` provider references; no real bank or provider was connected. TLS validated for frontend and backend, staging-origin CORS passed, unapproved origin received no allow-origin header, logout cookie remained host-only/Secure/HttpOnly/SameSite=Lax, and unauthenticated Admin Operations returned 401.

**VERIFIED post-deployment regression:** `npm test` passed all **50 scripts / 2,177 assertions / 0 failures**. Typecheck/client production build, server build, and `git diff --check` passed; the existing >500 kB client chunk advisory remains. Hosted setup passed 45/45 and edge cases 46/46. Two independent genuine Cyber Hopper restart recoveries passed 29/29 each. Space Blaster's ordinary hosted bracket settled exactly once; a stale one-off harness checkpoint failed, but provider restart event, reconnect sessions, persisted attempts and final ledger independently verify active-Final recovery and one final prize. Cold idle catalog recovery produced all 12 cards after the service woke and the background refresh ran; a user-operated timeout/Retry was not directly confirmed. Full 8/16-player hosted progression remains blocked; the user said “not yet” to authorizing twelve more synthetic accounts. Isolated fixtures and partial hosted admission/cancellation checks do not substitute for it.

**Phase status: NOT PASS / not ready for next phase.** Signed-in browser refresh persistence remains unverified; authenticated Admin Operations and physical devices remain unverified. Production deployment `AtViaffzmmQELvKqBn8u56mxRZ6W`, main `91ca7533c8d4d3e78bc090031d69097731b03d8b`, and served bundle hash `394007635f52addd95f3f886bb17594069486d12400f73a6e81ec9d741fb5e59` were rechecked read-only and unchanged; that existing Production bundle still references the staging API. Source review confirms a hosted production client build fails closed until an independent production API target is accepted. Fixing the live Production alias still requires separate authorization. See the [latest competition rollout report](docs/COMPETITION_RESTRUCTURE_ROLLOUT.md), [Phase 7A baseline](docs/PHASE_7A_BASELINE.md), and [sanitized staging evidence](docs/evidence/competition-restructure-staging-20260929.json).

The staging service continues to use `exec node --import tsx packages/server/src/index.ts` and `npm install --include=dev && npm run build:server`. Migration 0013 is irreversible through an old 13-migration binary; keep the 0013-compatible runtime and do not restore over new financial history. No main merge, Production deployment/configuration change, real-money activation, or real payment rail was performed.


**Pre-bank handoff (2026-09-27, documentation only):** [Bank integration intake](docs/BANK_INTEGRATION_INTAKE.md) captures required/optional/unknown bank facts, and [bank integration readiness](docs/BANK_INTEGRATION_READINESS.md) maps the current provider interface, unbuilt refund/status/real-callback gaps and the separately authorized Production isolation sequence. No provider-specific implementation, migration, Production configuration or deployment was made for this handoff. The then-accepted staging runtime was `b87036ce9394af61714e0a8920944e4a6fe247f4`; do not push documentation-only commits to the auto-deploy branch merely to publish this pack.

## Historical Phase 7I hosted mock commercial staging deployment — 2026-09-27

**BUILT and deployed to STAGING, verified by exact Git refs, Render/Vercel deployment pages and live public identity:** the approved feature branch `codex/phase-7b-commercial-candidate` serves code revision `b87036ce9394af61714e0a8920944e4a6fe247f4` on Render staging [`dep-dasi2760tbcc73fghfgg`](https://dashboard.render.com/web/srv-da2c50c9v7es73db3dkg/deploys/dep-dasi2760tbcc73fghfgg) and Vercel Preview [`GS3HnyHv8SJRmvSZ2abiqGyRif6S`](https://vercel.com/akatsuki-66a7/arcadeclash-client/GS3HnyHv8SJRmvSZ2abiqGyRif6S). `/deployment.json`, `/health` and `/api/health` match the full SHA and staging identity; the latter reports database connected and 13/13 migrations match. This documentation may be committed locally after the deployed code without changing that live SHA. [Phase 7I acceptance](docs/PHASE_7I_HOSTED_COMMERCIAL_ACCEPTANCE.md) and [structured evidence](docs/evidence/phase7i-hosted-acceptance-20260927.json) record six genuine hosted authority outcomes, commercial ledger reconciliation, failure cases and **44/44 scripts / 1,682/1,682 assertions**.

**Final switches, verified by Render saved environment and live health:** `APP_ENV=staging`, `NODE_ENV=production`, registered Frankfurt project `gzfcucvxfzzjzjtgkwpd`, migration head `0012_commercial_financial_core` hash `9c6a81859792a4ba5ab6ce0f51eb34b195e4fa8573962d9dee55c5e2ea92fed5`. `REAL_MONEY_ENABLED`, `REAL_MONEY_DEPOSITS_ENABLED`, `REAL_MONEY_WITHDRAWALS_ENABLED` and `REAL_MONEY_COMPETITIONS_ENABLED` are all `false`. The separate `STAGING_MOCK_COMMERCIAL_ENABLED` mode is installed; its three action switches `STAGING_MOCK_DEPOSITS_ENABLED`, `STAGING_MOCK_COMPETITIONS_ENABLED`, `STAGING_MOCK_WITHDRAWALS_ENABLED` were each returned to `false` after acceptance. The mock mode is restricted to the registered staging service, target, two synthetic users and separate operator/provider secrets; do not copy those keys or user IDs into source, shared evidence, Vercel or Production. Test history is retained; do not delete financial audit rows to reset a test. To repeat a hosted mock test, an operator must validate the same staging boundary, explicitly enable only the needed action flags, deploy the exact reviewed feature revision, run the test, reconcile, then return all three to `false` and redeploy. Turning off new entry does not override already accepted obligations; signed callbacks and uncertain payout retry remain available for settlement. This is no authorization for real-money activation.

**Production separation remains unresolved, verified by remote main and Vercel Production overview:** `main` and Production deployment [`AtViaffzmmQELvKqBn8u56mxRZ6W`](https://vercel.com/akatsuki-66a7/arcadeclash-client/AtViaffzmmQELvKqBn8u56mxRZ6W) are unchanged at `91ca7533c8d4d3e78bc090031d69097731b03d8b`. The Production frontend still references the staging API from the earlier verified bundle. Phase 7A is **NOT PASS**; no Production deployment/config/data or real provider resource was touched. Authenticated Admin Operations remains an external sign-in blocker. Render Free cold-first catalog timeout/Retry remains a staging infrastructure limitation; this run verified warm catalog 4/4 at 367/141/117 ms.

## Historical Phase 7B controlled staging deployment — 2026-09-27

**BUILT and deployed to STAGING, verified by Git refs, provider deployment pages and live HTTP:** feature branch `codex/phase-7b-commercial-candidate`, backend Render [`dep-dasgkhjncjis73a2g9r0`](https://dashboard.render.com/web/srv-da2c50c9v7es73db3dkg/deploys/dep-dasgkhjncjis73a2g9r0) **Live**, frontend Vercel Preview [`98vgUR1jHJgJQhPhcMdV7kjyht8m`](https://vercel.com/akatsuki-66a7/arcadeclash-client/98vgUR1jHJgJQhPhcMdV7kjyht8m) **Ready**, and `staging.fugluck.com` all identify `39debbfa9dfb99a2f38c1c99fa19b5f58f7333c3`. The existing Render service and Frankfurt staging database were reused. Migration `0012_commercial_financial_core` was applied only after a fresh protected CA-verified backup and isolated restore parity check; staging now matches **13/13** migrations, head hash `9c6a81859792a4ba5ab6ce0f51eb34b195e4fa8573962d9dee55c5e2ea92fed5`. [Staging acceptance](docs/PHASE_7B_STAGING_ACCEPTANCE.md) contains scope and limitations.

**Money remains unavailable:** `APP_ENV=staging`, `NODE_ENV=production`, registered Frankfurt routing fingerprint `6b2e32ee04be948ac7015fe81ff6e32ca09ffee7491aade8e69041fcd18eb926`, CA verification, staging-only origins and all four financial flags `false` remain mandatory. `/health` and `/api/health` report the approved SHA; `/api/health` reports database `connected` and migrations `match`. The commercial provider/ledger/flow code rejects hosted construction and has no public financial mutation routes. The staging mock exercise used temporary isolated database schemas from the trusted workstation. Do not describe it as a hosted deposit/withdrawal launch. No bank/provider secret was added.

The candidate Vercel branch required its own Preview-scoped `VITE_APP_ENV=staging` and `VITE_API_URL=https://api-staging.fugluck.com`. The first automatic build failed closed without `VITE_APP_ENV`; the rebuild succeeded after both values were scoped to `codex/phase-7b-commercial-candidate` with Production deselected. The older Production/Preview shared variables were **not** changed. The existing Production frontend remains at [`AtViaffzmmQELvKqBn8u56mxRZ6W`](https://vercel.com/akatsuki-66a7/arcadeclash-client/AtViaffzmmQELvKqBn8u56mxRZ6W), main `91ca7533c8d4d3e78bc090031d69097731b03d8b`, and still embeds the staging API. Separately approved production remediation is required; never promote this Preview or point staging at production data.

The Phase 7A section and historical provisioning walkthrough below record earlier states. Their 12-migration/undeployed-candidate statements are superseded by the current Phase 7B deployment above.

## Phase 7A deployment contract (2026-09-27)

**Historical Phase 7A contract; superseded for current state by the Phase 7B section above.** Its evidence and limitations are in [the Phase 7A.1 baseline](docs/PHASE_7A_BASELINE.md). Existing services must be reused; the blueprint is a configuration reference, not authorization to create a second service or purchase a plan.

**BUILT and deployed to staging at `542c594c1891784c7dd90efa458cb0f05e8fc9ec` (verified 2026-09-27):** hosted startup validates explicit deployment identity, full Git revision, registered database project and routing fingerprint, staging-only origins, host-only cookies, and disabled commercial flags before opening a database connection. The complete migration history is checked before startup recovery or traffic. Hosted runtime schema repair is disabled; migrations remain an explicit operator step. Hosted database TLS verifies the server certificate using the configured provider CA. The current post-deployment evidence and remaining blockers are in [the Phase 7A.1 baseline](docs/PHASE_7A_BASELINE.md).

The registered staging API is `fugluck-api-staging` / `srv-da2c50c9v7es73db3dkg`, Frankfurt, `api-staging.fugluck.com`. The intended and provider-configured database project is `gzfcucvxfzzjzjtgkwpd`, Frankfurt. Render environment `evm-da2c502jnfac73ae92kg` is labeled `Staging`; its sole service is the staging API. After the private database credential rotation, Render deploy `dep-dasen7t9fdbs73d4aj8g` is Live at the approved SHA, confirmed by provider UI and public database readiness. A CA-verified read-only attempt using the older local URI failed PostgreSQL authentication (`28P01`); never reuse it. Vercel Preview `Cd1TVmXmunanBSSaPnbMKtSgUkom` is Ready at that SHA, and `staging.fugluck.com` is assigned only to `codex/phase-7a-environment-safety`. The production Vercel deployment and `main` were not changed.

Required backend settings for the reviewed candidate:

| Setting | Value |
|---|---|
| `APP_ENV` | `staging` (deployment identity; independent of Node runtime mode) |
| `NODE_ENV` | `production` |
| `RENDER_GIT_COMMIT` | Provider-injected full reviewed commit; otherwise supply `GIT_SHA` |
| `DATABASE_URL` | Existing verified Frankfurt URI, supplied privately; never document its credential |
| `DATABASE_REGION` | `eu-central-1` |
| `DATABASE_TARGET_FINGERPRINT` | `6b2e32ee04be948ac7015fe81ff6e32ca09ffee7491aade8e69041fcd18eb926` for the inspected routing tuple only |
| `DATABASE_CA_CERT` | Official Supabase Root 2021 CA PEM; required by the verified pooler preflight. Obtain from the project Database Settings and verify the fingerprint in the baseline report. |
| `CLIENT_ORIGIN`, `ALLOWED_ORIGINS`, `APP_URL` | `https://staging.fugluck.com` only |
| `COOKIE_DOMAIN` | Remove / leave empty; the API sets host-only cookies |
| `COOKIE_SAMESITE` | `lax` |
| `REAL_MONEY_ENABLED` | `false` |
| `REAL_MONEY_DEPOSITS_ENABLED` | `false` |
| `REAL_MONEY_WITHDRAWALS_ENABLED` | `false` |
| `REAL_MONEY_COMPETITIONS_ENABLED` | `false` |

The fingerprint hashes the normalized host, port, database name, and database username (including the pooler project tenant); it excludes the password. It does not prove secret-store isolation, physical region, restore readiness, or the active runtime connection by itself. Recalculate and independently verify it when routing changes. `npm run audit:environment` prints sanitized offline configuration evidence; `npm run audit:environment -- --check-database` additionally makes a bounded read-only migration query only after hosted configuration passes. Supply configuration through a secure operator environment, not shell arguments/history.

For the staging Vercel Preview branch, set `VITE_APP_ENV=staging` and `VITE_API_URL=https://api-staging.fugluck.com`. Keep System Environment Variables enabled for the full commit SHA. Scope these values to the approved staging branch. **Do not share future production financial credentials with Preview, client builds, or staging.** All `VITE_*` values are public bundle configuration. This release deliberately blocks Vercel Production builds and backend `APP_ENV=production` until a separate production target is accepted in code.

**Open production separation blocker (verified after staging recovery):** the unchanged Production frontend at `91ca7533c8d4d3e78bc090031d69097731b03d8b` still embeds `https://api-staging.fugluck.com` in `/assets/index-BMOhywaz.js`. The older Vercel `VITE_API_URL` setting remains scoped to both Production and Preview; the new staging override applies only to the approved Preview branch. Main source routes catalog, auth/account, admin, wallet, friends, invites, matchmaking and authority sockets through that API URL. No independent production API/database was identified in the inspected provider inventory. The existing Production deployment cannot be corrected by the staging branch or a Preview alias change. A separately approved production action must retire/disable that frontend or supply an independently accepted production API/database and Production-only configuration; remove the shared Production/Preview override during that action. Do not point it at staging or promote this Preview to Production. The old shared `VITE_SUPABASE_*` project settings are not referenced by current client source (verified by source search), but should be separated or removed during that production action.

**Local Phase 7B candidate:** `0012_commercial_financial_core` adds simulation-only accounting tables and a mock provider; it is not applied to staging. Staging remains on 12 migrations through `0011_terminal_participant_status` and the approved SHA. Before a future staging deployment of code that includes 0012, take a fresh protected backup, rehearse restore, apply the reviewed migration to staging explicitly, verify its hash/constraints and disabled financial flags, then deploy matching revisions. Do not run migration commands against the staging or production URL by inference from a local `.env` file.

The local candidate also upgrades Drizzle ORM to `0.45.3` and Drizzle Kit to `0.31.11`. Local runtime audit has zero findings; four moderate development-tooling findings remain. Its complete local regression run passed **43 scripts / 1,661 assertions / 0 failures**, with each count in [candidate evidence](docs/evidence/phase7a-commercial-candidate-20260927.json). These dependency changes are not in the deployed staging revision; rerun migration/readiness and deployment checks when a future staging rollout is authorized and prepared.

Rollout order:

1. Run all `scripts/*-check.ts` programs, typecheck/client build and server build. Review the Phase 7A report and the exact candidate diff.
2. Deploy only an explicitly approved feature-branch commit to the verified staging targets. A push can create an automatic Vercel Preview; it is not a deploy-free action. Do not push before the branch-scoped frontend settings and rollout are approved. Do not merge to `main` or promote Vercel Production.
3. Before any schema change, obtain a fresh protected backup, rehearse an isolated restore, and verify the official migration chain. The local Phase 7B candidate adds `0012_commercial_financial_core`, which has **not** been applied to staging; do not reset, repair, or rewrite the existing migration journal.
4. Verify the database routing tuple privately and run the read-only TLS/migration preflight. Missing certificates, fingerprint mismatch, or migration mismatch are stops, not reasons to weaken guards.
5. Apply the non-secret environment settings above to the existing staging service and use the reviewed SHA for both frontend and backend. Preserve the existing authority gate and disabled trial templates. Environment-scoped JWTs require users/admins to sign in again after rollout.
6. Verify `/deployment.json` at the frontend, `/health` and `/api/health` at the backend, and authenticated Admin Operations. Require full revision equality, explicit staging identity, matching database target and migration chain, all commercial operations OFF, and zero accounting discrepancy. `/health` is liveness; `/api/health` returns 503 if database/migration readiness fails.
7. Verify catalog first-request timeout/retry and warm behavior, then desktop/mobile UI. Free-instance wake-up delays remain a deployment limitation, not a reason to weaken the six-second catalog deadline.

**PLANNED before production:** separate provider environment/accounts and secret stores, production database/role/region, verified backups and restore targets, certificate validation, durable monitoring, capacity and recovery objectives, and a controlled money-disabled rollout. Application guards cannot prove provider IAM or future credential isolation. Never register a production target by copying staging data or financial credentials.

## Historical initial provisioning walkthrough — superseded

The remainder records the original staging setup and is retained as historical context. Its creation steps, broad cookie domain, automatic deployment, region suggestions, and old revision observations are **not** the current rollout instructions.

This guide provides the complete, step-by-step procedure to deploy Fugluck to a **Public Staging Environment** for real-browser testing on actual domain names:
* **Frontend Web App**: `https://staging.fugluck.com` (Hosted on **Vercel**)
* **Backend API & WebSocket Server**: `https://api-staging.fugluck.com` (Hosted on **Render**)
* **Database**: Dedicated, isolated Staging PostgreSQL database

> [!IMPORTANT]
> **Staging Environment Safety Invariants:**
> 1. **This is NOT a real-money launch**: Real payments and withdrawals are completely disabled.
> 2. **Separate Database**: Staging **MUST NOT** connect to or modify production data. Always use a dedicated staging database.
> 3. **No Weakened Security**: HTTPS, HTTP-only Secure cookies, CSRF boundaries, password complexity, rate limits, and origin validation remain 100% strictly enforced.

---

## Architecture Overview

```
[ Browser / Desktop Player ]
             │
             ├──► https://staging.fugluck.com (Vercel Client / Static SPA)
             │
             └──► https://api-staging.fugluck.com (Render Node.js / Express 5 + Socket.IO)
                                  │
                                  ▼
             [ Dedicated Staging PostgreSQL Database (Neon / Supabase) ]
```

---

## Step-by-Step Staging Deployment

### Updating the Existing Staging Environment

Use the existing Vercel project `arcadeclash-client` and Render service `fugluck-api-staging` (`srv-da2c50c9v7es73db3dkg`); do not create replacement services. The custom domains are `staging.fugluck.com` and `api-staging.fugluck.com`. The provider dashboards were inspected on 2026-09-25. Render's service page showed the **staging service name and staging custom domain**, but its project environment badge reads `Production`; treat that badge as an unresolved provider-label ambiguity and re-verify the exact service ID and domain before any deployment. Do not deploy if the target cannot be proven to be the staging service. The deployed backend at inspection was `edc949727ca0a4b690fe589141910c7aba2d605c` on branch `codex/phase-5-5b-cyber-hopper-authority`; auto-deploy is off. A prior Vercel provider inspection recorded `staging.fugluck.com` as an alias to a Preview deployment from that same Phase 5.5B1 branch. Recheck live revisions and alias before release; these are historical observations, not a claim about the current deployment.

Deploy only an explicitly approved feature-branch commit to the verified staging targets. Do not merge to `main` or promote Vercel Production. Deploy frontend and backend from the same reviewed commit when both change, record their full Git SHAs, then verify `/health`, `/api/health`, `/api/competitions/templates`, and the signed-in admin health view. `/health` alone does not prove database, competition, or accounting readiness. Keep the controlled authority trial disabled unless a separately authorized manual acceptance test is actively underway.

The Supabase dashboard identifies the current isolated project as `fugluck-staging-frankfurt` (`gzfcucvxfzzjzjtgkwpd`) in Frankfurt. A previous local `.env.staging.local` inspection found a raw connection URI targeting a different, older Tokyo pooler; it was not used. Never infer the Render service's database target from that stale file. Before any database operation, verify the database project identity through the provider's non-secret project metadata and keep credentials out of logs and source.

**Resolved deployment incident (historical):** missing migrations `0008`/`0009` caused startup recovery to fail with PostgreSQL `42P01`, `relation "competition_instances" does not exist`. Applying the official migration chain to the verified staging database and redeploying resolved the incident. Do not reset the database or delete migration history. Free instances can cold-start slowly; catalog requests now stop waiting after six seconds and offer Retry. A warm API returning cards is distinct from a guaranteed cold-start latency target.

### STEP 1 — Create an Isolated Staging PostgreSQL Database

1. Log in to your PostgreSQL cloud provider (e.g. [Neon](https://neon.tech), [Supabase](https://supabase.com), or Render PostgreSQL).
2. Create a new database project named **`fugluck-staging`** (or a separate database on your cluster).
3. Copy the connection string URI. It will look like:
   ```
   postgresql://[user]:[password]@[host]:5432/[staging_db_name]?sslmode=require
   ```
4. Save this URI securely. You will use it as `DATABASE_URL` in the backend service.

---

### STEP 2 — Deploy the Backend Server on Render

1. Log in to [Render Dashboard](https://dashboard.render.com).
2. Click **New +** -> **Web Service**.
3. Connect your GitHub repository (`arcadeclash`).
4. Configure the Web Service settings:
   * **Name**: `fugluck-server-staging`
   * **Region**: Choose the region closest to your database (e.g. `Ohio (US East)` or `Frankfurt (EU)`).
   * **Runtime**: `Node`
   * **Root Directory**: Leave blank (monorepo root).
   * **Build Command**:
     ```bash
     npm install --include=dev && npm run build:server
     ```
   * **Start Command**:
     ```bash
     npm run start:server
     ```
   * **Health Check Path**: `/health`
   * **Auto-Deploy**: `Yes`
5. Configure the **Environment Variables** in the Render UI:

| Variable Name | Value / Description | Sensitive? |
|---|---|---|
| `NODE_ENV` | `production` | No |
| `APP_ENV` | `staging` (deployment identity; independent of Node runtime mode) | No |
| `DATABASE_URL` | *Paste your Staging PostgreSQL URI from Step 1* | **YES (Secret)** |
| `JWT_SECRET` | *Generate a 64-character random hex string* (see below) | **YES (Secret)** |
| `CLIENT_ORIGIN` | `https://staging.fugluck.com` | No |
| `ALLOWED_ORIGINS` | `https://staging.fugluck.com` | No |
| `APP_URL` | `https://staging.fugluck.com` | No |
| `COOKIE_DOMAIN` | `.fugluck.com` | No |
| `COOKIE_SAMESITE` | `lax` | No |
| `TRUST_PROXY` | `1` | No |
| `ENABLE_DEV_DIAMOND_STUB` | `false` | No |
| `EMAIL_PROVIDER` | `logger` | No |
| `EMAIL_FROM` | `Fugluck Staging <no-reply@fugluck.com>` | No |

> [!TIP]
> **Generating a Secure JWT Secret:**
> You can generate a random 64-char key in any terminal with:
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```

6. Click **Create Web Service**. Wait for the initial build and deployment to complete.
7. Render will provide a default URL (e.g. `https://fugluck-server-staging.onrender.com`).

---

### STEP 3 — Run Database Migrations on Staging

Before using the application, apply the official database migration chain (`0000` through `0011`) to your isolated staging database, after verifying the exact project and reviewing the backup requirements below:

1. The existing Render Free service has no Shell. Run migrations from a trusted operator workstation only after verifying the target project and completing a current logical backup. Supply the target `DATABASE_URL` through a secure, short-lived environment mechanism; never paste it into shell history, logs, or chat. Do not use the stale local Tokyo connection noted above.
2. From the repository root, run the migration command against the verified staging target:
   ```bash
   npm run db:migrate
   ```
3. Verify that all tables, triggers, indexes, and initial platform records are created without errors.

Migrations `0008_competition_economy.sql` and `0009_sandbox_accounting.sql` add the competition domain and its TEST / SANDBOX GEL accounting tables; `0010_competition_authority.sql` and `0011_terminal_participant_status.sql` add durable authority and terminal participant state. These are additive migrations. Do not infer that a migration is missing from an app-level health check. Inspect `drizzle.__drizzle_migrations` and the checked-in journal, and confirm the backend's `DATABASE_URL` identifies the dedicated staging database before running `npm run db:migrate`.

---

### STEP 4 — Deploy the Frontend on Vercel

1. Log in to [Vercel Dashboard](https://vercel.com).
2. Click **Add New...** -> **Project**.
3. Import your GitHub repository (`arcadeclash`).
4. In the project setup configuration:
   * **Framework Preset**: `Vite`
   * **Root Directory**: Click *Edit* and select **`packages/client`**.
   * **Build Command**: `npm run build` (or leave default Vite build)
   * **Output Directory**: `dist`
   * **Install Command**: `npm install` (from monorepo root)
5. Add the **Environment Variables** in Vercel:

| Variable Name | Value |
|---|---|
| `VITE_API_URL` | `https://api-staging.fugluck.com` (or your Render URL until DNS is active) |
| `VITE_SUPABASE_URL` | *Your public Supabase project URL (optional)* |
| `VITE_SUPABASE_ANON_KEY` | *Your public Supabase anon key (optional)* |

6. Click **Deploy**.
7. Vercel will build the client and deploy it. SPA routes (`/profile`, `/terms`, `/help`, etc.) will route properly thanks to [`packages/client/vercel.json`](packages/client/vercel.json).

---

### STEP 5 — Configure Custom Domains & DNS Records

In your DNS Provider (Cloudflare, Namecheap, GoDaddy, AWS Route 53, etc.), add the following CNAME records:

| Record Type | Host / Name | Target / Points To | Notes |
|---|---|---|---|
| **CNAME** | `staging` | `cname.vercel-dns.com` | Frontend (Vercel) |
| **CNAME** | `api-staging` | `fugluck-api-staging.onrender.com` | Existing backend (Render; verified 2026-09-23) |

1. In Vercel Project Settings -> **Domains**, add `staging.fugluck.com`.
2. In Render Web Service Settings -> **Custom Domains**, add `api-staging.fugluck.com`.
3. Render and Vercel will automatically provision free SSL/TLS certificates for both subdomains.
4. Verify that `https://api-staging.fugluck.com/health` returns `{ "ok": true, "status": "healthy" }`.

---

## Environment Variable Reference Table

| Variable | Scope | Required in Staging? | Default / Example | Purpose |
|---|---|---|---|---|
| `DATABASE_URL` | Server | **Yes** | `postgresql://...` | Staging PostgreSQL connection URI |
| `JWT_SECRET` | Server | **Yes** | *64+ char random string* | Key for signing HTTP-only session cookies |
| `PORT` | Server | Auto-injected | `4000` / `10000` | Port on which the HTTP server listens |
| `NODE_ENV` | Server | **Yes** | `production` | Sets server runtime mode and security defaults |
| `CLIENT_ORIGIN` | Server | **Yes** | `https://staging.fugluck.com` | CORS origin allowed for credentialed cookies |
| `ALLOWED_ORIGINS` | Server | **Yes** | `https://staging.fugluck.com` | Comma-separated allowlist for CORS & WebSockets |
| `APP_URL` | Server | **Yes** | `https://staging.fugluck.com` | Base URL used in verification emails & reset links |
| `COOKIE_DOMAIN` | Server | **Yes** | `.fugluck.com` | Domain for cookie scoping across subdomains |
| `COOKIE_SAMESITE` | Server | Optional | `lax` | SameSite cookie attribute (`lax` / `none`) |
| `TRUST_PROXY` | Server | Optional | `1` | Reverse proxy hop count for secure headers & IP |
| `ENABLE_DEV_DIAMOND_STUB` | Server | Optional | `false` | Disables test diamond generation button |
| `EMAIL_PROVIDER` | Server | Optional | `logger` | Transactional email provider (`logger`, `resend`, `smtp`) |
| `EMAIL_FROM` | Server | Optional | `Fugluck <no-reply@fugluck.com>` | From email address header |
| `VITE_API_URL` | Client | **Yes** | `https://api-staging.fugluck.com` | Public API & WebSocket endpoint for frontend |

---

## Staging Verification & Smoke-Test Checklist

### Competition Catalog Fixtures (Staging Only)

The first public request to `GET /api/competitions/templates` seeds the built-in simulated TEST GEL templates only when there are no templates at all. This idempotent demo fixture set includes standard duels, a promotional prize, and a freeroll; disable fixtures through **Admin → Competitions → Templates** to remove them from the player catalog. Disabled defaults remain disabled. Stable database primary keys prevent concurrent initialization from duplicating defaults, and templates/prizes are inserted atomically. Do not invoke this workflow against a production database. Creating the fixtures does not grant user balances, create entries, or run a competition.

After the API deployment and staging migrations are confirmed, open `/competitions` as a guest and confirm the catalog includes the examples. Use an already-provisioned staging test account to inspect signed-in balance messaging. Do not join entries as part of catalog acceptance.

After completing the deployment steps above, conduct the following live browser verification:

### 1. Home & Navigation
- [ ] Open `https://staging.fugluck.com` in Chrome, Safari, and Firefox.
- [ ] Verify that styles, typography, SVG assets, and game canvas components render cleanly.
- [ ] Open Browser DevTools (F12) -> Console: confirm zero unhandled errors or missing assets.

### 2. Direct SPA Page Routing (Deep Links)
- [ ] Navigate directly to `https://staging.fugluck.com/terms` and refresh (F5) — page loads with full text.
- [ ] Navigate directly to `https://staging.fugluck.com/privacy` and refresh (F5).
- [ ] Navigate directly to `https://staging.fugluck.com/help` — search and category accordions work.
- [ ] Navigate to an invalid URL (`/unknown-page`) — renders the custom 404 page with Home button.

### 3. User Registration & Consent
- [ ] Click **Sign Up**.
- [ ] Verify that Terms & Privacy checkboxes are required before submitting registration.
- [ ] Register a new test user (`staging_user_1`).
- [ ] Confirm 1,000 Signup COINS are granted to the user balance.
- [ ] Log out, then log back in with credentials. Confirm session cookie is preserved on F5 refresh.

### 4. Game Catalog & Practice Play
- [ ] Select **Neon Runner** -> Practice Mode: canvas physics loop runs at 60 FPS without stutter.
- [ ] Select **Pixel Ninja Dash** -> Practice Mode: jump/dash reflex input triggers cleanly.
- [ ] Select **Space Blaster** -> Practice Mode: vector player ship and thruster animations render.
- [ ] Select **Cyber Hopper** -> Practice Mode: grid hopping navigation operates cleanly.
- [ ] Select **True / False Sprint** -> Practice Mode: answer options and timer function.
- [ ] Select **Speed Trivia Clash** -> Practice Mode: questions and score progression display.

### 5. Multiplayer Matchmaking & WebSockets
- [ ] Open a second private browser window and log in as `staging_user_2`.
- [ ] On User 1, click **Find Opponent** (COINS mode).
- [ ] Confirm User 1 appears in the live matchmaking queue on the home dashboard.
- [ ] On User 2, click **Match** to pair.
- [ ] Verify both players transition cleanly into the match room with shared seed.
- [ ] Complete the match rounds and verify winner resolution, score submission, and payout.

### 6. Wallet & Financial Safety
- [ ] Open `https://staging.fugluck.com/wallet`.
- [ ] Verify COINS balance reflects game outcomes and grants.
- [ ] Verify there is no active Diamond shop, stake picker, or competition mode; historical Diamond information is marked retired/legacy.
- [ ] Confirm competition balances and entry/prize values use **TEST / SANDBOX GEL / NO REAL MONEY** messaging; simulated funding is labeled **ADD TEST FUNDS**, not Deposit.
- [ ] Verify there are NO fields requesting real credit cards, bank accounts, or withdrawal methods.

### 7. Security & Cookie Headers
- [ ] In DevTools -> Application -> Cookies:
  - `ac_session` cookie has `HttpOnly: true`.
  - `ac_session` cookie has `Secure: true`.
  - `ac_session` cookie domain is `.fugluck.com` or `api-staging.fugluck.com`.
  - `SameSite` is `Lax`.
- [ ] Network tab: Verify backend responds with `Access-Control-Allow-Origin: https://staging.fugluck.com`.

---

## Troubleshooting & Maintenance

* **CORS Error in Browser Console**:
  Confirm that `CLIENT_ORIGIN` and `ALLOWED_ORIGINS` in Render match `https://staging.fugluck.com` exactly (no trailing slashes).
* **Socket.IO Fails to Connect**:
  Verify `VITE_API_URL` in Vercel is set to `https://api-staging.fugluck.com` and that Render has completed its deployment.
* **Database Connection Failure**:
  Ensure `DATABASE_URL` includes `?sslmode=require` if required by your cloud PostgreSQL provider.
* **Restarting Backend**:
  In Render, click **Manual Deploy** -> **Deploy latest commit** or **Restart service**.
