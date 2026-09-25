// Competition Instance Service & Factory (Fugluck Competition Economy — Phase 3)
// Implements FUGLUCK — FINAL COMPETITION DOMAIN CONTRACT Sections 4, 5, 6, 7
// Manages continuous queueing, atomic registration, snapshotting, and final-seat concurrency.

import { randomUUID } from "node:crypto";
import { asc, eq, sql } from "drizzle-orm";
import type {
  CompetitionFormat,
  CompetitionInstance,
  CompetitionInstancePrize,
  CompetitionParticipant,
  CompetitionStatus,
  ISO4217Currency,
} from "@fugluck/shared";
import { createMoney } from "@fugluck/shared";
import { GAME_COMPETITION_CERTIFICATIONS } from "@fugluck/shared";
import type { CompetitionAccountingPort } from "../accounting/port";
import { db, pool } from "../db/client";
import {
  competitionInstancePrizes,
  competitionInstances,
  competitionParticipants,
  competitionTemplatePrizes,
  competitionTemplates,
} from "../db/schema";
import { assertGameEligibleForCompetition, assertLiveAuthorityTemplateShape, templateService } from "./templateService";

export const ADVISORY_LOCK_TEMPLATE_QUEUE_NAMESPACE = 2094927182;

export class InstanceRegistrationError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "InstanceRegistrationError";
  }
}

export interface JoinCompetitionResult {
  instanceId: string;
  templateId: string;
  gameId: string;
  seatIndex: number;
  currentParticipants: number;
  participantCapacity: number;
  status: CompetitionStatus;
  isLocked: boolean;
  entryFeeMinor: number;
  currency: ISO4217Currency;
}

class AsyncMutex {
  private queue = new Map<string, Promise<void>>();

  async runExclusive<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const previous = this.queue.get(key) ?? Promise.resolve();
    let release: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });

    this.queue.set(key, previous.then(() => current, () => current));
    await previous.catch(() => {});

    try {
      return await fn();
    } finally {
      release!();
      if (this.queue.get(key) === current) {
        this.queue.delete(key);
      }
    }
  }
}

export const templateQueueMutex = new AsyncMutex();

export class CompetitionInstanceService {
  /**
   * Retrieves a CompetitionInstance by ID with its snapshotted prizes and participants.
   */
  async getInstance(
    id: string,
    txClient?: any,
  ): Promise<(CompetitionInstance & { participants: CompetitionParticipant[] }) | null> {
    const client = txClient ?? db;
    const rows = await client
      .select()
      .from(competitionInstances)
      .where(eq(competitionInstances.id, id));

    if (rows.length === 0) return null;
    const inst = rows[0];

    const prizeRows = await client
      .select()
      .from(competitionInstancePrizes)
      .where(eq(competitionInstancePrizes.instanceId, id))
      .orderBy(asc(competitionInstancePrizes.placement));

    const partRows = await client
      .select()
      .from(competitionParticipants)
      .where(eq(competitionParticipants.instanceId, id))
      .orderBy(asc(competitionParticipants.seatIndex));

    return {
      id: inst.id,
      templateId: inst.templateId,
      gameId: inst.gameId,
      format: inst.format as CompetitionFormat,
      participantCapacity: inst.participantCapacity,
      currency: inst.currency as ISO4217Currency,
      entryFeeMinor: inst.entryFeeMinor,
      rulesVersion: inst.rulesVersion,
      skillAssessmentVersion: inst.skillAssessmentVersion,
      jurisdiction: inst.jurisdiction,
      status: inst.status as CompetitionStatus,
      currentParticipants: inst.currentParticipants,
      matchId: inst.matchId,
      winnerUserId: inst.winnerUserId,
      lockedAt: inst.lockedAt ? inst.lockedAt.toISOString() : null,
      startedAt: inst.startedAt ? inst.startedAt.toISOString() : null,
      settledAt: inst.settledAt ? inst.settledAt.toISOString() : null,
      createdAt: inst.createdAt.toISOString(),
      prizes: prizeRows.map((p: any) => ({
        id: p.id,
        instanceId: p.instanceId,
        placement: p.placement,
        amountMinor: p.amountMinor,
        currency: p.currency as ISO4217Currency,
        awardedUserId: p.awardedUserId,
      })),
      participants: partRows.map((p: any) => ({
        id: p.id,
        instanceId: p.instanceId,
        userId: p.userId,
        seatIndex: p.seatIndex,
        entryFeeMinor: p.entryFeeMinor,
        score: p.score,
        rank: p.rank,
        prizeWonMinor: p.prizeWonMinor,
        status: p.status as any,
        registeredAt: p.registeredAt.toISOString(),
      })),
    };
  }

