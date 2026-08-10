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

// Idempotent: 10 COINS once per user. Diamonds stay at 0 until a purchase.
// Also used on login/me so accounts created before the wallet shipped get
// the same one-time grant without farming every login.
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
  await db.insert(ledgerEntries).values({
    id: randomUUID(),
    userId,
    currency,
    amount: -amount,
    reason,
  });
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
  await db.insert(ledgerEntries).values({
    id: randomUUID(),
    userId: winnerUserId,
    currency,
    amount: winnerPayout,
    reason: winnerReason,
  });

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
