# Security and Operations Evidence Summary

- Evidence ID: `PH6C-SEC-OPS-20260925`
- Source revision: `3d8922fd251ffbeb6d0ededade578fd3c6b8bbaa`
- Evidence date: 2026-09-25 UTC
- Environment: local automated checks, guarded disposable PostgreSQL, source inspection, and read-only provider/dashboard observations

## Relevant automated checks from the Phase 6B validation run

Full `npm test` ran the 38 ordered canonical scripts without reported failures. Relevant results included admin HTTP 36/36, competition admin 42/42, competition authority 65/65, authority latency 26/26, staging readiness 34/34, database safety 18/18, atomic wager 38/38, and Cyber Hopper authority 42/42. Authentication, admin session/RBAC, CORS, rate limiting, SQL injection, input validation, XSS, password policy, registration verification, request logging redaction and settlement/lifecycle recovery scripts also completed without failure output. The standalone test scripts remain the source for individual assertions.

The protected operations endpoint requires admin audit permission and reports only sanitized machine error codes plus bounded process-local metrics. Authority session binding/fencing and result/settlement idempotency are asserted in the authority suites. Admin funding tests verify integer amount and reason validation, RBAC denial, balanced ledger posting and atomic audit linkage. Admin screens do not expose winner selection, score editing, direct balance setting or ledger-row mutation.

## Operational observations and exclusions

- Staging Drizzle journal was read-only inspected at 12 applied entries through `0011_terminal_participant_status.sql`.
- Supabase UI displayed the isolated Frankfurt staging project on a Free plan without managed backup. A current logical dump and restore into a disposable project were not completed.
- Render UI showed the staging service name/custom hostname but a `Production` environment badge. This remains a mandatory target-identity check before any future deployment.
- No staging data mutation, migration, deployment or destructive restore was performed. No production deployment, main merge, external submission or money rail was used.
- This is not an independent penetration test, formal security audit, cloud disaster-recovery drill, or production capacity certification.
