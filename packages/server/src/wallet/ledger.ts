import { SIGNUP_COIN_GRANT, type Currency, type WalletBalances } from "@arcadeclash/shared";
import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../db/client";
import { ledgerEntries } from "../db/schema";

export const PLATFORM_RAKE_ACCOUNT = "platform_rake_account";
export const DEFAULT_RAKE_PERCENT = 10;
export const COINS_RAKE_PERCENT = 0;
export const DIAMONDS_RAKE_PERCENT = 5;

export async function getBalances(userId: string): Promise<WalletBalances> {
  const rows = await db
    .select({
      currency: ledgerEntries.currency,
      total: sql<number>`coalesce(sum(${ledgerEntries.amount}), 0)::int`,
    })
    .from(ledgerEntries)
    .where(eq(ledgerEntries.userId, userId))
    .groupBy(ledgerEntries.currency);

  let coins = 0;
  let diamonds = 0;
  for (const row of rows) {
    if (row.currency === "COINS") coins = Number(row.total);
    if (row.currency === "DIAMONDS") diamonds = Number(row.total);
  }
  return { coins, diamonds };
}

async function hasReason(userId: string, reason: string): Promise<boolean> {
  const existing = await db.query.ledgerEntries.findFirst({
    where: and(eq(ledgerEntries.userId, userId), eq(ledgerEntries.reason, reason)),
  });
  return Boolean(existing);
}

// Evaluates and applies the monthly 1,000 COIN allowance refill on login/me.
// Tops off balances under 1,000 COINS up to 1,000 COINS; balances >= 1,000 are left untouched.
export async function checkAndApplyMonthlyAllowance(userId: string): Promise<WalletBalances> {
  const monthKey = new Date().toISOString().slice(0, 7);
  const reason = `monthly_allowance_refill:${monthKey}`;

  if (!(await hasReason(userId, reason))) {
    const balances = await getBalances(userId);
    if (balances.coins < 1000) {
      const topUp = 1000 - balances.coins;
      await db.insert(ledgerEntries).values({
        id: randomUUID(),
        userId,
        currency: "COINS",
        amount: topUp,
        reason,
      });
    } else {
      await db.insert(ledgerEntries).values({
        id: randomUUID(),
        userId,
        currency: "COINS",
        amount: 0,
        reason,
      });
    }
  }
  return getBalances(userId);
}

// Idempotent: 1,000 COINS starting grant once per user + monthly 1,000 COIN refill check.
export async function ensureSignupGrant(userId: string): Promise<WalletBalances> {
  if (!(await hasReason(userId, "signup_grant"))) {
    await db.insert(ledgerEntries).values({
      id: randomUUID(),
      userId,
      currency: "COINS",
      amount: SIGNUP_COIN_GRANT,
      reason: "signup_grant",
    });
  }
  await checkAndApplyMonthlyAllowance(userId);
  return getBalances(userId);
}

export async function grantDiamondsStub(userId: string, diamonds: number, packId: string): Promise<WalletBalances> {
  if (!Number.isInteger(diamonds) || diamonds <= 0) {
    throw new Error("Diamond grant must be a positive integer.");
  }
  await db.insert(ledgerEntries).values({
    id: randomUUID(),
    userId,
    currency: "DIAMONDS",
    amount: diamonds,
    reason: `diamond_purchase_stub:${packId}`,
  });
  return getBalances(userId);
}

export async function escrowStake(
  userId: string,
  currency: Currency,
  amount: number,
  matchId: string,
): Promise<WalletBalances> {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("Stake amount must be a positive integer.");
  }
  const balances = await getBalances(userId);
  const currentBalance = currency === "COINS" ? balances.coins : balances.diamonds;
  if (currentBalance < amount) {
    throw new Error(`Insufficient ${currency} balance for escrow.`);
  }
  const reason = `stake_escrow:${matchId}`;
  const rows = await db
    .insert(ledgerEntries)
    .values({
      id: randomUUID(),
      userId,
      currency,
      amount: -amount,
      reason,
    })
    .returning();

  if (!rows || rows.length === 0) {
    console.error(`[ledger] ERROR: Failed to insert escrow entry (0 rows returned) for userId=${userId}, matchId=${matchId}`);
  } else {
    console.log(`[ledger] SUCCESS: Escrowed ${amount} ${currency} for userId=${userId}, matchId=${matchId}`);
  }
  return getBalances(userId);
}

export async function payoutWinner(
  winnerUserId: string,
  loserUserId: string,
  currency: Currency,
  stakeAmount: number,
  matchId: string,
  rakePercent?: number,
): Promise<{ winnerBalances: WalletBalances; rakeFee: number; winnerPayout: number }> {
  if (!Number.isInteger(stakeAmount) || stakeAmount <= 0) {
    throw new Error("Stake amount must be a positive integer.");
  }
  const effectiveRake =
    rakePercent !== undefined
      ? rakePercent
      : currency === "COINS"
      ? COINS_RAKE_PERCENT
      : DIAMONDS_RAKE_PERCENT;

  const totalPot = stakeAmount * 2;
  const rakeFee = Math.floor((totalPot * effectiveRake) / 100);
  const winnerPayout = totalPot - rakeFee;

  const winnerReason = `stake_payout:${matchId}`;
  const winnerRows = await db
    .insert(ledgerEntries)
    .values({
      id: randomUUID(),
      userId: winnerUserId,
      currency,
      amount: winnerPayout,
      reason: winnerReason,
    })
    .returning();

  if (!winnerRows || winnerRows.length === 0) {
    console.error(`[ledger] ERROR: Failed to insert payout entry (0 rows returned) for winnerUserId=${winnerUserId}, matchId=${matchId}`);
  } else {
    console.log(`[ledger] SUCCESS: Paid out ${winnerPayout} ${currency} to winnerUserId=${winnerUserId}, matchId=${matchId}`);
  }

  if (rakeFee > 0) {
    const rakeReason = `platform_rake:${matchId}`;
    await db.insert(ledgerEntries).values({
      id: randomUUID(),
      userId: PLATFORM_RAKE_ACCOUNT,
      currency,
      amount: rakeFee,
      reason: rakeReason,
    });
  }

  const winnerBalances = await getBalances(winnerUserId);
  return { winnerBalances, rakeFee, winnerPayout };
}

export async function refundStake(
  userId: string,
  currency: Currency,
  amount: number,
  matchId: string,
): Promise<WalletBalances> {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("Refund amount must be a positive integer.");
  }
  const reason = `stake_refund:${matchId}`;
  await db.insert(ledgerEntries).values({
    id: randomUUID(),
    userId,
    currency,
    amount,
    reason,
  });
  return getBalances(userId);
}
