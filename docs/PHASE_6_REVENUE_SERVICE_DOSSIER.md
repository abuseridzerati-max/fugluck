# Phase 6 — Revenue Service Technical Dossier + Submission Readiness

**Status: PROPOSED FOR APPROVAL — PLANNED, NOT IMPLEMENTED**

**Status note (2026-09-25):** this v0.3.0 text is preserved as a historical planning specification, not the current phase tracker or current evidence. Its claims that Phase 5.5 and Phase 6 are unstarted describe the 2026-09-23 baseline. The current implementation map is [`COMPETITION_ARCHITECTURE.md`](COMPETITION_ARCHITECTURE.md); the factual Phase 6C reviewer package and evidence index are [`PHASE_6C_REVENUE_SERVICE_DOSSIER.md`](PHASE_6C_REVENUE_SERVICE_DOSSIER.md) and [`evidence/phase6c/EVIDENCE_INDEX.md`](evidence/phase6c/EVIDENCE_INDEX.md). This pointer is based on reading current source and the new evidence package.

Specification version: `0.3.0`

Prepared: 2026-09-23

Audited source baseline: `2cbc429caed07dc4e8ece05bbb4662fb27667018`

Scope owner / technical approver / evidence custodian / legal reviewer: **TBD**

**Direction change (user instruction, 2026-09-23): replay is removed from the target Fugluck architecture. Version 0.1.0 is superseded and was not approved. Existing code still uses the retired mechanism; its replacement/removal is PLANNED Phase 5.5 work. This revision does not implement that change.**

**Selected target:** [RV-001 — Non-Replay Result Validation Architecture](RESULT_VALIDATION_ARCHITECTURE.md) selects live server-authoritative state/scoring (Level 3) for all four candidates. The model-choice block in v0.2.0 is resolved; implementation and acceptance remain blocked/unstarted. This supersedes its plausibility-only sandbox option for prize competition. Live execution of existing game logic is in scope; input-history reconstruction remains excluded.

This is a proposed engineering specification, not a dossier, evidence bundle, legal opinion, approval, or submission. All MUST/SHALL statements below are proposed acceptance requirements. Approving this document would define scope; it would not itself authorize deployment, external disclosure, regulatory filing, payments, or Phase 7. No implementation or submission artifacts were generated for this specification task.

## 1. Authority, audit basis, and objective

### 1.1 What was found

The Phase 4/5 roadmap in [PROGRESS.md](../PROGRESS.md) calls Phase 6 **Revenue Service Technical Dossier + Submission Readiness**, with an older four-deliverable roadmap. Its former gameplay reconstruction deliverable is superseded by the current user instruction. The four proposed deliverables are now D1 technical/legal-review dossier, D2 result-validation & competition-integrity evidence, D3 ledger/reconciliation evidence, and D4 submission-readiness package. The introducing roadmap commits are `6d948c6` and `7174dcc`. Formal regulatory review/classification follows Phase 6; payment integration and monetary activation follow that gate.

**Section 22 and the full `FUGLUCK — FINAL COMPETITION DOMAIN CONTRACT` were not found.** Searches covered the current repository, hidden documentation paths excluding dependencies/build output/Git internals/secrets, root and client docs, source/migration comments, deployment and admin material, and reachable Git documentation history. History contains the roadmap's Section 22 reference, not the section's text. No separate archived/legal/specification folder containing that contract was found. The old legal register's `real_money_diamond_economy_architecture.md` reference is also not present in the searched documentation history. This does not assert that an external document never existed.

This document proposes replacement **Phase 6 scope only**, based on the user's current competition invariants and inspected code. It does not reconstruct or impersonate the missing contract. If an authoritative contract is subsequently supplied, record a reviewed comparison and resolve conflicts before implementation.

### 1.2 Objective

Prepare a complete, internally reviewable technical evidence package for external legal/regulatory review of Fugluck's proposed platform-defined competition model. It must demonstrate actual product architecture, implementation behavior, independently repeatable policy/accounting checks, and accounting behavior, with explicit limitations and traceable evidence.

It must not conclude that Fugluck is legal, is not gambling, is licensed, is compliant, or is approved by a Revenue Service or another authority. Live server scoring establishes execution of trusted server rules, not human input, complete cheat prevention, network fairness or legal classification. No authoritative determination or official filing checklist was supplied or established by this repository audit.

### 1.3 Scope and exclusions

In scope: platform-controlled CompetitionTemplates; immutable instance **terms/prize snapshots** with separately changing lifecycle state; independent entry and predetermined prizes; Test/Sandbox GEL; separate free, non-redeemable Coins; retired Diamonds with preserved history; seeded gameplay and live server-authoritative competition state/scoring; competition/accounting lifecycles; administration/audit controls; cancellation, voids/refunds, ties, forfeits, rematches, promotional prizes, freerolls, simulated sponsorship, and historical records.

The initial runtime evidence profile is **HEAD_TO_HEAD, capacity 2, one predetermined first-place prize**, for the four current sandbox candidates. Preserve multiple-prize/format domain types and accounting capabilities. Do not describe tournament brackets, leaderboard rushes, or multi-placement runtime settlement as working until separately built and verified. Unsupported templates must not silently launch through the supported runtime (see P1).

Excluded: real-money deposits/withdrawals/payouts/settlement; PSP activation or new PSP abstractions; card processing or bank integration; player-created monetary wagering/lobbies/prizes; friend-money challenges; bets on players/external events; restored Diamond economy; Coin-to-GEL conversion; legal filing or external transmission without later explicit authorization; new games/engines; expanded tournament formats; Phase 7; unrelated refactors. Every GEL amount remains **TEST / SANDBOX GEL — NO REAL MONEY**.

### 1.4 Separate completion gates

| Gate | Meaning | Required approval / evidence |
|---|---|---|
| S — specification approved | Scope and defaults accepted | Named product/technical approver accepts this version and prerequisite boundary |
| H — prerequisite hardening accepted | Actual runtime can produce truthful evidence | All P1–P7 scope and RV-001 A1–A12 acceptance criteria pass; source revision recorded |
| T — technical package ready for review | D1–D4 artifacts reproducible and internally checked | All mandatory matrices pass; technical reviewer and custodian sign off |
| F — filing preparation complete | Package matched to a confirmed authority/process | Filing placeholders resolved by responsible legal reviewer; any official requirements source-linked |
| X — external submission authorized | Permission to send a specific reviewed package | Separate user authorization for recipient, channel, contents and final package hash |

Gate T may be reached with filing placeholders clearly marked unresolved; this MUST NOT be labeled filing-ready or full Phase 6 completion. Full Phase 6 completion requires T and F, and Gate T requires implemented, tested Level 3 authority for every included candidate; plausible client scores are never a settlement source. Gate X and actual filing are outside this phase. Legal clearance and monetary activation are never inferred from these engineering gates.

## 2. Verified implementation inventory and repair decisions

All findings in this section are **BUILT/source-inspected at the audited baseline**, not freshly executed tests or browser reproductions. The accepted Phase 5 evidence was catalog/entry-preview and read-only admin acceptance; it excluded joined/settled competitions.

### 2.1 Source map

