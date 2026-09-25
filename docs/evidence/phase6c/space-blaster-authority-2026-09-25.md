# Space Blaster Authority Evidence

- Evidence ID: `PH6C-SB-AUTH-20260925`
- Source revision: `3d8922fd251ffbeb6d0ededade578fd3c6b8bbaa`
- Run date: 2026-09-25 UTC (the test harness does not retain an exact start timestamp; this evidence record was compiled at 2026-09-25 01:50 UTC)
- Command: `npx tsx scripts/competition-authority-check.ts`
- Environment: local real WebSocket/Socket.IO integration against the guarded disposable PostgreSQL test database; no staging or production use
- Result: **65 passed, 0 failed**

## What the check demonstrated

- `SpaceBlasterEngine` movement, canonical viewport clamp, firing cadence, seeded spawn behavior, survival score, server-side projectile collision scoring, and ship collision termination.
- The competition path rejects Neon Runner, Pixel Ninja Dash, Cyber Hopper under the wrong runtime path, and unsupported games; rejected entries reserve no funds.
- Real sockets bind authenticated users to a versioned session, instance, match and game. Wrong session/instance/match/game/version/nonce/epoch/user, malformed controls and replaced controllers are rejected. Reconnect rotates the epoch and nonce and fences the old controller.
- Client-supplied score/winner fields cannot choose the result; the legacy client score service cannot bypass authority.
- Server controls produce immutable results. A normal earned winner settles exactly once and participant states become terminal. Tie/draw, forfeit, readiness timeout, both-disconnected, system failure and process-loss cases use their defined settlement/refund behavior; uncertain system outcomes do not invent a winner.
- Duplicate result/terminal/settlement operations are rejected or idempotent. Reconciliation remains zero after the checked refund case.
- Local 20-session benchmark in this run: 59.93 ticks/s, approximately 19.98 snapshots/s per session, 0.464 ms maximum batch tick, and the suite's 250 ms lag-budget assertion passed. This is a local harness result only.

## Source map

`games/space-blaster/engine.ts`; `packages/server/src/competitions/authorityRuntime.ts`; `authorityStore.ts`; `authorityAdmission.ts`; `packages/client/src/game-loader/AuthorityCompetition.tsx`; `scripts/competition-authority-check.ts`.

## Limits

This is automated local evidence, not physical staging gameplay, cloud load testing, or legal/regulatory evidence. Dynamic synthetic IDs, account names, tokens and database connection details are excluded.
