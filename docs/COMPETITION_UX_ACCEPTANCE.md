# Simplified player competition UX — local acceptance

Date: September 28, 2026. Candidate branch: `codex/competition-ux`.

## Scope and source verification

**BUILT — verified by source review:** `/competitions` uses the existing server catalog, a responsive game-card grid, All / Space Blaster / Cyber Hopper filters, compact confirmation, optional Rules & details, and My Competitions. There was no mandatory giant details route in the audited implementation; the removed complexity was repetitive technical card/modal copy, internal format labels, and dense disclosures. The recording was a visual reference for room selection; its branding and business rules were not adopted.

**BUILT — verified by presentation tests and source review:** Entry and first-place Prize are separate canonical amounts. Existing open rooms display their immutable instance terms. Free entry is explicit; Promo follows the existing template title designation, never a client prize formula. Player icons and accessible counts use actual capacity/occupancy. Supported live competitions remain two-player head-to-head; this task did not add four-player gameplay.

**BUILT — verified by source and disposable-database API tests:** the new player projection only reads existing tables. Catalog occupancy follows the queue's oldest open instance, with a session-specific participation marker and `no-store`. `/api/competitions/mine` requires an authenticated active account and filters by that session's user. Operator-only mock templates remain excluded. Confirmed entry returns and applied authority decisions enrich the existing public instance summary; ledger/accounting references are not added.

**BUILT — verified by tests/source:** PENDING_ENTRANTS → Open/Full (Waiting for existing players); LOCKED → Starting; ACTIVE → Live; VERIFYING/SETTLED → Finished, with pending-result fallback until settlement; CANCELLED → Canceled; VOIDED → Voided. Unknown states are Unavailable. My Competitions offers View, Get Ready, Return to Game, or View Result. The authority renderer continues sending controls/bindings only, rendering server snapshots at 1280 × 720 and never submitting a score. Waiting resumes the saved entry rather than rejoining. Leave is shown only while the canonical entry is pending. Server winner, participant scores and awarded prize drive results; a missing winner/result stays pending. Draw needs an applied server decision; equal scores alone do not establish a draw. Refund wording requires recorded return/release.

**VERIFIED commercial boundary by Git diff/source:** accounting, payment/provider, risk, eligibility, authority runtime/store, schema/migrations, game engines, shared financial types, deployment configuration and real-money switches have no application changes. The sandbox test-funds button uses the existing faucet and refreshes the server-derived balance. No mock operator deposit/withdrawal control was added. No production action, main merge, push, staging deployment or production deployment was performed. Accepted hosted runtime remains the earlier `b87036ce9394af61714e0a8920944e4a6fe247f4`; this local UI acceptance is not a new hosted acceptance. The existing production → staging reference finding remains untouched.

## Browser review

**VERIFIED in Chromium with isolated layout fixtures:** English, Georgian and Russian at 320, 375, 390, 430, 768, 1024 and 1440 px: no page or Entry/Prize overflow. Mobile uses one column, 768 px two, 1024 px three, 1440 px four. Cards do not have a fixed height. Primary actions measured about 47 px high; secondary details, dialog actions, close controls and policy links have 44 px targets. This is viewport simulation, not physical-device certification.

**VERIFIED by keyboard/DOM/screenshot:** modal initial focus, explicit Tab wrapping, Escape close and focus return; text and icons alongside status colors; screen-reader slot count; language attributes on competition views; reduced-motion styling. Sample normal-state text contrast ratios are 5.70–17.14:1; the scoped hover color also preserves white-text contrast. Expanded policies remain scrollable inside the modal. Existing policy pages/draft legal translations were not edited. Timeout and generic failure show Retry; Retry returns to loading; a filtered empty state offers Show All and restores the catalog. Fixture data is isolated in ignored local review files and is absent from normal routes/build entry points.

## Executed regression and local end-to-end evidence

**VERIFIED by complete serial regression:** all 45 `scripts/*-check.ts` programs passed: **1,775 assertions, zero failures, exit failures or count mismatches** (completed 2026-09-28 14:19:45 UTC). Every check was run with `npx tsx scripts/<filename>` after adding `C:\Program Files\nodejs` to PATH. The table below gives each count. After final browser fixes, the affected player UI, player UX, i18n, account lifecycle and XSS checks were rerun: **44 + 93 + 65 + 41 + 17 = 260 passing assertions**, zero failures. The earlier complete suite is distinct from these final targeted reruns.

**VERIFIED by final builds:** `npm run typecheck` passed shared/theme/games/server checks and the client production build; `npm run build:server` passed; the final `npm --workspace=@fugluck/client run build` passed after the session-specific catalog refresh adjustment. The existing >500 kB client chunk advisory remains. `git diff --check` passed. No dependency or schema changes were made.