| ID | Sources inspected | Reusable implementation / fact |
|---|---|---|
| S1 | [competitions.ts](../packages/shared/src/competitions.ts), [money.ts](../packages/shared/src/money.ts) | Template/instance/prize types; integer amounts; four candidate and two coin-only classifications |
| S2 | [templateService.ts](../packages/server/src/competitions/templateService.ts), [instanceService.ts](../packages/server/src/competitions/instanceService.ts) | Platform templates, snapshotted terms/prizes, registration/reservations |
| S3 | [useMatchSocket.ts](../packages/client/src/matchmaking/useMatchSocket.ts), [MatchLoader.tsx](../packages/client/src/game-loader/MatchLoader.tsx), [gameModule.ts](../packages/shared/src/gameModule.ts) | Current completion payload and generic submitScore transport; payload replacement required |
| S4 | [matchmaking/index.ts](../packages/server/src/matchmaking/index.ts), [matches.ts](../packages/server/src/matchmaking/matches.ts), [lifecycleEngine.ts](../packages/server/src/competitions/lifecycleEngine.ts) | Legacy dispatch versus competition activation and service-level lifecycle/settlement |
| S5 | [Neon Runner engine](../games/neon-runner/engine.ts), [Dash engine](../games/pixel-ninja-dash/engine.ts), [Blaster engine](../games/space-blaster/engine.ts), [Hopper engine](../games/cyber-hopper/engine.ts), their constants and index modules | Actual score formulas, local result generation, gameplay seeds and timing; no trusted remote gameplay measurement established |
| S6 | [port.ts](../packages/server/src/accounting/port.ts), [sandboxAdapter.ts](../packages/server/src/accounting/sandboxAdapter.ts), [schema.ts](../packages/server/src/db/schema.ts), [0008](../packages/server/drizzle/0008_competition_economy.sql), [0009](../packages/server/drizzle/0009_sandbox_accounting.sql) | Existing accounting, snapshots, journal and history compatibility |
| S7 | [adminCompetitions.ts](../packages/server/src/routes/adminCompetitions.ts), [competition routes](../packages/server/src/routes/competitions.ts), [admin views](../packages/client/src/admin/CompetitionAdminViews.tsx) | Read/admin boundaries and eligibility wording requiring review |
| S8 | [wallet.ts](../packages/server/src/routes/wallet.ts), [admin.ts](../packages/server/src/routes/admin.ts), [ledger.ts](../packages/server/src/wallet/ledger.ts), [queue.ts](../packages/server/src/matchmaking/queue.ts) | Diamond creation/grant/queue surfaces and history |
| S9 | [Phase 3 checks](../scripts/competition-phase3-lifecycle-check.ts), [Phase 2 checks](../scripts/competition-phase2-accounting-check.ts), [Phase 5 checks](../scripts/competition-phase5-admin-check.ts) | Existing direct-service/accounting/admin coverage; not proof of the proposed result policy |

The retired subsystem's exact paths and migration disposition are recorded in section 2.7. Source presence is not approval to keep it.

### 2.2 Gap 1 — runtime competition completion: A, blocking prerequisite

The inspected route is:

1. `MatchLoader` receives gameOver and calls the hook's `submitScore` with matchId, claimed score, duration, log and viewport.
2. `useMatchSocket` emits `submitScore` for competition mode too.
3. `matchmaking/index.ts` sends this event to the legacy `matches.submitScore`.
4. That function requires `socketToMatch` and `matches` entries. Competition activation creates a database `comp_match_*` and emits matched events, but does not register those legacy maps.
5. No production caller of `lifecycleEngine.submitScore` was found. Phase 3 checks call it directly.

Consequently the current socket path does not connect a competition submission to participant score persistence, VERIFYING/terminal transition, or competition prize settlement. The service contains those operations, but its existence cannot prove they occur from the real player flow. **Repair before runtime evidence generation.** Do not connect competition money to legacy pot/rake settlement as a shortcut.

Related facts that P1 must address within this same flow: rematch/reconnect/disconnect are dispatched through legacy handlers; the lifecycle submission currently turns invalid results into score zero without a durable verdict; and it returns SETTLED after calling settlement even when the settlement can produce VOIDED for a tie. Full lifecycle semantics must be measured, not inferred from UI copy.

### 2.3 Gap 2 — live authority and durable decisions: A, blocking prerequisite

The current checker still uses the retired reconstruction subsystem. No selected live Level 3 owner/scheduler/control/snapshot path or complete durable authority/session/result/decision record exists at the audited baseline. Existing engines can be reused, but source availability is not runtime acceptance.

**Decision:** [RV-001](RESULT_VALIDATION_ARCHITECTURE.md) selects server-owned evolving game state and terminal scores for all four candidates. Phase 5.5 implements secure sessions/live controls, game authority, minimal immutable terminal facts and durable lifecycle/accounting arbitration. No accepted score is derived from a client numeric report. Keep bounded audits and aggregate server facts; do not persist control sequences or rebuild games after restart.

Additive session/result/decision schema changes are required during implementation; none are made now. Source/build/authority provenance can be packaged by Phase 6. A lost active run without trusted durable terminal facts voids/refunds; a committed outcome retries the same economic effect. No replay persistence or proof package is authorized.

### 2.4 Gap 3 — backend Diamond retirement: A, blocking prerequisite

| Surface | Current inspected behavior | Required disposition |
|---|---|---|
| Socket `joinQueue`; `queue.enqueue`/`tryPair` | Accept DIAMONDS and caller-selected positive stake, subject to guest/email restrictions | Reject new Diamond entry at public and service boundaries; never silently reinterpret as Coins |
| Legacy `createMatch` and rematch path | Carry currency/stake into legacy escrow/settlement; no universal Diamond retirement gate | Block new Diamond matches/rematches, including alternate entry points |
| Wallet `/purchase-diamonds`, `/diamonds/stub-buy`, `grantDiamondsStub` | Environment-gated creation; can be enabled with a flag, defaults allowed outside production | Disabled in all supported runtime modes after hardening; retain history labels |
| Admin `/wallet/grant-diamonds` | RBAC-protected but active ledger creation, without the purchase-stub environment gate | Disable new Diamond funding; historical read/audit remains |
| Wallet `/packs` and root wallet packs payload | Still advertise legacy packs | Remove active offers or return explicit retired/no-offers response; do not remove historical transactions |
| Balance/history, legacy matches/settlements, ledger queries, compensating correction/recovery | Historical data or remediation paths | Preserve read access and original entries; separately audit any authorized correction so it cannot become a new funding/entry bypass |

`index.ts` mounts the wallet/admin routers. This is an active-capable backend contradiction, not merely an unused type or historical record. Friend/guest invitation code currently uses COINS and zero stake; preserve it. This review did not execute Diamond actions or inspect a live account's Diamond balance.

### 2.5 Gap 4 — documentation: A for current claims; B for preserved history

