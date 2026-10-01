# Security audit — 2026-10-01

**Result: PASS WITH REMAINING MANUAL ACTIONS — local candidate only.** All 55 requested categories are covered below. This result authorizes no deployment and does not certify hosted security, real-money readiness, or the separate Competition Restructure / Phase 7A acceptance gates.

Scope: `C:\Users\abuse\Fugluck`, `codex/competition-restructure`, base HEAD `c8dd9176b78c03a7dee8f76fd5fa7bd99959d675`, plus local changes. Source inspection, negative HTTP/Socket.IO tests, concurrent PostgreSQL tests, dependency advisories, sanitized secret scans, production builds, and unauthenticated read-only staging HTTPS were used. No hosted database credentials were used, no hosted data/configuration was changed, and no destructive external testing was performed. No push, merge, commit, deployment, DNS action, credential rotation, or provider activation occurred.

Verification language: **BUILT** means verified in local code/tests; **PLANNED** means not implemented or not applied to hosting. PASS / NOT PRESENT mean no confirmed issue in the examined implementation, not proof against every possible attack. PARTIAL and manual actions explicitly retain limitations. Test coverage includes fixtures and source assertions as well as live local HTTP/Socket.IO/database tests; not every passing assertion is a penetration test.

## Findings and severity

Counts refer to distinct findings, not category repetitions: **CRITICAL 0; HIGH 2; MEDIUM 9; LOW 6; FIXED 15; PARTIAL 2; MANUAL ACTION REQUIRED 8**. FIXED means the local source defect was corrected; deployment is still pending. Missing infrastructure evidence is not counted as a proven critical vulnerability.

| ID | Severity | Local status | Confirmed finding and resulting behavior |
|---|---|---|---|
| F01 | HIGH | FIXED | Installed Engine.IO 6.6.9 affected by a protocol-upgrade mismatch crash advisory. Lockfile and installed package now use 6.6.10. Transport upgrades made this relevant to the server; no exploit was run against hosting. |
| F02 | HIGH | FIXED | Stateless copied sessions remained usable after logout/password recovery; connected sockets retained identity. Sessions now have random IDs, durable logout revocation, a password-hash credential stamp, expiry checks, separate user/admin purposes, action rechecks and socket disconnects. This limits an already stolen token; no initial token theft was demonstrated. |
| F03 | MEDIUM | FIXED | Read-then-delete reset/verification tokens permitted concurrent consumption. Transactional delete-returning permits exactly one successful consumer. |
| F04 | MEDIUM | FIXED | Socket CORS configuration did not enforce Origin for direct WebSocket transport. Socket.IO allowRequest now enforces the approved-origin policy; browser HTTP mutations also receive explicit Origin/Fetch Metadata checks. |
| F05 | LOW | FIXED | Caller-selected public guest IDs could impersonate another free-play guest. Server-issued signed guest proofs permit reconnect; knowing an ID alone does not. Guests still cannot wager. |
| F06 | MEDIUM | PARTIAL | Accepted passwords beyond bcrypt's 72-byte input limit ignored suffixes. Newly hashed long passwords use a versioned SHA-256 prehash before bcrypt, including UTF-8 cases. Existing raw bcrypt hashes cannot reveal whether the original password was long: legacy credential reset remains M4. |
| F07 | MEDIUM | FIXED | Logging could expose current/new passwords and credentials through incomplete key redaction, raw errors, request payloads and unsanitized console paths. Central redaction now covers these paths, database URIs, JWTs, configured secrets and bcrypt hashes; request bodies/query values are omitted. Historical provider logs were not accessed. |
| F08 | MEDIUM | FIXED | Competition error paths returned raw internal exception messages/codes. An explicit public domain-error allowlist now preserves deliberate gameplay errors while suppressing SQL/network/internal messages. |
| F09 | MEDIUM | FIXED | Limiter keys used raw request paths, so varying resource IDs allocated new request buckets. Factory-specific keys now use matched route patterns, with a global API ceiling and protected socket-action ceiling. Infrastructure distribution remains M6. |
| F10 | MEDIUM | FIXED | Migrations did not explicitly deny inherited/default browser access to backend-owned application tables/functions. Migration 0014 adds revocation storage and revokes current-schema PUBLIC/anon/authenticated privileges and current creator's defaults. A deliberately granted disposable schema proves removal. Actual hosted grants/exposure were not verified; M1/M2 remain. |
| F11 | LOW | FIXED | Ignore rules omitted some `.env.*` variants. All private variants are now ignored, with example templates allowed. No real committed private credential was confirmed. |
| F12 | LOW | FIXED | API responses lacked an explicit private-cache boundary. API middleware now sends `Cache-Control: no-store`. No actual shared-cache disclosure was demonstrated. |
| F13 | LOW | FIXED | Frontend lacked CSP. Local Vercel config now enforces framing/base/object restrictions and supplies the fuller asset/API policy in Report-Only mode; backend supplies minimal enforced CSP. This is a defense-in-depth gap, not a demonstrated XSS exploit. M5 remains. |
| F14 | LOW | FIXED | Hosted email fallback could retain raw recovery tokens in in-memory test history and claim delivery without a transport. Hosted history is disabled; logger/SMTP stubs return failure. Real delivery is M3. Public recovery replies remain deliberately non-enumerating. |
| F15 | MEDIUM | FIXED | Hosted startup merely warned on JWT secrets shorter than 32 characters. It now rejects them. Length is not an entropy assessment; actual external secret quality was not tested. |
| F16 | LOW | FIXED | Malformed sandbox-faucet amounts were coerced/defaulted or failed as internal errors. Provided amounts must be positive safe integers within the existing sandbox maximum. No real-money authority was enabled. |
| F17 | MEDIUM | PARTIAL | One esbuild development-server advisory remains through four development-tool packages. No use of that esbuild `serve()` API was found in Fugluck's server. Production-only npm audit has zero findings. A controlled upstream/toolchain upgrade remains M8. |

