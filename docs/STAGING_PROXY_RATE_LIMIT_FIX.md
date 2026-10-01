# Staging proxy and guest rate-limit repair — 2026-10-01

## Cause and verification

**BUILT investigation, verified by protected staging diagnostics and fresh HTTPS:** the actual inbound chain, listed from client to application, is client → Cloudflare public edge → Render private 10/8 proxy → local loopback → Express. `TRUST_PROXY=1` selected the private Render proxy as `req.ip`. The previous hosted logs recorded three different private proxy identities for the same test client. A fresh reproduction at diagnostic revision `00c646ebce8f202ed072276f5636306106d1b253` issued 25 requests in **2,736 ms**, all HTTP 200. Neither limiter initialization nor route attachment was responsible: source inspection confirms a singleton sliding-window store, a middleware instance created once, and the actual guest endpoint configured for **20 requests / 60,000 ms**.

Caller-supplied X-Forwarded-For prefixes survive before the platform-appended client/edge/private addresses. Forwarded also survives unchanged. Therefore a trust-all/leftmost-IP fix would create a bypass. The temporary diagnostic used the existing staging service/database/financial guards, authorized synthetic accounts and existing operator secret; it returned only that caller's own chain. It has been removed from the application source. Raw client IPs and operator credentials remain in ignored, restricted local storage.

**BUILT fix, verified by source and HTTP regression:** explicit `TRUST_PROXY=render`, gated by Render's injected `RENDER=true`, installs an address-and-position trust function. From the socket outward it accepts only exact loopback, then Render private 10/8, then Cloudflare's published ranges. It always stops at the following client address, including a client whose own address belongs to one of those ranges. Unknown/missing proxy layers stop traversal. Direct/local operation defaults to false. Trust-all, arbitrary numeric hop counts and unknown configurations throw at boot. `Forwarded`, `CF-Connecting-IP` and `X-Real-IP` never determine the limiter key. IPv4-mapped IPv6 collapses to IPv4; IPv6 spelling and interface rotation share a /64 bucket; invalid IP text uses a single fail-closed bucket.

The trusted Cloudflare networks were checked against the [official IPv4 list](https://www.cloudflare.com/ips-v4) and [IPv6 list](https://www.cloudflare.com/ips-v6) on 2026-10-01. Express documents [right-to-left traversal and numeric-hop risks](https://expressjs.com/en/guide/behind-proxies/). Render confirms [Cloudflare and load-balancer ingress](https://render.com/articles/how-render-handles-ddos-attacks). No external request fetches a trust list at runtime. If provider networks/topology change, review this profile and repeat hosted acceptance.

**VERIFIED instance scope:** Render Compute shows Free with scaling unavailable; deploy logs show `WEB_CONCURRENCY=1`, start command executes a single Node process, and all successful diagnostics report one process/instance identity. The store remains process-local. **PLANNED before any future horizontal scaling:** introduce an atomic shared limiter store and verify aggregate limits across replicas. A restart/deploy starts a new in-memory window; the investigation did not observe a restart during the failing burst. This fix does not certify restart-proof or distributed throttling.

## Required Render action

On **fugluck-api-staging**, service `srv-da2c50c9v7es73db3dkg`, change only **Environment → TRUST_PROXY** from `1` to `render`, save, and manually deploy the reviewed feature commit. Do not substitute `true` or a larger hop count. Other environment, financial/provider and scaling settings remain unchanged. **VERIFIED by provider UI:** only TRUST_PROXY was edited and Save only completed; revealing the saved field confirmed render. Deployment remains PLANNED until the reviewed feature commit is pushed.

## Acceptance

**VERIFIED by fresh local execution:** `proxy-rate-limit-check.ts` passes **82/82** assertions against the actual guest router: first 20 succeed, 21 returns 429 with Retry-After, rotating trusted proxy addresses/prefixes cannot reset the bucket, direct traffic ignores headers, mapped IPv4/IPv6 normalize, separate clients remain independent, and requests resume after window expiry. All previous test scripts are preserved; `npm test` also includes this new regression.

**VERIFIED by full fresh execution:** all **53 scripts / 2,352 assertions / 0 failures / 0 exit failures / 0 count mismatches**; typecheck/client build and explicit server build exit 0. Each script is listed below. No application source changed after these runs. **PLANNED:** staging deploy and exact SHA parity, original hosted security acceptance, plus `scripts/hosted-guest-rate-limit.ts`. The focused hosted script waits for a fresh window without resetting the server; verifies 20 successes then requests 21–25 returning 429, malicious forwarding changes and alternate Render hostname cannot bypass, and legitimate issuance resumes after expiry. No threshold or original security assertion is weakened.

**VERIFIED by source/Git review:** no competition economics, engine, migration or financial switch changed. Production and main are untouched. Real money, deposits, withdrawals and Keepz remain off. Initial local AGENTS.md/.agents/stray file exclusions are preserved.

## Complete local regression counts

Verified by the complete run ending 2026-10-01T19:41:36.5644216Z.

| Script | Pass | Fail |
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