| Document/surface | Classification at baseline | Proposed treatment |
|---|---|---|
| Latest Phase 5 acceptance in PROGRESS.md | Current evidence with explicit read-only/preview limits | Keep; link exact scope rather than upgrading it to transactional acceptance |
| Earlier dated PROGRESS.md sessions | Historical; some architecture statements superseded | Preserve chronology; append corrections and current pointers |
| AGENTS.md / CLAUDE.md | Current instructions, needs update | Replace active Diamond/stake/rake and authoritative gameplay-reconstruction claims with current competition/result-policy boundaries; clearly limit surviving Coin/legacy rules |
| LEGAL_REVIEW_REQUIRED.md | Current register, needs update | Retire Diamond exchange/playthrough/payment and gameplay-reconstruction assumptions; keep unanswered classification/territory/tax/age questions as questions |
| REPO-STATE.md / RECOVERY-STATE.md | Historical August 2026 snapshots | Preserve unchanged; not a current architecture authority |
| DEPLOYMENT.md | Current deployment guide, needs narrow update | Extend retirement verification to backend boundaries; preserve additive migration/staging identity safeguards |
| GAMES.md | Current game manifest, needs claim reconciliation | Distinguish practice/Coins, candidate status, blocked Level 3 implementation/acceptance and actually evidenced formats; retire current authoritative verification claims, mark historical descriptions superseded |
| `policyData.ts` current terms/rules/about/privacy and `faqData.ts` matchmaking copy | Current user-facing descriptions, needs update | Remove current Diamond economy, monetary pot/rake and authoritative gameplay-reconstruction descriptions; avoid blanket fairness/skill/legal claims; version current policies through the existing mechanism |
| Historical Diamond policy and previously accepted policy versions | Historical / superseded policy content | Preserve original versions/acceptance records, identify historical scope; add current notices rather than silently rewriting a user's prior agreement |
| Shared legacy enums, schema constraints, migration files, old test records | Compatibility/history, not an active product claim | Preserve where required for history; update only current runtime expectations/tests with clear reasons |
| Missing competition contract / Section 22 | Referenced but unavailable | Do not fabricate; record this proposed spec's approval as its own authority |

### 2.6 Additional limits on what may be claimed

- Two-player first-place settlement is the initial runtime scope; broader formats remain excluded and activation-gated.
- All four current browser engines generate score locally; the Level 3 server flow is **PLANNED**, not retroactively present. RV-001 source audits establish what must move under live server authority.
- Fixed-step gameplay, canonical viewport and seeded PRNG remain useful. Live authority still cannot prove human input, prevent all bots/collusion or guarantee equal latency.
- RV-001 selects online state/scoring without end-of-run reconstruction. Cost, mobile controls and latency must be measured; particularly sensitive Dash remains blocked if it fails playability acceptance. No downgrade to plausibility-only prize settlement.
- Append-only history, safe integer boundaries and full lifecycle reconciliation remain acceptance requirements tied to settlement/session work, not a separate broad hardening project. Privileged database owners are outside an absolute immutability claim.
- No live-state restoration from input history is permitted. Restart/lease loss before trusted terminal records is infrastructure uncertainty, not a player forfeit or automatic opponent win.

### 2.7 Active replay dependency retirement inventory — audit only

The word replay in this subsection identifies code to retire or historical data to preserve. None is a Phase 6 evidence source or target subsystem. Classification is based on repository-wide source/import searches at the recorded baseline; safe deletion is conditional on replacing consumers, not permission to edit now.

| Inspected item | Classification | Future disposition / preservation boundary |
|---|---|---|
| `packages/server/src/validation/scoreValidator.ts`; calls in `competitions/lifecycleEngine.ts` and `matchmaking/matches.ts` | **Replace** | Replace gameplay replay, post-hoc headless execution, reconstructed-score comparison and freeze-frame verdict logic with RV-001 live server authority for candidate competitions and explicitly lower-trust casual checks. Keep all active modes functional or explicitly gated; no silent acceptance fallback for Coins/quiz/guest flows. |
| `packages/shared/src/replay.ts`, its exports in `shared/src/index.ts`; `games/replayAdapters.ts` and its `games/package.json` export | **Safe to delete after consumers replaced** | Remove driver, adapter registry, associated limits/errors/types and package export. Retain existing game engines for online authoritative play; no post-hoc reconstruction in the result checker or evidence CLI. |
| `games/{neon-runner,pixel-ninja-dash,space-blaster,cyber-hopper,speed-trivia,tf-sprint,sky-dodge}/replay.ts` | **Safe to delete after consumers replaced** | All seven adapters, including unregistered legacy Sky Dodge. Preserve gameplay engines and modules; do not require reconstruction for non-candidate games. |
| `games/*/index.ts` logging buffers/recordInput calls, `shared/src/gameModule.ts` InputLogEntry/GameOverPayload, `shared/src/matchmaking.ts` SubmitScorePayload | **Replace** | Remove input-log/wallMs collection and transport; retain actual controls, local gameplay, viewport rendering and minimal completion summary. Redefine verdict semantics and end reasons explicitly. |
| `client/src/game-loader/MatchLoader.tsx`, generic submission hook, result messages; `server/src/matchmaking/matches.ts` result/write fields | **Replace** | RV-001 live controls/snapshots and server-result contract with accurate authority wording; stop active trace writes and unsupported verification claims. Old client protocol receives a version error, not automatic trust. |
| `server/src/db/schema.ts` inputLogP1/inputLogP2; `drizzle/0003_matches_history.sql` input_log columns and stored records | **Database history to preserve** | Keep existing rows/columns and migration history intact; no new trace collection, no backfill/delete, no required reconstruction dependency. Mark historical semantics in read metadata. |
| `server/src/routes/matches.ts` historical inputLog response, `client/src/pages/ProfilePage.tsx` stale history shape, historical verdicts/reasons | **Historical compatibility only** | Audit consumers; retain read compatibility only where needed, minimize exposure, mark legacy schema/source. Never reinterpret an old verdict as passing the new policy or export traces in new evidence. Remove unused current client fields after checking consumers. |
| `scripts/score-validation-check.ts`, `input-validation-check.ts`, `competition-phase3-lifecycle-check.ts`, `matchmaking-check.ts`, `match-lifecycle-durability-check.ts`, `atomic-wager-lifecycle-check.ts` | **Tests to replace in affected portions** | Replace adapter-derived fixtures with versioned session/result acceptance/rejection cases; retain lifecycle, accounting, durability, authorization and atomic assertions. |
| `scripts/competition-phase4-ui-check.ts` | **Tests to replace in affected portions** | Assert honest result wording and new rejection states; retain entry/prize, sandbox and responsive checks. |
| `scripts/determinism-check.ts`, `canvas-render-check.ts` | **Tests to replace in affected portions** | Retire reconstruction-based assertions. Preserve useful PRNG, fixed-step scheduling and canvas finite-coordinate/gameplay checks without the retired driver; live server rule checks remain distinct from retired gameplay reconstruction. |
| `shared/src/fixedTimestepLoop.ts`, `rng.ts`, gameplay engine files/constants | **Preserve gameplay; replace stale comments** | Fixed-step local play, seeded generation and 1280×720 rendering remain. These are not evidence reconstruction components. |
| Admin eligibility explanations, legal/FAQ copy, AGENTS/CLAUDE/GAMES and dated progress/history | **Replace current claims; historical compatibility only for dated records** | Remove current authoritative-replay claims. Add superseded notices/pointers to historical accounts without changing old facts or deleting history. |

Migration completion requires import/dependency and text review across source, scripts, build exports, current docs and UI; no active runtime or evidence-tool dependency on retired files. RV-001 assigns Level 1 to legacy casual Coins/quiz paths; implement that scoped replacement before their shared checker is removed. They remain outside the four-game paid-candidate evidence matrix.

## 3. Phase 5.5 — Competition Runtime & Result Validation Hardening

**Selected engineering scope; PLANNED, NOT IMPLEMENTED.** The implementation-ready authority, protocol, timing/resource defaults, failure rules and schema design are in [RV-001](RESULT_VALIDATION_ARCHITECTURE.md). This replaces H1–H6 from v0.2.0; no implementation authorization is inferred from writing the decision.

