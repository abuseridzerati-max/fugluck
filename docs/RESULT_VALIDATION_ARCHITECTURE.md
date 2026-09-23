# Fugluck — Non-Replay Result Validation Architecture

Decision: RV-001, version 1.0.0, 2026-09-23.

**USER-APPROVED ARCHITECTURE — implementation acceptance pending.** The user's Phase 5.5A request approves RV-001 and authorizes incremental implementation of the common authority foundation and Space Blaster reference only. Other game migrations, replay deletion, Diamond retirement, deployment, Phase 6 evidence generation and Phase 7 are excluded from that step. Runtime acceptance and monetary activation are not approved by this architecture decision.

Source baseline: `2cbc429caed07dc4e8ece05bbb4662fb27667018`. Source/code review only; no new runtime tests, capacity benchmark or browser trial. Supersedes the open plausibility-only selection in Phase 6 v0.2.0. [Phase 6 specification](PHASE_6_REVENUE_SERVICE_DOSSIER.md) v0.3.0 adopts this decision.

## 1. Decision and reasons

**Select Level 3, live server-authoritative gameplay state and scoring, for all four current competition candidates:** Space Blaster, Pixel Ninja Dash, Cyber Hopper and Neon Runner. The server owns the actual evolving scoring/collision state, processes live control intentions, and produces terminal results. The browser renders and captures controls. A client result is a claim/acknowledgement, never a source of authoritative score.

These games already have bounded fixed-step `update()` logic separated from browser input/render orchestration. Their engines are presently imported by the server's old checker. Reusing this logic continuously during play is a practical candidate; production cost and latency suitability remain acceptance gates, not measured facts. No alternative score formula or second game engine is required.

Hybrid event checking was considered but not selected for these four games: a hit requires bullet/asteroid and ship state; a gate award requires current distance/stumble and dash timing; a crossing award requires position and collision state; survival points require actual alive state. Merely checking a claimed event against a known seed, count or timing window leaves the core achievement untrusted. Once those dependencies are server-owned, the chosen design is Level 3.

Replay remains retired. **Live execution is expressly different from reconstruction:** one state advances as events arrive during the active session; no persisted input sequence, no end-of-run simulation, no rollback/rewind, no input-history resend and no reconstruction after restart. A server process loss without a durable terminal decision leads to system void/refund. Running authoritative game logic without a canvas is allowed; a post-hoc headless replay validator is not.

## 2. Models evaluated against this repository

Estimates below are relative engineering judgments from source, not benchmark results or legal/payment approval.

| Dimension | A — plausibility only | B — live server authority (selected) | C — hybrid event verification |
|---|---|---|---|
| Security strength | Rejects malformed/impossible values; believable lies survive | Server owns all score-bearing state and terminal conditions | Strong only for events whose full prerequisites are independently server-known |
| Fabricated scores | Weak: valid session can submit invented in-range score | Claim cannot alter server score; comparison rejects mismatches | Weak if hits/checkpoints are self-asserted; strong only with independent event authority |
| Modified clients | Can fabricate plausible duration/counters | Cannot teleport, suppress collisions or grant points on server; can automate legal controls | Can fabricate any event/state left on client |
| Complexity | Low common checks plus per-game bounds | Medium/high transport, scheduling, ownership, snapshots and UI integration | Medium/high game-specific causal rules; easy to omit dependencies |
| Latency | Only completion needs network | Live control latency matters, especially Dash's 80/180 ms windows | Score events need timely delivery; trusting old client timestamps creates an exploit |
| Server cost | Small per submission | Two live engines per head-to-head match; ongoing CPU, memory and traffic | Lower only if authoritative event prerequisites are cheap; approaches B for these games |
| Per-game effort | Low/medium, but does not solve result trust | Blaster highest (entities/collisions); Hopper medium/high; Runner medium; Dash medium, with high latency sensitivity | Blaster/Hopper/Runner need most of B to prove achievements; Dash still needs live progress/stumble/timing authority |
| Free/practice suitability | Suitable for explicitly untrusted practice/casual scores | Required for prize-bearing competition, including freerolls | Suitable where independently validated events are enough |
| Future monetary suitability | Rejected as sole mechanism | Required for these four; still needs load, abuse/fairness and later external approvals | Level 2 minimum only for a separately reviewed game with genuinely authoritative event prerequisites |
| Seeded PRNG | Seed does not authenticate reported performance | Keep server-issued seed and same gameplay stream per participant | Keep seed where useful; known layout alone does not prove achievement |
| Mobile/browser impact | Little network load | Rendering/interpolation plus small controls; ongoing snapshots; no duplicate physics required by default | Smaller traffic only for sparse events; client state may still cost CPU |

