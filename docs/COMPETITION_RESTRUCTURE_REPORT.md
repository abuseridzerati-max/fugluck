# FUGLUCK COMPETITION SYSTEM RESTRUCTURE REPORT

September 28, 2026. **Local candidate; hosted tournament acceptance is PLANNED.** All BUILT statements below describe source inspected and the local checks identified under Tests. They do not claim a staging deployment, real-user qualification, bank integration or commercial launch approval.

## Standard Competition Model

**BUILT:** reusable 2/4/8/16-player single elimination for Space Blaster and Cyber Hopper. Four Standard products per game remain discoverable; joining creates or fills a room. Exactly the configured capacity must join. The default reference fee is 500 tetri for Space Blaster and 400 for Cyber Hopper, shared across that game's capacities.

At creation, freeze `reference fee × scheduled capacity`, a 90% winner prize and the remaining 10% platform margin. Integer basis-point arithmetic floors the prize to tetri; the remaining scheduled total is the margin. Default whole-GEL fees produce exact amounts. A full four-player Space Blaster event has 5 GEL Entry, 18 GEL Prize and 2 GEL margin. It never recalculates its prize from collected entries. Unfilled Standard rooms time out after two minutes and return reservations; subsequent joins can open another room.

## Promotional Model

**BUILT:** one featured Promo per game per six-hour cycle, paid reference Entry, and frozen Prize equal to 150% of the full scheduled reference total. The subsidy is the frozen prize less scheduled entry revenue, normally 50% of the reference total. Default capacity rotates 2/4/8/16. Five valid Standard completions in that game grant one ticket for the next eligible cycle, not permanent access.

## GIFT Model

**BUILT:** one GIFT per game per 24-hour cycle, default capacity 16, zero Entry, and a frozen 150% reference-total Prize funded entirely by the platform. Ten valid Standard completions grant one next-cycle ticket. GIFT admission creates no entry reservation or debit. Paid, free and subsidized economics remain distinct in the accounting port and player presentation.

## Qualification

**BUILT:** independent per-user, per-game Promo and GIFT tracks. One unique completion event per Standard tournament and participant is recorded only after final settlement, an applied authoritative Final winner, and that participant's positive-tick receipt from an applied win/forfeit decision. Playing several rounds earns one completion. Early elimination waits for the whole tournament to settle. Sandbox, mock, synthetic/admin fixtures, practice, Coins, invalidated, refunded, voided and no-gameplay participation do not qualify.

Qualification freezes its track until the assigned cycle ends, including after ticket use. Admission consumes the correct user's ticket in the same database transaction as the seat; insufficient funds and rejected admission preserve or recover it. No stockpiling, carry-over or cross-game tickets. Expiry clears progress to zero. Reads project expiry without ledger mutations; transactional admission/completion/replacement persists it. Invalidation removes eligibility and cannot be reversed.

The public product remains sandbox and cannot earn qualification. Live provenance admission explicitly fails closed. Positive qualification tests use labeled disposable-schema fixtures; they are not genuine commercial acceptance. Real qualification activation requires a separately approved financial/provider/policy rollout.

## Scheduler

**BUILT:** durable cycle IDs and immutable configuration snapshots. Defaults are Asia/Tbilisi 00:00/06:00/12:00/18:00 for Promo and 00:00 daily for GIFT. UTC is also supported; unsupported zones are rejected. Registration closes five minutes before start. Reaching the threshold strictly before cutoff targets that cycle; at/after cutoff targets the following cycle. A full special waits for its scheduled start. An underfilled special voids and refunds.

Catalog creation is idempotent across concurrent requests and process restarts. Recovery uses stored timestamps, does not generate a backlog of missed events, and does not let later configuration edits alter an existing cycle. Configuration changes are audited domain operations; no public editor or broad admin redesign was introduced.

## Knockout Tournament Engine

