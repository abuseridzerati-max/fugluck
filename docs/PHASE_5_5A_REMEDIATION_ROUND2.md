# Phase 5.5A — Remediation Round 2

Final status: **NOT PASS**. Infrastructure, accounting and terminal-state corrections are verified. Physical desktop/mobile control acceptance and mobile reconnect usability remain incomplete; expanded mobile diagnostics also showed browser stalls. The previous report remains preserved in `PHASE_5_5A_REMEDIATION.md`.

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

Source inspection: Socket.IO defaults to polling with WebSocket upgrade; ping interval 25 seconds, timeout 20 seconds; HTTP compression threshold 1024 bytes; WebSocket per-message deflate defaults off; configured message limit 1 MB. Full routine snapshots remain volatile (stale frames need not accumulate); terminal frames are reliable. Actual staging observations follow below. The old 517 ms gap has no complete historical trace and cannot retrospectively be assigned to the database. New instrumentation separates generation, emit, browser and rendering measurements without hiding long gaps; exact network-hop delay remains unmeasured.

## Local validation — verified by execution

Canonical suite: 38 scripts / 1393 passing assertions. The authority test loaded before the last two protocol assertions were added; its final focused rerun passed 65/65 (replacing 63/63 in the consolidated count). Separate atomic accounting 37/37 and database safety 18/18 passed. Consolidated **40 distinct scripts / 1450 assertions / zero failures**. Shared/theme/games/server typecheck, client production build, separate server build and diff whitespace check passed. Existing client large-chunk advisory remains. All database regression scripts used the guarded disposable test database, not staging. Exact per-script counts follow.

## Staging deployment — verified in provider UIs and live requests

Runtime commit **0a38802a8f1047b320687f139d40578c32571090** is pushed to the remediation branch. Vercel Preview `dpl_GJ4BaWyVA1RqA9pw95g42W3xjUDa` is Ready at that exact SHA and assigned only the staging hostname. Render deployment `dep-daqg4nad0e5s73af8iq0` is Live at the same SHA. The user saved the new database connection and redeployed; `/api/health` independently returned healthy/database connected. Three new QA accounts created through the staging signup/faucet appeared in the Frankfurt database, independently confirming the backend target. No production promotion or main merge.

Post-creation inspection found the replacement Data API **enabled**, contrary to the earlier creation-form choice. It was disabled through the provider UI and the saved switch was verified at zero. The application uses direct server PostgreSQL access; no client Supabase data path was introduced. The old Tokyo database is retained. Local connection files remain ignored/private; the original local Tokyo file no longer authenticates, so a rollback would require the original connection from Render history or a user-managed credential update.

## Actual staging trials

Ten new controlled instances: **seven normal server-result settlements, two admission rejections, one deliberate both-disconnected void**. All are terminal. Full identifiers, result scores, ledger aggregates and participant states are in `evidence/phase55a-round2/final-database-audit.json`.

| Trial | Instance prefix | Observed result |
|---|---|---|
| First security attempt | 94580dac | Admission rejected; p95 107.1/112.5 ms and jitter about 44 ms. Reservation released; no captured-entry refund claimed. Six security assertions passed; admission assertion failed. |
| Security repeat | e6e5bd4c | 15/15 assertions; natural winner, score 48; active socket reconnect 349.6 ms and controller fencing passed. |
| Desktop browser | cb798e4e | 9.7 seconds automated alternating steering/held fire through normal controls, five direction segments, ship X 30–996.7, score 139, natural win. |
| 375 px, expanded diagnostics | 4eded7f7 | 7.9 seconds alternating controls/firing, score 65, natural win. Browser long tasks/render stalls observed. |
| 375 px, collapsed comparison | 318ada74 | 4.1 seconds alternating controls/firing, score 48, natural loss; shorter sample, better rendering cadence. |
| 320 px | 9b6d4e33 | 11.8 seconds, six direction segments, X 30–1080, firing and score progression; natural win at final score 144. |
| 320 px pointer attempt | d4cf407f | Natural collision occurred before usable pointer verification. Ship X stayed 640; do not count as verified physical steering. |
| 320 px reconnect attempt | 39e02b44 | Automated steering/fire worked for 5.3 seconds; run completed before reconnect action. Physical reconnect not established. |
| 320 px immediate reconnect attempt | 62772803 | Admission rejected: p95 97.4/114.1 ms, jitter 35.8/44.5 ms. Reservation released, no arbitrary winner. |
| Deliberate both-client loss | ad765deb | 9/9 assertions; BOTH_DISCONNECTED, no winner, captured entry refunds total 1000 minor units. |

The recorded simulated controls prove repeated normal socket inputs, direction changes, visible bullets, authoritative score response and natural collision/completion. They do **not** certify physical keyboard holds or simultaneous touch gestures. One pointer drag attempt produced no confirmed movement, and later Fire/reconnect clicks found correctly disabled terminal controls. These unsuccessful attempts are retained, not relabeled as passes. No horizontal overflow was observed at actual 375/320 px widths; neutral terminal controls and fitting result screens were verified. Screenshots contain no account names, passwords or tokens. Temporary QA session-token file was removed; accounts/history/ledger remain preserved.