Rejected alternatives: signed client scores or browser-held secrets as proof of achievement; delayed batches of claimed hits/gates; a second end-of-run simulator; automatically restoring replay; pure maximum-score rules for monetary eligibility. A hybrid renderer with server-owned scoring state is still Level 3 in this taxonomy.

## 3. Trust levels and eligibility

| Level | Definition | Allowed use |
|---|---|---|
| 0 | Client report only | Offline practice and explicitly untrusted displays; no valuable prize/settlement |
| 1 | Authenticated/session-bound and plausibility checked | Non-redeemable casual Coins/free social play with honest labeling and ledger safeguards; no GEL competition prizes |
| 2 | Server validates each score-bearing event and independently owns its complete prerequisites | Future game-specific review minimum for monetary candidates; not satisfied by plausible event reports |
| 3 | Server owns the continuously evolving score-bearing state, collisions/timing and terminal result | Required for all four current competition candidates and all their GEL templates, including zero-entry freerolls |

| Game | Required minimum for competition | Selected model | Current release disposition |
|---|---|---|---|
| Space Blaster | Level 3 | B | Block until implemented and accepted |
| Pixel Ninja Dash | Level 3 | B | Block until implemented and latency/playability gates pass |
| Cyber Hopper | Level 3 | B | Block until implemented and accepted |
| Neon Runner | Level 3 | B | Block until implemented and accepted |

The architecture choice is now resolved; these are **implementation/acceptance blocks**, not an unresolved choice between models. No game receives actual Level 3 certification from this document. Preserve existing candidate classifications and historical templates, but Phase 5.5 must enforce a separate runtime capability gate before reservation/activation. Do not relabel them as legally approved. Existing staging catalog acceptance does not override this gate. No eligibility flags or staging data are changed in this planning task.

Level 0/1 practice and casual Coins remain available under explicit lower-trust policy. Free entry with a valuable/promotional prize is not an exception. Quiz games remain outside paid-candidate eligibility; their casual paths need an explicit Level 1 replacement before deleting the shared old checker.

## 4. Source audit and per-game design

### 4.1 Space Blaster

**BUILT, source-inspected:** [engine](../games/space-blaster/engine.ts), [constants](../games/space-blaster/constants.ts), [module](../games/space-blaster/index.ts). Seeded asteroids; ship motion clamped to virtual bounds; 0.15-second firing cooldown; moving bullets/asteroids and both collision types; +1 survival per 30 updates, +10 per destroyed asteroid. Spawn interval parameter changes with difficulty; it is not a constant inter-spawn gap.

**PLANNED server ownership:** instantiate one engine per player with common match seed, 1280×720 and 1/60-second steps. Maintain ship coordinates, held movement, bullet/asteroid IDs and positions, cooldown, gameplay PRNG, collision/alive state, tick and score. Apply received movement intent and one-shot fire pulses at server ticks. Existing update logic alone grants kills/survival points and ends collision runs. Never accept client hit, kill, position or score-change claims.

**Client:** renders server entity snapshots, interpolates motion, captures directional state and fire pulse. Immediate muzzle flash/ship visual prediction may be cosmetic, corrected to current server state without replaying old inputs. Do not predict authoritative points or death. Submit live controls plus a final receipt acknowledgement; optional displayedScore is diagnostic only.

**Checks:** unauthorized/duplicate controls; fire spam cannot bypass cooldown; movement cannot exceed engine speed/clamps; invented asteroid IDs/hit claims reject; hiding a local collision cannot keep the server alive. Limits: legal-input bots/aim assistance and predictable future spawns remain possible. Highest expected CPU/entity/snapshot demand; benchmark is mandatory.

### 4.2 Pixel Ninja Dash