  /**
   * Creates a brand new CompetitionInstance by snapshotting all material terms
   * and prizes from the given template.
   */
  async createInstanceFromTemplate(
    templateId: string,
    txClient?: any,
  ): Promise<CompetitionInstance> {
    const client = txClient ?? db;
    const template = await templateService.getTemplate(templateId);

    if (!template) {
      throw new InstanceRegistrationError("TEMPLATE_NOT_FOUND", `Template ${templateId} not found.`);
    }
    if (!template.enabled) {
      throw new InstanceRegistrationError("TEMPLATE_DISABLED", `Template ${templateId} is disabled.`);
    }
    assertGameEligibleForCompetition(template.gameId, {
      isSandbox: true,
      enabled: true,
      rulesVersion: template.rulesVersion,
    });
    try {
      assertLiveAuthorityTemplateShape({ format: template.format, participantCapacity: template.participantCapacity, prizes: template.prizes ?? [] });
    } catch (error) {
      throw new InstanceRegistrationError("UNSUPPORTED_TEMPLATE_SHAPE", error instanceof Error ? error.message : "Unsupported authority template shape.");
    }

    const instanceId = `inst_${randomUUID()}`;

    const executeCreation = async (tx: any) => {
      await tx.insert(competitionInstances).values({
        id: instanceId,
        templateId: template.id,
        gameId: template.gameId,
        format: template.format,
        participantCapacity: template.participantCapacity,
        currency: template.currency,
        entryFeeMinor: template.entryFeeMinor,
        rulesVersion: template.rulesVersion,
        skillAssessmentVersion: template.skillAssessmentVersion,
        jurisdiction: template.jurisdiction,
        status: "PENDING_ENTRANTS",
        currentParticipants: 0,
      });

      if (template.prizes && template.prizes.length > 0) {
        for (const prize of template.prizes) {
          await tx.insert(competitionInstancePrizes).values({
            id: `inst_prz_${randomUUID()}`,
            instanceId,
            placement: prize.placement,
            amountMinor: prize.amountMinor,
            currency: prize.currency,
          });
        }
      }
    };

    if (txClient) {
      await executeCreation(txClient);
    } else {
      await db.transaction(async (tx) => {
        await executeCreation(tx);
      });
    }

    const created = await this.getInstance(instanceId, txClient);
    if (!created) {
      throw new Error(`Failed to load newly created instance ${instanceId}`);
    }
    return created;
  }