## Snapshot and browser measurements

All observed active browser connections used **WebSocket**. No polling fallback problem was demonstrated, so transports/ping/compression were not blindly changed. Full snapshot maximum was **1888 bytes** across the server trials, small enough that no delta-compression architecture was warranted. Snapshot position arrays contain only active entities. One server backpressure observation occurred in the security/reconnect trial; all captured browser reports had zero missing sequences and zero background receipts.

| Browser sample | Active seconds | Receive Hz | Render Hz | Gap p50 / p95 / p99 / max (ms) |
|---|---:|---:|---:|---|
| Desktop | 9.717 | 20.068 | 60.145 | 49.9 / 54.8 / 59.9 / 71.9 |
| 375, expanded diagnostics | 7.855 | 19.986 | 47.847 | 48.9 / 203.1 / 275.8 / 302.9 |
| 375, collapsed comparison | 4.054 | 20.476 | 59.024 | 49.8 / 62.8 / 152.2 / 152.2 |
| 320 | 11.844 | 20.179 | 60.003 | 49.8 / 56.9 / 125.9 / 160.9 |

Seven natural server runs measured **59.980–59.999 Hz simulation**. Browser-observed server creation/emit intervals imply approximately **19.994–20.008 Hz**. Short client-window tick/receive ratios include boundary/network batching effects and are not substituted for server clock rates. Maximum server create-to-emit timestamp difference was 1 ms. Final notification emission took 0.18–0.28 ms.

**Gap attribution:** the old 517 ms event lacks a complete trace and was not reproduced; its precise historical cause remains unproven. New 375-expanded browser stalls occurred while server creation/emit gaps stayed at most 56 ms, without missing frames/background receipts; browser long tasks reached 265 ms and rendering gaps 263 ms. This identifies a browser-side stall contribution in that sample, not server simulation starvation. The collapsed comparison improved rendering to 59 Hz, but its four-second duration and different match do not establish a definitive causal explanation. The 320 client and its independent socket partner both reached about 161 ms arrival gaps while server emission remained regular, consistent with shared transport/network delay; exact hop/process attribution is unproven. No unexplained 500+ ms active gap appeared in this round. Client receive-to-application maxima were 0.5 ms desktop, 0.6 ms 375-expanded, 57.3 ms 375-collapsed, 3.3 ms 320. Browser/tool overhead cannot be excluded. Diagnostics are opt-in and collapsed by default; measured expanded-panel stalls are reported explicitly.

Accepted admission samples had p95 **65.3–90.9 ms**, jitter **3.0–27.2 ms**. Two of ten trial attempts were rejected under the unchanged 100/30 ms limits. Repeated admission reliability is therefore not established merely from the eight starts. Database locality does not explain client/server RTT admission, which contains no database query.

## Database improvement and settlement breakdown

| Metric | Historical Tokyo staging | Frankfurt staging this round |
|---|---:|---:|
| Active lease write maximum | 269 ms | 10.75 ms |
| Finalizing lease maximum | 1658 ms | 3.66 ms |
| Terminal decision persistence | 1807–1909 ms | 16.57–31.58 ms |
| Natural settlement overall | 6153–7833 ms | 59.69–125.57 ms |
| Warm transaction connection acquisition | not separated | 0.012–0.050 ms |
| Decision lookup | not separated | 2.18–4.20 ms |
| Accounting/ledger stage | not separated | 15.33–40.16 ms |
| Lifecycle/application transaction | not separated | 17.33–57.83 ms |
| Pending receipt wait at finish | not separated | 0.013–9.06 ms |
| Socket notification emit | not separated | 0.18–0.28 ms |

Stage ranges are from different operations and must not be added as if one request hit every maximum. Client delivery of the final notification adds network delay not included in server emit time. Independent local warm query comparison remained about 68–72 ms after acceptance. Geographic co-location materially improved these observed database stages; it did not prove all browser/network latency solved. Duplicate background application metrics can occur; idempotent accounting and final database audit show exactly one credit/settlement per instance.

## Accounting/state closure — independently verified

Each of seven new SETTLED instances has one settlement, exactly one 900-minor-unit participant prize credit, completed SUBMITTED participants and the correct winner/loser ranks. The deliberate disconnect trial has one refund settlement, 1000 total refunded, two VOIDED participants and no ranks/prizes. The two pre-capture latency rejects have reservation releases (refund credits correctly zero), VOIDED participants and no winner. Historical and new refund admin panels both show captured TEST GEL 10, refunds TEST GEL 10 and **zero discrepancy**. Instance list count now reports real totals. Final global ledger sum/escrow/reserved funds/open instances/unapplied decisions are all zero; trial template disabled.