**BUILT, source-inspected:** [engine](../games/pixel-ninja-dash/engine.ts), [constants](../games/pixel-ninja-dash/constants.ts), [module](../games/pixel-ninja-dash/index.ts). Seeded gate positions; track 11000; 60-second limit; speed grows with difficulty up to 800 despite a stale fixed-pace comment. A missed gate causes stumble at 0.15 speed for 550 ms. Perfect/good windows are 80/180 ms; score combines progress, 15/8 gate bonuses and remaining-time finish bonus.

**PLANNED server ownership:** course/reset seed, distance, elapsed time, difficulty/speed, stumble state, unresolved gates, perfect/good/miss counts, finish/timeout and final score. Client sends a dash press pulse; server judges the current gate at the tick of receipt/application. No client timestamp backdating, supplied checkpoint order, perfect/good classification or completion-time authority. The compact course can be sent once for rendering, but its exposure is not an anti-bot control.

**Client:** draws server course/progress, interpolates between snapshots, shows immediate dash animation. Server gate decisions and score override visual estimates; final UI uses the authoritative receipt. Do not end competition on a local timeout alone.

**Checks:** skip/fabricated gate and early-finish claims reject; dash spam cannot award a gate twice; slowed traversal/finish bonus follow the same live state. Limits: network delay changes effective timing and can make the existing windows unpleasant or unfair. Do not silently widen timing windows or compensate using trusted client clocks. If measured usability fails, keep Dash competition disabled and separately review a versioned timing redesign.

### 4.3 Cyber Hopper

**BUILT, source-inspected:** [engine](../games/cyber-hopper/engine.ts), [constants](../games/cyber-hopper/constants.ts), [module](../games/cyber-hopper/index.ts). 20×11 grid; seeded hazard lanes, moving obstacles, round-dependent speed; +10 per new maximum row, +150 for reaching row 10 then reset. The engine has no hop cooldown and processes up, down, left, right flags in that order. Input pulses are cleared each update.

**PLANNED server ownership:** grid position, maximum row, completed rounds, lane/obstacle state, seed/PRNG, tick, collisions and score. Receive bounded direction pulses; at most one boolean pulse per direction per server tick, preserving existing simultaneous-direction order. Do not invent a slower human hop limit or trust client row/round/checkpoint claims. Each award follows server-observed movement/collision evaluation in existing engine order.

**Client:** renders grid/hazards and animates requested hops as non-authoritative feedback; reconciles to snapshots. Sends direction pulses, never a trajectory or claimed successful crossing.

**Checks:** teleport/row-skip/round-bonus claims reject; duplicate pulses cannot apply twice; flood cannot advance extra ticks. Limits: automation at legal tick rates remains possible; high command responsiveness and same-tick goal/collision ordering need explicit regressions and mobile usability checks.

### 4.4 Neon Runner

**BUILT, source-inspected:** [engine](../games/neon-runner/engine.ts), [constants](../games/neon-runner/constants.ts), [module](../games/neon-runner/index.ts). Seeded hurdle/overhang schedule, speed/difficulty capped at 780 units/sec, distance integration and floor(distance/8) score; vertical movement/jump release, slide duration and obstacle collisions determine survival. Gameplay and cosmetic PRNG streams are separate.

**PLANNED server ownership:** spawn timer/obstacles, player vertical state, slide/jump state, elapsed/distance/speed, collision and terminal score. Accept jump press/release and slide pulses at server ticks. Only the server advances distance and alive state. A client cannot earn survival by waiting and then reporting a believable number.

**Client:** draws/interpolates server world and local cosmetic effects; captures controls; authoritative death and result come from server. No client elapsed-time or distance grant.

**Checks:** fabricated distance/survival rejected; local removal of hurdles cannot prevent server collision; repeated release/slide obey existing state constraints. Limits: seed-aware bots and latency-sensitive jumping remain. Preserve physics and score rules; test server initialization/resize/reset ordering.

## 5. Common live session and submission protocol

Everything in this section is PLANNED. Reuse [socket authentication](../packages/server/src/matchmaking/socketAuth.ts), but recheck account/participant/session eligibility and revocation at resume/result boundaries. Current auth supports guests for casual play; guests never inherit competition privileges.

### 5.1 Server-owned context and ownership

