import { desc, eq } from "drizzle-orm";
import { Router } from "express";
import { attachSession, requireAuth } from "../auth/middleware";
import { db } from "../db/client";
import { ledgerEntries } from "../db/schema";
import { ensureSignupGrant, getBalances } from "../wallet/ledger";

export function formatReasonLabel(reason: string, amount: number): string {
  if (reason.startsWith("signup_grant")) return "Signup Grant";
  if (reason.startsWith("monthly_allowance_refill")) return "Monthly Allowance Refill";
  if (reason.startsWith("stake_escrow")) return "Wager Escrow";
  if (reason.startsWith("stake_payout")) return "Match Payout (Victory)";
  if (reason.startsWith("stake_refund")) return "Match Refund";
  if (reason.startsWith("admin_coin_reset")) return "Coin Allowance Reset";
  if (reason.startsWith("admin_grant")) return "Admin Grant";
  if (reason.startsWith("admin_adjustment")) return "Admin Adjustment";
  return amount >= 0 ? "Wallet Credit" : "Wallet Debit";
}

export const walletRouter = Router();

walletRouter.use(attachSession, requireAuth);

walletRouter.get("/balances", async (req, res) => {
  // ensureSignupGrant so pre-wallet accounts still get the one-time 10 coins.
  const balances = await ensureSignupGrant(req.userId!);
  res.json({ balances });
});

walletRouter.get("/history", async (req, res) => {
  const userId = req.userId!;
  const entries = await db.query.ledgerEntries.findMany({
    where: eq(ledgerEntries.userId, userId),
    orderBy: [desc(ledgerEntries.createdAt)],
    limit: 50,
  });

  const formatted = entries.map((e) => ({
    id: e.id,
    currency: e.currency,
    amount: e.amount,
    reason: e.reason,
    label: formatReasonLabel(e.reason, e.amount),
    createdAt: e.createdAt.toISOString(),
  }));

  res.json({ history: formatted });
});

// Convenience re-export for callers that already have balances and just want
// a refresh without the grant side-effect — still idempotent via ensure.
walletRouter.get("/", async (req, res) => {
  const balances = await getBalances(req.userId!);
  res.json({ balances });
});