Historical content fingerprints remain identical for all 31 legacy ledger rows, 118 sandbox ledger rows, 6 admin audits, 8 authority results, 11 authority decisions and 20 match-history rows. Immutable historical records were not rewritten to obtain reconciliation. Browser desktop/mobile/admin console warning/error collections were empty; expected adversarial rejection codes, occasional partner NOT_ACTIVE during terminal transitions and the two admission failures are separately retained. No critical server exception was observed in inspected authority logs; this is not an assertion about uninspected provider logs.

## Final 42-field completion report

| # | Requested field | Result |
|---:|---|---|
| 1 | Initial Git state | Clean remediation branch, local 05018ee one ahead of remote 996c9b4; main refs above. |
| 2 | Evidence pushed | Yes, original 05018ee pushed without rewriting its NOT PASS meaning. |
| 3 | Old database | Supabase, Tokyo/ap-northeast-1. |
| 4 | New database | Supabase, Frankfurt/eu-central-1; backend target independently verified. |
| 5 | Migration method | Private full pg_dump backup; guarded single-transaction application-schema restore; official migration 0011. |
| 6 | Parity | 24/24 tables match before migration; 12 official migration hashes/timestamps match afterward; immutable history preserved. |
| 7 | DB latency | Local query 308–318 → 68–73 ms; Render stage comparison above. |
| 8 | Snapshot-gap cause | Historical 517 ms unproven; new browser stalls and shared arrival delays isolated as described above. |
| 9 | Browser transport | WebSocket. |
| 10 | Generation rate | Approximately 20 Hz per participant, server timestamps. |
| 11 | Emit rate | Approximately 20 Hz per participant, server timestamps. |
| 12 | Client receive rate | Main browser samples 19.986–20.476 Hz. |
| 13 | Gap percentiles | Full per-width table above; maximum 302.9 ms with expanded diagnostics. |
| 14 | Payload | Maximum 1888 bytes, full snapshot. |
| 15 | Desktop controls | Automated sustained controls/natural win verified; physical keyboard-hold acceptance incomplete. |
| 16 | 375 px | Automated movement/fire and results verified; expanded diagnostics stalls; physical touch acceptance incomplete. |
| 17 | 320 px | Automated movement/fire for 11.8 s and fitting win screen verified; physical pointer/reconnect checks inconclusive. |
| 18 | Reconciliation cause | Refund participant credits omitted from report outflows. |
| 19 | Reconciliation fix | Count the refund credit once, preserve ledger, display refund/subsidy/discrepancy separately. |
| 20 | Participant cause | Terminal authority application updated rank/prize but left active status; void assigned rank 1. |
| 21 | Participant fix | Atomic authority projection, explicit VOIDED/CANCELLED semantics, official historical projection repair. |
| 22 | Settlement | Natural total 59.69–125.57 ms; detailed stages above. |
| 23 | Regressions | Sequence/binding/stale/interpolation tests; real refund HTTP; terminal states; existing concurrent exactly-once tests retained. |
| 24 | Tests | 40 scripts / 1450 assertions pass; typecheck/client/server builds pass. Live security repeat 15/15, failure 9/9; initial admission assertion failed. |
| 25 | Remediation commit | 0a38802a8f1047b320687f139d40578c32571090; evidence documentation separate. |
| 26 | Frontend | Same 0a38802, Vercel Preview GJ4BaWyVA1RqA9pw95g42W3xjUDa. |
| 27 | Backend | Same 0a38802, Render dep-daqg4nad0e5s73af8iq0. |
| 28 | Winner payout | Seven natural winners, exactly one TEST GEL 9 prize each. |
| 29 | Refund | Both-disconnected entries refunded TEST GEL 10 total; admission reservations released. |
| 30 | Displayed reconciliation | Zero for both historical and new actual refunds. |
| 31 | DB reconciliation | Zero globally and for all ten trials; no escrow/reserved/open/unapplied work. |
| 32 | Reconnect | Actual socket reconnect 349.6 ms and fencing pass; mobile UI reconnect not established. |
| 33 | Errors | Browser warning/error collections empty; expected socket rejections retained; no critical exception in inspected authority logs. |
| 34 | Verdict | **NOT PASS**. |
| 35 | Blockers | Physical desktop/mobile gesture and mobile reconnect acceptance incomplete; short mobile samples/stalls and two admission rejections prevent a full reliability claim. |
| 36 | Final Git status | Clean working tree after final evidence commit on the remediation branch; runtime remote remains 0a38802 and final evidence is backed up on `codex/phase-5-5a-round2-evidence`. No history rewrite. |
| 37 | Main merge | None. |
| 38 | Other games | Not migrated. |
| 39 | Replay retirement | Not started. |
| 40 | Diamond retirement | Not started. |
| 41 | Phase 6 | Not started. |
| 42 | Phase 7 | Not started. |

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
