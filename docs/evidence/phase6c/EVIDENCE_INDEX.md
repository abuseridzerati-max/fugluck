# Phase 6C Evidence Index

## Reviewer entry

Start with the [Technical Review Dossier](../../PHASE_6C_REVENUE_SERVICE_DOSSIER.md). It explains the product in plain language, separates practice/Coins from TEST GEL competitions, describes server authority and accounting, and lists limits without making legal conclusions.

## Evidence records

| Evidence ID | Subject | Artifact | Verification boundary |
|---|---|---|---|
| `PH6C-SB-AUTH-20260925` | Space Blaster Level 3 authority | [`space-blaster-authority-2026-09-25.md`](space-blaster-authority-2026-09-25.md) | Local real-socket integration + engine checks; not physical staging gameplay |
| `PH6C-CH-AUTH-20260925` | Cyber Hopper Level 3 authority | [`cyber-hopper-authority-2026-09-25.md`](cyber-hopper-authority-2026-09-25.md) | Local real-socket integration + server-engine checks |
| `PH6C-ACCOUNTING-20260925` | Entry/prize cases and accounting lifecycle | [`sandbox-accounting-2026-09-25.md`](sandbox-accounting-2026-09-25.md) | Local disposable PostgreSQL; simulated ledger only |
| `PH55B1-CH-STAGING-20260925` | Physical two-device Cyber Hopper session | [Phase 5.5B1 acceptance](../../PHASE_5_5B1_CYBER_HOPPER_ACCEPTANCE.md) and [sanitized authority log](../phase55b1-cyber-hopper/authority-run-20260925.txt) | User-confirmed physical play plus sanitized staging logs; reconnect not exercised |
| `PH6C-SEC-OPS-20260925` | Security, failure/recovery and operational safeguards | [`security-operations-2026-09-25.md`](security-operations-2026-09-25.md) | Automated code checks/source review; no independent penetration test or provider DR drill |

## Provenance and integrity

- Source code SHA used by the 6C targeted evidence runs: `3d8922fd251ffbeb6d0ededade578fd3c6b8bbaa` (the current `HEAD` when rerunning the focused Space Blaster, Cyber Hopper and accounting suites). Those runs change no application source.
- Evidence environment: local development runtime; guarded disposable PostgreSQL database `arcadeclash_atomic_test`; local Socket.IO clients. No staging DB mutation, live funds, user identifiers, credentials, cookies, tokens, or provider secrets are included.
- Drizzle migration journal: 12 entries, through `0011_terminal_participant_status.sql`. The separately accepted staging SQL Editor check observed 12 applied rows; these 6C tests use the local disposable database, not staging.
- Build/test revision: the evidence runs are source-equivalent to code in the 6A baseline and use the checked-out revision above. They are not a staging deployment.
- Timestamps are UTC on 2026-09-25; suite records include the run date, source SHA, command, environment and result count.
- SHA-256 checksums for all evidence artifacts except this manifest are in [`SHA256SUMS.txt`](SHA256SUMS.txt). The manifest is intentionally excluded from hashing itself to avoid a self-referential checksum.

## Completion boundaries

No Revenue Service filing, legal opinion, production deployment, or main merge is represented here. Staging candidate revision parity and current staging visual acceptance are Phase 6D checks. The missing verified Frankfurt backup/restore is listed as an operational limitation and must be resolved before any schema change or risky data operation.
