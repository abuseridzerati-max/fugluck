# Phase 6B — Operational Readiness

Status: **Phase 6B local gate passed on 2026-09-25**. This is not a staging backup/restore drill or production-capacity certification. Verification claims below distinguish checked-in code, automated tests, provider UI observations, and work still required.

## 1. Monitoring and health

- **BUILT — backend liveness:** `GET /health` returns process health and revision metadata without checking PostgreSQL. It is appropriate as a hosting liveness probe, not as proof the product can serve competitions. Verified in `packages/server/src/index.ts`.
- **BUILT — backend and database health:** `GET /api/health` performs a database connectivity query and reports failure without exposing a connection string. Verified in `packages/server/src/index.ts`.
- **BUILT — authenticated operations view:** `GET /api/admin/operations` is guarded by `ADMIN_VIEW_AUDIT`. It checks database reachability, competition counts, authority-session counts, sandbox-accounting reconciliation, and migration metadata. It reports frontend/backend revision, configured database region, recent admission summaries, reconnect counts and sanitized authority error codes. Verified in `packages/server/src/routes/admin.ts`, `operationsTelemetry.ts`, and the admin console.
- **LIMITATION:** recent admission/reconnect/error telemetry is process-local, capped at 40 records per category, and cleared on restart. It is a current-process operator aid, not durable observability or a complete historical audit. Durable audit/ledger/authority records remain in the database.
- **LIMITATION:** database region is reported only when `DATABASE_REGION` is configured; otherwise the UI must show “Not configured.” The operations endpoint does not infer physical region from credentials or hostname.
- **RECOVERY SIGNALS:** use both health endpoints, deployment revision, migration metadata, authority active-session count, and reconciliation result. Escalate nonzero discrepancy or database/query errors; do not attempt to manually edit balances or settled rows.

## 2. Staging database backup and restore

### Verified provider facts and present status

