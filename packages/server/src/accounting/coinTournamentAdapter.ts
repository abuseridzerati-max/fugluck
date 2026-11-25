// Isolated Coins Knockout Tournament Accounting Adapter.
// Operates exclusively on free virtual COINS in `ledger_entries` plus
// `coin_tournament_reservations` and `coin_tournament_settlements`.
// Never writes to sandbox_* or commercial_* monetary tables and never represents COINS as MoneyAmount.

import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { pool as defaultPool } from "../db/client";

const WALLET_USER_LOCK_NAMESPACE = 1094927180;
const COIN_INSTANCE_LOCK_NAMESPACE = 1094927181;

export interface CoinReserveResult {
  success: boolean;
  errorCode?: "INSUFFICIENT_FUNDS" | "DUPLICATE_ENTRY" | "INVALID_AMOUNT" | "INTERNAL_ERROR";
  errorMessage?: string;
}

export interface CoinReleaseResult {
  success: boolean;
  errorCode?: "RESERVATION_NOT_FOUND" | "ALREADY_CAPTURED" | "INTERNAL_ERROR";
  errorMessage?: string;
}

export interface CoinCaptureResult {
  success: boolean;
  errorCode?: "RESERVATION_NOT_FOUND" | "ALREADY_RELEASED" | "INTERNAL_ERROR";
  errorMessage?: string;
}

export interface CoinSettleResult {
  success: boolean;
  totalCapturedCoins?: number;
  totalAwardedCoins?: number;
  errorCode?: "COMPETITION_ALREADY_SETTLED" | "COMPETITION_ALREADY_REFUNDED" | "INVALID_PRIZE_AMOUNT" | "INTERNAL_ERROR";
  errorMessage?: string;
}

export interface CoinRefundResult {
  success: boolean;
  totalRefundedCoins?: number;
  refundedUserIds?: string[];
  errorCode?: "COMPETITION_ALREADY_SETTLED" | "COMPETITION_ALREADY_REFUNDED" | "INTERNAL_ERROR";
  errorMessage?: string;
}

export class CoinTournamentAccountingAdapter {
  constructor(private readonly dbPool: Pool = defaultPool) {}

