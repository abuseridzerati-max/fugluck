# TEST GEL Sandbox Accounting Evidence

- Evidence ID: `PH6C-ACCOUNTING-20260925`
- Source revision: `3d8922fd251ffbeb6d0ededade578fd3c6b8bbaa`
- Run date: 2026-09-25 UTC (the test harness does not retain an exact start timestamp; this evidence record was compiled at 2026-09-25 01:50 UTC)
- Command: `npx tsx scripts/competition-phase2-accounting-check.ts`
- Environment: local disposable PostgreSQL test database; all balances and ledger postings simulated
- Result: **54 passed, 0 failed**

## Scenario results

| Scenario | Setup | Verified result |
|---|---|---|
| Standard | 2 players, TEST ₾5 entry each, predetermined TEST ₾9 prize | TEST ₾10 captured; TEST ₾9 awarded; TEST ₾1 margin; zero discrepancy |
| Promotional | 2 players, TEST ₾5 entry each, predetermined TEST ₾20 prize | TEST ₾10 captured; TEST ₾10 simulated subsidy; TEST ₾20 prize; zero margin and zero discrepancy |
| Freeroll | FREE entry, predetermined TEST ₾1,000 fixture prize | No participant entry capture; TEST ₾1,000 simulated subsidy; zero discrepancy |

The code's live runner currently accepts H2H with one first-place prize only. Other accounting-domain shapes tested here do not imply those formats can run in live competition.

## Lifecycle controls verified

- Integer minor-unit validation, negative/fractional rejection, currency separation, balance checks and overdraft prevention.
- Entry reservation, available/reserved balance movement, duplicate reservation idempotency, exact capture, release before capture, cancellation/void, captured-entry refund and duplicate-refund no-double-credit.
- Exactly-once settlement, winner balance unchanged on retry, draw refund, promotion subsidy, and preservation of Coins and historical Diamonds outside the sandbox ledger.
- Per-instance and full-ledger double-entry reconciliation report zero discrepancy. Total sandbox ledger postings sum to zero.

## Source map and limits

`packages/server/src/accounting/port.ts`; `sandboxAdapter.ts`; `packages/server/src/competitions/authorityStore.ts`; `scripts/competition-phase2-accounting-check.ts`.

These are local test fixtures only. No real GEL or prize was created, and no staging user was funded or entered.