**BUILT:** tournament roots, all N−1 bracket slots, entry intents, immutable terms and durable lifecycle states. Capacities 2/4/8/16 yield 1/3/7/15 matches with no byes. Capture, bracket creation, match attempts, final settlement and refunds recover independently. Completed matches and their winners remain durable across restart. The existing deployment requirement of one active game-owning server process remains; distributed socket routing is outside this change.

## Bracket Seeding

**BUILT:** a server-generated 256-bit cryptographic seed drives HMAC-SHA256 counter output and rejection-sampled Fisher–Yates over a canonical entrant list. Persist the seed, immutable order and SHA-256 commitment once after full admission. Repeated processing cannot reseed. Player projections omit the seed. This provides an auditable server draw; it is not an externally verifiable pre-registration randomness ceremony. Individual authority matches receive their own game seed.

## Round Advancement

**BUILT:** every bracket match uses the existing certified Level 3 runtime, two fresh authority sessions and a fenced attempt. Only a persisted, applied server decision advances the winner into the predetermined parent slot. Duplicates, stale attempts and late decisions cannot advance again. New round bindings replace the previous round's client controls and snapshots. The Final's exact authority run authorizes the one tournament prize; semifinals never settle money.

## Ties / Forfeits / Voids

**BUILT:** a tie creates a fresh attempt for the same pair; no arbitrary winner. One admitted/ready player against a missing opponent can advance by a server-recorded no-show after the deadline. Both absent voids/refunds. Zero-tick no-shows never earn qualification. Existing reconnect grace, admission checks and fencing remain. Recoverable authority interruption retries the match; the configured three infrastructure retries bound recovery before refund. Completed prior rounds remain intact.

Leaving an unfilled room cancels the whole room and returns every reservation. The voluntary caller's special ticket stays consumed through normal expiry; other entrants receive linked next-cycle replacements. A platform failure before positive-tick gameplay replaces accepted tickets, including delayed recovery after expiry. Repeated processing cannot duplicate entitlement. An already available later ticket coalesces the replacement; a later consumed entitlement defers it until expiry. After valid recorded play, the conservative policy is refund without replacement or qualification credit.

## Tournament Accounting

**BUILT:** reserve once per tournament admission, capture each paid entry once when full, and settle the frozen prize once after the Final. Durable entry intents recover an ambiguous reservation reply with the same financial key. Ticket/seat admission is atomic; rejected admissions compensate the reservation. Failed payout leaves `FINALIZING` for idempotent retry. Refunds reconcile captured and reserved entries without erasing history.

Commercial settlement verifies full scheduled entries, capacity, frozen prize, winner and exact Final authority run. Existing append-only double-entry postings, zero-sum checks, revenue/margin, subsidy and prize-obligation accounts remain canonical. No direct balance mutation, new bank provider, per-round fee, client-submitted score, client-selected winner or client-supplied prize was introduced. Commercial and sandbox adapters share the tournament boundary.

## Space Blaster Integration

**BUILT:** the existing `space-blaster-rv001-v1` engine and authority contract are unchanged. Four authenticated Socket.IO clients play two real semifinals and a Final using ordinary controls. Signed mock-provider deposits fund commercial ledger entries; authoritative results drive advancement and the final 1,800-tetri award. Evidence records all runs, receipts and reconciliation. The local acceptance constructor caps games at 240 ticks for speed; no hosted setting or engine rule was changed.

## Cyber Hopper Integration

**BUILT:** the same tournament model wraps unchanged `cyber-hopper-rv001-v1`. Four authenticated clients play through two semifinals and a Final for a frozen 1,440-tetri prize. The recovery acceptance interrupts an active Final, restarts the owning server and checks a fresh fenced attempt while preserving the completed semifinals and original bracket. This is local transport/engine acceptance, not a claim of four physical devices or hosted latency certification.

## Migrations

**BUILT locally:** `0013_knockout_tournaments.sql`; expected journal length 14, timestamp `1790400000000`. Nine new tables:

| Table | Purpose |
|---|---|
| `competition_product_configs` | Audited active configuration revisions |
| `competition_special_cycles` | Frozen schedules and special terms |
| `competition_products` | Materialized product/template terms and provenance |
| `competition_tournaments` | Root state, seed, winner, final run, invalidation and cancellation actor |
| `competition_bracket_matches` | Fixed slots, attempts, failures and winners |
| `competition_entry_intents` | Admission and financial compensation recovery |
| `competition_qualification_events` | Unique applied completion evidence |
| `competition_qualification_tracks` | Independent progress and frozen target |
| `competition_qualification_tickets` | Owned entitlement, consumption, expiry and replacement lineage |

Authority runs gain bracket-match/attempt fields. Partial indexes preserve legacy one-run-per-instance behavior while enforcing unique bracket attempts and a single live run. Triggers protect configuration, product/cycle/instance/prize terms, draw, slots/winners, tickets, applied evidence and irreversible invalidation. No legacy balance, ledger or result rewrite is included.

Canonical LF SHA-256: `a39b84386b0cfbfd5fcd7f6bdc3e7a18604d055398829bc8fb470efb9aef3a08`. Exact CRLF equivalent: `b071114af85a28c5c43a8bcb83246943190ed860e07aa0c981204c54e46c0914`. Applied only to the guarded disposable database and isolated schemas. Hosted migration is **PLANNED**.

## API / UI Integration

**BUILT:** extended the existing `playerReadModel.ts`, shared DTOs, Competition cards, confirmation, My Competitions, waiting/play/results and optional Rules. Added STANDARD/PROMO/GIFT, capacity, frozen Entry/Prize, independent progress, next cycles, locked eligibility, tournament state, round, own current match and optional named bracket. The existing PICK → JOIN → PLAY → RESULT flow remains. Sixteen occupancy slots wrap, card actions align, and EN/KA/RU copy is retained.

The catalog selects only current product IDs instead of fetching all historical cycles. Own results show the player's latest opponent and elimination while other rounds continue. Read models expose no authority tokens, seeding secrets or internal financial resources. The existing join message still accepts a template ID rather than economic terms. A private, authenticated operator endpoint provisions fixed four-player mock Standard templates for the eventual hosted exercise; it cannot change client-selected fees or prizes.

## Tests

**Executed:** all **49 scripts, 2,172/2,172 passing assertions, zero failures**, exit failures or count mismatches in the consolidated final results. Baseline was 45 / 1,775. Every program was run; corrected failures were rerun to completion. [Sanitized evidence](evidence/competition-restructure-acceptance-20260928.json) includes individual counts, the initial run, repairs, final reruns, actual authority receipts and LF source digests.

| Script | Passed | Failed |
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
| `sql-injection-check.ts` | 19 | 0 |
| `staging-mock-commercial-check.ts` | 13 | 0 |
| `staging-readiness-check.ts` | 40 | 0 |
| `test-database-safety-check.ts` | 18 | 0 |
| `tournament-authority-check.ts` | 33 | 0 |
| `tournament-domain-check.ts` | 97 | 0 |
| `tournament-recovery-check.ts` | 52 | 0 |
| `tournament-rules-check.ts` | 180 | 0 |
| `wallet-friends-check.ts` | 48 | 0 |
| `wallet-settlement-concurrency-check.ts` | 16 | 0 |
| `wallet-settlement-integrity-check.ts` | 24 | 0 |
| `xss-audit-check.ts` | 17 | 0 |

The four new suites cover economics/rounding/schedules/seeding; all bracket capacities, qualification and commercial subsidy; interrupted admission, tickets, ownership and final-payout recovery; and genuine four-client gameplay. Eight/sixteen-player advancement and positive real-qualification semantics use explicit domain fixtures. Genuine four-player results are listed separately below; no fixture winner is described as live acceptance.

- **space-blaster:** instance `inst_801fd7b9-183d-4679-8d31-052a0f305e34`, Final run `613d6069-9db9-4f00-b24e-b65205faa96c`, frozen prize 1800 tetri; 3 authority runs including any void/retry, 6 positive-tick receipts.
- **cyber-hopper:** instance `inst_43bf57fc-a820-4345-8ee2-1ccdb543282d`, Final run `3345961e-897a-4c91-952f-a59a749d6c7c`, frozen prize 1440 tetri; 4 authority runs including any void/retry, 6 positive-tick receipts.

