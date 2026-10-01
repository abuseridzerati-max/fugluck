# Main merge and deployment safety — 2026-10-02

**BUILT and verified by source/diff, official Vercel documentation/schema, live provider UI, Git refs and GitHub API:** accepted feature `3a24ea02df7dc9bfa4d06d4d19d13439ae517073` was fast-forwarded into main, then the separate guard commit `9f8a72d57f0541d2a46ddb4b45207066116e08d0` was fast-forwarded in. Feature history and its local/remote branch remain intact at the accepted SHA; no squash, rewrite, conflict or deletion.

## Deployment control

Vercel project `arcadeclash-client` uses Root Directory `packages/client`, connected repository `abuseridzerati-max/fugluck`, Production branch `main`. Before the guard, its UI explicitly confirmed every main commit creates a Production deployment and automatically assigns Production domains. **BUILT:** the sole configuration change adds `git.deploymentEnabled.main = false` to that project's existing `vercel.json`. All headers/rewrites remain byte-for-byte equivalent as parsed JSON. This disables Git-triggered main deployments under the [official Vercel contract](https://vercel.com/docs/project-configuration/git-configuration#gitdeploymentenabled); the current [official schema](https://openapi.vercel.sh/vercel.json) accepts this Boolean branch map.

The dashboard still tracks main; no dashboard, domain, Production environment variable or application state was changed. Effective Git auto-deploy for main is OFF through repository configuration. Other branches retain Vercel's existing default behavior. Manual/API deployments are separate controls; this task performed none. No manual dashboard action is needed for the guarded push.

**VERIFIED by live inventories/settings:** the visible Vercel workspace has one project; its Git settings show no deploy hooks. The visible Render workspace has one project and one service, `fugluck-api-staging`, in Staging, tracking `codex/competition-restructure`, Auto-Deploy Off. No Production backend service was found in that inventory. `render.yaml` describes staging only with `autoDeploy: false`; it does not establish any unseen service's dashboard state.

**VERIFIED by local tracked trees and GitHub API:** no GitHub workflows on main or the feature; API workflow count zero, repository webhook count zero, rulesets empty. Main's branch protection has no required status checks or pull-request reviews. No active local Git hook or additional repository deployment script was found. Normal non-force push was accepted.

## Validation and push

**VERIFIED by fresh complete execution on main at guard commit:** 53 scripts / 2,352 assertions / zero failures, exit failures or count mismatches. Typecheck, explicit client production build and server build passed. Migration/schema, accounting/reconciliation, security and competition checks below all passed. The test database was guarded loopback disposable PostgreSQL; no hosted migration or database mutation was performed.

**VERIFIED after initial main push by remote refs, live Vercel Production history and GitHub API:** main initially synchronized at `9f8a72d57f0541d2a46ddb4b45207066116e08d0`; no deployment exists for that commit. Latest Production remains `AtViaffzmmQELvKqBn8u56mxRZ6W` / `91ca7533c8d4d3e78bc090031d69097731b03d8b`, GitHub deployment `6648743148`, dated 2026-09-24 UTC. This documentation follow-up preserves tested application/configuration source; final remote and provider checks are captured in the session's ignored receipt and final response.

**VERIFIED by fresh public HTTPS/provider UI:** staging frontend/backend remain at the accepted `3a24ea0` full SHA above. Health still denies real money, deposits and withdrawals. Keepz remains OFF per accepted user/handoff state; no provider or financial setting was touched. Prior 87/87 hosted staging acceptance is retained, not rerun or claimed as new hosted testing here. This main synchronization does not certify or deploy Production, change competition economics, or resolve prior Production isolation/readiness findings.

[Sanitized validation evidence](evidence/main-merge-safety-20261002.json).

## Every script result

| Script | Passing assertions | Failures |
|---|---:|---:|
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
| competition-player-ux-check.ts | 110 | 0 |
| competition-socket-session-check.ts | 18 | 0 |
| cors-audit-check.ts | 20 | 0 |
| cyber-hopper-authority-check.ts | 42 | 0 |
| determinism-check.ts | 12 | 0 |
| environment-safety-check.ts | 89 | 0 |
| file-upload-audit-check.ts | 4 | 0 |
| financial-reconnection-check.ts | 17 | 0 |
| i18n-check.ts | 65 | 0 |
| input-validation-check.ts | 20 | 0 |
| legal-policy-help-check.ts | 86 | 0 |
| match-lifecycle-durability-check.ts | 26 | 0 |
| matchmaking-check.ts | 65 | 0 |
| migration-schema-parity-check.ts | 338 | 0 |
| owner-admin-lockout-check.ts | 10 | 0 |
| password-policy-check.ts | 18 | 0 |
| password-security-check.ts | 13 | 0 |
| proxy-rate-limit-check.ts | 82 | 0 |
| rate-limit-check.ts | 11 | 0 |
| registration-verification-check.ts | 9 | 0 |
| request-logging-audit-check.ts | 12 | 0 |
| score-validation-check.ts | 12 | 0 |
| security-boundary-check.ts | 75 | 0 |
| seed-admin-check.ts | 7 | 0 |
| shutdown-lifecycle-check.ts | 4 | 0 |
| sql-injection-check.ts | 19 | 0 |
| staging-mock-commercial-check.ts | 13 | 0 |
| staging-readiness-check.ts | 40 | 0 |
| test-database-safety-check.ts | 18 | 0 |
| tournament-authority-check.ts | 34 | 0 |
| tournament-domain-check.ts | 97 | 0 |
| tournament-recovery-check.ts | 52 | 0 |
| tournament-rules-check.ts | 180 | 0 |
| wallet-friends-check.ts | 48 | 0 |
| wallet-settlement-concurrency-check.ts | 16 | 0 |
| wallet-settlement-integrity-check.ts | 24 | 0 |
| xss-audit-check.ts | 17 | 0 |
| **Total: 53 scripts** | **2,352** | **0** |
