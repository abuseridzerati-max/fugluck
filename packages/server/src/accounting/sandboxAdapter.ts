// Sandbox Accounting Adapter (Fugluck Competition Economy — Phase 2)
// Implements FUGLUCK — FINAL COMPETITION DOMAIN CONTRACT
// Provides isolated, double-entry, balanced sandbox GEL accounting for development, QA,
// and Revenue Service review without real payment provider integrations or real-world money.

import crypto from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "../db/client";
import type { MoneyAmount } from "@fugluck/shared";
import { createMoney } from "@fugluck/shared";
import type {
  CompetitionAccountingPort,
  ReserveEntryParams,
  ReserveEntryResult,
  ReleaseEntryParams,
  ReleaseEntryResult,
  CaptureEntryParams,
  CaptureEntryResult,
  SettleCompetitionParams,
  SettleCompetitionResult,
  RefundCompetitionParams,
  RefundCompetitionResult,
} from "./port";
import {
  sandboxEntryReservations,
  sandboxLedgerEntries,
  sandboxSettlements,
} from "../db/schema";

const ADVISORY_LOCK_USER_NAMESPACE = 2094927180;
const ADVISORY_LOCK_INSTANCE_NAMESPACE = 2094927181;

export class SandboxAccountingAdapter implements CompetitionAccountingPort {
  /**
   * Reserves entry funds for a user entering a competition.
   * Atomically verifies available balance and transitions entry fee to RESERVED state.
   */
  async reserveEntry(params: ReserveEntryParams): Promise<ReserveEntryResult> {
    const { competitionInstanceId, userId, entryFee, idempotencyKey } = params;

    // Validate currency and amount
    this.assertValidMoney(entryFee);

    return await db.transaction(async (tx) => {
      // 1. Take advisory transaction lock on the user's sandbox balance
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(${ADVISORY_LOCK_USER_NAMESPACE}, hashtext(${userId}))`,
      );

      // 2. Check for existing reservation by idempotency key
      const existingByIdem = await tx
        .select()
        .from(sandboxEntryReservations)
        .where(sql`${sandboxEntryReservations.idempotencyKey} = ${idempotencyKey}`);

      if (existingByIdem.length > 0) {
        const res = existingByIdem[0];
        return {
          success: true,
          accountingReferenceId: res.accountingReferenceId,
          competitionInstanceId: res.competitionInstanceId,
          userId: res.userId,
          reservedAmount: createMoney(res.amountMinor, "GEL"),
        };
      }

      // 3. Check for existing reservation for this user and instance
      const existingForInstance = await tx
        .select()
        .from(sandboxEntryReservations)
        .where(
          sql`${sandboxEntryReservations.competitionInstanceId} = ${competitionInstanceId} AND ${sandboxEntryReservations.userId} = ${userId}`,
        );

      if (existingForInstance.length > 0) {
        return {
          success: false,
          competitionInstanceId,
          userId,
          reservedAmount: entryFee,
          errorCode: "DUPLICATE_ENTRY",
          errorMessage: `User ${userId} already has an entry reservation for competition instance ${competitionInstanceId}`,
        };
      }

      // 4. Verify user has sufficient available sandbox funds
      if (entryFee.amountMinor > 0) {
        const balanceRes = await tx.execute(
          sql`SELECT COALESCE(SUM(CASE WHEN balance_type = 'AVAILABLE' THEN amount_minor ELSE 0 END), 0)::integer AS available
              FROM sandbox_ledger_entries
              WHERE user_id = ${userId} AND currency = 'GEL'`,
        );

        const available = Number((balanceRes.rows[0] as any)?.available ?? 0);
        if (available < entryFee.amountMinor) {
          return {
            success: false,
            competitionInstanceId,
            userId,
            reservedAmount: entryFee,
            errorCode: "INSUFFICIENT_FUNDS",
            errorMessage: `Insufficient available sandbox funds (available: ₾${(available / 100).toFixed(2)}, required: ₾${(entryFee.amountMinor / 100).toFixed(2)})`,
          };
        }
      }

      // 5. Generate unique accounting and reservation IDs
      const accountingReferenceId = `sar_res_${crypto.randomUUID()}`;
      const reservationId = `sres_${crypto.randomUUID()}`;

      // 6. Record reservation
      await tx.insert(sandboxEntryReservations).values({
        id: reservationId,
        competitionInstanceId,
        userId,
        currency: "GEL",
        amountMinor: entryFee.amountMinor,
        status: "RESERVED",
        idempotencyKey,
        accountingReferenceId,
      });

      // 7. Insert balanced ledger movement: AVAILABLE -> RESERVED
      if (entryFee.amountMinor > 0) {
        await tx.insert(sandboxLedgerEntries).values([
          {
            id: `sle_${crypto.randomUUID()}`,
            accountingReferenceId,
            idempotencyKey: `${idempotencyKey}:avail_debit`,
            competitionInstanceId,
            userId,
            accountId: `user:${userId}:GEL`,
            eventType: "ENTRY_RESERVE",
            currency: "GEL",
            amountMinor: -entryFee.amountMinor,
            balanceType: "AVAILABLE",
            description: `Entry reservation debit for competition ${competitionInstanceId}`,
          },
          {
            id: `sle_${crypto.randomUUID()}`,
            accountingReferenceId,
            idempotencyKey: `${idempotencyKey}:res_credit`,
            competitionInstanceId,
            userId,
            accountId: `user:${userId}:GEL`,
            eventType: "ENTRY_RESERVE",
            currency: "GEL",
            amountMinor: entryFee.amountMinor,
            balanceType: "RESERVED",
            description: `Entry reservation credit for competition ${competitionInstanceId}`,
          },
        ]);
      }

      return {
        success: true,
        accountingReferenceId,
        competitionInstanceId,
        userId,
        reservedAmount: entryFee,
      };
    });
  }

  /**
   * Releases an entry reservation back to available balance (e.g. unregistering or cancel before start).
   */
  async releaseEntry(params: ReleaseEntryParams): Promise<ReleaseEntryResult> {
    const { competitionInstanceId, userId, idempotencyKey } = params;

    return await db.transaction(async (tx) => {
      // 1. Take advisory transaction lock on user
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(${ADVISORY_LOCK_USER_NAMESPACE}, hashtext(${userId}))`,
      );

      // 2. Find reservation
      const resRows = await tx
        .select()
        .from(sandboxEntryReservations)
        .where(
          sql`${sandboxEntryReservations.competitionInstanceId} = ${competitionInstanceId} AND ${sandboxEntryReservations.userId} = ${userId}`,
        );

      if (resRows.length === 0) {
        return {
          success: false,
          competitionInstanceId,
          userId,
          errorCode: "RESERVATION_NOT_FOUND",
          errorMessage: "No entry reservation found for instance and user",
        };
      }

      const reservation = resRows[0];

      // Idempotency: already released
      if (reservation.status === "RELEASED") {
        return {
          success: true,
          accountingReferenceId: reservation.accountingReferenceId,
          competitionInstanceId,
          userId,
          releasedAmount: createMoney(reservation.amountMinor, "GEL"),
        };
      }

      if (reservation.status === "CAPTURED") {
        return {
          success: false,
          competitionInstanceId,
          userId,
          errorCode: "ALREADY_CAPTURED",
          errorMessage: "Cannot release already captured entry funds; use refundCompetition instead",
        };
      }

      // Update reservation status to RELEASED
      const releaseRefId = `sar_rel_${crypto.randomUUID()}`;
      await tx
        .update(sandboxEntryReservations)
        .set({ status: "RELEASED", updatedAt: new Date() })
        .where(sql`${sandboxEntryReservations.id} = ${reservation.id}`);

      // Insert balanced movement: RESERVED -> AVAILABLE
      if (reservation.amountMinor > 0) {
        await tx.insert(sandboxLedgerEntries).values([
          {
            id: `sle_${crypto.randomUUID()}`,
            accountingReferenceId: releaseRefId,
            idempotencyKey: `${idempotencyKey}:res_debit`,
            competitionInstanceId,
            userId,
            accountId: `user:${userId}:GEL`,
            eventType: "ENTRY_RELEASE",
            currency: "GEL",
            amountMinor: -reservation.amountMinor,
            balanceType: "RESERVED",
            description: `Entry reservation release debit for competition ${competitionInstanceId}`,
          },
          {
            id: `sle_${crypto.randomUUID()}`,
            accountingReferenceId: releaseRefId,
            idempotencyKey: `${idempotencyKey}:avail_credit`,
            competitionInstanceId,
            userId,
            accountId: `user:${userId}:GEL`,
            eventType: "ENTRY_RELEASE",
            currency: "GEL",
            amountMinor: reservation.amountMinor,
            balanceType: "AVAILABLE",
            description: `Entry reservation release credit for competition ${competitionInstanceId}`,
          },
        ]);
      }

      return {
        success: true,
        accountingReferenceId: releaseRefId,
        competitionInstanceId,
        userId,
        releasedAmount: createMoney(reservation.amountMinor, "GEL"),
      };
    });
  }

  /**
   * Captures reserved entry funds into platform competition escrow when competition locks/starts.
   */
  async captureEntry(params: CaptureEntryParams): Promise<CaptureEntryResult> {
    const { competitionInstanceId, userId, idempotencyKey } = params;

    return await db.transaction(async (tx) => {
      // 1. Take advisory transaction lock on user
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(${ADVISORY_LOCK_USER_NAMESPACE}, hashtext(${userId}))`,
      );

      // 2. Find reservation
      const resRows = await tx
        .select()
        .from(sandboxEntryReservations)
        .where(
          sql`${sandboxEntryReservations.competitionInstanceId} = ${competitionInstanceId} AND ${sandboxEntryReservations.userId} = ${userId}`,
        );

      if (resRows.length === 0) {
        return {
          success: false,
          competitionInstanceId,
          userId,
          errorCode: "RESERVATION_NOT_FOUND",
          errorMessage: "No entry reservation found for instance and user",
        };
      }

      const reservation = resRows[0];

      // Idempotency: already captured
      if (reservation.status === "CAPTURED") {
        return {
          success: true,
          accountingReferenceId: reservation.accountingReferenceId,
          competitionInstanceId,
          userId,
          capturedAmount: createMoney(reservation.amountMinor, "GEL"),
        };
      }

      if (reservation.status === "RELEASED") {
        return {
          success: false,
          competitionInstanceId,
          userId,
          errorCode: "ALREADY_RELEASED",
          errorMessage: "Cannot capture released reservation",
        };
      }

      // Update reservation status to CAPTURED
      const captureRefId = `sar_cap_${crypto.randomUUID()}`;
      await tx
        .update(sandboxEntryReservations)
        .set({ status: "CAPTURED", updatedAt: new Date() })
        .where(sql`${sandboxEntryReservations.id} = ${reservation.id}`);

      // Insert balanced movement: RESERVED -> PLATFORM ESCROW
      if (reservation.amountMinor > 0) {
        await tx.insert(sandboxLedgerEntries).values([
          {
            id: `sle_${crypto.randomUUID()}`,
            accountingReferenceId: captureRefId,
            idempotencyKey: `${idempotencyKey}:res_debit`,
            competitionInstanceId,
            userId,
            accountId: `user:${userId}:GEL`,
            eventType: "ENTRY_CAPTURE",
            currency: "GEL",
            amountMinor: -reservation.amountMinor,
            balanceType: "RESERVED",
            description: `Entry capture debit from reserved balance for competition ${competitionInstanceId}`,
          },
          {
            id: `sle_${crypto.randomUUID()}`,
            accountingReferenceId: captureRefId,
            idempotencyKey: `${idempotencyKey}:escrow_credit`,
            competitionInstanceId,
            userId,
            accountId: "platform:escrow:GEL",
            eventType: "ENTRY_CAPTURE",
            currency: "GEL",
            amountMinor: reservation.amountMinor,
            balanceType: "CAPTURED",
            description: `Entry capture credit to platform escrow for competition ${competitionInstanceId}`,
          },
        ]);
      }

      return {
        success: true,
        accountingReferenceId: captureRefId,
        competitionInstanceId,
        userId,
        capturedAmount: createMoney(reservation.amountMinor, "GEL"),
      };
    });
  }

  /**
   * Settles a competition by distributing predetermined placement prizes to winners.
   * Handles platform fee retention and promotional/sponsored prize overlays cleanly.
   */
  async settleCompetition(params: SettleCompetitionParams): Promise<SettleCompetitionResult> {
    const { competitionInstanceId, prizes, idempotencyKey } = params;

    // Validate all prizes
    for (const p of prizes) {
      this.assertValidMoney(p.amount);
    }

    return await db.transaction(async (tx) => {
      // 1. Advisory transaction lock on the competition instance to prevent concurrent settlements
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(${ADVISORY_LOCK_INSTANCE_NAMESPACE}, hashtext(${competitionInstanceId}))`,
      );

      // 2. Check for existing settlement record
      const existingSettlements = await tx
        .select()
        .from(sandboxSettlements)
        .where(sql`${sandboxSettlements.competitionInstanceId} = ${competitionInstanceId}`);

      if (existingSettlements.length > 0) {
        const s = existingSettlements[0];
        if (s.status === "SETTLED") {
          return {
            success: true,
            accountingReferenceId: s.accountingReferenceId,
            competitionInstanceId,
            totalEntriesCaptured: createMoney(s.totalEntriesCapturedMinor, "GEL"),
            totalPrizesAwarded: createMoney(s.totalPrizesAwardedMinor, "GEL"),
            platformMarginRetained: createMoney(s.platformMarginMinor, "GEL"),
            promotionalSubsidyInjected: createMoney(s.promotionalSubsidyMinor, "GEL"),
            prizesAwarded: prizes,
          };
        }
        return {
          success: false,
          competitionInstanceId,
          totalEntriesCaptured: createMoney(s.totalEntriesCapturedMinor, "GEL"),
          totalPrizesAwarded: createMoney(s.totalPrizesAwardedMinor, "GEL"),
          prizesAwarded: [],
          errorCode: "COMPETITION_ALREADY_REFUNDED",
          errorMessage: `Competition ${competitionInstanceId} has already been refunded`,
        };
      }

      // 3. Query total captured entries for this competition
      const capturedRes = await tx.execute(
        sql`SELECT COALESCE(SUM(amount_minor), 0)::integer AS total_captured
            FROM sandbox_entry_reservations
            WHERE competition_instance_id = ${competitionInstanceId} AND status = 'CAPTURED'`,
      );
      const totalCapturedMinor = Number((capturedRes.rows[0] as any)?.total_captured ?? 0);
      const totalPrizesMinor = prizes.reduce((sum, p) => sum + p.amount.amountMinor, 0);

      // 4. Calculate economic breakdown (Platform Margin vs Promotional Subsidy)
      let platformMarginMinor = 0;
      let promotionalSubsidyMinor = 0;

      if (totalCapturedMinor >= totalPrizesMinor) {
        platformMarginMinor = totalCapturedMinor - totalPrizesMinor;
      } else {
        promotionalSubsidyMinor = totalPrizesMinor - totalCapturedMinor;
      }

      const accountingReferenceId = `sar_settle_${crypto.randomUUID()}`;

      // 5. Insert settlement record
      await tx.insert(sandboxSettlements).values({
        competitionInstanceId,
        status: "SETTLED",
        totalEntriesCapturedMinor: totalCapturedMinor,
        totalPrizesAwardedMinor: totalPrizesMinor,
        platformMarginMinor,
        promotionalSubsidyMinor,
        currency: "GEL",
        accountingReferenceId,
        idempotencyKey,
      });

      // 6. Balanced Ledger Postings
      const entriesToInsert: Array<{
        id: string;
        accountingReferenceId: string;
        idempotencyKey?: string;
        competitionInstanceId: string;
        userId?: string;
        accountId: string;
        eventType: string;
        currency: "GEL";
        amountMinor: number;
        balanceType: string;
        description: string;
      }> = [];

      // A. Debit platform escrow for captured entries
      if (totalCapturedMinor > 0) {
        entriesToInsert.push({
          id: `sle_${crypto.randomUUID()}`,
          accountingReferenceId,
          idempotencyKey: `${idempotencyKey}:escrow_debit`,
          competitionInstanceId,
          accountId: "platform:escrow:GEL",
          eventType: "PRIZE_PAYOUT",
          currency: "GEL",
          amountMinor: -totalCapturedMinor,
          balanceType: "SETTLED",
          description: `Debit platform escrow for competition ${competitionInstanceId} settlement`,
        });
      }

      // B. Debit promotional subsidy funding account if prize > captured entries
      if (promotionalSubsidyMinor > 0) {
        entriesToInsert.push({
          id: `sle_${crypto.randomUUID()}`,
          accountingReferenceId,
          idempotencyKey: `${idempotencyKey}:promo_debit`,
          competitionInstanceId,
          accountId: "platform:promotions:GEL",
          eventType: "PROMOTIONAL_SUBSIDY",
          currency: "GEL",
          amountMinor: -promotionalSubsidyMinor,
          balanceType: "SETTLED",
          description: `Promotional prize overlay subsidy debit for competition ${competitionInstanceId}`,
        });
      }

      // C. Credit prize winners' available balances
      for (const p of prizes) {
        if (p.amount.amountMinor > 0) {
          entriesToInsert.push({
            id: `sle_${crypto.randomUUID()}`,
            accountingReferenceId,
            idempotencyKey: `${idempotencyKey}:prize_${p.placement}_${p.userId}`,
            competitionInstanceId,
            userId: p.userId,
            accountId: `user:${p.userId}:GEL`,
            eventType: "PRIZE_PAYOUT",
            currency: "GEL",
            amountMinor: p.amount.amountMinor,
            balanceType: "AVAILABLE",
            description: `Place ${p.placement} prize credit for competition ${competitionInstanceId}`,
          });
        }
      }

      // D. Credit platform retained fee if entries > prize
      if (platformMarginMinor > 0) {
        entriesToInsert.push({
          id: `sle_${crypto.randomUUID()}`,
          accountingReferenceId,
          idempotencyKey: `${idempotencyKey}:fee_credit`,
          competitionInstanceId,
          accountId: "platform:fees:GEL",
          eventType: "PLATFORM_FEE_RETAINED",
          currency: "GEL",
          amountMinor: platformMarginMinor,
          balanceType: "SETTLED",
          description: `Platform fee retained from competition ${competitionInstanceId}`,
        });
      }

      if (entriesToInsert.length > 0) {
        await tx.insert(sandboxLedgerEntries).values(entriesToInsert);
      }

      return {
        success: true,
        accountingReferenceId,
        competitionInstanceId,
        totalEntriesCaptured: createMoney(totalCapturedMinor, "GEL"),
        totalPrizesAwarded: createMoney(totalPrizesMinor, "GEL"),
        platformMarginRetained: createMoney(platformMarginMinor, "GEL"),
        promotionalSubsidyInjected: createMoney(promotionalSubsidyMinor, "GEL"),
        prizesAwarded: prizes,
      };
    });
  }

  /**
   * Refunds all captured entries back to participants' available balances and releases any active reservations.
   */
  async refundCompetition(params: RefundCompetitionParams): Promise<RefundCompetitionResult> {
    const { competitionInstanceId, reason, idempotencyKey } = params;

    return await db.transaction(async (tx) => {
      // 1. Advisory transaction lock on instance
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(${ADVISORY_LOCK_INSTANCE_NAMESPACE}, hashtext(${competitionInstanceId}))`,
      );

      // 2. Check existing settlement/refund
      const existingSettlements = await tx
        .select()
        .from(sandboxSettlements)
        .where(sql`${sandboxSettlements.competitionInstanceId} = ${competitionInstanceId}`);

      if (existingSettlements.length > 0) {
        const s = existingSettlements[0];
        if (s.status === "REFUNDED") {
          return {
            success: true,
            accountingReferenceId: s.accountingReferenceId,
            competitionInstanceId,
            totalRefunded: createMoney(s.totalEntriesCapturedMinor, "GEL"),
            refundedUserIds: [],
          };
        }
        return {
          success: false,
          competitionInstanceId,
          totalRefunded: createMoney(0, "GEL"),
          refundedUserIds: [],
          errorCode: "COMPETITION_ALREADY_SETTLED",
          errorMessage: `Competition ${competitionInstanceId} has already been settled; cannot refund`,
        };
      }

      // 3. Find all reservations for this instance
      const reservations = await tx
        .select()
        .from(sandboxEntryReservations)
        .where(sql`${sandboxEntryReservations.competitionInstanceId} = ${competitionInstanceId}`);

      let totalRefundedMinor = 0;
      const refundedUserIds: string[] = [];
      const accountingReferenceId = `sar_ref_${crypto.randomUUID()}`;

      const entriesToInsert: Array<{
        id: string;
        accountingReferenceId: string;
        idempotencyKey?: string;
        competitionInstanceId: string;
        userId?: string;
        accountId: string;
        eventType: string;
        currency: "GEL";
        amountMinor: number;
        balanceType: string;
        description: string;
      }> = [];

      for (const res of reservations) {
        if (res.status === "CAPTURED") {
          // Update status to REFUNDED
          await tx
            .update(sandboxEntryReservations)
            .set({ status: "REFUNDED", updatedAt: new Date() })
            .where(sql`${sandboxEntryReservations.id} = ${res.id}`);

          if (res.amountMinor > 0) {
            totalRefundedMinor += res.amountMinor;
            refundedUserIds.push(res.userId);

            // Escrow debit
            entriesToInsert.push({
              id: `sle_${crypto.randomUUID()}`,
              accountingReferenceId,
              idempotencyKey: `${idempotencyKey}:escrow_refund_${res.userId}`,
              competitionInstanceId,
              accountId: "platform:escrow:GEL",
              eventType: "ENTRY_REFUND",
              currency: "GEL",
              amountMinor: -res.amountMinor,
              balanceType: "SETTLED",
              description: `Escrow refund debit for competition ${competitionInstanceId} (${reason})`,
            });

            // User credit
            entriesToInsert.push({
              id: `sle_${crypto.randomUUID()}`,
              accountingReferenceId,
              idempotencyKey: `${idempotencyKey}:user_refund_${res.userId}`,
              competitionInstanceId,
              userId: res.userId,
              accountId: `user:${res.userId}:GEL`,
              eventType: "ENTRY_REFUND",
              currency: "GEL",
              amountMinor: res.amountMinor,
              balanceType: "AVAILABLE",
              description: `Entry refund credit for competition ${competitionInstanceId} (${reason})`,
            });
          }
        } else if (res.status === "RESERVED") {
          // Release reservation
          await tx
            .update(sandboxEntryReservations)
            .set({ status: "RELEASED", updatedAt: new Date() })
            .where(sql`${sandboxEntryReservations.id} = ${res.id}`);

          if (res.amountMinor > 0) {
            entriesToInsert.push({
              id: `sle_${crypto.randomUUID()}`,
              accountingReferenceId,
              idempotencyKey: `${idempotencyKey}:res_release_${res.userId}`,
              competitionInstanceId,
              userId: res.userId,
              accountId: `user:${res.userId}:GEL`,
              eventType: "ENTRY_RELEASE",
              currency: "GEL",
              amountMinor: -res.amountMinor,
              balanceType: "RESERVED",
              description: `Entry reservation release debit on refund for ${competitionInstanceId}`,
            });
            entriesToInsert.push({
              id: `sle_${crypto.randomUUID()}`,
              accountingReferenceId,
              idempotencyKey: `${idempotencyKey}:avail_restore_${res.userId}`,
              competitionInstanceId,
              userId: res.userId,
              accountId: `user:${res.userId}:GEL`,
              eventType: "ENTRY_RELEASE",
              currency: "GEL",
              amountMinor: res.amountMinor,
              balanceType: "AVAILABLE",
              description: `Entry reservation release credit on refund for ${competitionInstanceId}`,
            });
          }
        }
      }

      // Record refund settlement
      await tx.insert(sandboxSettlements).values({
        competitionInstanceId,
        status: "REFUNDED",
        totalEntriesCapturedMinor: totalRefundedMinor,
        totalPrizesAwardedMinor: 0,
        platformMarginMinor: 0,
        promotionalSubsidyMinor: 0,
        currency: "GEL",
        accountingReferenceId,
        idempotencyKey,
      });

      if (entriesToInsert.length > 0) {
        await tx.insert(sandboxLedgerEntries).values(entriesToInsert);
      }

      return {
        success: true,
        accountingReferenceId,
        competitionInstanceId,
        totalRefunded: createMoney(totalRefundedMinor, "GEL"),
        refundedUserIds,
      };
    });
  }

  // =========================================================================
  // Sandbox QA / Testing Administration Helpers
  // =========================================================================

  /**
   * Provisions test sandbox GEL for QA/demonstration testing.
   * Strictly server/internal scoped. Debits platform treasury and credits user available balance.
   */
  async grantSandboxFunding(userId: string, amount: MoneyAmount, idempotencyKey: string): Promise<{ success: boolean; balance: MoneyAmount; accountingReferenceId?: string }> {
    this.assertValidMoney(amount);
    if (amount.amountMinor <= 0) {
      throw new Error("Funding grant amount must be strictly positive");
    }

    let grantRefId: string | undefined;

    await db.transaction(async (tx) => {
      // 1. Take advisory lock on user
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(${ADVISORY_LOCK_USER_NAMESPACE}, hashtext(${userId}))`,
      );

      // 2. Check for idempotency
      const creditIdemKey = `${idempotencyKey}:user_credit`;
      const existing = await tx
        .select()
        .from(sandboxLedgerEntries)
        .where(sql`${sandboxLedgerEntries.idempotencyKey} = ${creditIdemKey}`);

      if (existing.length > 0) {
        grantRefId = existing[0].accountingReferenceId;
        return;
      }

      const accountingReferenceId = `sar_grant_${crypto.randomUUID()}`;
      grantRefId = accountingReferenceId;

      // 3. Balanced postings: Platform Treasury (debit) -> User Available (credit)
      await tx.insert(sandboxLedgerEntries).values([
        {
          id: `sle_${crypto.randomUUID()}`,
          accountingReferenceId,
          idempotencyKey: `${idempotencyKey}:treasury_debit`,
          accountId: "platform:treasury:GEL",
          eventType: "FUNDING_GRANT",
          currency: "GEL",
          amountMinor: -amount.amountMinor,
          balanceType: "AVAILABLE",
          description: `QA sandbox funding grant debit to platform treasury for user ${userId}`,
        },
        {
          id: `sle_${crypto.randomUUID()}`,
          accountingReferenceId,
          idempotencyKey: `${idempotencyKey}:user_credit`,
          userId,
          accountId: `user:${userId}:GEL`,
          eventType: "FUNDING_GRANT",
          currency: "GEL",
          amountMinor: amount.amountMinor,
          balanceType: "AVAILABLE",
          description: `QA sandbox funding grant credit for user ${userId}`,
        },
      ]);
    });

    const bal = await this.getSandboxBalance(userId);
    return { success: true, balance: bal.available, accountingReferenceId: grantRefId };
  }

  /**
   * Retrieves a user's current sandbox balances.
   */
  async getSandboxBalance(userId: string): Promise<{ available: MoneyAmount; reserved: MoneyAmount; total: MoneyAmount }> {
    const res = await db.execute(
      sql`SELECT
            COALESCE(SUM(CASE WHEN balance_type = 'AVAILABLE' THEN amount_minor ELSE 0 END), 0)::integer AS available,
            COALESCE(SUM(CASE WHEN balance_type = 'RESERVED' THEN amount_minor ELSE 0 END), 0)::integer AS reserved
          FROM sandbox_ledger_entries
          WHERE user_id = ${userId} AND currency = 'GEL'`,
    );

    const availableMinor = Number((res.rows[0] as any)?.available ?? 0);
    const reservedMinor = Number((res.rows[0] as any)?.reserved ?? 0);

    return {
      available: createMoney(availableMinor, "GEL"),
      reserved: createMoney(reservedMinor, "GEL"),
      total: createMoney(availableMinor + reservedMinor, "GEL"),
    };
  }

  /**
   * Performs full accounting reconciliation for a specific competition instance.
   * Asserts zero unexplained discrepancy across escrow, payouts, subsidies, and fees.
   */
  async reconcileCompetitionInstance(competitionInstanceId: string): Promise<{
    reconciled: boolean;
    totalCapturedMinor: number;
    totalPrizesMinor: number;
    platformMarginMinor: number;
    promotionalSubsidyMinor: number;
    discrepancyMinor: number;
  }> {
    const res = await db.execute(
      sql`SELECT
            COALESCE(SUM(CASE WHEN event_type = 'ENTRY_CAPTURE' AND amount_minor > 0 THEN amount_minor ELSE 0 END), 0)::integer AS captured,
            COALESCE(SUM(CASE WHEN event_type = 'PRIZE_PAYOUT' AND user_id IS NOT NULL THEN amount_minor ELSE 0 END), 0)::integer AS prizes,
            COALESCE(SUM(CASE WHEN event_type = 'PLATFORM_FEE_RETAINED' THEN amount_minor ELSE 0 END), 0)::integer AS margin,
            COALESCE(SUM(CASE WHEN event_type = 'PROMOTIONAL_SUBSIDY' THEN ABS(amount_minor) ELSE 0 END), 0)::integer AS subsidy
          FROM sandbox_ledger_entries
          WHERE competition_instance_id = ${competitionInstanceId}`,
    );

    const row = (res.rows[0] as any) ?? { captured: 0, prizes: 0, margin: 0, subsidy: 0 };
    const totalInflows = Number(row.captured) + Number(row.subsidy);
    const totalOutflows = Number(row.prizes) + Number(row.margin);
    const discrepancyMinor = totalInflows - totalOutflows;

    return {
      reconciled: discrepancyMinor === 0,
      totalCapturedMinor: Number(row.captured),
      totalPrizesMinor: Number(row.prizes),
      platformMarginMinor: Number(row.margin),
      promotionalSubsidyMinor: Number(row.subsidy),
      discrepancyMinor,
    };
  }

  /**
   * Performs whole-system double-entry balance check across all sandbox records.
   * In a double-entry ledger, the algebraic SUM of all signed amounts must equal exactly 0.
   */
  async reconcileSystem(): Promise<{ reconciled: boolean; totalLedgerSum: number }> {
    const res = await db.execute(
      sql`SELECT COALESCE(SUM(amount_minor), 0)::integer AS total_sum FROM sandbox_ledger_entries`,
    );
    const totalSum = Number((res.rows[0] as any)?.total_sum ?? 0);
    return {
      reconciled: totalSum === 0,
      totalLedgerSum: totalSum,
    };
  }

  private assertValidMoney(money: MoneyAmount): void {
    if (!money || typeof money !== "object") {
      throw new Error("Invalid MoneyAmount payload");
    }
    if (!Number.isInteger(money.amountMinor) || money.amountMinor < 0) {
      throw new Error(`Invalid monetary minor amount: ${money.amountMinor}. Must be a non-negative integer.`);
    }
    if (money.currency !== "GEL") {
      throw new Error(`Unsupported currency for sandbox accounting: ${money.currency}. Only GEL is supported.`);
    }
  }
}