- Server creates random match/session/attempt IDs, a cryptographic per-player nonce (at least 128 random bits), rules/game-build/protocol versions, seed, participant seats, immutable entry/prize references, deadlines and ownership epoch. Gameplay mulberry32 is not a nonce generator.
- Persist nonce digest, owner identity/epoch, bindings and deadlines; raw nonce is sent only over authenticated encrypted transport and excluded from logs/evidence. User/instance/configuration are resolved from server records, not client assertions. Bind a single controlling connection per attempt; reauthentication rotates nonce/connection epoch and invalidates the old controller.
- One process owns both live player engines. A persisted renewable lease/fencing epoch plus DB constraints prevents two owners from committing results. Initial lease TTL is 2 seconds, renewed every 500 ms using database time; every result/decision write checks current epoch, lease and terminal state under lock. A failed renewal stops trusted progress immediately rather than awarding points until expiry. A DB/lease outage routes to system-failure recovery. Do not transfer/rebuild an active engine on restart. A stale owner cannot commit after lease expiry or after a terminal decision.
- Capture/start and idempotent activation reuse the actual stored seed/configuration. The current `activateCompetition` seed=0 return on the already-ACTIVE path and fallback seed lookup must be removed, never treated as a second valid run.

### 5.2 Proposed wire messages

| Direction | Message / allowlisted fields | Authority and bounds |
|---|---|---|
| Server → client | sessionReady: session/attempt refs, nonce, epoch, protocol/game/rules version, config/seed, start/deadline, latest snapshot sequence | Issued only to owned participant; opponent receives no bearer nonce |
| Client → server | control: sessionId, epoch, nonce, increasing seq, lastSeenSnapshotSeq, current movement flags and game-specific pulse flags | No positions, hits, score increments, tick rewind requests, trajectory, action batch or trusted client time. Maximum 1 KiB per packet; only allowlisted booleans/references |
| Server → client | state: epoch, snapshotSeq, serverTick/time, latest consumed controlSeq, current render state, score/alive/terminal | Current state; no history reconstruction endpoint. Data minimization per participant |
| Client → server | finishClaim: sessionId, epoch, nonce, requestId, lastSeenSnapshotSeq, optional displayedScore/endReason/duration | Optional diagnostic claim; compare to terminal server facts. If still running, reply not-terminal; never stop/award based on the claim |
| Server → client | authoritativeResult: resultId, authoritative score/end reason, finalTick, duration, level=3, rules/build versions and lifecycle status | Emitted from durable server result; settlement status remains pending until accounting is confirmed |
| Client → server | acknowledgeResult / forfeit / resume | Authenticated owned attempt, request identity and epoch; forfeit is explicit, separate from gameOver |

A final claim/acknowledgement is not necessary for the server to finalize a completed run; a losing client cannot block settlement by withholding it. Claims of huge/impossible scores reject, but a mismatched cosmetic score also does not automatically invalidate sound server state or award the opponent. Duplicate accepted acknowledgements return the existing receipt; conflicting/new result claims cannot replace it.

### 5.3 Live scheduling, network and resource policy

Initial **versioned sandbox engineering defaults**, not measurements of the existing deployment:

- 60 authoritative updates/sec with fixed 1/60 dt and 1280×720. Browser rAF and its drop-excess-time accumulator are not the server scheduler. Server monotonic time determines ticks; execute each current step once, with bounded scheduling catch-up, never reprocess historical inputs.
- Client sends up to 60 control packets/sec; server token bucket permits 60/sec with burst 12. For each tick, keep only latest movement state and OR each permitted pulse flag once; consume then discard. Packet sequence high-water mark rejects duplicate/out-of-order commands without requiring retransmission of missing sequences. Do not queue pulses to execute in later ticks. Controls after a terminal result reject. Existing game-specific cooldown/state restrictions still apply.
- A snapshot reference can be at most 500 ms old when accepting a new control; old snapshots are rejected with resync, not backdated. Store bounded snapshot sequence/time metadata only for this window, not world/input history. Epoch and monotonic seq prevent duplicated controls. Refresh held-state heartbeat at least every 100 ms; after 250 ms without one, neutralize held controls. Missing pulses are lost; never retransmit them as new actions.
- Send current snapshots at 20 Hz initially. Client interpolates and may predict cosmetic feedback only; no rollback or input-history replay even on the client is required. On reconnect send full current state, not a missed-event stream. Slow consumers receive latest state or disconnect; no unbounded transport backlog.
- Ready timeout 30 seconds before capture/start; both participants ready then a common server-owned 3-second countdown. Reject controls before activation. Initial admission test: 20 ping samples over 5 seconds, p95 RTT ≤100 ms and p95 minus median RTT ≤30 ms for each client. Failed admission releases pending reservations; no paid attempt starts. These conservative defaults require measured desktop/mobile acceptance, especially Dash; changes require a versioned decision, not silent tolerance widening.
- Dash keeps its existing 60-second engine finish/timeout. Other three use a **new explicit 180-second competition cap**, with current server score finalized as `time_limit` if still alive. This bounds cost and opportunities; it is a planned competition rule, not existing engine behavior. Preserve practice rules, snapshot the cap, show it before entry and test exact boundary ordering. On cap tick apply the last allowed engine update then prefer a natural terminal cause if one occurred; otherwise time_limit.
- A simulation more than 250 ms behind its due server tick is infrastructure uncertainty: stop and system-void/refund that competition, not a player penalty or an accelerated catch-up race. Missing lease/DB authority has the same effect. No scoring at client-controlled clock speed. No silent time-dropping on the server.
- Start implementation with one simulation owner process and a configured conservative capacity. Benchmark to set that capacity before enabling templates; do not add a cluster/worker platform without evidence it is required. Disable admission before resources are exhausted. No unmeasured capacity or fairness guarantee for the current Render service.

These defaults make implementation concrete, while enabled-game acceptance depends on proving they are usable and safe. Failure keeps the affected game disabled; it does not authorize a lower trust level. Latency equality cannot be guaranteed, and no RTT-based scoring compensation or client-clock trust is selected.

## 6. Outcome, settlement and failure policy

Invariant: **CLIENT RESULT/CONTROL → SERVER VALIDATION → AUTHORITATIVE RESULT → COMPETITION LIFECYCLE → ACCOUNTING SETTLEMENT**. The server may initiate completion itself; the same authority boundary always applies. No public/API/service fallback can settle a client numeric score as authoritative.

1. Live owner records terminal per-player facts with game/rules/build/authority epoch and Level 3 status. Immutable result uniqueness is `(instance, participant, attempt)`; server creates the result ID. Keep client claims separately from authoritative scores.
2. Lifecycle moves ACTIVE → VERIFYING when appropriate; it can wait for the other ongoing authoritative run. A missing client acknowledgement never prevents progression. Only two trusted completed results, a valid forfeit decision, or an explicit system/cancellation decision can produce a terminal competition decision.
3. Choose one durable outcome under DB lock/compare-and-set keyed by instance; prize schedule comes only from its snapshot. Choose either settle or refund/release once, not competing independent commands. Use the existing accounting port and its idempotent transactions. Persist pending application before external transaction boundaries; recovery retries that same outcome/economic identity and checks accounting success before terminal UI/status.
4. A committed terminal decision resumes accounting after restart; it never becomes a different winner/void because of retry. An active run lost before durable trusted results exist is void/refund. A result digest/summary alone cannot reconstruct lost state and must never be used to do so.