| Work package | Scope and acceptance |
|---|---|
| P1 — real completion and secure sessions | Bind authenticated user/instance/game/build/attempt/nonce; capability gate before reserve/capture; single fenced owner and actual seed; real client/socket lifecycle integration |
| P2 — per-game live authority | Run existing four engines online at fixed 60 Hz/1280×720; validate current controls, own collisions/state/score, emit snapshots/results; implement RV-001 latency/resource/cap rules; no history reconstruction |
| P3 — trusted results and settlement | Add durable authoritative receipts and one terminal decision; settle/refund from server facts only via existing accounting; compare-and-set/idempotent recovery; preserve snapshots/history |
| P4 — replay retirement | Remove retired driver/adapters/logging/contracts after replacement; retain gameplay/PRNG/score rules; scoped Level 1 casual/quiz compatibility |
| P5 — Diamond retirement | Disable all new queue/create/rematch/purchase/stub/admin-grant/offer paths, preserve historical ledger/settlement/audit and authorized compensation |
| P6 — current docs/UI | Correct stake/rake/Diamond and retired verification wording; explain live server authority and limitations; preserve historical versions/agreements |
| P7 — required tests | RV-001 A1–A12 for every enabled game, all current canonical scripts, migration/DB safety/atomic checks, typecheck/builds, live-browser/mobile/network and measured capacity acceptance |

Required chain: actual game/control/completion → server validation/live terminal facts → authoritative result → participant/CompetitionInstance and VERIFYING where appropriate → single settlement/refund/void → actual terminal status. Server may complete even if the client withholds its final acknowledgement. Direct service tests alone are insufficient.

Every candidate requires Level 3, including freerolls with prizes. Model selection is resolved; implementation acceptance remains blocked for all four. A failed game stays disabled. No payment rails, gameplay redesign, tournament expansion, anti-bot product or distributed hosting platform is added. Reuse existing engines and accounting; benchmark first, revise scope explicitly if architecture/cost/latency cannot meet the decision. No runtime tests/builds are run in this planning task.

## 4. D1 — Technical/legal-review dossier

Outputs: `dossier/dossier.md` as the reviewable source and `dossier/dossier.pdf` as its version-matched rendered copy. JSON evidence, not PDF/screenshots, remains the machine-verifiable source. The PDF must be visually checked before Gate T. Every material factual claim cites source commit/path/symbol and at least one evidence ID, or is visibly labeled **PLANNED / NOT VERIFIED / LIMITATION**. Each section below is mandatory; a genuinely inapplicable subsection states why and who reviewed that classification.

| # | Section | Required explanation and evidence |
|---|---|---|
| 1 | Product overview | Current sandbox purpose, boundaries, environments, version and operator placeholders |
| 2 | Competition model | Template/instance/participant/prize entities; supported runtime profile versus future types |
| 3 | Player journey | Guest browse → sign-in → terms/entry → wait → play → authoritative result; links to runtime evidence |
| 4 | Competition creation authority | Admin RBAC/platform ownership; reject player-created monetary terms |
| 5 | Entry-fee architecture | Integer entry value, reservation timing, sufficient-balance checks, no arbitrary player stake |
| 6 | Predetermined-prize architecture | Prize schedule fixed before entry and copied into instance |
| 7 | Entry versus prize | Independent properties; standard/promo/free counterexamples to a fixed pot/rake invariant |
| 8 | Free/casual Coins | Free points, no redemption/withdrawal/conversion; keep casual/social flow distinct |
| 9 | Sandbox GEL | Simulated funds only; funding labels and zero external monetary rails |
| 10 | Diamond retirement | Backend rejection evidence and retained historical reads, not just absent UI |
| 11 | Competition lifecycle | State/ownership transitions and terminal protections demonstrated through real handlers |
| 12 | Cancellation and voids | Pending release versus captured refund; who may initiate, race/duplicate handling |
| 13 | Forfeits | Exact trigger and legitimate-opponent conditions; disconnect is a server policy event, not proof of cheating |
| 14 | Ties | Two equal authoritative server results → VOIDED/draw + full refund; no fee/prize |
| 15 | Rematches | New instance/reservation at current platform terms; old snapshot/evidence unchanged |
| 16 | Guest/friend restrictions | Guests browse but do not enter competitions; friend/guest casual matches are free; no money challenges |
| 17 | Gameplay architecture | Existing local engines, canonical viewport, fixed-step play and supported builds; distinguish browser claims from server-owned facts |
| 18 | Seeded PRNG | Algorithms/streams used per game; gameplay versus cosmetic randomness; source references |
| 19 | Server-issued configuration | Seed/configuration origin, version, session binding and intended shared conditions; no proof that an altered client used them |
| 20 | Submission/session contract | Authenticated user/seat, server-issued match/attempt, nonce binding, schema, size limits, receipt times and expiry; no action history |
| 21 | Result authority | RV-001 Level 3 live state/scoring, session/control validation and durable server receipts; client claims cannot grant points |
| 22 | Integrity limits | Server authority versus legal-input bots, collusion, latency and trusted-host compromise; implemented acceptance/capacity status for each game |
| 23 | Accounting architecture | Port/adapter separation, accounts, signed double-entry journal and exact minor units |
| 24 | Reservations | Available→reserved movement, idempotency and balance checks |
| 25 | Captures | Reserved→escrow on lock, atomicity/compensation and duplicate prevention |
| 26 | Settlement | Snapshotted prize recipients, result authority, escrow/subsidy/fee entries |
| 27 | Refunds | Full captured-entry return or reserved release; compensating entries preserve history |
| 28 | Promotional subsidies | Prize can exceed entries; identifiable simulated promotions source |
| 29 | Freerolls | Zero entry/reservation amount independent of positive predetermined prize; simulated sponsorship only |
| 30 | Idempotency/concurrency | Operation/entity identity, repeated and concurrent attempts, locks, retry after restart |
| 31 | Audit logging | Actor pseudonym, permission, action, reason, target, time, idempotency and result links |
| 32 | Admin controls | Read versus mutation permissions, template versions, cancellation/void/grant controls and rejected actions |
| 33 | Data retention/evidence | Internal/reviewer/submission separation, minimization, access and retention decisions |
| 34 | Known limitations | Unsupported formats, client timing trust, infrastructure limits, legal unknowns, failed/unverified checks |
| 35 | Architecture diagrams | Entity/snapshot diagram; runtime state sequence; session/result decision flow; accounting flow; trust/data/export boundaries |
| 36 | Evidence index | Claim→source→scenario→artifact→check result→reviewer mapping, including exclusions and failures |

**Required architecture wording:** Fugluck's candidate engines use seeded pseudo-random generation. Under selected RV-001, live server state determines score-bearing transitions, collisions and outcomes; the client renders and sends current controls. This Level 3 flow is PLANNED until implemented and accepted. It does not prove human input, perfect network fairness, legal classification or freedom from all cheating. The seed does not select a winner.

## 5. D2 — RESULT VALIDATION & COMPETITION INTEGRITY EVIDENCE

### 5.1 Selected authority and evidence boundary

[RV-001](RESULT_VALIDATION_ARCHITECTURE.md) is the selected design: **Level 3 live server-authoritative scoring/state for Space Blaster, Pixel Ninja Dash, Cyber Hopper and Neon Runner**. Seeded local rendering/gameplay utilities remain; client reports, nonces and plausibility bounds alone never authorize a prize. The v0.2.0 option to accept plausible reports for sandbox prize competitions is superseded.

Server owns the current ship/bullet/asteroid/collision state for Blaster; course/distance/stumble/gate/finish state for Dash; grid/hazard/round/collision state for Hopper; and obstacle/jump/slide/distance/collision state for Runner. Only live server transitions award points. Clients send current control intent, display snapshots and acknowledge results; they do not send authoritative achievements or ordered histories for later reconstruction.