F01 is supported by the [Socket.IO advisory](https://github.com/socketio/socket.io/security/advisories/GHSA-2gc4-cqfq-p2gv). F17 concerns the development `serve()` API described by the [esbuild advisory](https://github.com/evanw/esbuild/security/advisories/GHSA-67mh-4wv8-2f99), rather than every use of esbuild's transform/build APIs.

## Remaining manual actions

These are eight work items, not eight additional confirmed vulnerabilities.

1. **M1 — Reviewed staging release and migration.** PLANNED: use the existing protected backup/restore process, review/apply 0014 on the correct staging target, then release matching server/client code under separate authorization. Migration precedes server startup: the new session queries fail closed without its table. Verify creator/owner permissions before applying revocations. Old user/admin sessions intentionally require sign-in again. This audit did not apply a hosted migration or change flags.
2. **M2 — Hosted permission and isolation evidence.** Inspect actual Supabase role inheritance, table/function/default grants for every object creator, backend role privileges, RLS where used, storage buckets/policies, provider IAM and protected-backup access. Revoking current creator defaults does not cover every historical object creator or a future SECURITY DEFINER function granting PUBLIC execution. Reverify production frontend/API/DB isolation; historical handoffs recorded a production bundle pointing at staging, but current production requests failed and this session cannot confirm resolution.
3. **M3 — Recovery mail delivery.** Verify configured Resend sender and delivery for verification/reset under controlled staging accounts. SMTP is a stub, not a working transport. Do not treat a generic API reply as delivery proof; no external mail configuration was changed.
4. **M4 — Legacy long-password credentials.** Establish a reset plan for affected or potentially affected legacy bcrypt credentials. Length cannot be reconstructed from a bcrypt hash. New and newly changed passwords are fixed; old raw bcrypt verification remains compatible and may still accept equal first-72-byte inputs.
5. **M5 — CSP browser validation.** Inspect the Report-Only policy on staged login, guest reconnect, all supported games, images/fonts and API/WSS traffic. The fuller policy is not yet enforced, has no reporting collector, and future checkout must be reviewed when implemented. No interactive browser run was performed in this audit.
6. **M6 — Edge rate and proxy verification.** Validate the actual reverse-proxy hop chain (default one hop; explicitly trusting all proxies should be avoided), prevent spoofed forwarding headers at the edge, and add shared rate limits across replicas where needed. Process-local limits reset on restart and are not volumetric DDoS protection.
7. **M7 — Hosted security operations.** Establish auth/admin/abuse alerting, durable log retention/access rules and administrator MFA where supported. Financial event histories are transactionally guarded; `admin_audit_logs` are not immutable against the database owner, and some administrative audit writes are separate from their mutation. Security decisions can be tested locally without claiming an external monitoring service exists.
8. **M8 — Controlled development dependency upgrade.** Resolve the four-package esbuild tool-chain advisory through a compatible upstream update, revalidate migrations/builds, and avoid publishing esbuild's development `serve()` API on an untrusted network. No major or force upgrade was performed.

## Category-by-category audit

### 1

ISSUE: Secret / credential security

STATUS: PASS

EVIDENCE: 442 tracked files; 1,628 distinct Git blobs reachable from all local refs; ignored local environment values compared internally against those blobs and 20 final built assets; `packages/server/.env.example`, `packages/server/src/auth/jwt.ts`, `packages/client/src/env.ts`, lockfile and tracked documentation/fixtures.

FINDING: No confirmed private database, JWT, provider, service-role or private-key secret was found in the examined source/history/bundle scope. Matches were templates, test constants, code expressions and one retired historical Supabase public anon key (decoded role `anon`, not `service_role`). Three locally present private configuration values had zero exact Git/bundle matches. No `.github` workflow exists. No credential was tested against a provider, and inaccessible remote refs/provider secrets were not inspected.

ACTION: No rotation or history rewrite justified by the examined evidence. Report rotation as NO within this scope. F11 strengthens future ignore coverage.

### 2

ISSUE: Environment file exposure

STATUS: FIXED

EVIDENCE: `.gitignore`, client Vite configuration/public environment helpers, final client assets; read-only `https://staging.fugluck.com/.env` and `/` responses.

FINDING: F11 present. Current staging `/.env` returns HTTP 200 with the exact root HTML hash, `text/html` and no environment assignments: an SPA fallback, not an exposed env file. Only intended Vite public settings feed the client; no local private credential exact-match exists in assets. Production probes failed and do not establish production exposure or safety.

ACTION: BUILT ignore `.env.*`, retain `.env.*.example`. Runtime public deployment/health metadata remains non-secret. No hosted rewrite changed.

### 3

ISSUE: Authentication

STATUS: FIXED

EVIDENCE: `auth/jwt.ts`, `auth/session.ts`, `auth/middleware.ts`, `routes/auth.ts`, `matchmaking/socketAuth.ts`; new HTTP/socket tests for forged identities, invalid proofs, database outages and current account status.

FINDING: User identity comes from a verified cookie/ticket and database lookup, not a body/query/handshake userId. F02/F05 required corrections; malformed explicit socket authentication no longer falls back to a guest. Signed guest proof is a free-play capability, not an authenticated account session.

ACTION: BUILT durable current-session checks, credential binding and signed guest reconnect proof. All privileged operations remain server-authenticated. Migration requirement M1.

### 4

ISSUE: Authorization / IDOR / BOLA

STATUS: PASS

EVIDENCE: `routes/account.ts`, `friends.ts`, `wallet.ts`, `matches.ts`, `competitions.ts`, `admin.ts`, `adminCompetitions.ts`, `stagingMockCommercial.ts`; `playerReadModel.ts`; cross-user HTTP tests and competition/tournament suites.

FINDING: Own account/history/financial operations use trusted req.userId; friend acceptance/deletion checks membership. Ordinary users cannot select an admin actor or mutate another participant. Public catalog/seat/rank/score/user identity fields are intentional; financial account/reservation references, emails, hashes and tokens are not public projections. No confirmed cross-user financial mutation was found. Real withdrawal/deposit providers are unavailable.

ACTION: Added negative own-history, query-ID forgery, friend-resource and administrative access tests. No speculative route rewrite.

### 5

ISSUE: Database security

STATUS: PARTIAL

EVIDENCE: `db/client.ts`, `db/schema.ts`, migrations 0000–0014, `0009_sandbox_accounting.sql`, `0012_commercial_financial_core.sql`, `0014_security_boundaries.sql`; local anonymous role grants before/after revocation, future-table default privilege test; current client source.

FINDING: F10 lacked an explicit browser-deny migration. Current architecture uses the backend connection and Fugluck-owned auth, not customer direct Supabase table access. Financial SQL constraints/triggers remain in place. No frontend service-role key or current Supabase client was found. Hosted RLS, inherited permissions and backend privilege reduction were not inspected; absence of direct browser code does not prove those hosted controls.

ACTION: BUILT 0014 denies current-schema table/sequence/function access for PUBLIC/browser roles while retaining backend owner access. Tested a deliberately permissive isolated schema. PLANNED M1/M2; not a claim that actual hosting had permissive grants.

### 6

ISSUE: SQL / NoSQL injection

STATUS: NOT PRESENT

EVIDENCE: Database query sites across routes, payments, accounting and competitions; `scripts/sql-injection-check.ts`; migration/administrative identifier construction; new malicious amount/body tests.

FINDING: Runtime values use pg placeholders or Drizzle expressions. SQL identifiers derive from code-controlled schema/migration state, not arbitrary request paths. No NoSQL store or executable query-object API is present. Dynamic SQL in 0014 uses PostgreSQL format `%I` for catalog-derived identifiers.

ACTION: Retained parameterized access. Existing injection suite: 19 passes. Code review is not a database-driver security proof.

### 7

ISSUE: Input validation

STATUS: FIXED

EVIDENCE: Route validators, `payments/financialFlows.ts`, `accounting/commercialLedger.ts`, competition/tournament rules, `routes/competitions.ts` faucet, `scripts/input-validation-check.ts`, new numeric attacks.

FINDING: Server checks financial safe integers, capacities/enums/provenance and identity. F16 allowed malformed sandbox faucet amounts to coerce/default or become a 500. Security-sensitive updates use explicit fields; harmless extra fields are not universally rejected, but cannot grant role/balance/result authority.

ACTION: BUILT strict provided faucet amount bounds and regression coverage for null/text/fractional/unsafe/nonpositive/over-cap amounts. Economics and accepted legitimate amounts unchanged.

### 8

ISSUE: Mass assignment

STATUS: NOT PRESENT

EVIDENCE: Inserts/updates in account/auth/admin/financial/competition routes, `financialFlows.ts`, public projections; new policy-accept body test with role/balance fields.

FINDING: No request-body spread into privileged user, ledger, provider or winner fields was found. Server creates those values explicitly. Extra role/balance fields submitted alongside a legitimate mutable field do not change stored privilege.

ACTION: Added a negative persisted-role assertion; kept explicit allowlists.

### 9

ISSUE: Client-only security

STATUS: PASS

EVIDENCE: `payments/eligibility.ts`, `risk.ts`, `riskReview.ts`, `financialFlows.ts`, `config/commercialSafety.ts`, authority admission/runtime and tournament service; commercial/authority/domain suites.

FINDING: UI hiding is supplemented by server roles, eligibility/risk/amount gates, commercial enablement and authoritative results. Commercial prizes cannot be selected by the client. Casual nonconvertible COINS compatibility play still has its older client-report boundary; it does not authorize commercial settlement.

ACTION: Preserved fail-closed commercial controls and server engines. No competition economics changes.

### 10

ISSUE: Admin security

STATUS: FIXED

EVIDENCE: `routes/admin.ts`, `adminCompetitions.ts`, `auth/middleware.ts`, admin permissions/audit helpers; admin HTTP/security/lockout suites and new purpose-isolation tests.

FINDING: Roles/permissions are read server-side and required on APIs. F02 made a dedicated admin login proof distinct from a relabeled user cookie, and invalidates it on logout/password change. Restricted users cannot authenticate as admin. No ordinary-user administrative bypass was demonstrated. Hosted MFA/operator account policy remains unknown.

ACTION: BUILT separate purpose/stamp checks; tested ordinary-user rejection, valid owner acceptance, cookie relabeling and revocation. M7 covers external operations.

### 11

ISSUE: Payment / financial authority

STATUS: PASS

EVIDENCE: `payments/financialFlows.ts`, provider/mock implementations, `accounting/commercialLedger.ts`, ledger migrations/triggers, tournament admission/settlement; commercial 76, phase-2 accounting 54 and atomic wager 38 passes.

FINDING: Backend derives actor, amount, trusted operation and result. Ledger is append-only double entry with safe amounts, locks and idempotent transaction identities; no customer `setBalance` operation found. Current payment provider implementations are mock; real-money functionality stays unavailable/off.

ACTION: Preserved ledger/accounting rules. Added invalid financial amount assertions; no client authority over provider success or winner added.

### 12

ISSUE: Webhook security

STATUS: PASS

EVIDENCE: `payments/provider.ts`, `mockProvider.ts`, `hostedMockProvider.ts`, `financialFlows.ts`, staged mock route/config and replay/idempotency tests.

FINDING: Existing mock provider authenticity uses HMAC verification and timing-safe comparison, event identity/hash and transactional idempotency; raw callback data cannot select another user's credit. No implemented Keepz/bank integration exists to audit as live. No externally unsigned callback was found to be trusted for money.

ACTION: No speculative provider integration. PLANNED Keepz rule remains callback notification → backend authoritative provider lookup → validated financial event; do not activate an unsigned raw callback as payment proof.

### 13

ISSUE: XSS

STATUS: NOT PRESENT

EVIDENCE: React renderers, game innerHTML assignments, avatar/URL usage; `scripts/xss-audit-check.ts` (17 passes); client bundle review.

FINDING: React renders user strings as text; game HTML writes are constant pause markup/container clearing. No arbitrary customer HTML/SVG injection sink was found. Avatars load as browser images, not server-fetched documents or raw HTML. CSP is additional hardening, not the evidence for absence of XSS.

ACTION: Retained text rendering. F13 supplies framing/base/object defense and Report-Only policy; M5 remains.

### 14

ISSUE: CSRF

STATUS: FIXED

EVIDENCE: `config/httpSecurity.ts`, cookie options, `config/cors.ts`; negative Origin, cross-site Fetch Metadata and form-body HTTP tests.

FINDING: Sessions are HttpOnly cookies with hosted Secure/SameSite=Lax. Mutable browser HTTP requests now require approved supplied Origin, reject cross-site requests without Origin and reject nonempty non-JSON bodies. Existing credentialed CORS remains restricted. Originless nonbrowser callers are permitted but still need valid authentication/provider proof.

ACTION: BUILT compatible browser CSRF boundary. No irrelevant bearer-only token framework introduced. Trusted approved-origin XSS and GET initialization limitations are separately covered.

### 15

ISSUE: Session / cookie security

STATUS: FIXED

EVIDENCE: `auth/jwt.ts`, `auth/session.ts`, account/auth/admin routes, socket session guard, hosted startup identity checks; copied-cookie/ticket and socket disconnect tests.

FINDING: F02 present. Sessions remain seven days but expire server-side, have random jti and purpose, and are bound to current credentials. Logout revocation is persisted. Password changes/recovery invalidate old user/admin proofs. Current browser receives a fresh proof on authenticated password change. Host-only cookies and Secure/HttpOnly/Lax are required on hosted startup.

ACTION: BUILT local immediate socket disconnect, protected-action rechecks and a ten-second cross-replica current-session check. Frames are not individually database-authenticated; another replica may process in-flight frames within that interval. Old release sessions require login. M1/M6.

### 16

ISSUE: Password reset / account recovery

STATUS: FIXED

EVIDENCE: `routes/auth.ts`, token hashing/expiry, `email/emailService.ts`; actual concurrent reset and verify requests, replay and stale-session tests.

FINDING: Tokens are random UUIDs stored hashed; reset expires after one hour. Recovery responses are generic; configured APP_URL controls links. Nonproduction fixture tokens are excluded by mandatory hosted NODE_ENV=production. F03 races and F02 stale sessions corrected. Email delivery is not proven by HTTP success.

ACTION: BUILT atomic token consumption and session invalidation. F14 removes hosted raw-token history/fake transport success. M3 delivery and M4 legacy credentials remain.

### 17

ISSUE: JWT security

STATUS: FIXED

EVIDENCE: `auth/jwt.ts`, `config/startup.ts`, `deploymentIdentity.ts`, HTTP/socket verification tests and logger redaction.

FINDING: Verification pins HS256, checks expiration and hosted issuer/audience, restricts user/admin/socket/guest purposes, and reloads account state. Unsigned, forged, expired and no-exp proofs are rejected. F15 boot configuration did not reject a short secret. Socket proofs expire in 60 seconds and cannot outlive their parent session; guest proofs cannot authenticate accounts.

ACTION: BUILT minimum hosted secret length enforcement and scoped current proofs. Secret entropy/rotation schedule remains operator responsibility; no signing key was printed or rotated.

### 18

ISSUE: CORS

STATUS: FIXED

EVIDENCE: `config/cors.ts`, hosted identity allowlist, Socket.IO allowRequest, actual polling/WebSocket and approved frontend tests; staged static headers.

FINDING: API credentials use explicit origins, not credentialed `*`. Public static staging HTML uses `*` without credentials, which is not an authenticated disclosure. F04 needed explicit direct-WebSocket Origin enforcement. Origin is a browser boundary, not identity for a nonbrowser client.

ACTION: BUILT shared allowlist enforcement for both Socket.IO transports. Local approved frontend HTTP remained functional in tests; actual browser reconnect validation remains M5.

### 19

ISSUE: Rate limiting / abuse protection

STATUS: PARTIAL

EVIDENCE: `utils/rateLimiter.ts`, auth/admin/financial/competition route limiters, `index.ts`, socket guard; existing rate suite 11 and new identifier-variation test.

FINDING: F09 corrected. Recovery/verification/guest issuance and financial/admin paths have application limits. API fallback is 500/minute per client; protected socket actions are 30/10 seconds per account before querying authentication. Limits are process-local and depend on trustworthy client IP; they do not prove cloud-edge/distributed protection.

ACTION: BUILT stable route buckets and general ceiling without per-frame DB queries. PLANNED M6 edge/shared enforcement. No claim of volumetric attack resistance.

### 20

ISSUE: Cloud / Supabase / storage security

STATUS: REQUIRES MANUAL ACTION

EVIDENCE: Current client/backend source, database target/TLS validation, migrations, template configuration, unauthenticated staged health.

FINDING: No active browser service-role integration or customer-upload storage API exists. Backend staging target is explicitly fingerprinted and TLS verified in code. Actual storage policies, provider IAM, RLS and inherited browser-role privileges cannot be established from local source or public health.

ACTION: M2 inspect hosted configuration without changing it here. Do not infer private buckets or least-privilege database ownership from absent client calls.

### 21

ISSUE: File upload security

STATUS: NOT APPLICABLE

EVIDENCE: Route inventory, client file inputs/storage API search; `scripts/file-upload-audit-check.ts` (4 passes).

FINDING: No Fugluck customer binary-upload route was found. Avatar URLs are image references; developer backups/build artifacts are not customer uploads.

ACTION: No unused upload framework/scanner added. Review this boundary before implementing uploads.

### 22

ISSUE: Path traversal

STATUS: NOT PRESENT

EVIDENCE: Runtime filesystem reads, migration journal/SQL paths, static client configuration and route inventory.

FINDING: No customer-controlled runtime filename/download/export path is supplied to filesystem operations. Migration filenames derive from checked-in deployment data. The backend does not statically expose its environment or backup directory.

ACTION: Keep repository-controlled migrations and ignored protected artifacts separate from static output. No speculative filesystem endpoint added.

### 23

ISSUE: SSRF

STATUS: NOT PRESENT

EVIDENCE: Server fetch/HTTP sites, `email/emailService.ts`, provider implementations and avatar handling.

FINDING: Runtime outbound email request targets fixed `https://api.resend.com/emails`; user avatar URLs are fetched by the browser. No user-selected server URL/host/scheme or cloud-metadata proxy was found. Administrative DATABASE_URL is guarded configuration, not public request input.

ACTION: Keep future provider lookups on configured allowlisted endpoints; do not claim a general arbitrary-URL service has been hardened.

### 24

ISSUE: Command injection

STATUS: NOT PRESENT

EVIDENCE: Server runtime child_process/exec/spawn search; developer backup and test helpers inspected separately.

FINDING: No customer-facing runtime shell execution was found. Protected backup tooling invokes fixed executables with argument arrays, not customer shell strings.

ACTION: No command execution feature added or rewritten. CLI maintenance tooling is not exposed as an API.

### 25

ISSUE: Insecure deserialization

STATUS: NOT PRESENT

EVIDENCE: Express JSON parser, JWT verifier, provider/authority payload validation, persisted JSON read models.

FINDING: Data is parsed as JSON or cryptographically verified tokens and checked before security-sensitive use. No executable serialized-object/eval format found. Unknown request properties do not enter privileged ORM fields.

ACTION: Retained JSON boundaries, body limits and explicit runtime validation. No blanket claim that parsing alone validates payloads.

### 26

ISSUE: OAuth security

STATUS: NOT APPLICABLE

EVIDENCE: Actual current auth routes/AuthContext and provider dependencies.

FINDING: Current Fugluck uses its owned password/cookie authentication. Retired Supabase client history does not establish an active OAuth flow. No runtime social login callback or account-linking route found.

ACTION: No OAuth/PKCE implementation introduced; review before adding providers.

### 27

ISSUE: Open redirects

STATUS: NOT PRESENT

EVIDENCE: Login/reset/email links, client navigation and payment-flow responses.

FINDING: Recovery links use configured APP_URL plus controlled relative routes, not a customer-supplied redirect destination. No active OAuth or external checkout redirect route found.

ACTION: Retain controlled destinations; do not accept future arbitrary return URLs.

### 28

ISSUE: Source maps / debug output

STATUS: PASS

EVIDENCE: Final Vite production build has 20 assets and zero `.map` files; error middleware, admin operations routes, deployment/health payloads.

FINDING: No public source maps in the local output. Backend generic errors do not return stacks. Authenticated admin diagnostics are not a public database viewer. Local build evidence cannot rule out unrelated stale files at a hosting provider.

ACTION: F08 hides internal competition error details; M2/M7 cover hosted inventory/log visibility. Existing chunk-size advisory is not a source-map exposure.

### 29

ISSUE: Production error handling

STATUS: FIXED

EVIDENCE: Global Express error handler, auth/admin route catches, competition socket/HTTP paths, `competitions/playerError.ts`, safe logger and error tests.

FINDING: F08 present: some caught exceptions exposed raw messages/codes despite the generic global 500. Safe domain codes now survive only through an explicit allowlist; unknown database/network details map to fixed generic responses. Internal errors remain sanitized diagnostics.

ACTION: BUILT public error boundary. Preserved expected `GAMEPLAY_BLOCKED` behavior after initial three compatibility assertion failures; admission still rejected and reserved no funds. No tests weakened.

### 30

ISSUE: Logging / secret leakage

STATUS: FIXED

EVIDENCE: All server console sites, `utils/safeLogger.ts`, email delivery paths, client console sites and new redaction tests.

FINDING: F07/F14 present. Current/new passwords, reset/socket proofs, signature/config keys, JWT/database/bcrypt text, errors and request payloads were incompletely protected. No customer card-data processing exists. Browser logs inspected do not print session/JWT/password values.

ACTION: BUILT central bounded/cycle-safe logging; request bodies and query values omitted; server diagnostic console calls routed through logger. Hosted test email history disabled. Historical logs were neither read nor purged; M7.

### 31

ISSUE: Audit logging

STATUS: PARTIAL

EVIDENCE: Admin audit helpers/schema, commercial financial events/postings/transactions and append-only SQL triggers; admin/commercial/accounting suites.

FINDING: Privileged actions have actor/action metadata, financial transitions are recorded with transactionally protected histories. Financial append-only triggers protect application mutations. Some admin mutation/audit pairs are separate writes, and admin audit records are not immutable against a privileged database owner. This is a durability/operations limitation, not a proven ordinary-user bypass.

ACTION: Preserve existing audit structure; M7 improve operational retention/privilege boundaries and review atomic administrative audit writes. No enterprise logging stack added.

### 32

ISSUE: Security monitoring

STATUS: PARTIAL

EVIDENCE: Request logger, admin operations/reconciliation endpoints, `competitions/operationsTelemetry.ts`, provider idempotency and financial events.

FINDING: Local logs show request failures/rate rejections; operations telemetry exposes authority/recovery/financial counters to authorized admins. Durable financial records allow reconciliation. No verified external auth/admin anomaly alerting or log collector is configured in source; some counters are process-local.

ACTION: Safer logs remain useful signals; M7 establish hosted collection/alerting and access/retention. Do not infer real-time fraud monitoring from reconciliation tests.

### 33

ISSUE: Backup / restore

STATUS: PARTIAL

EVIDENCE: Existing ignored `Temp/competition-rollout-20260928/backup-restore.cjs` and retained rehearsal evidence; `.gitignore`, deployment/rollout docs and PROGRESS historical handoff.

FINDING: Source workflow uses read-only source transaction/TLS, consistent snapshot, environment-supplied credentials, fresh isolated destination checks, non-destructive migration review and reconciliation/parity. Backup artifacts remain under ignored private Temp paths, not client static output. This audit read the process and prior evidence; it did not perform a new backup/restore or inspect hosted object access permissions.

ACTION: Preserve process. M1 reuse it for 0014 and M2 verify actual access controls. No existing archive copied into Git.

### 34

ISSUE: Security headers

STATUS: FIXED

EVIDENCE: `config/httpSecurity.ts`, `packages/client/vercel.json`, local HTTP header assertions; read-only staging headers.

FINDING: F13 CSP gap and F12 cache gap corrected locally. Backend now sends nosniff, DENY, no-referrer, restricted permissions, minimal CSP and hosted HSTS; frontend config adds compatible minimum enforced CSP plus broader Report-Only policy. Current deployed staging still has no CSP because this candidate is not deployed; existing staging HSTS/DENY/nosniff were observed.

ACTION: BUILT local headers. M1/M5 apply and browser-check without enforcing a speculative restrictive script/checkout policy.

### 35

ISSUE: Clickjacking

STATUS: PASS

EVIDENCE: Existing frontend DENY response, Vercel headers, new backend CSP/header tests.

FINDING: Staging pages already send X-Frame-Options DENY; local candidate adds explicit CSP frame-ancestors none to client and API. No intended hostile embedding use case found.

ACTION: Preserve DENY and add modern framing boundary locally. No actual browser attack was run against hosting.

### 36

ISSUE: HTTPS / encryption

STATUS: PARTIAL

EVIDENCE: `db/client.ts`, `deploymentIdentity.ts`, cookie options, fixed Resend HTTPS endpoint; verified-TLS staging requests.

FINDING: Code requires hosted database CA/TLS checks and rejects downgrades; hosting requires secure runtime/host-only cookies. Staging frontend/API HTTPS verified in fresh read-only requests. Disposable loopback tests intentionally do not use TLS. Production TLS/provider secret management cannot be established from failed production probes or local source.

ACTION: Keep standard crypto/TLS and environment secrets. M2 verify actual infrastructure; no custom encryption invented.

### 37

ISSUE: Tenant / user isolation

STATUS: PASS

EVIDENCE: Same route/financial/public projection review as category 4; new negative tests and existing authority/admin/financial suites.

FINDING: Account boundaries use session-derived actors; public competition participation is intentional, private financial/auth records are not. Signed guest identity prevents reuse of a publicly visible identifier as proof. No cross-user financial access was confirmed in examined routes.

ACTION: Added explicit own-wallet/history, body/query identity, friend mutation and role-negative tests; no claim of exhaustive external ID enumeration.

### 38

ISSUE: Dependency security

STATUS: PARTIAL

EVIDENCE: npm lockfile, installed Engine.IO package; before/after and production-only `npm audit --json`; primary upstream advisories.

FINDING: Before: one high and four moderate package findings. After patch: zero high/critical, four moderate development-tool packages representing one esbuild advisory. Production-only audit: zero known findings. F01 relevant server crash fixed; F17 requires compatible toolchain work. Audit results are a snapshot, not malicious-package assurance.

ACTION: Updated only Engine.IO to 6.6.10 with `--ignore-scripts`; no force/major update. M8 remaining dev dependency review.

### 39

ISSUE: Supply chain / malicious packages

STATUS: PASS

EVIDENCE: Workspace manifests/lockfile, patch diff, lockfile install-script inventory.

FINDING: Declared install scripts belong to existing esbuild native-binary installers (root and toolchain copies) and optional fsevents. No newly introduced obscure dependency/network installer was found in this patch; Engine.IO dependency bump executed no install scripts. Native installer presence alone is not malicious behavior. Package provenance was not cryptographically attested and no sandboxed dynamic malware analysis was performed.

ACTION: Retained lockfile and reviewed minimal patch. No legitimate package removed without evidence; M8 addresses known dev advisory.

### 40

ISSUE: AI / prompt injection

STATUS: NOT APPLICABLE

EVIDENCE: Runtime server/client dependency and API searches, financial authority code.

FINDING: No customer-facing LLM, retrieval or model-controlled tool execution exists in Fugluck runtime. Local Codex/JevRouter development tools are not a customer financial authorization surface.

ACTION: No runtime AI machinery added. Future AI must not grant financial authority or derive permissions from prompts/output.

### 41

ISSUE: Unpermissioned AI access

STATUS: NOT PRESENT

EVIDENCE: Runtime imports, frontend environment/source/build secret scans, server outbound requests.

FINDING: No runtime AI service key/tool capability was found in browser assets or server application. This does not inspect unrelated workstation tool credentials.

ACTION: No AI provider connection or secret introduced.

### 42

ISSUE: Code review / AI-generated code

STATUS: PASS

EVIDENCE: Recent auth/socket, competition admission/authority/persistence/recovery, payment/provider, eligibility/risk, commercial ledger and startup source; full suite and focused security negatives.

FINDING: Reviewed actual code rather than accepting historical architectural prose. Current auth uses owned cookies, not the old Supabase rehydration claim; competitions use continuous server authority rather than client replay authority. Confirmed defects became F01–F17; working financial rules and engines were preserved. Origin/credential/version/error assumptions received targeted fixes.

ACTION: BUILT local remediation plus tests. Historical acceptance limitations remain; source review does not certify every line or hosting control.

### 43

ISSUE: Fail-closed behavior

STATUS: FIXED

EVIDENCE: Commercial safety/provider/risk gates, session middleware/socket guard, startup/migration identity checks, financial transaction rollback and authority tests.

FINDING: Commercial lookup/eligibility failures do not grant money; missing authority results do not choose a client winner. Socket authentication database failures now reject as authentication_unavailable rather than producing an unhandled middleware rejection or guest downgrade. Hosted logger/SMTP fallback no longer claims delivered recovery mail. No real provider enabled.

ACTION: BUILT fail-closed auth errors and mail truthfulness; preserved transaction/result gates. Explicitly tested DB-outage socket rejection and request-driven mock enablement denial.

### 44

ISSUE: Race conditions / TOCTOU

STATUS: FIXED

EVIDENCE: F03 transactional token consume; financial/admission advisory and row locks, request/event idempotency, bracket fencing/advance persistence; concurrency/recovery suites.

FINDING: Reset/verification race confirmed and corrected. Financial and tournament architecture already guards duplicate entries, awards, provider events and retry ownership; failures cannot partially commit postings. Current-session checks are not a lock covering an entire distributed action, so narrowly in-flight work after revocation is not claimed impossible.

ACTION: Added actual two-request reset/verify races. Kept exactly-once identities, transaction guards and authority fencing; full concurrency/recovery suites pass.

### 45

ISSUE: Financial integer safety

STATUS: PASS

EVIDENCE: `accounting/commercialLedger.ts`, financial flows, tournament amount/capacity rules, SQL constraints and reconciliation.

FINDING: Commercial amounts are bounded safe integer minor units; BigInt is used for aggregate validation and balance constraints guard persistence. NaN, Infinity, negative/fractional/unsafe amounts are rejected. Legacy recreational currency arithmetic is not presented as real-money accounting.

ACTION: Added five invalid numeric amount cases and retained commercial 76/accounting 54/rules 180 passes. No economics/rake/prize change.

### 46

ISSUE: HTTP method / API design

STATUS: PARTIAL

EVIDENCE: All route registrations; public-user projection calls, wallet initialization/monthly allowance helpers, competition catalog initialization.

FINDING: Financial/customer mutations use authenticated POST/PUT/PATCH/DELETE. Existing GET `/api/auth/me`/balance paths may idempotently initialize signup/monthly COINS allowance; catalog reads may initialize default schedules/terms. These are trusted compatibility/provisioning writes, not commercial deposit/withdrawal/entry/payout. Therefore a strict assertion that every GET is read-only would be false.

ACTION: Document residual semantics. A future reviewed split into explicit initialization/maintenance operations should preserve the standing allowance/catalog rules; no gratuitous economics redesign in this audit. No demonstrated fund-theft finding assigned to this behavior.

### 47

ISSUE: Cache security

STATUS: FIXED

EVIDENCE: `config/httpSecurity.ts`, authenticated local HTTP response checks; static hosting configuration.

FINDING: F12 explicit API no-store boundary was missing. All `/api/` responses now have no-store, including private account, wallet, admin and competition data/errors. Public versioned static assets may still be cached. Private account data is not embedded in the public HTML shell.

ACTION: BUILT middleware and regression assertion. Hosting cache behavior for this new candidate remains unapplied M1.

### 48

ISSUE: Security of staging

STATUS: PARTIAL

EVIDENCE: `deploymentIdentity.ts`, `commercialSafety.ts`, `stagingMockCommercial.ts`, staging safety tests; fresh public frontend identity/API health.

FINDING: Staging is fingerprinted to its separate registered database, frontend and host-only cookie scope. Public current identity is the base SHA; health reports money/deposits/withdrawals/commercial competitions false. Read-only checks did not inspect private provider settings or shared credential reuse. Historical production frontend pointed at staging; fresh production requests failed, so present isolation is unverified. No safety flag changed, including existing mock competition settings.

ACTION: M1/M2 staged review only. Production startup remains blocked pending registration of a separate accepted target; do not share production credentials or infer Phase 7A approval.

### 49

ISSUE: Production debug / internal dashboards

STATUS: PASS

EVIDENCE: Route inventory, health/deployment payloads, admin operations endpoints, mock route guards and environment startup controls.

FINDING: Admin diagnostics require server admin authorization. Sandbox/test money routes are guarded and cannot affect an accepted production commercial target. Public health exposes environment/revision, routing fingerprint/project identifier, readiness and feature-denial states, not credentials, SQL or private account data. These identifiers aid deployment audit; they are not secrets.

ACTION: Keep financial/debug endpoints guarded. Current production endpoint inventory was not verified live; M2.

### 50

ISSUE: Security regression tests

STATUS: PASS

EVIDENCE: New `scripts/security-boundary-check.ts` and `security-test-session.ts`; updated existing fixture session helpers/socket tests; full suite result below.

FINDING: 75 new assertions exercise actual local HTTP/Socket.IO and disposable database boundaries, with targeted pure-function cases. They cover unauthenticated/cross-user/admin denials, purpose/signature/expiry, guest impersonation, logout/password invalidation, concurrent one-use tokens, origin/CSRF/cache/headers, numeric/mass-assignment/rate/error/logging cases, grant hardening and balanced reconciliation. No hosted account action or provider callback was sent.

ACTION: Added canonical npm test entry and test:security command. Fixture tokens now bind to actual fixture password hashes instead of bypassing current-session checks.

### 51

ISSUE: Run existing full suite

STATUS: PASS

EVIDENCE: Every `scripts/*-check.ts` executed after final source edits; 52 scripts, 2,270 passes, zero failures/nonzero exits/count mismatches; builds and per-script table below.

FINDING: User's 50/2,177 baseline predates the existing 18-assertion socket-session script: the actual starting baseline was 51/2,195. Added security suite 75 gives 52/2,270. Initial run had three expected gameplay-error wording failures; explicit public error mapping fixed them, and full final suite was repeated successfully. No existing count was reduced.

ACTION: Typecheck (including client build), explicit client build, server build all exit zero. Migration/schema parity 338, commercial 76, phase-2 accounting 54 and all competition/recovery suites pass. Existing client chunk-size warning remains.

### 52

ISSUE: No production deployment

STATUS: PASS

EVIDENCE: Performed actions, Git branch/ref comparison, local disposable database identity, read-only staging evidence.

FINDING: No commit/push/merge/deploy/DNS/provider/key change occurred. Production/main remained untouched. Tests used `127.0.0.1:55439/fugluck_security_test` with the data directory checked against `Temp/competition-restructure/pgdata`; no hosted database was mutated or reset. Real money remains OFF.

ACTION: Stop disposable test service after checkpoint; retain local reviewable candidate. Any release or cloud action is separate authorization/work.

### 53

ISSUE: Security report

STATUS: PASS

EVIDENCE: This report and `docs/evidence/security-audit-20261001.json`.

FINDING: All 55 requested categories use ISSUE/STATUS/EVIDENCE/FINDING/ACTION. Findings, local verification, manual hosted limitations, severity/counts and exact session file changes are explicit. No actual secrets are included.

ACTION: Save report/evidence and prepend verified handoff to PROGRESS.md; preserve unrelated dirty documentation.

### 54

ISSUE: Severity

STATUS: PASS

EVIDENCE: Distinct F01–F17 register and severity rationale above.

FINDING: No confirmed critical wallet mutation, arbitrary admin, injection or committed private credential was found. Two high findings are an applicable remote crash advisory and reusable compromised sessions. Medium/low gaps are described with prerequisites and residual scope, not promoted to financial exploits without evidence.

ACTION: Count findings once, even where several categories cite them. Partial development/legacy issues are not counted fixed; manual tasks are tracked separately.

### 55

ISSUE: Final response

STATUS: PASS

EVIDENCE: Final suite/build/audit evidence and preserved ref identities.

FINDING: Local candidate passes with eight remaining manual tasks; tests alone do not establish hosted security or financial launch readiness. Production/main unchanged, money OFF, no confirmed rotation-required secret in examined scope.

ACTION: Report exact files and counts and end with SAFE FOR NEXT STAGING SECURITY REVIEW, scoped to review rather than deployment approval.

## Verification results

Final all-script run completed `2026-10-01T15:31:57Z`: **52 scripts / 2,270 passing assertions / 0 failures / 0 nonzero exits / 0 count mismatches**. Each existing script retained its expected pass count. The suite enumerated every `*-check.ts` file; other maintenance/helper scripts were not executed as test scripts. Tests used fresh disposable PostgreSQL schemas and actual local HTTP/Socket.IO for applicable suites. Accounting and reconciliation passed with zero discrepancy in the focused security fixture.

Typecheck, explicit client production build and server build passed. Production npm audit: zero known vulnerabilities; full audit: four moderate development package findings, one remaining advisory. Final 20 client assets contain no exact local private credential matches and no public source maps. Initial failing run was retained in ignored evidence rather than concealed.

| Script (`scripts/`) | Pass | Fail | Exit |
|---|---:|---:|---:|
| admin-console-check.ts | 49 | 0 | 0 |
| admin-reset-recovery-check.ts | 11 | 0 | 0 |
| admin-security-check.ts | 8 | 0 | 0 |
| atomic-wager-lifecycle-check.ts | 38 | 0 | 0 |
| auth-account-lifecycle-check.ts | 41 | 0 | 0 |
| authority-presentation-check.ts | 24 | 0 | 0 |
| canvas-render-check.ts | 21 | 0 | 0 |
| commercial-financial-check.ts | 76 | 0 | 0 |
| competition-admin-http-check.ts | 44 | 0 | 0 |
| competition-authority-check.ts | 65 | 0 | 0 |
| competition-authority-latency-check.ts | 26 | 0 | 0 |
| competition-phase1-domain-check.ts | 41 | 0 | 0 |
| competition-phase2-accounting-check.ts | 54 | 0 | 0 |
| competition-phase3-lifecycle-check.ts | 45 | 0 | 0 |
| competition-phase4-ui-check.ts | 44 | 0 | 0 |
| competition-phase5-admin-check.ts | 42 | 0 | 0 |
| competition-player-ux-check.ts | 110 | 0 | 0 |
| competition-socket-session-check.ts | 18 | 0 | 0 |
| cors-audit-check.ts | 20 | 0 | 0 |
| cyber-hopper-authority-check.ts | 42 | 0 | 0 |
| determinism-check.ts | 12 | 0 | 0 |
| environment-safety-check.ts | 89 | 0 | 0 |
| file-upload-audit-check.ts | 4 | 0 | 0 |
| financial-reconnection-check.ts | 17 | 0 | 0 |
| i18n-check.ts | 65 | 0 | 0 |
| input-validation-check.ts | 20 | 0 | 0 |
| legal-policy-help-check.ts | 86 | 0 | 0 |
| match-lifecycle-durability-check.ts | 26 | 0 | 0 |
| matchmaking-check.ts | 65 | 0 | 0 |
| migration-schema-parity-check.ts | 338 | 0 | 0 |
| owner-admin-lockout-check.ts | 10 | 0 | 0 |
| password-policy-check.ts | 18 | 0 | 0 |
| password-security-check.ts | 13 | 0 | 0 |
| rate-limit-check.ts | 11 | 0 | 0 |
| registration-verification-check.ts | 9 | 0 | 0 |
| request-logging-audit-check.ts | 12 | 0 | 0 |
| score-validation-check.ts | 12 | 0 | 0 |
| security-boundary-check.ts | 75 | 0 | 0 |
| seed-admin-check.ts | 7 | 0 | 0 |
| shutdown-lifecycle-check.ts | 4 | 0 | 0 |
| sql-injection-check.ts | 19 | 0 | 0 |
| staging-mock-commercial-check.ts | 13 | 0 | 0 |
| staging-readiness-check.ts | 40 | 0 | 0 |
| test-database-safety-check.ts | 18 | 0 | 0 |
| tournament-authority-check.ts | 34 | 0 | 0 |
| tournament-domain-check.ts | 97 | 0 | 0 |
| tournament-recovery-check.ts | 52 | 0 | 0 |
| tournament-rules-check.ts | 180 | 0 | 0 |
| wallet-friends-check.ts | 48 | 0 | 0 |
| wallet-settlement-concurrency-check.ts | 16 | 0 | 0 |
| wallet-settlement-integrity-check.ts | 24 | 0 | 0 |
| xss-audit-check.ts | 17 | 0 | 0 |

## Exact files changed by this audit session

Exactly **52 files** changed/added by this session:

- `.gitignore`
- `PROGRESS.md`
- `docs/SECURITY_AUDIT.md`
- `docs/evidence/security-audit-20261001.json`
- `package-lock.json`
- `package.json`
- `packages/client/src/lib/guestId.ts`
- `packages/client/src/matchmaking/useMatchSocket.ts`
- `packages/client/vercel.json`
- `packages/server/drizzle/0014_security_boundaries.sql`
- `packages/server/drizzle/meta/_journal.json`
- `packages/server/src/auth/jwt.ts`
- `packages/server/src/auth/middleware.ts`
- `packages/server/src/auth/password.ts`
- `packages/server/src/auth/session.ts`
- `packages/server/src/competitions/authorityRuntime.ts`
- `packages/server/src/competitions/authorityStore.ts`
- `packages/server/src/competitions/instanceService.ts`
- `packages/server/src/competitions/lifecycleEngine.ts`
- `packages/server/src/competitions/playerError.ts`
- `packages/server/src/competitions/templateService.ts`
- `packages/server/src/competitions/tournamentService.ts`
- `packages/server/src/config/httpSecurity.ts`
- `packages/server/src/config/startup.ts`
- `packages/server/src/db/client.ts`
- `packages/server/src/db/schema.ts`
- `packages/server/src/email/emailService.ts`
- `packages/server/src/index.ts`
- `packages/server/src/matchmaking/index.ts`
- `packages/server/src/matchmaking/matches.ts`
- `packages/server/src/matchmaking/queue.ts`
- `packages/server/src/matchmaking/socketAuth.ts`
- `packages/server/src/routes/account.ts`
- `packages/server/src/routes/admin.ts`
- `packages/server/src/routes/adminCompetitions.ts`
- `packages/server/src/routes/auth.ts`
- `packages/server/src/routes/competitions.ts`
- `packages/server/src/utils/rateLimiter.ts`
- `packages/server/src/utils/safeLogger.ts`
- `packages/server/src/validation/triviaQuestions.ts`
- `packages/server/src/wallet/ledger.ts`
- `scripts/competition-admin-http-check.ts`
- `scripts/competition-authority-check.ts`
- `scripts/competition-phase5-admin-check.ts`
- `scripts/competition-player-ux-check.ts`
- `scripts/competition-socket-session-check.ts`
- `scripts/cyber-hopper-authority-check.ts`
- `scripts/migration-schema-parity-check.ts`
- `scripts/security-boundary-check.ts`
- `scripts/security-test-session.ts`
- `scripts/tournament-authority-check.ts`
- `scripts/tournament-recovery-check.ts`

Server files outside authentication/config/routes largely change diagnostic console calls to the central sanitizer; game engines and financial economics were not rewritten. Existing unrelated changes in AGENTS.md, DEPLOYMENT.md, prior competition reports/evidence, `.agents/` and the stray untracked file remain as found. Only this session's entry was added to the already dirty PROGRESS.md.

Raw local logs, secret-scan tooling, dependency JSON and initial/final run records are retained under ignored `Temp/security-audit/`; sanitized shareable metadata is saved as a local uncommitted evidence file. No browser UI or real mail-delivery test was performed. Staging HTTP evidence describes the old deployed base SHA, not this new local candidate. Existing hosted acceptance limitations remain unchanged.

Cleanup verified by database identity, successful CHECKPOINT and Windows process/listener inspection: the disposable PostgreSQL service was stopped with native process control; ports 55439, 4000 and 5173 have zero listeners. The cluster remains preserved. No graceful-shutdown claim is made for native Stop-Process.

**SAFE FOR NEXT STAGING SECURITY REVIEW**