The initial pass exposed four fixture/test failures: the old migration-head expectation; broad Phase 3 cleanup conflicting with protected product records; the resulting incomplete Phase 4 fixture; and a UX fault injection tied to an obsolete SQL spelling. The tests were corrected without weakening database protection or application assertions. Their reruns passed **44 / 45 / 44 / 110** respectively. The stronger active-Final restart also exposed a shutdown-order defect: sockets disconnected before simulation stopped, producing an erroneous both-disconnected void. The close boundary now stops authority first; the genuine two-game tournament and both existing game-authority suites were rerun successfully.

The first domain run stopped after 52 passing checks on a disposable-database connection timeout/DNS failure. A fresh loopback PostgreSQL 17.11 database then passed all 97 domain checks. Recovery HTTP fixtures were corrected for the existing 32-character username limit and tsx static/dynamic module isolation; all 52 recovery checks passed without opening a staging connection. The fixture-only failures and reruns are preserved in evidence.

Typecheck (including the client production build), server production build, Drizzle metadata check and Git whitespace check passed. Migration parity passed **338** assertions. Runtime dependency audit: **0 vulnerabilities**; complete audit: **4 existing moderate development-tool findings**, no high/critical findings. The existing Vite chunk-size advisory remains. No dependencies changed.

Local Chromium verified 12 cards, game filtering, locked specials, compact frozen Join terms, optional rules and responsive occupancy. EN widths 320/375/390/430/768/1024/1440, KA 320/390 and RU 320/1440 had no page, terms or slots overflow. Cycle labels use numeric day/month and 24-hour time to avoid this browser's English weekday/day-period fallback for Georgian; translated application labels render correctly. Warm/fresh-local-process catalog timings are local observations only, not hosted cold-start acceptance.

## Commercial Safety

**Verified by source, environment checks and actions performed:** default-off `ENABLE_KNOCKOUT_TOURNAMENTS` requires test/development/staging, authority enabled and all real-money switches false. Existing admitted obligations can finish after the action switch closes. Public tests use sandbox products; commercial E2E uses the existing signed mock provider. No bank implementation or external payment execution was added.

No push, hosted migration, deployment, main merge, production configuration/data access or financial activation was performed. Historical Phase 7I acceptance and bank-readiness evidence remain intact. The accepted hosted SHA in prior evidence is `b87036ce9394af61714e0a8920944e4a6fe247f4`; it was not freshly revalidated here. The production frontend → staging API blocker remains unchanged and explicitly outside this task.

## Files Changed

**Created (15):**

- `docs/COMPETITION_RESTRUCTURE.md`
- `docs/COMPETITION_RESTRUCTURE_REPORT.md`
- `docs/COMPETITION_RESTRUCTURE_ROLLOUT.md`
- `docs/evidence/competition-restructure-acceptance-20260928.json`
- `packages/server/drizzle/0013_knockout_tournaments.sql`
- `packages/server/src/competitions/tournamentPersistence.ts`
- `packages/server/src/competitions/tournamentQualification.ts`
- `packages/server/src/competitions/tournamentRules.ts`
- `packages/server/src/competitions/tournamentService.ts`
- `packages/shared/src/tournaments.ts`
- `scripts/tournament-authority-check.ts`
- `scripts/tournament-domain-check.ts`
- `scripts/tournament-recovery-check.ts`
- `scripts/tournament-rules-check.ts`
- `scripts/tournament-test-database.ts`

**Modified (39):**