Read RV-001 sections 4–7 for exact controls, server context/nonce/epoch, clocks/deadlines, duplicate semantics, client prediction limits, failure policies, settlement invariant and additive schema. The four games remain **blocked on implementation/acceptance**, not on choosing a validation model. Required capacity/latency checks may keep individual games disabled; no lower-trust monetary fallback.

This evidence proves the trusted server's control validation, score/state ownership and accounting decisions were exercised. It does not independently reconstruct gameplay, prove human input or certify absence of bots/network advantage/server compromise. New proof must not reinterpret historical verdicts as Level 3.

### 5.2 Per-game evidence requirements

| Game | Required Level 3 facts | Adversarial proof and limitation |
|---|---|---|
| Space Blaster | Live ship motion/clamps, fire cooldown, asteroid/bullet state, collisions, kill/survival increments, terminal score | Invented hits/kills/positions and plausible fabricated final scores cannot change server score. Legal-input aim bots remain possible; entity cost measured |
| Pixel Ninja Dash | Live course/gates, elapsed/distance, stumble, perfect/good/miss decisions, finish/timeout and bonus | Client gate classifications/timestamps/early finish cannot award points; no backdating. 80/180 ms windows require latency/mobile acceptance |
| Cyber Hopper | Live grid/hazards, direction ordering, max-row/round awards and collisions | Fabricated crossings/rounds and duplicate pulses cannot create points; preserve no-hop-cooldown rules; automation remains possible |
| Neon Runner | Live spawns/jump/slide/collision, speed/distance and floor(distance/8) score | Waiting then reporting believable survival cannot alter server result. Seed-aware legal-input bots remain possible |

Server PRNG/score rules remain deterministic; no input log, rewind or end-of-run reconstruction package exists. Independent arithmetic checks concern server facts and ledger totals, not reproducing the player's run.

### 5.3 Evidence package and durable facts

Each `results/<package-id>/` contains:

```text
manifest.json                 # identity, source/build/rules/protocol/policy versions, hashes
context.json                  # server-owned instance/match/attempt/config/authority context
claims.jsonl                  # optional bounded redacted final claims and rejection receipts
authoritative-results.json    # server scores, terminal causes/ticks, aggregates and provenance
decisions.jsonl               # authorization/check outcomes, forfeit/system/terminal decisions
lifecycle.jsonl               # server transitions and result/decision/accounting references
health-summary.json           # timing/lease/lag/control counts; no raw control trace
outcome.json                   # actual winner/tie/forfeit/void and ledger references
verify.json                   # schema/provenance/arithmetic/reference checks
summary.md
checksums.sha256
supplementary/                # sanitized screenshots/video; never substitute for server facts
```

Minimum fields: immutable evidence/package/scenario/run IDs; UTC generation/receipt times and local/staging provenance; source/build/game/rules/skill-assessment/protocol/authority-policy versions; migration and tool versions; pseudonymous users/seats/instance/match/attempt IDs; snapshotted terms/config/seed; required/achieved authority level; owner/connection epochs and nonce-binding audit reference without bearer secret; authoritative start/deadline/final tick/duration; server score, end reason and aggregates; separate optional claimed score; each check pass/fail/not_evaluated/unavailable and reason; health/lag/lease summary; state changes; terminal decision ID and settlement/refund references; file sizes/hashes and checking procedure.

Persist immutable result and terminal decision receipts before successful outcome/settlement claims. A lost active engine is never recreated from a receipt or input history. No per-tick state trace, command sequence or gameplay reconstruction data is required or exported. Owner/nonce-control metadata is distinct from immutable result/history records. Bounded denied-request records omit arbitrary payloads and credentials.

Independent reviewer checks validate pinned source/authority design, record linkage, state/health/owner consistency, final aggregate score arithmetic where meaningful, terminal policy and exact ledger conservation. Real-handler/browser/adversarial checks demonstrate live execution; a JSON package alone does not attest an honest server. Hashes establish byte integrity against retained provenance, not authorship or legal validity.

## 6. Result-validation evidence matrix

V01–V13 are mandatory for **each of the four candidates** under RV-001 Level 3; no new results exist yet. Quiz games remain excluded from paid-candidate evidence but retain eligibility/casual regression coverage.

| ID | Case | Required evidence / acceptance |
|---|---|---|
| V01 | Valid live completion | Real client, authenticated controls and owner session lead to a durable authoritative server result; score/state never adopted from browser |
| V02 | Impossible and plausible fabricated results | Malformed/impossible numeric claims reject; plausible but false claims/hits/checkpoints cannot change live score. Mismatched client display is not automatic forfeiture of a sound server run |
| V03 | Impossible timing and server clock | Pre-start/post-expiry controls, client clock manipulation and excess command frequency cannot advance extra ticks or backdate events; server lag/clock failure follows system policy |
| V04 | Invalid session/controller | Wrong identity/nonce/instance/game/version, stale epoch/owner or simultaneous old controller rejects without affecting another attempt |
| V05 | Duplicates/conflicts | Duplicate control seq applies once; exact result retry returns original receipt; conflicting/new identities cannot overwrite or create another economic effect |
| V06 | Malformed/oversized result/control | Strict schemas/bounds/rate checks; no secret or input-history retention; rejected packets do not consume others' result authority |
| V07 | Late/withheld acknowledgement | No post-terminal mutation; expired attempt rejects new play; server can finish and settle without client acknowledgement; retries/readback return existing result |
| V08 | Winner/loser settlement | Two authoritative unequal scores, correct seats and snapshot prize, single accounting effect and correct UI |
| V09 | Tie | Equal authoritative scores → VOIDED/draw/full refund/no prize or fee; missing/rejected is not invented zero |
| V10 | Forfeit/disconnect | Explicit forfeit and healthy isolated-client grace rules; current-state resume; no pause/new attempt; both-disconnected/infrastructure uncertainty never invents winner |
| V11 | Cancellation/system void | Pending release versus captured refund; permission/state/race checks, no terminal resurrection |
| V12 | Settlement once/recovery | Completion/cancel/void/forfeit races converge; restart after committed decision retries same effect; lost active state without trusted final facts voids/refunds |
| V13 | Authority, limits and retirement | Modified browser physics/rendering cannot award points; legal-input automation not falsely claimed prevented; load/mobile/network gates pass; no active reconstruction dependency |

Use actual socket/router/live-owner/lifecycle boundaries for mandatory categories and browser runs for V01/V08. Synthetic negative packets are explicitly labeled. Test both seats, current authority health, no-ack finalization, ownership fencing and the full failure policy in RV-001. Unit arithmetic tests supplement real runtime proof. Repeat evidence policy/arithmetic checks on stored server facts only; do not regenerate a gameplay trajectory.

## 7. D3 — Ledger reconciliation package contract

Each `accounting/<package-id>/` contains `manifest.json`, `scenario.json`, `opening-balances.json`, `operations.jsonl`, `ledger.jsonl`, `reservations.json`, `settlements.json`, `closing-balances.json`, `reconciliation.json`, `audit.jsonl`, `reproduce.json`, `summary.md`, and `checksums.sha256`. JSON is authoritative; an optional CSV is a presentation derivative with its own digest. Opening and closing database reads must use a consistent snapshot or a quiescent isolated fixture. Paginated admin UI output alone is not a complete export.