- **Provider UI observation (2026-09-25):** the isolated Frankfurt Supabase project is on the Free plan; its Backups page says managed database backups are not included on Free. The Supabase backup guide directs Free projects to logical exports with the CLI, and the CLI backup guide documents `supabase db dump` using `pg_dump` and requiring Docker Desktop and PostgreSQL client tools: [Database backups](https://supabase.com/docs/guides/platform/backups), [CLI backup and restore](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).
- **Migration version (verified by repository and read-only staging SQL editor inspection):** Drizzle journal has 12 entries, ending at `0011_terminal_participant_status.sql`; the staging query returned 12 applied journal rows. Phase 6A/6B introduce no database migration.
- **Backup completion status:** no verified staging dump or restore was produced in this work. The ignored local `.env.staging.local` was previously inspected without printing its contents and found to hold a raw URI for an older Tokyo pooler, not the Frankfurt project. No local `pg_dump`, Docker, or Supabase CLI was available at that inspection. Do not use that URI for the current project. A backup must be completed and its checksum/size recorded before the next staging schema change or any risky data operation.

### Approved logical backup procedure

1. Identify the isolated staging project by provider project ref and region through non-secret provider metadata. Confirm that it is not a production database. Do not trust a filename, service label, or stale local export alone.
2. Install/use the official Supabase CLI, Docker Desktop, and PostgreSQL client tools on a trusted operator machine. Use a short-lived environment variable or secure prompt for the staging database URI; do not put it in command-line history, chat, repository files, or logs.
3. Follow the official `supabase db dump` procedure to export schema and data to an access-controlled local artifact. Keep the dump out of Git and public storage. Include required roles only if the official procedure and least-privilege review require them; never export provider secrets unnecessarily.
4. Record project ref, environment, migration journal end, UTC capture time, dump format, file size, and SHA-256 in a separate sanitized backup record. Verify the dump exits successfully and is non-empty.
5. Test restoration only into a new disposable database/project. Apply or verify the documented migration chain, compare schema/table counts and critical competition/accounting invariants, and run reconciliation. Never restore over live staging as a test.
6. Keep object storage/assets separate: a PostgreSQL dump does not back up external storage buckets. Inventory and back up those separately if the product begins depending on them.

### Protected data classes

Users and authentication metadata; policy acceptances; Coins and historical Diamond records; TEST GEL ledger and balances; reservations, captures, releases, settlements, refunds and reconciliation; competition templates, prizes, instances, participants and lifecycle events; authority runs, sessions, admissions, results and decisions; admin audit/funding history; migration journal and application configuration references. No passwords, tokens, database URLs, or unnecessary personal details belong in an evidence artifact.

## 3. Deployment, migration order, and rollback

- Verify exact Vercel project/Preview deployment, alias, Render service ID/custom domain, connected branch, and full Git SHA before deployment. The Render page inspected on 2026-09-25 showed service `fugluck-api-staging` and `api-staging.fugluck.com`, while its environment badge read “Production”; treat this as an unresolved provider label and do not deploy until the service ID and staging custom domain are independently reconfirmed.
- Do not merge to `main`, promote Vercel Production, or deploy any production service. Deploy the same reviewed feature SHA to both staging components when both change. Render auto-deploy was off at inspection, so a manual deployment must select the exact approved revision.
- Before a schema change: complete and verify the logical backup above; compare `packages/server/drizzle/meta/_journal.json` with `drizzle.__drizzle_migrations`; review the additive SQL; apply `npm run db:migrate` once to the verified staging target; verify the latest journal entry and critical table/index presence; then deploy the matching server and client.
- Phase 6A/6B currently add no schema migration, so no migration operation is required for these changes.
- On failed rollout, stop further traffic promotion, capture sanitized provider logs and deployed SHAs, and roll frontend/backend back to the previously verified matching code revision. Prefer a forward code fix if an additive migration has already been applied. Do not run destructive down migrations, reset a database, rewrite migration history, or restore a backup over live staging during incident response.
- Post-deploy checks: `GET /health`, `GET /api/health`, `GET /api/competitions/templates`, authenticated admin operations view, and direct desktop/mobile page smoke checks. Require expected full revision equality and zero accounting discrepancy before calling the staging candidate healthy.

## 4. Security and safety review

**Automated suites to rerun at the Phase 6B gate:** authentication/account lifecycle; admin security/console/reset recovery/owner lockout; CORS; rate limits; SQL injection; input validation; XSS audit; password security/policy; registration verification; request logging; file upload audit; competition admin HTTP; authority socket/session checks; accounting concurrency/integrity; database safety; settlement/lifecycle durability.

**Source-reviewed safeguards:** admin APIs retain server-side permission guards; authority sockets bind authenticated users, instance, session, controller fencing and versioned bindings; terminal settlement uses idempotency and immutable decisions; no administrator endpoint selects a winner, edits a score, rewrites a settled result, or directly sets TEST GEL balance. Test-fund grants are ledger operations with reason and audit linkage. Recheck against the code and full tests at the gate; this inventory does not imply a third-party penetration test.

**Payment boundary:** no live PSP, bank, card processing, withdrawal, or real-money prize functionality is authorized. All competition economics stay TEST / SANDBOX GEL; no production deployment or external submission is part of this phase.

## 5. Capacity evidence and limits

- The repository includes real-socket authority/load tests for Space Blaster and Cyber Hopper, multiple session counts, competition admission, and accounting concurrency. Results below were captured at this Phase 6B gate and are limited to the tested source state.
- **Cyber Hopper local real-socket benchmark (verified by `scripts/cyber-hopper-authority-check.ts`, run 2026-09-25):** 1 session ran at 59.87 ticks/s with 0.212 ms maximum batch-tick time; 10 sessions at 59.60 ticks/s with 0.358 ms maximum; 20 sessions at 59.69 ticks/s with 0.258 ms maximum. Snapshot cadence was about 19.9 Hz per session. All admission checks and the scripted authority cases passed. This measures the local test harness, not a hosted service.
- **Authority scheduler stress (verified by `scripts/competition-authority-latency-check.ts`, run in full `npm test`):** real WebSocket clients were exercised at 1/10/20 matches (2 players per match) while the test store injected an 800 ms async lease renewal. At 1 match, the emitted stress record showed 59.997 ticks/s, 20.33 snapshots/s, and an 813 ms delayed heartbeat. At 20 matches the suite completed 5,991 ticks, 8,256 snapshots, max tick time about 0.784 ms, and max lease roundtrip about 815 ms. The assertions confirmed ticks and snapshots continue during pending renewals, while an expired lease stops the run safely.
- The latency suite deliberately injects an 800 ms asynchronous store heartbeat to test simulation progress while a persistence renewal is pending. That injection is a scheduler/fault test; it is **not** a live PostgreSQL latency or database capacity measurement.
- Capacity claims are limited to the tested local harness, process/runtime, session counts, and measured interval. They do not establish production throughput, multi-instance horizontal scaling, cloud database saturation limits, or availability targets.

## 6. Failure and recovery evidence

The gate's full `npm test`, standalone database safety, atomic wager, and Cyber Hopper authority runs exercised disconnect/reconnect, both participants disconnecting, admission rejection, forfeit, cancellation, safe void/refund, database failure atomicity, duplicate settlement, process-loss/orphan recovery, and refusal to invent a winner on uncertain system failure. These tests establish tested code paths, not a live provider disaster-recovery drill.

## 7. Gate status

**Phase 6B gate (verified by command exit and output, 2026-09-25):** canonical `npm test` completed its 38 ordered scripts with no failure output; `test:database-safety` passed 18/18; `test:atomic-wager` passed 38/38; `test:cyber-hopper-authority` passed 42/42. `npm run typecheck` passed (including the client production build), and `npm run build:server` passed. The canonical test run includes migration parity 321/321, Phase 1 domain 41/41, Phase 2 accounting 54/54, Phase 3 lifecycle 45/45, Phase 4 UI 44/44, Phase 5 admin 42/42, competition authority 65/65, admin HTTP 36/36, authority latency 26/26, and authority presentation 24/24. `git diff --check` is part of the final commit gate.

**Backup limitation remains explicit:** provider plan and supported logical-dump procedure were verified, but a current Frankfurt-project dump and disposable restore were not performed. This is a blocker before future schema changes or risky data operations; Phase 6A/6B require no database migration. No destructive restore, live money, production deploy, main merge, or external submission is allowed.