**VERIFIED by actual local browser, normal Socket.IO authority sessions and read-only SQL:** two synthetic users used the guarded disposable `arcadeclash_atomic_test` database. Standard Space Blaster entry was reserved once at 500 minor GEL; F5 and My Competitions resumed the same instance, then Leave returned exactly 500. Refresh after cancellation created no new entry. A subsequent Space Blaster game settled once for the server-selected winner, scores 2–2 with an opponent explicit forfeit, prize 900, captured entries 1,000 and margin 100. Equal scores did not override the authoritative winner. Cyber Hopper accepted normal keyboard hop controls and settled once at 10–0, prize 720, captured entries 800 and margin 80. My Competitions reopened that exact result. Result refreshes did not start another competition. A real zero-entry freeroll displayed Free / 10 GEL, full 2/2 slots, server countdown, play and a durable DRAW at 19–19; its recorded zero entry was refunded and no prize was awarded. The optional opponent timer was a normal explicit forfeit, not a fixture result; the freeroll completed naturally before that timer. No client score or direct database settlement was used.

**VERIFIED fixes from browser findings:** competition refresh restores the authority mode, completion clears the saved launch, reconnect returns to Waiting instead of remaining on Confirming, join refreshes available test balance, Starting shows full slots without disabled gameplay controls, and the existing sign-in password field has a distinct accessible Password label. Catalog participation is reloaded when the signed-in user changes. Real catalog measurements also passed all seven required widths. The [sanitized evidence](evidence/competition-ux-acceptance-20260928.json) includes full counts, final rerun counts, layout/contrast observations and the four local instance records. Screenshots remain in ignored local `Temp/competition-ux/` files; they are local review artifacts, not hosted evidence.

| Script (`npx tsx scripts/<name>`) | Passed | Failed |
| --- | ---: | ---: |
| admin-console-check.ts | 49 | 0 |
| admin-reset-recovery-check.ts | 11 | 0 |
| admin-security-check.ts | 8 | 0 |
| atomic-wager-lifecycle-check.ts | 38 | 0 |
| auth-account-lifecycle-check.ts | 41 | 0 |
| authority-presentation-check.ts | 24 | 0 |
| canvas-render-check.ts | 21 | 0 |
| commercial-financial-check.ts | 76 | 0 |
| competition-admin-http-check.ts | 44 | 0 |
| competition-authority-check.ts | 65 | 0 |
| competition-authority-latency-check.ts | 26 | 0 |
| competition-phase1-domain-check.ts | 41 | 0 |
| competition-phase2-accounting-check.ts | 54 | 0 |
| competition-phase3-lifecycle-check.ts | 45 | 0 |
| competition-phase4-ui-check.ts | 44 | 0 |
| competition-phase5-admin-check.ts | 42 | 0 |
| competition-player-ux-check.ts | 93 | 0 |
| cors-audit-check.ts | 20 | 0 |
| cyber-hopper-authority-check.ts | 42 | 0 |
| determinism-check.ts | 12 | 0 |
| environment-safety-check.ts | 81 | 0 |
| file-upload-audit-check.ts | 4 | 0 |
| financial-reconnection-check.ts | 17 | 0 |
| i18n-check.ts | 65 | 0 |
| input-validation-check.ts | 20 | 0 |
| legal-policy-help-check.ts | 86 | 0 |
| match-lifecycle-durability-check.ts | 26 | 0 |
| matchmaking-check.ts | 65 | 0 |
| migration-schema-parity-check.ts | 329 | 0 |
| owner-admin-lockout-check.ts | 10 | 0 |
| password-policy-check.ts | 18 | 0 |
| password-security-check.ts | 13 | 0 |
| rate-limit-check.ts | 11 | 0 |
| registration-verification-check.ts | 9 | 0 |
| request-logging-audit-check.ts | 12 | 0 |
| score-validation-check.ts | 12 | 0 |
| seed-admin-check.ts | 7 | 0 |
| sql-injection-check.ts | 19 | 0 |
| staging-mock-commercial-check.ts | 12 | 0 |
| staging-readiness-check.ts | 40 | 0 |
| test-database-safety-check.ts | 18 | 0 |
| wallet-friends-check.ts | 48 | 0 |
| wallet-settlement-concurrency-check.ts | 16 | 0 |
| wallet-settlement-integrity-check.ts | 24 | 0 |
| xss-audit-check.ts | 17 | 0 |

## Remaining limits

No hosted rollout or physical mobile-device review was performed in this task. A separately authorized candidate staging rollout and its browser/network verification remain follow-up deployment work. The existing Render Free cold-start limitation, authenticated admin verification boundary and production isolation blocker are unchanged; none was reclassified as passed by this UI work.