Minimum ledger fields: evidence/source row reference, accountingReferenceId, idempotencyKey/reference, pseudonymous user/account, instance, eventType, currency, signed integer amountMinor, balanceType, createdAt. Include all counterpart accounts (treasury, promotions, escrow, fees), not only player rows. Preserve foreign-key/reference relationships in redacted views. Operation records include actor/role, normalized requested amount, idempotency identity, attempt/order, result/error, persisted row IDs and before/after record counts/hashes. Audit records include reason, permission and outcome for allowed and denied admin scenarios without credentials.

All arithmetic is exact integer minor units; GEL uses scale 2 for display only. Money inputs must fit declared supported bounds, and totals must not overflow PostgreSQL/JavaScript integer ranges. The verifier must reject fractional, non-finite or out-of-range values. Never round a fractional submission into an accepted amount. No floating-point monetary calculations; decimal display strings are not computation inputs.

### 7.1 Mandatory reconciliation checks

1. **Posting group:** signed amounts sum to zero for every accountingReferenceId, currency and operation; expected counterparty/event types exist. A global zero cannot hide two offsetting bad operations.
2. **Account roll-forward:** opening balance + signed postings = closing balance for each account/currency. Reconcile user AVAILABLE/RESERVED subbalances to reservation state. Do not require all account balances to be zero or all platform funding accounts to be non-negative.
3. **Instance lifecycle:** independently reconcile reservation amount/status, captures, actual refunds/releases, predetermined awards, fee and subsidy to the final instance/settlement. Sum escrow across relevant balance categories; do not mistake a historical CAPTURED category value for unspent escrow after settlement.
4. **Terminal state:** no stranded player reservation or spendable competition escrow after settlement/cancel/void. A pending case must explicitly explain remaining reserved balances.
5. **System:** all signed journal entries for the isolated test dataset/currency sum to zero; opening system state and extraction boundary are recorded. A limited staging extract cannot prove the entire staging system balanced without a complete consistent snapshot.
6. **Idempotency/concurrency:** repeated reserve/capture/release/refund/settle has one economic effect; compare unique postings and balances, not response success alone. Record expected state errors for incompatible operations and detect double spending under concurrent insufficient-balance attempts.
7. **History preservation:** hashes of pre-existing rows remain unchanged; cancellations/refunds are linked compensating rows. Prove application and restricted-role append-only boundaries separately from elevated migration/test-owner permissions.
8. **Failure detection:** a deliberately imbalanced disposable fixture or corrupted exported copy fails verification with nonzero discrepancy and a named failed invariant. Never alter a live/staging ledger to manufacture this case.

For the **current settled adapter**, measure `captured + subsidy = awarded prizes + retained margin` as a conservation identity, not a prize-setting rule. Prize amounts originate from the immutable schedule. Standard, promotional and freeroll evidence must disprove a universal `collected entries = prize + fee` requirement. For refunded/cancelled/pending instances use the corresponding roll-forward and compensation equations, not a settled-only formula. Independent verifier calculations must be compared with adapter summaries and settlement records; explain or fix any mismatch before passing.

## 8. Accounting evidence matrix

All numbers below are integer minor units in the machine files. Display examples are explicitly TEST GEL. Fixtures are isolated; initial grants and opening balances are declared. Shared tests must not erase unrelated data.

| ID | Scenario | Concrete inputs and expected economic result |
|---|---|---|
| A01 | Funding and available balance | Grant player A 1000 with counterposting treasury -1000; available +1000, reserved 0; same grant identity retried without duplicate funding. Also verify fractional/negative/non-finite/out-of-range input rejection. |
| A02 | Standard runtime | Two entries of 500 (TEST ₾5 each); predetermined prize 900 (TEST ₾9). Reserve/capture 1000; award 900; current adapter retained margin 100; subsidy 0. If each starts at 1000, winner ends 1400 and loser 500; reserved/escrow cleared. |
| A03 | Promotional runtime | Two entries of 500; prize 2000 (TEST ₾20). Captured 1000; promotions source -1000; award 2000; margin 0. Starting at 1000 each yields winner 2500, loser 500. |
| A04 | Freeroll / simulated sponsor source | Two zero-cost entries with prize 1000 (TEST ₾10). No user entry debit; promotions funding 1000; winner +1000; loser unchanged; margin 0. Record whether zero-value reservation rows are stored or omitted. This is not proof of a sponsor contract or external funding. |
| A05 | Pending cancellation | A enters at 500; before lock: available -500, reserved +500. Owner cancellation restores 500 to available, reserved 0, no capture/fee/prize; instance CANCELLED. Repeat release/cancellation has no extra credit. |
| A06 | System/admin void | Both 500 entries captured; an authorized system/admin void refunds 500 to each, no fee/prize/subsidy, escrow cleared and instance VOIDED. Repeat refund no-op; audit reason retained. |
| A07 | Forfeit | Supported head-to-head 500/500/900 terms; trigger actual authorized forfeit/disconnect policy and record trigger/deadline/other player's validation state. Legitimate opponent receives the predetermined 900 only where the approved rule permits; forfeiter 0; margin 100. An opponent without sound server authority cannot receive an inferred prize; a rejected client claim alone does not invalidate a healthy live result. Evidence links authoritative decision and posting. |
| A08 | Exact authoritative-score tie | Two authoritative equal scores with 500 entries; instance VOIDED, history draw, full 500 refund each, fee/prize/subsidy 0. Include zero-score versus missing/untrusted result distinction. |
| A09 | Idempotent retry matrix | Separately repeat reserve, capture, release, refund and settle at least twice under same operation identity, then retry same entity/terminal effect with a new request identity. One economic effect; cross-state requests reject or return existing state. Include same-key changed-payload conflict and post-restart retry. |
| A10 | Concurrency and failure recovery | Insufficient aggregate balance across parallel entry attempts; duplicate settlement triggers; cancellation racing lock; void racing settlement; failure between evidence/accounting/state writes and recovery. No overdraft, double settlement, false terminal success, missing successful-operation evidence or stranded funds. |
| A11 | Snapshot and rematch | Edit future template prize/entry after instance creation; old terms/prizes/evidence remain unchanged. A rematch creates a distinct instance and reservation from currently enabled platform terms; original postings never reused. |
| A12 | Authorization and currency separation | Guests/unrelated users cannot enter or cancel others' instances; forged entry/prize ignored/rejected; Coin conversion and Diamond queue/grant/purchase blocked; quiz paid entry blocked; unauthorized admin mutation denied and logged. No forbidden ledger changes. |
| A13 | Multiple placements, adapter-only | Captured 1000; prizes 600 and 300; margin 100. Exercise CompetitionAccountingPort/adapter on disposable fixtures and verify independence of schedule. Explicitly `evidenceLevel: accounting-service`; not proof of live multi-placement runtime support. |
| A14 | History preservation and negative control | Snapshot existing synthetic legacy Coin/Diamond history and immutable journal rows before cases; exact original row hashes preserved afterward. Verify restricted-role update/delete rejection and detect intentionally corrupt exported evidence. |
| A15 | Restart/orphan recovery | Controlled local restart with pending reservation and separately locked/active/verifying captured entries; release/refund according to recorded recovery rule, repeat recovery idempotently, no invented winner or lost evidence. |