| Condition | Required behavior | Financial consequence |
|---|---|---|
| Malformed/unauthorized packet | Reject, bounded reason audit/rate limit; cannot consume someone else's attempt or trigger their forfeit | None from that packet |
| Impossible/fabricated result | Reject claim; compare/continue using healthy live server facts, not reported number | Normal server outcome only; claim rejection itself is not a prize instruction |
| Duplicate exact acknowledgement/result request | Return existing response; duplicate control seq is discarded | One accepted result/economic effect |
| Conflicting duplicate/new result identity | Reject conflict; preserve original receipt; audit | No new effect |
| Late/expired attempt | Reject new controls/claims; allow authenticated read/idempotent acknowledgement of existing result | Use existing decision; expiry is not a new winner rule |
| Explicit player forfeit | Authenticated action while unresolved; win only for an eligible opponent with healthy live/terminal authority; no known invalid/system-uncertain opponent | Predetermined prize once; both forfeited before a terminal decision → void/refund |
| Isolated client disconnect | Neutralize controls; live simulation continues, no pause/new attempt. Reauthenticate within 10-second grace to current snapshot. If a healthy server terminal result occurs during grace, keep it. After grace, still-running isolated leaver forfeits only when server and other participant are demonstrably healthy | Apply that policy once; both disconnected or infrastructure ambiguity → system void/refund, not inferred winner |
| Validation uncertainty, engine exception, excessive server lag, owner/lease loss or active-state loss | Stop affected authority; retain reason/observations; no invented zero/forfeit | Void and full captured refund, or release if pending; no prize/fee |
| Accounting/DB outage after durable decision | Pending/retry same decision, never claim settlement succeeded prematurely | Exactly one eventual effect; no second award/refund |
| Suspected tampering/automation | Bounded audit and rate restriction; distinguish evidence from suspicion. Trust healthy server result; suspicious claim alone does not establish a disqualification | No automatic opponent award solely from suspicion; confirmed sanction policy needs separate scope |
| Equal authoritative scores, including zero | Existing head-to-head tie policy; rejected/missing is not zero | VOIDED/draw, full refund, no prize/fee |
| Pending cancellation / authorized system void | Validate permissions/state, arbitrate with terminal decision, preserve audit | Release or refund once; never reverse a committed prize through a racing void |

Future monetary use must separately review disconnect fairness, abuse of refunds, bots and eligibility controls. Infrastructure uncertainty must never create an unjustified winner. Legacy “invalid client report means opponent wins” semantics are superseded for this chosen competition flow; malformed reports do not discredit an independently sound live result.

## 7. Durable records and schema impact

**Additive schema changes are needed during implementation; none are made now.** Existing participant scores/history alone lack server authority ownership, result provenance and durable outcome arbitration. Proposed logical records (final table names may follow repository conventions):

- **Competition session/attempt:** instance/match/user/seat foreign keys; unique active attempt; protocol/game/rules/config digests; seed; trust level required/achieved; nonce digest and connection epoch; start/deadline; owner/fencing epoch and renewable lease. Mutable control metadata is distinct from immutable facts. No raw nonce or control history in evidence.
- **Authoritative result:** unique participant attempt/result ID; server score, terminal reason/tick/duration, game-specific aggregate totals, server build/rules versions, authority epoch and health outcome, created time. Append-only once committed. Store no input sequence or periodic engine checkpoint history.
- **Terminal decision/application:** unique instance decision, result/forfeit/system reason references, decision type and snapshotted award schedule, stable accounting identity, pending/applied state, application reference and timestamps. Recovery must reconcile it with existing settlement/reservation rows.
- **Bounded audit/claim receipt:** authentication outcome, request identity/digest, allowed diagnostic claim, rejection code or existing result reference; dedupe and retention boundaries. Server-generated totals are not independently reconstructable gameplay proof. Record control acceptance/rejection counts and health summaries, not full controls or state traces.

Fencing/nonce-control metadata can update; accepted results, financial journal and original audit facts cannot be overwritten by retries. Preserve old schema/migrations/input-log/history/settlement records. Versioned snapshot/config fields may be additive columns or linked immutable policy records. Migration parity, concurrency, access permissions and recovery tests must demonstrate the selected design.

## 8. Replay retirement and utilities to retain

