// Competition Admin Router (Fugluck Competition Economy — Phase 5)
// Operational and administrative management interface for the Competition domain.
// Strictly sandbox GEL — zero real payments.

import { randomUUID } from "node:crypto";
import { Router } from "express";
import { eq, sql } from "drizzle-orm";
import {
  GAME_COMPETITION_ELIGIBILITY_REGISTRY,
  type CompetitionFormat,
  type CompetitionPrize,
  type CompetitionTemplate,
  type GameCompetitionEligibility,
  type ISO4217Currency,
} from "@fugluck/shared";
import { requirePermission } from "../auth/permissions";
import { db, pool } from "../db/client";
import { adminAuditLogs, competitionInstances, users } from "../db/schema";
import { templateService } from "../competitions/templateService";
import { instanceService } from "../competitions/instanceService";
import { lifecycleEngine } from "../competitions/lifecycleEngine";
import { sandboxAccountingAdapter } from "../accounting/sandboxAdapter";

export const competitionAdminRouter = Router();

// ---------------------------------------------------------------------------
// 1. Competition Overview Dashboard
// ---------------------------------------------------------------------------

const handleGetDashboard = async (_req: any, res: any) => {
  try {
    const [templatesCountRes] = await pool.query(
      `SELECT
         COUNT(*)::integer AS total,
         COUNT(CASE WHEN enabled = true THEN 1 END)::integer AS enabled
       FROM competition_templates`,
    ).then((r) => r.rows);

    const [instancesStatusRes] = await pool.query(
      `SELECT
         COUNT(CASE WHEN status = 'PENDING_ENTRANTS' THEN 1 END)::integer AS waiting,
         COUNT(CASE WHEN status = 'LOCKED' THEN 1 END)::integer AS locked,
         COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END)::integer AS active,
         COUNT(CASE WHEN status = 'VERIFYING' THEN 1 END)::integer AS verifying,
         COUNT(CASE WHEN status = 'SETTLED' AND settled_at >= CURRENT_DATE THEN 1 END)::integer AS settled_today,
         COUNT(CASE WHEN status = 'CANCELLED' AND created_at >= CURRENT_DATE THEN 1 END)::integer AS cancelled_today,
         COUNT(CASE WHEN status = 'VOIDED' AND settled_at >= CURRENT_DATE THEN 1 END)::integer AS voided_today,
         COUNT(*)::integer AS total_instances
       FROM competition_instances`,
    ).then((r) => r.rows);

    const accountingSummary = await sandboxAccountingAdapter.getSandboxAccountingSummary();

    const metrics = {
      totalTemplatesCount: Number(templatesCountRes?.total ?? 0),
      enabledTemplatesCount: Number(templatesCountRes?.enabled ?? 0),
      waitingInstancesCount: Number(instancesStatusRes?.waiting ?? 0),
      lockedInstancesCount: Number(instancesStatusRes?.locked ?? 0),
      activeInstancesCount: Number(instancesStatusRes?.active ?? 0),
      verifyingInstancesCount: Number(instancesStatusRes?.verifying ?? 0),
      settledTodayCount: Number(instancesStatusRes?.settled_today ?? 0),
      cancelledTodayCount: Number(instancesStatusRes?.cancelled_today ?? 0),
      voidedTodayCount: Number(instancesStatusRes?.voided_today ?? 0),
      totalInstancesCount: Number(instancesStatusRes?.total_instances ?? 0),
      entriesReservedMinor: accountingSummary.reservedEntryFundsMinor,
      entriesCapturedMinor: accountingSummary.capturedEntryFundsMinor,
      prizesAwardedMinor: accountingSummary.prizeAwardsMinor,
      platformMarginMinor: accountingSummary.platformFeesMinor,
      promotionalSubsidiesMinor: accountingSummary.promotionalSubsidiesMinor,
      systemLedgerSumMinor: accountingSummary.systemLedgerSumMinor,
      reconciliationDiscrepancyMinor: accountingSummary.discrepancyMinor,
    };

    res.json({
      metrics,
      templates: {
        total: Number(templatesCountRes?.total ?? 0),
        enabled: Number(templatesCountRes?.enabled ?? 0),
      },
      instances: {
        waiting: Number(instancesStatusRes?.waiting ?? 0),
        locked: Number(instancesStatusRes?.locked ?? 0),
        active: Number(instancesStatusRes?.active ?? 0),
        verifying: Number(instancesStatusRes?.verifying ?? 0),
        settledToday: Number(instancesStatusRes?.settled_today ?? 0),
        cancelledToday: Number(instancesStatusRes?.cancelled_today ?? 0),
        voidedToday: Number(instancesStatusRes?.voided_today ?? 0),
        total: Number(instancesStatusRes?.total_instances ?? 0),
      },
      accounting: {
        totalGrantsMinor: accountingSummary.totalGrantsMinor,
        availableUserFundsMinor: accountingSummary.availableUserFundsMinor,
        reservedEntryFundsMinor: accountingSummary.reservedEntryFundsMinor,
        capturedEscrowFundsMinor: accountingSummary.capturedEscrowFundsMinor,
        totalPrizeAwardsMinor: accountingSummary.totalPrizeAwardsMinor,
        totalRefundsMinor: accountingSummary.totalRefundsMinor,
        platformFeesRetainedMinor: accountingSummary.platformFeesRetainedMinor,
        promotionalSubsidiesMinor: accountingSummary.promotionalSubsidiesMinor,
        totalLedgerSum: accountingSummary.totalLedgerSum,
        systemReconciled: accountingSummary.systemReconciled,
      },
      currency: "GEL",
      isSandbox: true,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to load competition dashboard metrics." });
  }
};

competitionAdminRouter.get("/dashboard", requirePermission("COMPETITIONS_VIEW"), handleGetDashboard);
competitionAdminRouter.get("/overview", requirePermission("COMPETITIONS_VIEW"), handleGetDashboard);

// ---------------------------------------------------------------------------
// 2. Template Authoring & Management
// ---------------------------------------------------------------------------

competitionAdminRouter.get("/templates", requirePermission("COMPETITIONS_VIEW"), async (_req, res) => {
  try {
    const templates = await templateService.listTemplates();

    const enrichedTemplates = templates.map((t: CompetitionTemplate) => {
      const expectedEntriesMinor = t.participantCapacity * t.entryFeeMinor;
      const predeterminedPrizesMinor = (t.prizes ?? []).reduce(
        (sum: number, p: CompetitionPrize) => sum + p.amountMinor,
        0,
      );
      const expectedPlatformMarginMinor = Math.max(0, expectedEntriesMinor - predeterminedPrizesMinor);
      const expectedPromotionalSubsidyMinor = Math.max(0, predeterminedPrizesMinor - expectedEntriesMinor);

      return {
        ...t,
        economics: {
          expectedEntriesMinor,
          predeterminedPrizesMinor,
          expectedPlatformMarginMinor,
          expectedPromotionalSubsidyMinor,
        },
      };
    });

    res.json({ templates: enrichedTemplates });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to load templates." });
  }
});

competitionAdminRouter.post("/templates", requirePermission("COMPETITIONS_MANAGE"), async (req, res) => {
  try {
    const adminUserId = req.userId!;
    const {
      gameId,
      title,
      format,
      participantCapacity,
      currency,
      entryFeeMinor,
      prizes,
      rulesVersion,
      skillAssessmentVersion,
      jurisdiction,
      enabled,
    } = req.body ?? {};

    // Validation
    if (typeof currency === "string" && currency !== "GEL") {
      res.status(400).json({ error: "Invalid currency. Only sandbox GEL is supported." });
      return;
    }

    if (typeof entryFeeMinor === "number" && entryFeeMinor < 0) {
      res.status(400).json({ error: "Entry fee cannot be negative." });
      return;
    }

    if (typeof participantCapacity === "number" && participantCapacity < 2) {
      res.status(400).json({ error: "Participant capacity must be at least 2." });
      return;
    }

    if (!Array.isArray(prizes) || prizes.length === 0) {
      res.status(400).json({ error: "Template must specify at least one prize placement." });
      return;
    }

    const placements = new Set<number>();
    for (const p of prizes) {
      if (typeof p.placement !== "number" || p.placement < 1) {
        res.status(400).json({ error: "Prize placement must be a positive integer." });
        return;
      }
      if (placements.has(p.placement)) {
        res.status(400).json({ error: `Duplicate prize placement: ${p.placement}` });
        return;
      }
      placements.add(p.placement);

      if (typeof p.amountMinor !== "number" || p.amountMinor < 0) {
        res.status(400).json({ error: "Prize amount cannot be negative." });
        return;
      }
    }

    const template = await templateService.createTemplate({
      gameId,
      title,
      format: (format ?? "HEAD_TO_HEAD") as CompetitionFormat,
      participantCapacity: Number(participantCapacity),
      currency: "GEL",
      entryFeeMinor: Number(entryFeeMinor),
      prizes: prizes.map((p: any) => ({
        placement: Number(p.placement),
        amountMinor: Number(p.amountMinor),
        currency: "GEL",
      })),
      rulesVersion: rulesVersion ?? "1.0.0",
      skillAssessmentVersion: skillAssessmentVersion ?? "1.0.0",
      jurisdiction: jurisdiction ?? "GE",
      enabled: enabled ?? true,
    });

    // Audit log
    const auditLogId = `audit_${randomUUID()}`;
    await db.insert(adminAuditLogs).values({
      id: auditLogId,
      adminUserId,
      action: "ADMIN_COMPETITION_TEMPLATE_CREATE",
      targetType: "competition_template",
      targetId: template.id,
      amount: template.entryFeeMinor,
      currency: "GEL",
      reason: "Admin created competition template",
      details: {
        gameId: template.gameId,
        title: template.title,
        prizes: template.prizes,
      },
    });

    res.status(201).json({ template, auditLogId });
  } catch (err: any) {
    const status = err.name === "GameEligibilityError" || err.name === "TemplateValidationError" ? 400 : 500;
    res.status(status).json({ error: err.message || "Failed to create template." });
  }
});

competitionAdminRouter.put("/templates/:id", requirePermission("COMPETITIONS_MANAGE"), async (req, res) => {
  try {
    const adminUserId = req.userId!;
    const templateId = String(req.params.id);
    const { title, rulesVersion, skillAssessmentVersion, jurisdiction, enabled, prizes } = req.body ?? {};

    if (Array.isArray(prizes)) {
      const placements = new Set<number>();
      for (const p of prizes) {
        if (typeof p.placement !== "number" || p.placement < 1) {
          res.status(400).json({ error: "Prize placement must be a positive integer." });
          return;
        }
        if (placements.has(p.placement)) {
          res.status(400).json({ error: `Duplicate prize placement: ${p.placement}` });
          return;
        }
        placements.add(p.placement);

        if (typeof p.amountMinor !== "number" || p.amountMinor < 0) {
          res.status(400).json({ error: "Prize amount cannot be negative." });
          return;
        }
      }
    }

    const template = await templateService.updateTemplate(templateId, {
      title,
      rulesVersion,
      skillAssessmentVersion,
      jurisdiction,
      enabled,
      prizes: Array.isArray(prizes)
        ? prizes.map((p: any) => ({
            placement: Number(p.placement),
            amountMinor: Number(p.amountMinor),
            currency: "GEL" as ISO4217Currency,
          }))
        : undefined,
    });

    // Audit log
    const auditLogId = `audit_${randomUUID()}`;
    await db.insert(adminAuditLogs).values({
      id: auditLogId,
      adminUserId,
      action: "ADMIN_COMPETITION_TEMPLATE_EDIT",
      targetType: "competition_template",
      targetId: templateId,
      reason: "Admin updated competition template terms for future instances",
      details: {
        title: template.title,
        enabled: template.enabled,
        prizes: template.prizes,
      },
    });

    res.json({ template, auditLogId });
  } catch (err: any) {
    const status = err.name === "TemplateValidationError" ? 400 : 500;
    res.status(status).json({ error: err.message || "Failed to update template." });
  }
});

competitionAdminRouter.post("/templates/:id/enable", requirePermission("COMPETITIONS_MANAGE"), async (req, res) => {
  try {
    const adminUserId = req.userId!;
    const templateId = String(req.params.id);
    const template = await templateService.enableTemplate(templateId);

    const auditLogId = `audit_${randomUUID()}`;
    await db.insert(adminAuditLogs).values({
      id: auditLogId,
      adminUserId,
      action: "ADMIN_COMPETITION_TEMPLATE_ENABLE",
      targetType: "competition_template",
      targetId: templateId,
      reason: "Admin enabled competition template",
    });

    res.json({ template, auditLogId });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to enable template." });
  }
});

competitionAdminRouter.post("/templates/:id/disable", requirePermission("COMPETITIONS_MANAGE"), async (req, res) => {
  try {
    const adminUserId = req.userId!;
    const templateId = String(req.params.id);
    const template = await templateService.disableTemplate(templateId);

    const auditLogId = `audit_${randomUUID()}`;
    await db.insert(adminAuditLogs).values({
      id: auditLogId,
      adminUserId,
      action: "ADMIN_COMPETITION_TEMPLATE_DISABLE",
      targetType: "competition_template",
      targetId: templateId,
      reason: "Admin disabled competition template",
    });

    res.json({ template, auditLogId });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to disable template." });
  }
});

// ---------------------------------------------------------------------------
// 3. Live & Completed Instance Monitoring
// ---------------------------------------------------------------------------

competitionAdminRouter.get("/instances", requirePermission("COMPETITIONS_VIEW"), async (req, res) => {
  try {
    const result = await instanceService.listAdminInstances({
      status: typeof req.query.status === "string" ? req.query.status.trim() : undefined,
      gameId: typeof req.query.gameId === "string" ? req.query.gameId.trim() : undefined,
      templateId: typeof req.query.templateId === "string" ? req.query.templateId.trim() : undefined,
      instanceId: typeof req.query.instanceId === "string" ? req.query.instanceId.trim() : undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to list competition instances." });
  }
});

competitionAdminRouter.get("/instances/:id", requirePermission("COMPETITIONS_VIEW"), async (req, res) => {
  try {
    const instanceId = String(req.params.id);
    const detail = await instanceService.getInstanceAdminDetail(instanceId);
    if (!detail) {
      res.status(404).json({ error: "Competition instance not found." });
      return;
    }

    res.json(detail);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to load instance detail." });
  }
});

// ---------------------------------------------------------------------------
// 4. Safe Operational Cancellation & Voiding
// ---------------------------------------------------------------------------

competitionAdminRouter.post("/instances/:id/cancel", requirePermission("COMPETITIONS_CANCEL"), async (req, res) => {
  try {
    const adminUserId = req.userId!;
    const instanceId = String(req.params.id);
    const { reason } = req.body ?? {};

    if (typeof reason !== "string" || reason.trim().length === 0) {
      res.status(400).json({ error: "An explicit operational reason is required to cancel a competition." });
      return;
    }

    const instRows = await pool.query(`SELECT id, status FROM competition_instances WHERE id = $1`, [instanceId]);
    if (instRows.rows.length === 0) {
      res.status(404).json({ error: "Competition instance not found." });
      return;
    }

    const currentStatus = instRows.rows[0].status;

    // Idempotent handling if already cancelled
    if (currentStatus === "CANCELLED") {
      res.json({ success: true, instanceId, status: "CANCELLED" });
      return;
    }

    // Protection: only PENDING_ENTRANTS may be cancelled
    if (currentStatus !== "PENDING_ENTRANTS") {
      res.status(400).json({
        error: `Only PENDING_ENTRANTS instances can be cancelled. Current status is ${currentStatus}. Active or settled instances must not be cancelled.`,
      });
      return;
    }

    const cancelRes = await lifecycleEngine.cancelUnfilledInstance(
      instanceId,
      sandboxAccountingAdapter,
      reason.trim(),
    );

    if (!cancelRes.cancelled) {
      res.status(400).json({ error: "Failed to cancel instance; it may have filled and locked concurrently." });
      return;
    }

    // Audit log
    const auditLogId = `audit_${randomUUID()}`;
    await db.insert(adminAuditLogs).values({
      id: auditLogId,
      adminUserId,
      action: "ADMIN_COMPETITION_CANCEL",
      targetType: "competition_instance",
      targetId: instanceId,
      reason: reason.trim(),
    });

    res.json({ success: true, instanceId, status: "CANCELLED", auditLogId });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to cancel competition instance." });
  }
});

competitionAdminRouter.post("/instances/:id/void", requirePermission("COMPETITIONS_VOID"), async (req, res) => {
  try {
    const adminUserId = req.userId!;
    const instanceId = String(req.params.id);
    const { reason } = req.body ?? {};

    if (typeof reason !== "string" || reason.trim().length === 0) {
      res.status(400).json({ error: "An explicit operational reason is required to void a competition." });
      return;
    }

    const instRows = await pool.query(`SELECT id, status FROM competition_instances WHERE id = $1`, [instanceId]);
    if (instRows.rows.length === 0) {
      res.status(404).json({ error: "Competition instance not found." });
      return;
    }

    const currentStatus = instRows.rows[0].status;

    // Idempotent handling if already voided
    if (currentStatus === "VOIDED") {
      res.json({ success: true, instanceId, status: "VOIDED" });
      return;
    }

    // Terminal state protection: SETTLED competitions cannot be voided through this operation
    if (currentStatus === "SETTLED") {
      res.status(400).json({
        error: "SETTLED competitions cannot be voided. Historical settlements are immutable.",
      });
      return;
    }

    if (currentStatus === "CANCELLED") {
      res.status(400).json({ error: "CANCELLED competitions cannot be voided." });
      return;
    }

    if (currentStatus === "PENDING_ENTRANTS") {
      res.status(400).json({
        error: "PENDING_ENTRANTS competitions must be cancelled (which releases reservations), not voided.",
      });
      return;
    }

    // Valid void states: LOCKED, ACTIVE, VERIFYING
    const settleRes = await lifecycleEngine.settleCompetition(
      instanceId,
      { systemVoid: true, voidReason: reason.trim() },
      sandboxAccountingAdapter,
    );

    // Audit log
    const auditLogId = `audit_${randomUUID()}`;
    await db.insert(adminAuditLogs).values({
      id: auditLogId,
      adminUserId,
      action: "ADMIN_COMPETITION_VOID",
      targetType: "competition_instance",
      targetId: instanceId,
      reason: reason.trim(),
    });

    res.json({ success: true, instanceId, status: settleRes.status, auditLogId });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to void competition instance." });
  }
});

// ---------------------------------------------------------------------------
// 5. Sandbox Accounting & Ledger Inspection
// ---------------------------------------------------------------------------

competitionAdminRouter.get("/accounting/summary", requirePermission("COMPETITIONS_VIEW"), async (_req, res) => {
  try {
    const summary = await sandboxAccountingAdapter.getSandboxAccountingSummary();
    res.json({ summary, isSandbox: true, currency: "GEL" });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to load sandbox accounting summary." });
  }
});

competitionAdminRouter.get("/accounting/ledger", requirePermission("COMPETITIONS_VIEW"), async (req, res) => {
  try {
    const result = await sandboxAccountingAdapter.listSandboxLedgerEntries({
      competitionInstanceId: typeof req.query.competitionInstanceId === "string" ? req.query.competitionInstanceId.trim() : undefined,
      userId: typeof req.query.userId === "string" ? req.query.userId.trim() : undefined,
      eventType: typeof req.query.eventType === "string" ? req.query.eventType.trim() : undefined,
      accountId: typeof req.query.accountId === "string" ? req.query.accountId.trim() : undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to list sandbox ledger entries." });
  }
});

competitionAdminRouter.get("/accounting/grants", requirePermission("WALLET_VIEW"), async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit ?? 25) || 25));
    const offset = (page - 1) * limit;
    const query = typeof req.query.query === "string" ? req.query.query.trim() : "";
    const values: unknown[] = ["ADMIN_COMPETITION_GRANT_TEST_FUNDS"];
    let filter = "a.action = $1";
    if (query) {
      values.push(`%${query}%`);
      filter += ` AND (target.username ILIKE $${values.length} OR target.email ILIKE $${values.length} OR a.target_id = $${values.length})`;
    }
    const countResult = await pool.query(
      `SELECT COUNT(*)::integer AS total FROM admin_audit_logs a LEFT JOIN users target ON target.id = a.target_id WHERE ${filter}`,
      values,
    );
    const rows = await pool.query(
      `SELECT a.id, a.admin_user_id AS "adminUserId", admin.username AS "adminUsername",
        a.target_id AS "targetUserId", target.username AS "targetUsername", a.amount AS "amountMinor",
        a.currency, a.reason, a.details, a.created_at AS "createdAt"
       FROM admin_audit_logs a
       LEFT JOIN users target ON target.id = a.target_id
       LEFT JOIN users admin ON admin.id = a.admin_user_id
       WHERE ${filter}
       ORDER BY a.created_at DESC
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, limit, offset],
    );
    res.json({ grants: rows.rows, page, limit, total: Number(countResult.rows[0]?.total ?? 0) });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to load test funding history." });
  }
});

const handleGrantTestFunds = async (req: any, res: any) => {
  try {
    const adminUserId = req.userId!;
    const { targetUserId, amountMinor, reason } = req.body ?? {};

    if (typeof targetUserId !== "string" || targetUserId.trim().length === 0) {
      res.status(400).json({ error: "targetUserId is required." });
      return;
    }

    if (typeof amountMinor !== "number" || !Number.isInteger(amountMinor) || amountMinor <= 0) {
      res.status(400).json({ error: "amountMinor must be a positive integer." });
      return;
    }

    if (amountMinor > 1_000_000) {
      res.status(400).json({ error: "Maximum single test grant is TEST ₾10,000.00 (1,000,000 minor units)." });
      return;
    }

    if (typeof reason !== "string" || reason.trim().length === 0) {
      res.status(400).json({ error: "An explicit operational reason is required to grant test funds." });
      return;
    }

    const userTarget = await db.query.users.findFirst({ where: eq(users.id, targetUserId.trim()) });
    if (!userTarget) {
      res.status(404).json({ error: "Target user not found." });
      return;
    }

    const balance = await sandboxAccountingAdapter.grantSandboxTestFunds(targetUserId.trim(), amountMinor, {
      adminUserId,
      targetUsername: userTarget.username,
      reason: reason.trim(),
    });

    res.json({
      success: true,
      targetUserId: targetUserId.trim(),
      amountMinor,
      availableMinor: balance.availableMinor,
      reservedMinor: balance.reservedMinor,
      accountingReferenceId: balance.accountingReferenceId,
      auditLogId: balance.auditLogId,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to grant test funds." });
  }
};

competitionAdminRouter.post(
  "/accounting/grant-test-funds",
  requirePermission("WALLET_GRANT_SANDBOX"),
  handleGrantTestFunds,
);

competitionAdminRouter.post(
  "/accounting/grant",
  requirePermission("WALLET_GRANT_SANDBOX"),
  handleGrantTestFunds,
);

// ---------------------------------------------------------------------------
// 6. Game Eligibility View
// ---------------------------------------------------------------------------

competitionAdminRouter.get("/eligibility", requirePermission("COMPETITIONS_VIEW"), async (_req, res) => {
  try {
    const registry = Object.entries(GAME_COMPETITION_ELIGIBILITY_REGISTRY).map(([gameId, eligibility]) => ({
      gameId,
      status: eligibility,
      isCandidate: eligibility === "PAID_COMPETITIVE_CANDIDATE",
      isCoinOnly: eligibility === "COIN_COMPETITIVE",
      technicalNotes:
        eligibility === "PAID_COMPETITIVE_CANDIDATE"
          ? "Deterministic simulation, seed replay verification, and score validation supported. Candidate for sandbox skill competitions only."
          : "Casual Coin matchmaking and practice play only. Blocked from paid sandbox competitions.",
    }));

    const paidApprovedCount = registry.filter((r) => r.status === ("PAID_COMPETITIVE_APPROVED" as any)).length;

    res.json({
      registry,
      zeroPaidApproved: paidApprovedCount === 0,
      totalGames: registry.length,
      candidateGamesCount: registry.filter((r) => r.isCandidate).length,
      coinOnlyGamesCount: registry.filter((r) => r.isCoinOnly).length,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to load game eligibility registry." });
  }
});