A02–A08 and A11 require the real runtime path after H, with A06 using the authorized admin/system boundary. A01/A09/A10/A12/A14/A15 exercise relevant real boundaries; extra service tests may supplement them. At minimum demonstrate standard, promo and freeroll runtime settlement for **each of the four candidate games**; cross-cutting admin/concurrency/accounting cases may use one representative game with justification in the index. V09 ties and relevant validation failures remain mandatory per game. A13 is the sole explicitly adapter-only positive prize-format example. Sponsored external receipt handling and expanded tournament formats are N/A by approved scope, not implied passes.

## 9. D4 — Technical review / submission-readiness bundle

Proposed final structure; directories below are **not created in this task**:

```text
regulatory-evidence/<release-version>/<bundle-id>/
  README.md
  manifest.json
  environment-version.json
  evidence-index.json
  evidence-index.md
  dossier/dossier.md
  dossier/dossier.pdf
  diagrams/                   # versioned Mermaid source plus rendered SVG/PDF
  results/<package-id>/...
  accounting/<package-id>/...
  templates/                  # standard/promo/free snapshots, history/version references
  instances/                  # immutable terms plus explicit lifecycle/decision snapshots
  admin-audit/                # pseudonymous permission/audit examples, denied cases
  test-reports/               # commands, exact counts, exits, sanitized logs and coverage map
  verification/              # independent policy/reconciliation/completeness reports
  known-limitations.md
  filing-readiness.md         # unresolved target fields and required-document register
  review-record.md            # named internal reviewers, scope, dates, decisions
  checksums.sha256
```

`README.md` states environment, sandbox-only scope, evidence level, preparation purpose and gate status. The evidence index maps every dossier claim and mandatory scenario to file/record IDs, source references, expected/actual result, evidence level, status (`PASS`, `FAIL`, `BLOCKED`, `NOT_RUN`, `N/A`) and reviewer. N/A requires an approved scope exclusion and reason; no silent omissions. Known failures and limitations travel with the bundle.

### 9.1 Proposed implementation surface (after separate approval)

Use repository scripts/CLI plus Markdown/JSON evidence; **no new admin UI or public export API is required for Phase 6**. Reuse existing accounting/read services and the approved result-policy checks; evidence verification must not execute gameplay engines. Generate scenarios only against the existing guarded disposable-test-database workflow; export artifacts before authorized fixture cleanup. Evidence reads use a consistent snapshot/read-only role. Scenario generation is deliberately distinct from read-only extraction.

Planned commands, **not existing runnable commands today**:

| Proposed script | Contract |
|---|---|
| `npm run evidence:generate -- --profile phase6 --output <local-path>` | Guarded synthetic local runtime scenarios; requires explicitly configured disposable DB via process environment; refuses production/unverified targets; no external upload |
| `npm run evidence:export -- --run-id <id> --output <local-path>` | Read-only extraction of durable evidence for the selected run; completeness/snapshot checks; no mutation or automatic fixture seeding |
| `npm run evidence:verify -- --bundle <local-path>` | Schema/hash/reference checks; authority-provenance/state/policy checks over server records and separate client claims; independent integer reconciliation; nonzero exit for mismatches/incomplete mandatory evidence |
| `npm run evidence:redact -- --bundle <internal-path> --output <reviewer-path>` | Allowlisted transformation, stable per-bundle pseudonyms, secret/PII scan, regeneration of hashes and reviewer manifest; never overwrites internal originals |

Do not pass connection strings, passwords or tokens as command-line arguments or write them to manifests/logs. The staging extractor, if ever required, needs a separately approved dataset/recipient scope and read-only access; the generator is never pointed at staging by default. No command submits a package. These script names/interfaces can be finalized during implementation without changing evidence requirements; deviations must be recorded.

### 9.2 Independent rerun procedure

1. Obtain the approved source revision or authorized source/build archive from the manifest and verify its digest. Do not assume source may be shared publicly. Missing reviewer source/build access is a reproducibility blocker.
2. Use the recorded runtime version/platform and lockfile; set up an isolated environment without production/staging credentials. Follow the recorded dependency-install procedure. Pin a container digest if used; do not rely on a mutable tag.
3. Verify checksums before interpreting artifacts; reject unexpected files/unsafe paths. Schema-validate bounded JSON, references, candidate/game/configuration versions and evidence completeness.
4. Check authoritative result provenance, owner/session/version references, aggregate arithmetic, state order, unique decisions and RV-001 failure/deadline policy from recorded facts. Mark authentication/observations not independently observable rather than inventing proof. No gameplay reconstruction in the evidence tool.
5. Independently calculate posting-group, account, instance and system totals from raw ledger rows and declared opening balances. Compare required discrepancies to zero and terminal effects to one.
6. Produce a fresh verification report referencing original package hashes, tool version and actual results; never edit originals to turn failure into success. Separately regenerating runtime scenarios creates new IDs/nonces/timestamps and demonstrates the handlers again; it is not reconstruction of an earlier game.

## 10. Evidence integrity and versioning

- Each dataset, package, evidence record and bundle has an immutable UUID/reference. A changed artifact creates a new package/bundle and `supersedes` link; package IDs are never reused. Monetary amounts, accepted result summaries, decision observations and their ordered state transitions are preserved exactly.
- Each manifest carries schema/package version, source commit, dirty-worktree state, game-build/result-policy/tool hashes, dependency lock hash, applied migration journal and file digests, generation time in UTC, environment class, dataset provenance, tools and scenario profile version. Gate T requires a clean pinned source/build; the application version `0.0.1` alone is insufficient. Environment config is an allowlist of relevant nonsecret flags, not an environment dump, host credential or database URL.
- Encode JSON as UTF-8 with LF, lexically sorted object keys and preserved array order; avoid lossy numbers. Specify the serializer/version, timestamp representation and byte lengths. Hash **exact file bytes**, not pretty-printed reconstructions. Deterministic result comparisons exclude volatile UUIDs, execution time and generation timestamps but never omit economic or result-decision fields.
- `manifest.json` hashes payload files, not itself. Detached `checksums.sha256` covers the manifest and all payloads, excludes itself, and is sorted by relative path. Store the checksum-file/root archive digest in a separate internal release receipt; if zipped, record the archive digest outside the archive. No circular self-hash. Redacted bundles get their own manifests/digests.
- SHA-256 detects content changes relative to a trusted retained digest; it is not proof of original server execution, author identity or a legal signature. Record who captured/extracted/reviewed the data, provenance and handoffs in a protected internal receipt. Required official signatures remain TBD.
- Increment schema version for incompatible field/semantic changes; increment artifact package version for content or editorial changes. Every emitted package gets a fresh ID even for a patch. Record parent source/manifest digests internally and sanitized provenance in reviewer packages.
- Changes to game scoring/configuration, live authority/protocol policy, ownership/fencing, clock/deadline tolerances, gameplay timestep/viewport, outcome/forfeit rules, snapshots, accounting, permissions, active currency boundaries, migrations, or evidence tooling invalidate affected proofs for the **new release**. Old proofs remain evidence only for their original revision. Regenerate affected matrices and cross-cutting regression evidence; a scope/eligibility change requires a revised profile and approval. A wording-only fix still creates a new bundle/hash but may cite unchanged machine proofs.
- Failed, superseded and revoked packages are retained with their status and reason; never edited into a pass or silently replaced. Discovering compromised/incomplete proof revokes affected readiness status and stops sharing until regenerated and reviewed.

## 11. Data minimization, redaction, sharing, and retention

### 11.1 Three distinct collections