| Category | Files/components | Disposition in Phase 5.5 |
|---|---|---|
| Active replay to delete | `packages/shared/src/replay.ts`, replay exports; `games/replayAdapters.ts`/package export; all seven `games/*/replay.ts` adapters | Delete after active consumers and affected tests are migrated; no offline reconstruction replacement |
| Replace callers/contracts | `scoreValidator.ts`, `lifecycleEngine.ts`, legacy `matches.ts`, shared result/game-over/socket types, game module logging, MatchLoader/hook and misleading result/admin copy | Live authority for four candidate competition modes; Level 1 scoped casual replacement for remaining modes. Stop collecting/transmitting logs; no silent unvalidated monetary fallback |
| Keep deterministic utilities | `packages/shared/src/rng.ts`, `FIXED_TIMESTEP_SEC`, gameplay engines/constants and canonical viewport | Useful for live server execution and client presentation. Keep seeded PRNG; do not use it for cryptographic session secrets |
| Scheduler distinction | `fixedTimestepLoop.ts` browser accumulator | Keep for local practice/rendering as appropriate; its clamping/drop behavior must not govern server authoritative time. Implement a bounded live server clock runner, not a replay driver |
| Keep score rules | Engine score getters/update rules, finish/collision logic, gameplay RNG stream order | Reuse source; factor browser drawing/cosmetics only where needed without changing score/physics. Live wrapper exposes current state/controls/terminal facts, not run-from-log API |
| Preserve database/history | `schema.ts` legacy input-log fields, `0003_matches_history.sql`, old rows/verdicts, historical policy/audit/ledger | Keep original bytes and meanings. Historical read compatibility may remain; never mark old results Level 3 or export old input traces as new evidence |
| Replace affected tests | Score/input validation, phase3 lifecycle, phase4 wording, matchmaking/durability/atomic, determinism and canvas portions | Live-authority/adversarial/failure tests replace retired assertions; preserve finance, authentication, PRNG, scheduler and canvas coverage |

The full removal inventory in Phase 6 section 2.7 still applies, with live authoritative engine reuse explicitly preserved. Do not delete a gameplay utility merely because an old replay adapter imported it. Historical documents remain with supersession context. No code is removed by this decision.

## 9. Exact Phase 5.5 work packages and likely files

| Work package | Necessary changes / likely paths |
|---|---|
| P1 — completion/session integration | `server/src/matchmaking/index.ts`, `socketAuth.ts`, `competitions/{instanceService,lifecycleEngine}.ts`; shared matchmaking/competition types; DB session/authority records. Capability gate before reserve/capture, single activation/real seed, owned session start |
| P2 — four live authority integrations | Existing four `games/*/engine.ts`/constants retained; narrowly scoped live wrappers under server competitions; bounded server scheduler/transport; game modules and client MatchLoader/useMatchSocket render/control mode. Engine refactoring only where required for current state snapshots/no DOM |
| P3 — trusted outcomes/settlement | Lifecycle, match outcome/history writers, accounting port/sandbox adapter and additive decision/result migrations. No direct settlement from client scores; lock/fencing/idempotent outcome recovery; preserve old history |
| P4 — replay retirement | Section 8 files and Phase 6 inventory; explicit Level 1 casual/quiz policy with no GEL conversion or competition privileges; no alternate engine/reconstruction system |
| P5 — Diamond retirement | `matchmaking/{index,queue,matches}.ts`, wallet routes/service and admin grant/pack offers; block new DIAMONDS for all flags/entry points; preserve historic balances/settlements/audit and narrowly scoped compensation |
| P6 — current docs/UI correction | AGENTS/CLAUDE/GAMES, deployment readiness, legal register/current policy/FAQ, result/admin wording, PROGRESS; version current policies through existing mechanism, preserve prior acceptances |
| P7 — required checks | Shared/server/client typecheck/builds, every canonical script and affected integration checks, migration/DB safety, adversarial live socket tests, browser/device and capacity/latency validation |

Exclude payment rails, tournament/multi-placement expansion, new games, a distributed hosting platform, gameplay redesign, anti-bot product, regulatory submission and Phase 6 CLI/evidence generation. Existing integer/reconciliation/append-only requirements remain acceptance checks tied to these changes, not a separate broad database-hardening project. No schema/source/test edits now.

## 10. Acceptance criteria and required tests

Each enabled game must pass A1–A12; failed/unexecuted cases mean BLOCKED, not a downgrade to Level 1. Test data is disposable local synthetic data. Staging mutation/deployment requires separate authorization.