  /**
   * Continuous Queue & Atomic Registration:
   * Serialized per templateId queue to prevent connection pool exhaustion.
   * Finds or creates a PENDING_ENTRANTS instance with open capacity.
   * Reserves entry fee, registers participant, and transitions to LOCKED when full.
   */
  async joinCompetitionQueue(
    templateId: string,
    userId: string,
    accountingPort: CompetitionAccountingPort,
    options: { isGuest?: boolean } = {},
  ): Promise<JoinCompetitionResult> {
    if (options.isGuest) {
      throw new InstanceRegistrationError("GUEST_NOT_ALLOWED", "Guests cannot enter paid/sandbox GEL competitions.");
    }

    return await templateQueueMutex.runExclusive(templateId, async () => {
      // 1. Validate template availability
      const tmpl = await templateService.getTemplate(templateId);
      if (!tmpl) {
        throw new InstanceRegistrationError("TEMPLATE_NOT_FOUND", `Template '${templateId}' not found.`);
      }
      if (!tmpl.enabled) {
        throw new InstanceRegistrationError("TEMPLATE_DISABLED", `Template '${templateId}' is currently disabled.`);
      }
      const certification = GAME_COMPETITION_CERTIFICATIONS[tmpl.gameId];
      if (!certification || certification.testGelCompetition !== "LEVEL_3_CERTIFIED" || certification.authorityVersion !== tmpl.rulesVersion) {
        throw new InstanceRegistrationError("GAME_NOT_CERTIFIED", "This template is not eligible for the active TEST GEL authority version.");
      }
      try {
        assertLiveAuthorityTemplateShape({ format: tmpl.format, participantCapacity: tmpl.participantCapacity, prizes: tmpl.prizes ?? [] });
      } catch (error) {
        throw new InstanceRegistrationError("UNSUPPORTED_TEMPLATE_SHAPE", error instanceof Error ? error.message : "Unsupported authority template shape.");
      }

      // 2. Find open PENDING_ENTRANTS instance with available seat
      const openRows = await pool.query(
        `SELECT id, current_participants, participant_capacity, entry_fee_minor, currency, status, game_id
         FROM competition_instances
         WHERE template_id = $1
           AND status = 'PENDING_ENTRANTS'
           AND current_participants < participant_capacity
         ORDER BY created_at ASC
         LIMIT 1`,
        [templateId],
      );

      let targetInstance: any;
      if (openRows.rows.length > 0) {
        targetInstance = openRows.rows[0];
      } else {
        // Create new instance from template snapshot (committed immediately)
        targetInstance = await this.createInstanceFromTemplate(templateId);
      }

      const targetInstanceId = targetInstance.id;

      // 3. Duplicate participant guard
      const dupCheck = await pool.query(
        `SELECT id FROM competition_participants WHERE instance_id = $1 AND user_id = $2`,
        [targetInstanceId, userId],
      );
      if (dupCheck.rows.length > 0) {
        throw new InstanceRegistrationError(
          "DUPLICATE_USER_IN_INSTANCE",
          `User '${userId}' is already registered in instance '${targetInstanceId}'.`,
        );
      }

      // 4. Reserve entry funds via accounting port
      const seatIndex = Number(targetInstance.current_participants ?? targetInstance.currentParticipants);
      const entryFeeMinor = Number(targetInstance.entry_fee_minor ?? targetInstance.entryFeeMinor);
      const currency = String(targetInstance.currency);
      const entryFee = createMoney(entryFeeMinor, currency as ISO4217Currency);
      const idempotencyKey = `comp_res_${targetInstanceId}_${userId}_seat${seatIndex}`;

      const reserveResult = await accountingPort.reserveEntry({
        competitionInstanceId: targetInstanceId,
        userId,
        entryFee,
        idempotencyKey,
      });

      if (!reserveResult.success) {
        const errCode = reserveResult.errorCode ?? "RESERVATION_FAILED";
        throw new InstanceRegistrationError(
          errCode,
          reserveResult.errorMessage ?? `Accounting entry reservation failed: ${errCode}`,
        );
      }

      const reservedRefId = reserveResult.accountingReferenceId;

      try {
        // 5. Insert participant record and increment participants
        const participantId = `part_${randomUUID()}`;
        await pool.query(
          `INSERT INTO competition_participants (id, instance_id, user_id, seat_index, entry_fee_minor, status)
           VALUES ($1, $2, $3, $4, $5, 'REGISTERED')`,
          [participantId, targetInstanceId, userId, seatIndex, entryFeeMinor],
        );

        const nextParticipants = seatIndex + 1;
        const capacity = Number(targetInstance.participant_capacity ?? targetInstance.participantCapacity);
        const isFull = nextParticipants >= capacity;
        const newStatus = isFull ? "LOCKED" : "PENDING_ENTRANTS";

        await pool.query(
          `UPDATE competition_instances
           SET current_participants = $1, status = $2, locked_at = $3
           WHERE id = $4`,
          [nextParticipants, newStatus, isFull ? new Date() : null, targetInstanceId],
        );

        return {
          instanceId: targetInstanceId,
          templateId,
          gameId: String(targetInstance.game_id ?? targetInstance.gameId),
          seatIndex,
          currentParticipants: nextParticipants,
          participantCapacity: capacity,
          status: newStatus as CompetitionStatus,
          isLocked: isFull,
          entryFeeMinor,
          currency: currency as ISO4217Currency,
        };
      } catch (dbErr) {
        // Safe compensation if participant insert or update fails
        if (reservedRefId) {
          try {
            await accountingPort.releaseEntry({
              competitionInstanceId: targetInstanceId,
              userId,
              idempotencyKey: `comp_comp_release_${targetInstanceId}_${userId}`,
            });
          } catch (relErr) {
            console.error(`[competition] Compensation release failed:`, relErr);
          }
        }
        throw dbErr;
      }
    });
  }