- `DEPLOYMENT.md`
- `GAMES.md`
- `PROGRESS.md`
- `package.json`
- `packages/client/src/components/CompetitionCatalog.tsx`
- `packages/client/src/components/CompetitionUI.tsx`
- `packages/client/src/components/MyCompetitions.tsx`
- `packages/client/src/components/competition.css`
- `packages/client/src/game-loader/AuthorityCompetition.tsx`
- `packages/client/src/lib/competitionPresentation.ts`
- `packages/client/src/locales/en.json`
- `packages/client/src/locales/ka.json`
- `packages/client/src/locales/ru.json`
- `packages/server/.env.example`
- `packages/server/drizzle/meta/_journal.json`
- `packages/server/src/accounting/commercialAdapter.ts`
- `packages/server/src/accounting/sandboxAdapter.ts`
- `packages/server/src/competitions/authorityRuntime.ts`
- `packages/server/src/competitions/authorityStore.ts`
- `packages/server/src/competitions/lifecycleEngine.ts`
- `packages/server/src/competitions/playerReadModel.ts`
- `packages/server/src/competitions/templateService.ts`
- `packages/server/src/config/stagingMockCommercial.ts`
- `packages/server/src/config/startup.ts`
- `packages/server/src/db/schema.ts`
- `packages/server/src/index.ts`
- `packages/server/src/matchmaking/index.ts`
- `packages/server/src/routes/competitions.ts`
- `packages/server/src/routes/stagingMockCommercial.ts`
- `packages/shared/src/authority.ts`
- `packages/shared/src/competitions.ts`
- `packages/shared/src/index.ts`
- `scripts/competition-admin-http-check.ts`
- `scripts/competition-phase3-lifecycle-check.ts`
- `scripts/competition-phase4-ui-check.ts`
- `scripts/competition-player-ux-check.ts`
- `scripts/environment-safety-check.ts`
- `scripts/migration-schema-parity-check.ts`
- `scripts/staging-mock-commercial-check.ts`

**Deleted:** none. `AGENTS.md`, `.agents/` and the pre-existing Session 91 tail in `PROGRESS.md` are preserved outside the candidate commit.

## Git State

Branch: `codex/competition-restructure`. Verified parent/UI baseline: `4ae3fc3290bfbb1b367c57caeb01bd68140ead03`. The local candidate is the commit containing this report; its full SHA is supplied in the final handoff (a commit cannot contain its own hash). It contains every verified ancestor listed in the evidence, including the commercial, authority, accepted Phase 7I and local documentation foundation. No older branch was substituted.

This candidate has not been pushed, deployed or merged. At handoff, only the user's unrelated AGENTS/PROGRESS/.agents changes remain outside the candidate. Generated local logs, screenshot and test runner stay in ignored `Temp/competition-restructure/`; sanitized durable evidence is committed.

## Staging Rollout Requirements

**PLANNED:** follow [the complete rollout procedure](COMPETITION_RESTRUCTURE_ROLLOUT.md). Required gates are approval of the exact candidate and migration scope; fresh transaction-consistent staging backup; independently verified isolated restore and financial/schema/content parity; rehearsal of the official 13→14 migration; correct Preview/staging identities and all financial guards; then approved feature push and matching frontend/backend deployment. Production remains excluded.

After deployment, prove exact revisions, staging identity/database, migration head, TLS, production denial, warm and genuinely idle-first catalog, UI refresh/reconnect, and genuine four-player hosted mock tournaments for both games. Reconcile, close mock switches and record exact results. Do not automatically roll back to the old 13-migration binary: it rejects the extra migration and cannot recover tournament obligations. Contain using a compatible runtime with new admission off, then prefer a forward fix. Backup restoration after new activity needs a separate recovery decision.

## Remaining Work

- **PLANNED:** the explicitly approved backup/restore/migration/staging rollout and hosted four-player tournament acceptance above; no hosted pass is claimed.
- **PLANNED:** physical-device/real-network tournament UX and latency verification after staging is approved. Local engine/Socket.IO and Chromium evidence have narrower scope.
- **External / separately scoped:** real-money provider, legal/business/identity policy activation and the pre-existing production isolation blocker. All remain outside this candidate.
- **Existing advisories:** client chunk size and development-only dependency audit findings are recorded under Tests; no runtime high/critical finding is accepted silently.