| ID | Required evidence |
|---|---|
| A1 | Actual browser game plus two real authenticated sockets: start, live controls, natural/capped completion, durable server result, lifecycle and single accounting effect. Direct-service-only tests insufficient |
| A2 | Impossible score rejected; **plausible fabricated score also cannot replace server result**; claimed hit/gate/crossing/survival cannot create points. Modified rendering/collision code has no scoring authority |
| A3 | Bad/missing nonce, wrong user/game/version/instance, old epoch, guest, unknown session and concurrent controller reject; old connection cannot act after resume; stale owner cannot commit |
| A4 | Duplicate/out-of-order control pulses never apply twice; burst/flood cannot advance extra ticks; payload limits enforced; snapshot-age and timing boundary behavior covered |
| A5 | Exact result retry gives same receipt; conflicting/new result cannot overwrite; lost final client acknowledgement does not block server outcome; late input/claims cannot reopen terminal state |
| A6 | Per-game authoritative scoring/collision/terminal rules, initialization, 1280×720 and fixed-step semantics tested. Dash gate windows/finish bonus; Blaster cooldown/collision; Hopper simultaneous direction/goal ordering; Runner jump-release/slide/collision; new caps explicit |
| A7 | Valid unequal server results settle once from snapshots; exact ties/full refunds; zero versus missing/invalid distinguished; forfeit/disconnect/grace/both-disconnected policies enforced |
| A8 | Lag, clock anomalies, server/lease loss, engine exceptions and active-state loss produce no unjustified winner. Restart after durable decision retries same outcome; restart without sound terminal facts voids/refunds |
| A9 | Concurrent completion/void/cancel/forfeit cannot both settle and refund; accounting failure pending, never false success. Full existing standard/promo/freeroll, reservation/capture/release/refund and reconciliation matrix retained |
| A10 | Raw Diamond queue/match/rematch/purchase/stub/admin-grant paths reject even with flags enabled; historical records unchanged; casual Coins/guest/friend/quiz regressions pass under explicit lower-trust policy |
| A11 | Import/wire/storage audit shows no active competition replay dependency or input history; seeded utilities/engines still work; result/UI/legal descriptions match Level 3 and its residual limits |
| A12 | Desktop and narrow/mobile controls/result UI checked; network delay/jitter/loss/reconnect and load tested; no secret/account leak in captures; readiness gates below pass for configured concurrency |

Run all current `scripts/` tests through the canonical suite and explicitly run relevant standalone database-safety/atomic checks; report each script's actual counts/exits. Replace only retired architecture assertions, retaining equivalent positive/negative coverage for the new authority model. Add tests for owners/epochs, no-ack finalization, pending-settlement recovery, rendering/control separation and no-history storage. No tests were run in this decision task.

**Performance/playability gate:** measure each engine and the four-game mix for a sustained 30-minute test at the proposed concurrency and a brief 2× admission burst. Record CPU, RSS, per-tick processing/lag, DB latency, network bytes/player/sec and command→snapshot latency. At accepted load, require p99 tick processing within 16.67 ms, no healthy-run lag-triggered void, bounded memory/queues and overload admission rejection. This is a proposed test threshold, not an existing benchmark. Cost estimate: roughly `2 × concurrent matches × 60 × measured per-engine-step cost`, plus transport/accounting overhead; never quote a sessions/server capacity before measuring.

Check normal play at controlled RTT 0/50/100 ms and jitter within admission policy, and rejection/degradation at 150/250 ms, stalls and packet loss. Require no lost/doubled legal pulse at healthy network bounds and usable gate/hop/jump controls in browser trials. Dash's 80 ms window needs particular review; test failure keeps it disabled. Any timing/latency advantage remains a disclosed limitation even after acceptance. A cold-starting/overloaded service cannot advertise ready-to-start authoritative matches.

## 11. Residual limitations and readiness

Level 3 proves that the trusted server awarded points according to its live rules; it does not prove human input, eliminate bots/collusion/account sharing, make seed previews secret, establish perfect network fairness, or protect a compromised server/database owner. Clients may automate legal controls. No anti-bot certification, legal classification or monetary approval is asserted.

All four games temporarily remain ineligible for activated paid/prize competition until their selected Level 3 flow and full acceptance pass. Existing labels/records remain historical; enforcement changes occur only during authorized implementation. Future monetary use requires at least Level 2 in general and Level 3 for these four, plus separate security/fairness/operational and legal/payment gates. Failure of hosting cost or latency does not justify plausibility-only monetary settlement.

Schema changes are required but only designed here. Likely files, replacement tests, retirement boundaries and lifecycle safety are enumerated above. **No Phase 5.5 implementation, Phase 6 implementation/evidence generation, Phase 7, code deletion, schema change, commit, merge, deployment or regulator submission occurred in this planning task.**