  /**
   * Safe read-only view of a competition instance for clients/APIs.
   */
  async getPublicInstanceSummary(id: string): Promise<Record<string, any> | null> {
    const inst = await this.getInstance(id);
    if (!inst) return null;

    return {
      id: inst.id,
      templateId: inst.templateId,
      gameId: inst.gameId,
      format: inst.format,
      participantCapacity: inst.participantCapacity,
      currency: inst.currency,
      entryFeeMinor: inst.entryFeeMinor,
      rulesVersion: inst.rulesVersion,
      skillAssessmentVersion: inst.skillAssessmentVersion,
      jurisdiction: inst.jurisdiction,
      status: inst.status,
      currentParticipants: inst.currentParticipants,
      matchId: inst.matchId,
      winnerUserId: inst.winnerUserId,
      createdAt: inst.createdAt,
      prizes: inst.prizes?.map((p) => ({
        placement: p.placement,
        amountMinor: p.amountMinor,
        currency: p.currency,
      })),
      participants: inst.participants.map((p) => ({
        userId: p.userId,
        seatIndex: p.seatIndex,
        rank: p.rank,
        score: p.score,
        prizeWonMinor: p.prizeWonMinor,
        status: p.status,
      })),
    };
  }

  /**
   * Administrative filterable query of competition instances.
   */
  async listAdminInstances(params: {
    status?: string;
    gameId?: string;
    templateId?: string;
    instanceId?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    instances: Array<{
      id: string;
      templateId: string;
      templateTitle: string;
      gameId: string;
      format: string;
      status: CompetitionStatus;
      currentParticipants: number;
      participantCapacity: number;
      entryFeeMinor: number;
      currency: string;
      matchId: string | null;
      winnerUserId: string | null;
      createdAt: Date;
      lockedAt: Date | null;
      startedAt: Date | null;
      settledAt: Date | null;
      totalPrizeMinor: number;
    }>;
    total: number;
    page: number;
    limit: number;
  }> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (params.status && params.status.trim().length > 0) {
      conditions.push(`ci.status = $${idx++}`);
      values.push(params.status.trim());
    }

    if (params.gameId && params.gameId.trim().length > 0) {
      conditions.push(`ci.game_id = $${idx++}`);
      values.push(params.gameId.trim());
    }

    if (params.templateId && params.templateId.trim().length > 0) {
      conditions.push(`ci.template_id = $${idx++}`);
      values.push(params.templateId.trim());
    }

    if (params.instanceId && params.instanceId.trim().length > 0) {
      conditions.push(`ci.id ILIKE $${idx++}`);
      values.push(`%${params.instanceId.trim()}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countQuery = `SELECT count(*)::integer AS total FROM competition_instances ci ${whereClause}`;
    const countRes = await pool.query(countQuery, values);
    const total = Number(countRes.rows[0]?.total ?? 0);

    const listQuery = `
      SELECT
        ci.id,
        ci.template_id,
        COALESCE(ct.title, 'Unknown Template') AS template_title,
        ci.game_id,
        ci.format,
        ci.status,
        ci.current_participants,
        ci.participant_capacity,
        ci.entry_fee_minor,
        ci.currency,
        ci.match_id,
        ci.winner_user_id,
        ci.created_at,
        ci.locked_at,
        ci.started_at,
        ci.settled_at,
        COALESCE(
          (SELECT SUM(amount_minor) FROM competition_instance_prizes cip WHERE cip.instance_id = ci.id),
          0
        )::integer AS total_prize_minor
      FROM competition_instances ci
      LEFT JOIN competition_templates ct ON ci.template_id = ct.id
      ${whereClause}
      ORDER BY ci.created_at DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `;

    const listRes = await pool.query(listQuery, [...values, limit, offset]);

    return {
      instances: listRes.rows.map((r: any) => ({
        id: r.id,
        templateId: r.template_id,
        templateTitle: r.template_title,
        gameId: r.game_id,
        format: r.format,
        status: r.status as CompetitionStatus,
        currentParticipants: Number(r.current_participants),
        participantCapacity: Number(r.participant_capacity),
        entryFeeMinor: Number(r.entry_fee_minor),
        currency: r.currency,
        matchId: r.match_id,
        winnerUserId: r.winner_user_id,
        createdAt: r.created_at,
        lockedAt: r.locked_at,
        startedAt: r.started_at,
        settledAt: r.settled_at,
        totalPrizeMinor: Number(r.total_prize_minor),
      })),
      total,
      page,
      limit,
    };
  }

  /**
   * Administrative detailed inspection of a single competition instance.
   * Contrasts current template terms vs instance snapshotted terms,
   * inspects participants with username, and computes reconciliation.
   */
  async getInstanceAdminDetail(id: string): Promise<Record<string, any> | null> {
    const inst = await this.getInstance(id);
    if (!inst) return null;

    // Current template terms
    const currentTemplate = await templateService.getTemplate(inst.templateId);

    // Participants with username
    const partRows = await pool.query(
      `SELECT
         cp.id,
         cp.user_id,
         u.username,
         cp.seat_index,
         cp.status,
         cp.score,
         cp.rank,
         cp.prize_won_minor,
         cp.registered_at,
         cp.entry_fee_minor
       FROM competition_participants cp
       LEFT JOIN users u ON cp.user_id = u.id
       WHERE cp.instance_id = $1
       ORDER BY cp.seat_index ASC`,
      [id],
    );

    // Reconciliation check
    const { sandboxAccountingAdapter } = await import("../accounting/sandboxAdapter");
    const reconciliation = await sandboxAccountingAdapter.reconcileCompetitionInstance(id);

    return {
      instance: {
        id: inst.id,
        templateId: inst.templateId,
        gameId: inst.gameId,
        format: inst.format,
        status: inst.status,
        currentParticipants: inst.currentParticipants,
        participantCapacity: inst.participantCapacity,
        entryFeeMinor: inst.entryFeeMinor,
        currency: inst.currency,
        rulesVersion: inst.rulesVersion,
        skillAssessmentVersion: inst.skillAssessmentVersion,
        jurisdiction: inst.jurisdiction,
        matchId: inst.matchId,
        winnerUserId: inst.winnerUserId,
        createdAt: inst.createdAt,
        lockedAt: inst.lockedAt,
        startedAt: inst.startedAt,
        settledAt: inst.settledAt,
        prizes: inst.prizes?.map((p) => ({
          id: p.id,
          placement: p.placement,
          amountMinor: p.amountMinor,
          currency: p.currency,
          awardedUserId: p.awardedUserId,
        })),
      },
      currentTemplate: currentTemplate
        ? {
            id: currentTemplate.id,
            title: currentTemplate.title,
            gameId: currentTemplate.gameId,
            format: currentTemplate.format,
            participantCapacity: currentTemplate.participantCapacity,
            entryFeeMinor: currentTemplate.entryFeeMinor,
            currency: currentTemplate.currency,
            rulesVersion: currentTemplate.rulesVersion,
            jurisdiction: currentTemplate.jurisdiction,
            enabled: currentTemplate.enabled,
            prizes: currentTemplate.prizes,
          }
        : null,
      participants: partRows.rows.map((p: any) => ({
        id: p.id,
        userId: p.user_id,
        username: p.username ?? `User ${String(p.user_id).slice(0, 8)}`,
        seatIndex: Number(p.seat_index),
        status: p.status,
        score: p.score !== null ? Number(p.score) : null,
        rank: p.rank !== null ? Number(p.rank) : null,
        prizeWonMinor: Number(p.prize_won_minor ?? 0),
        registeredAt: p.registered_at,
        entryFeeMinor: Number(p.entry_fee_minor),
      })),
      reconciliation,
    };
  }
}

export const instanceService = new CompetitionInstanceService();