| Collection | Default contents/access | Sharing rule |
|---|---|---|
| Internal source evidence | Synthetic/local raw proof, restricted provenance receipts, test outputs, optional separately authorized pseudonym mapping; technical team/custodian only | No automatic external access |
| Reviewer package | Minimum reproducible allowlisted JSON, pseudonymous actor/participant references, sanitized diagrams/summaries and source/build access as approved | Human checks exact recipients, contents and digest before separate external authorization |
| Actual regulatory submission | A specifically approved reviewer package plus only the authority/process documents/signatures later confirmed | Not generated or submitted merely because Gate T passed; Gate F and separate Gate X authorization required |

Default evidence uses isolated synthetic accounts, synthetic identities and test funds. Do not automatically reuse or disclose staging users, admin records, live result/session records, source code, internal URLs or screenshots. Existing staging catalog screenshots can be supplementary only after review of their actual contents and sharing scope. Production data is excluded.

Never include passwords, cookies, JWTs, bearer/API tokens, reset/verification links, database credentials, admin session secrets or complete browser/network/environment dumps in **any** evidence package. Never include saved-account/password-manager suggestions. Avoid emails, real names, IP addresses, user agents and free-form reasons unless a separately justified field is necessary; defaults omit them. Sanitize audit descriptions that embed IDs and structured error/log fields, not just screenshots. Result summaries, timing and aggregate counters can still be identifying; synthetic data is the default even after pseudonymization.

Assign random package-scoped aliases such as `player-a` and `operator-1`, consistently across artifacts. Do not use a plain hash of an email as anonymity. Keep any source-to-alias mapping separate, access-controlled, unexported and subject to retention. Pseudonymization is not a claim of anonymization. IDs needed for cross-file reproducibility are aliases with an internal provenance link; nonsecret configuration, result values and timing relationships needed to check decisions remain exact. If redaction would alter policy/arithmetic semantics, regenerate from synthetic evidence instead of falsifying the proof.

An automated allowlist/secret scan and a human review of JSON, text, images, logs, archive names and metadata are mandatory before Gate T. Scanner failures block packaging. Reviewer files receive fresh hashes and are independently policy-checked/reconciled **after redaction**. Record omissions/transforms; no claim that redacted bytes are identical to raw originals.

### 11.2 Proposed engineering retention defaults — subject to approval, not statutory claims

| Material | Proposed retention / disposal rule |
|---|---|
| Working synthetic raw runs and failed-generation scratch artifacts | Retain through technical review, then at most 90 days after acceptance/abandonment unless linked to an active investigation; custodian approves deletion and records it |
| Accepted internal proof and redacted reviewer bundles | Keep while the referenced release/review is active, then 12 months after supersession/closure; review expiry before deletion; no automatic purge during review/dispute/hold |
| Pseudonym mapping for exceptionally approved real data | Do not collect by default; custodian records necessity and explicit expiry before collection, normally no longer than the review requiring it |
| Rejected/superseded official review versions | Retain the original bytes, status and reason under the accepted-bundle schedule; do not overwrite |
| Actual filing correspondence/artifacts | Retention **TBD by legal reviewer and confirmed process**; no invented deadline or automatic deletion |
| Application ledger/history/policy acceptance records | Outside this artifact-retention policy; never delete/mutate them to clean up evidence or retire Diamonds |

All defaults require named custodian approval at Gate S. Storage must have restricted access, encrypted storage/transport where used, separate internal/reviewer locations, and an access/change record. No public repository or anonymous upload is the default evidence store. This specification does not configure storage, retention jobs, legal holds, credentials or permissions.

## 12. Filing-target placeholders and decision log

These are unresolved facts, not research conclusions or official requirements. The dossier title does not prove that a particular Revenue Service process applies. No artifact above is represented as mandated by a Georgian authority.

| Field | Current value / owner action |
|---|---|
| Jurisdiction | **Georgia — to be confirmed against the actual intended filing/classification process** |
| Authority and process | TBD: confirm competent authority, exact review/classification procedure and purpose |
| Applicant legal entity | TBD: legal name, registration and authorized representative; never infer from repository/account names |
| Legal reviewer | TBD: responsible counsel/reviewer and review scope |
| Submission language | TBD: original/translation requirements and translation reviewer |
| Official form/template | TBD: obtain actual form/checklist and record authoritative source URL, version/date and applicability |
| Required signatures | TBD: signatories, signature method, authorization and any attestation text |
| Submission channel | TBD: portal/address/recipient; verify independently before any transmission |
| Supporting documents | TBD: process-specific corporate/legal/game/technical materials and evidentiary requirements |
| Legal classification/approval | **No determination provided; no claim made** |

Each resolved item needs evidence/source, decision date, responsible person and package version affected. If legal research is commissioned later, use authoritative current sources and distinguish requirements from recommendations. Unresolved filing fields block Gate F but need not prevent approving a technical-only implementation scope.

Approval decisions still needed: accept this proposed H and Phase 6 scope; name approver/reviewer/custodian; accept the local synthetic CLI/JSON/Markdown/PDF approach, matrix, supported runtime boundary, RV-001 live authority/resource/timing defaults, per-game acceptance requirements and retention defaults; confirm the filing placeholders before Gate F. If the frozen contract appears, review it before Gate H implementation begins. Approval here is not approval to share staging data or deploy.

## 13. Acceptance checklist and work order

### 13.1 This specification task

- [x] Objective and legal-claim boundary defined.
- [x] Four deliverables have content, formats and package structure.
- [x] Four-game result-validation matrix and concrete accounting matrix defined.
- [x] Reproduction, integrity, redaction, retention and versioning rules proposed.
- [x] Each audited gap classified; Phase 5.5 requirements and acceptance criteria explicit.
- [x] Unsupported runtime claims and evidence-level limits identified.
- [x] Filing-specific unknowns preserved; Section 22 absence stated accurately.
- [x] Prior audit preserved; no runtime repair, evidence generation, payment integration or submission performed.
- [ ] User approves this version and names owners — pending, not implied by authoring.

### 13.2 Future implementation order and definition of done

1. Approve Gate S, then separately authorize H implementation on a feature branch. Preserve all user invariants and the current historical baseline.
2. Implement P1–P7 and RV-001 and demonstrate Gate H with actual runtime, persistence and negative-path evidence. No real-money rails or unsupported format expansion.
3. Implement Phase 6 CLI schemas/extraction/redaction/verifiers and D1–D4 documents using recorded result decisions and existing accounting. Include artifact-schema/hash-corruption, identity/reference, policy-boundary checks, integer reconciliation, redaction leakage, unsafe-target, and reproducibility regression checks. Run the full then-current canonical validation suite; report exact per-script counts and versions.
4. Generate isolated local synthetic proof through real handlers; retain raw records; build and verify the redacted reviewer bundle. Run required desktop/mobile UI checks for relevant journey states without account identifiers. Add controlled staging evidence only if separately authorized and necessary.
5. Technical reviewer verifies **every mandatory matrix row** and dossier claim mapping, source/migration/build pinning, independent policy checks/reconciliation, history preservation, no leaked secrets and no unresolved critical contradiction. Review rendered PDF/diagrams for readability. Gate T fails if required runtime evidence is absent even if unit tests pass.
6. Resolve filing placeholders and confirm the dossier/readiness checklist with the named legal reviewer for Gate F. Record unresolved legal judgments without claiming approval. No real submission occurs in Phase 6.

No runtime/schema/migration/test file was changed while preparing this proposal. Only this specification, RV-001 decision document and the PROGRESS.md handoff are part of this planning task. Phase 5.5, Phase 6 implementation, Phase 7, merges, deployment and regulator submission remain unstarted.
