# Phase 5.5A — Remediation Round 2

Status: **IN PROGRESS; acceptance remains NOT PASS**. Previous report is preserved in `PHASE_5_5A_REMEDIATION.md`. This document records verified preparation, not completed staging acceptance.

## Scope and Git

Source/Git verified: branch `codex/phase-5-5a-remediation` initially clean at local evidence `05018ee2096e8ba88813c46ca01f33d546364f94`, remote runtime `996c9b4cb97ee364508558350a0d3d5df3595bbf`. Evidence was pushed without rewriting history. Local main remains `1361cce1e5d2b5b83701ccd6e2935ce05c530a16`; remote main was verified at `2cbc429caed07dc4e8ece05bbb4662fb27667018`. No main merge. Only the Space Blaster reference is in scope; other games, replay/Diamond retirement and Phases 6/7 are excluded.

## Infrastructure preparation — verified

Provider UI: Render staging Frankfurt; original Supabase staging Tokyo (`ap-northeast-1`, Nano). No recorded reason establishes that the mismatch was intentional. Supabase requires a replacement project for a [region change](https://supabase.com/docs/guides/troubleshooting/change-project-region-eWJo5Z); [built-in cloning](https://supabase.com/docs/guides/platform/clone-project) retains the original region. The user created Free-plan `fugluck-staging-frankfurt`, project `gzfcucvxfzzjzjtgkwpd`, in Central EU/Frankfurt (`eu-central-1`), t4g.nano. Public Data API was deselected in the creation form; post-creation settings verification remains pending.

The original uses a Supabase Session pooler (15 server connections, 200 clients, provider UI). The application reuses a PostgreSQL pool; source inspection found a separate maximum-one-connection authority lease pool kept warm by 500 ms renewals. Ordinary simulation ticks/snapshots contain no awaited database query. Default general-pool idle timeout is 10 seconds, minimum zero. No speculative pool tuning was applied. Connection acquisition includes DNS/TLS/authentication; their individual contributions were not isolated.

Backup: official PostgreSQL 17.11 pg_dump custom archive, full database, no ownership/ACL export. Ignored private path `Temp/phase55a-round2/staging-before-move.dump`; 387156 bytes; SHA-256 `f090de8b0e1c80e03fc8c4cd787212c8f930cc0135185a53bbf0637d014b9c26`. Archive inventory contains 24 application/migration table definitions and data entries. Auth users and Storage objects are both zero. No open competitions, reserved funds or escrow at backup time. Old database and backup are retained.

Restoration used pg_restore, a single transaction and `--exit-on-error`, restricted to `public` and `drizzle` on the exact verified empty replacement. Initial attempts rolled back because the schema-filtered restore did not create `drizzle`; explicitly creating that empty schema allowed restoration. Managed Supabase schemas were retained from the new project. All 24 table counts/content fingerprints and column definitions matched the backup. A subsequent read-only SQL check in the authenticated old-project dashboard returned **24 tables / all_match_backup=true**, establishing the source had not changed even though the user's original local connection file no longer authenticated.

Official `drizzle-kit migrate` then applied migration 0011. Its initial SSL attempt failed certificate validation; retry used libpq-compatible SSL `require`, matching the existing encrypted application/backup connection behavior. No provider TLS setting was changed. All 12 migration hashes/timestamps match the official journal. Only migration metadata and participant projections changed: 8 settled participants are SUBMITTED, 14 voided participants VOIDED. All other table fingerprints, including ledger, receipts, decisions, matches and audits, stayed identical. Column schema unchanged; ledger sum, escrow, reserved funds and open instances remain zero.

### Before/after measurements from this machine

| Measurement | Tokyo before | Frankfurt after restore |
|---|---:|---:|
| Initial connection acquisition | 2463 ms | 442 ms |
| Ten warm SELECT 1 calls | 308–318 ms | 68–73 ms |

These are measured local-client timings, not Render timings or proof of gameplay reliability. Render heartbeat/terminal/settlement comparisons remain pending. Historical active heartbeat maximum was 269 ms, finalizing maximum 1658 ms and settlement 6.15–7.83 seconds.

## Local implementation — BUILT, source-reviewed and regression-tested

- **Refund report:** captured escrow inflows and subsidy were compared only with prize/margin outflows, omitting ENTRY_REFUND participant AVAILABLE credits. The report now counts that positive refund leg once. Reservation/release remains an internal participant transfer and is excluded. No ledger history was rewritten. Admin shows Entry Refunds, Promotional Subsidy and Discrepancy separately; instance total consumes the actual flat API `total` field.
- **Participant projection:** authority application set rank/prize but left status PLAYING; void assigned rank 1. Final application now sets VOIDED/no rank for voids and SUBMITTED for completed results, retaining deliberate FORFEITED. Cancellation uses CANCELLED. Existing states lacked a correct cancellation/void meaning, so these two explicit terminal states were added. Migration 0011 corrects historical mutable projections; scores, financial records and immutable authority receipts/decisions remain unchanged.
- **Snapshot path:** per-participant continuous sequence, session ID/controller epoch, server tick and creation/emit timestamps; server generation/emit/backpressure/payload/transport counts and finalization-stage timing. Client bounded statistics cover receive/application/render timestamps, gaps, rejected/missing sequences, background receipts and browser long tasks. Out-of-order or wrong-binding frames are ignored.
- **Presentation/control:** independent animation-frame rendering with at most one snapshot interval of position interpolation. Gaps over 150 ms use the latest state; no extrapolation, simulated collision, score or result calculation. Held firing, pointer capture/release/cancel and neutral controls on blur/background are supported. Waiting cancellation appears only while actually cancellable. Opt-in staging diagnostics provide a 24-second alternating steering/held-fire check through normal socket inputs plus reconnect. This diagnostic automation is not, by itself, proof of physical mobile gesture usability.
- **Limits retained:** p95 RTT <=100 ms, jitter <=30 ms, existing lease/stop/refund policy. No other game was migrated and no accounting correctness check was weakened.

### Transport inspection and evidence limits

Source inspection: Socket.IO defaults to polling with WebSocket upgrade; ping interval 25 seconds, timeout 20 seconds; HTTP compression threshold 1024 bytes; WebSocket per-message deflate defaults off; configured message limit 1 MB. Full routine snapshots remain volatile (stale frames need not accumulate); terminal frames are reliable. Actual staging browser transport/payload/tail-gap attribution remains pending. The old 517 ms gap has no complete historical trace and cannot retrospectively be assigned to the database. New instrumentation is intended to separate generation, emit, network, browser and rendering delay without hiding it.

## Local validation — verified by execution

Canonical suite: 38 scripts / 1393 passing assertions. The authority test loaded before the last two protocol assertions were added; its final focused rerun passed 65/65 (replacing 63/63 in the consolidated count). Separate atomic accounting 37/37 and database safety 18/18 passed. Consolidated **40 distinct scripts / 1450 assertions / zero failures**. Shared/theme/games/server typecheck, client production build, separate server build and diff whitespace check passed. Existing client large-chunk advisory remains. All database regression scripts used the guarded disposable test database, not staging. Exact per-script counts follow.

## Staging acceptance — pending

No Round 2 code deployed yet. Database switch, exact matching frontend/backend revision, actual desktop/375px/320px sustained controls, browser transport/gap distributions, winner/refund/exactly-once results, reconnect/fencing, admin display and final cleanup remain unverified. Acceptance remains **NOT PASS** pending those gates; migration success alone does not change that verdict.

## Per-script pass counts

| Script | Pass | Fail |
|---|---:|---:|
| migration-schema-parity-check.ts | 321 | 0 |
| auth-account-lifecycle-check.ts | 41 | 0 |
| legal-policy-help-check.ts | 53 | 0 |
| i18n-check.ts | 65 | 0 |
| wallet-friends-check.ts | 48 | 0 |
| financial-reconnection-check.ts | 19 | 0 |
| matchmaking-check.ts | 65 | 0 |
| determinism-check.ts | 31 | 0 |
| score-validation-check.ts | 42 | 0 |
| canvas-render-check.ts | 28 | 0 |
| rate-limit-check.ts | 11 | 0 |
| sql-injection-check.ts | 19 | 0 |
| input-validation-check.ts | 16 | 0 |
| xss-audit-check.ts | 17 | 0 |
| password-security-check.ts | 13 | 0 |
| admin-security-check.ts | 8 | 0 |
| admin-console-check.ts | 49 | 0 |
| admin-reset-recovery-check.ts | 11 | 0 |
| seed-admin-check.ts | 7 | 0 |
| cors-audit-check.ts | 20 | 0 |
| registration-verification-check.ts | 9 | 0 |
| owner-admin-lockout-check.ts | 10 | 0 |
| request-logging-audit-check.ts | 12 | 0 |
| password-policy-check.ts | 18 | 0 |
| file-upload-audit-check.ts | 4 | 0 |
| wallet-settlement-concurrency-check.ts | 16 | 0 |
| wallet-settlement-integrity-check.ts | 23 | 0 |
| match-lifecycle-durability-check.ts | 26 | 0 |
| staging-readiness-check.ts | 34 | 0 |
| competition-phase1-domain-check.ts | 40 | 0 |
| competition-phase2-accounting-check.ts | 54 | 0 |
| competition-phase3-lifecycle-check.ts | 45 | 0 |
| competition-phase4-ui-check.ts | 43 | 0 |
| competition-phase5-admin-check.ts | 42 | 0 |
| competition-authority-check.ts | 65 | 0 |
| atomic-wager-lifecycle-check.ts | 37 | 0 |
| test-database-safety-check.ts | 18 | 0 |
| competition-admin-http-check.ts | 20 | 0 |
| competition-authority-latency-check.ts | 26 | 0 |
| authority-presentation-check.ts | 24 | 0 |