  async reserveEntry(params: {
    competitionInstanceId: string;
    userId: string;
    amountCoins: number;
    idempotencyKey: string;
  }): Promise<CoinReserveResult> {
    const { competitionInstanceId, userId, amountCoins, idempotencyKey } = params;
    if (!Number.isSafeInteger(amountCoins) || amountCoins < 0) {
      return { success: false, errorCode: "INVALID_AMOUNT", errorMessage: "Coin entry must be a non-negative integer." };
    }

    const client = await this.dbPool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock($1, hashtext($2))", [WALLET_USER_LOCK_NAMESPACE, userId]);

      const byKey = await client.query(
        "SELECT id, status FROM coin_tournament_reservations WHERE idempotency_key = $1",
        [idempotencyKey],
      );
      if (byKey.rowCount) {
        await client.query("COMMIT");
        return { success: true };
      }

      const byPair = await client.query(
        "SELECT id FROM coin_tournament_reservations WHERE competition_instance_id = $1 AND user_id = $2",
        [competitionInstanceId, userId],
      );
      if (byPair.rowCount) {
        await client.query("ROLLBACK");
        return { success: false, errorCode: "DUPLICATE_ENTRY", errorMessage: "User already has a coin reservation for this tournament." };
      }

      if (amountCoins > 0) {
        const balRes = await client.query(
          "SELECT COALESCE(SUM(amount), 0)::int AS coins FROM ledger_entries WHERE user_id = $1 AND currency = 'COINS'",
          [userId],
        );
        const available = Number(balRes.rows[0]?.coins ?? 0);
        if (available < amountCoins) {
          await client.query("ROLLBACK");
          return { success: false, errorCode: "INSUFFICIENT_FUNDS", errorMessage: `Insufficient COINS balance (${available} available, ${amountCoins} required).` };
        }

        await client.query(
          `INSERT INTO ledger_entries (id, user_id, currency, amount, reason)
           VALUES ($1, $2, 'COINS', $3, $4)
           ON CONFLICT (user_id, reason) DO NOTHING`,
          [randomUUID(), userId, -amountCoins, `coin_tournament_entry:${competitionInstanceId}`],
        );
      }

      await client.query(
        `INSERT INTO coin_tournament_reservations (id, competition_instance_id, user_id, amount_coins, status, idempotency_key)
         VALUES ($1, $2, $3, $4, 'RESERVED', $5)`,
        [`cres_${randomUUID()}`, competitionInstanceId, userId, amountCoins, idempotencyKey],
      );

      await client.query("COMMIT");
      return { success: true };
    } catch (err: any) {
      await client.query("ROLLBACK").catch(() => {});
      return { success: false, errorCode: "INTERNAL_ERROR", errorMessage: err?.message ?? "Failed to reserve coins." };
    } finally {
      client.release();
    }
  }

  async releaseEntry(params: {
    competitionInstanceId: string;
    userId: string;
    idempotencyKey: string;
  }): Promise<CoinReleaseResult> {
    const { competitionInstanceId, userId, idempotencyKey } = params;
    const client = await this.dbPool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock($1, hashtext($2))", [WALLET_USER_LOCK_NAMESPACE, userId]);

      const resRow = (
        await client.query(
          "SELECT * FROM coin_tournament_reservations WHERE competition_instance_id = $1 AND user_id = $2 FOR UPDATE",
          [competitionInstanceId, userId],
        )
      ).rows[0];

      if (!resRow) {
        await client.query("ROLLBACK");
        return { success: false, errorCode: "RESERVATION_NOT_FOUND" };
      }
      if (resRow.status === "RELEASED" || resRow.status === "REFUNDED") {
        await client.query("COMMIT");
        return { success: true };
      }
      if (resRow.status === "CAPTURED") {
        await client.query("ROLLBACK");
        return { success: false, errorCode: "ALREADY_CAPTURED" };
      }

      await client.query(
        "UPDATE coin_tournament_reservations SET status = 'RELEASED', settlement_key = $2, updated_at = now() WHERE id = $1",
        [resRow.id, idempotencyKey],
      );

      if (resRow.amount_coins > 0) {
        await client.query(
          `INSERT INTO ledger_entries (id, user_id, currency, amount, reason)
           VALUES ($1, $2, 'COINS', $3, $4)
           ON CONFLICT (user_id, reason) DO NOTHING`,
          [randomUUID(), userId, resRow.amount_coins, `coin_tournament_refund:${competitionInstanceId}`],
        );
      }

      await client.query("COMMIT");
      return { success: true };
    } catch (err: any) {
      await client.query("ROLLBACK").catch(() => {});
      return { success: false, errorCode: "INTERNAL_ERROR", errorMessage: err?.message ?? "Failed to release coins." };
    } finally {
      client.release();
    }
  }

  async captureEntry(params: {
    competitionInstanceId: string;
    userId: string;
    idempotencyKey: string;
  }): Promise<CoinCaptureResult> {
    const { competitionInstanceId, userId, idempotencyKey } = params;
    const client = await this.dbPool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock($1, hashtext($2))", [COIN_INSTANCE_LOCK_NAMESPACE, competitionInstanceId]);

      const resRow = (
        await client.query(
          "SELECT * FROM coin_tournament_reservations WHERE competition_instance_id = $1 AND user_id = $2 FOR UPDATE",
          [competitionInstanceId, userId],
        )
      ).rows[0];

      if (!resRow) {
        await client.query("ROLLBACK");
        return { success: false, errorCode: "RESERVATION_NOT_FOUND" };
      }
      if (resRow.status === "CAPTURED") {
        await client.query("COMMIT");
        return { success: true };
      }
      if (resRow.status === "RELEASED" || resRow.status === "REFUNDED") {
        await client.query("ROLLBACK");
        return { success: false, errorCode: "ALREADY_RELEASED" };
      }

      await client.query(
        "UPDATE coin_tournament_reservations SET status = 'CAPTURED', settlement_key = $2, updated_at = now() WHERE id = $1",
        [resRow.id, idempotencyKey],
      );

      await client.query("COMMIT");
      return { success: true };
    } catch (err: any) {
      await client.query("ROLLBACK").catch(() => {});
      return { success: false, errorCode: "INTERNAL_ERROR", errorMessage: err?.message ?? "Failed to capture coins." };
    } finally {
      client.release();
    }
  }

  async settleCompetition(params: {
    competitionInstanceId: string;
    winnerUserId: string;
    prizeCoins: number;
    idempotencyKey: string;
  }): Promise<CoinSettleResult> {
    const { competitionInstanceId, winnerUserId, prizeCoins, idempotencyKey } = params;
    if (!Number.isSafeInteger(prizeCoins) || prizeCoins < 0) {
      return { success: false, errorCode: "INVALID_PRIZE_AMOUNT" };
    }

    const client = await this.dbPool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock($1, hashtext($2))", [COIN_INSTANCE_LOCK_NAMESPACE, competitionInstanceId]);
      await client.query("SELECT pg_advisory_xact_lock($1, hashtext($2))", [WALLET_USER_LOCK_NAMESPACE, winnerUserId]);

      const existing = (
        await client.query("SELECT * FROM coin_tournament_settlements WHERE competition_instance_id = $1", [competitionInstanceId])
      ).rows[0];
      if (existing) {
        await client.query("COMMIT");
        if (existing.idempotency_key === idempotencyKey && existing.outcome === "SETTLED") {
          return {
            success: true,
            totalCapturedCoins: existing.total_captured_coins,
            totalAwardedCoins: existing.total_awarded_coins,
          };
        }
        return {
          success: false,
          errorCode: existing.outcome === "REFUNDED" ? "COMPETITION_ALREADY_REFUNDED" : "COMPETITION_ALREADY_SETTLED",
        };
      }

      // Enforce Final-only settlement on knockout tournaments.
      const tournament = (
        await client.query("SELECT state, provenance, winner_user_id FROM competition_tournaments WHERE instance_id = $1", [competitionInstanceId])
      ).rows[0];
      if (!tournament || tournament.provenance !== "COINS" || tournament.state !== "FINALIZING" || tournament.winner_user_id !== winnerUserId) {
        await client.query("ROLLBACK");
        return { success: false, errorCode: "INTERNAL_ERROR", errorMessage: "Coin tournament is not ready for final settlement." };
      }

      const reservations = (
        await client.query(
          "SELECT user_id, amount_coins, status FROM coin_tournament_reservations WHERE competition_instance_id = $1 ORDER BY user_id FOR UPDATE",
          [competitionInstanceId],
        )
      ).rows;

      const captured = reservations.filter((r) => r.status === "CAPTURED");
      const totalCapturedCoins = captured.reduce((sum, r) => sum + Number(r.amount_coins), 0);
      // 0% rake conservation: coin prize must exactly match total captured coin pot.
      if (captured.length !== reservations.length || prizeCoins !== totalCapturedCoins) {
        await client.query("ROLLBACK");
        return {
          success: false,
          errorCode: "INVALID_PRIZE_AMOUNT",
          errorMessage: `Coin prize (${prizeCoins}) must match captured pot (${totalCapturedCoins}).`,
        };
      }

      await client.query(
        `INSERT INTO coin_tournament_settlements (
          competition_instance_id, outcome, winner_user_id, total_captured_coins, total_awarded_coins, idempotency_key
        ) VALUES ($1, 'SETTLED', $2, $3, $4, $5)`,
        [competitionInstanceId, winnerUserId, totalCapturedCoins, prizeCoins, idempotencyKey],
      );

      if (prizeCoins > 0) {
        await client.query(
          `INSERT INTO ledger_entries (id, user_id, currency, amount, reason)
           VALUES ($1, $2, 'COINS', $3, $4)
           ON CONFLICT (user_id, reason) DO NOTHING`,
          [randomUUID(), winnerUserId, prizeCoins, `coin_tournament_prize:${competitionInstanceId}`],
        );
      }

      await client.query("COMMIT");
      return { success: true, totalCapturedCoins, totalAwardedCoins: prizeCoins };
    } catch (err: any) {
      await client.query("ROLLBACK").catch(() => {});
      return { success: false, errorCode: "INTERNAL_ERROR", errorMessage: err?.message ?? "Failed to settle coin tournament." };
    } finally {
      client.release();
    }
  }

  async refundCompetition(params: {
    competitionInstanceId: string;
    reason: string;
    idempotencyKey: string;
  }): Promise<CoinRefundResult> {
    const { competitionInstanceId, idempotencyKey } = params;
    const client = await this.dbPool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock($1, hashtext($2))", [COIN_INSTANCE_LOCK_NAMESPACE, competitionInstanceId]);

      const existing = (
        await client.query("SELECT * FROM coin_tournament_settlements WHERE competition_instance_id = $1", [competitionInstanceId])
      ).rows[0];
      if (existing) {
        await client.query("COMMIT");
        if (existing.idempotency_key === idempotencyKey && existing.outcome === "REFUNDED") {
          return { success: true, totalRefundedCoins: existing.total_captured_coins, refundedUserIds: [] };
        }
        return {
          success: false,
          errorCode: existing.outcome === "SETTLED" ? "COMPETITION_ALREADY_SETTLED" : "COMPETITION_ALREADY_REFUNDED",
        };
      }

      const reservations = (
        await client.query(
          "SELECT * FROM coin_tournament_reservations WHERE competition_instance_id = $1 ORDER BY user_id FOR UPDATE",
          [competitionInstanceId],
        )
      ).rows;

      let totalRefundedCoins = 0;
      const refundedUserIds: string[] = [];

      for (const r of reservations) {
        if (r.status === "RELEASED" || r.status === "REFUNDED") continue;
        await client.query("SELECT pg_advisory_xact_lock($1, hashtext($2))", [WALLET_USER_LOCK_NAMESPACE, r.user_id]);
        const nextStatus = r.status === "RESERVED" ? "RELEASED" : "REFUNDED";
        await client.query(
          "UPDATE coin_tournament_reservations SET status = $2, settlement_key = $3, updated_at = now() WHERE id = $1",
          [r.id, nextStatus, idempotencyKey],
        );
        if (r.amount_coins > 0) {
          await client.query(
            `INSERT INTO ledger_entries (id, user_id, currency, amount, reason)
             VALUES ($1, $2, 'COINS', $3, $4)
             ON CONFLICT (user_id, reason) DO NOTHING`,
            [randomUUID(), r.user_id, r.amount_coins, `coin_tournament_refund:${competitionInstanceId}`],
          );
          totalRefundedCoins += Number(r.amount_coins);
        }
        refundedUserIds.push(r.user_id);
      }

      await client.query(
        `INSERT INTO coin_tournament_settlements (
          competition_instance_id, outcome, winner_user_id, total_captured_coins, total_awarded_coins, idempotency_key
        ) VALUES ($1, 'REFUNDED', NULL, $2, 0, $3)`,
        [competitionInstanceId, totalRefundedCoins, idempotencyKey],
      );

      await client.query("COMMIT");
      return { success: true, totalRefundedCoins, refundedUserIds };
    } catch (err: any) {
      await client.query("ROLLBACK").catch(() => {});
      return { success: false, errorCode: "INTERNAL_ERROR", errorMessage: err?.message ?? "Failed to refund coin tournament." };
    } finally {
      client.release();
    }
  }
}
