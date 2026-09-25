// Competition HTTP Routes (Fugluck Competition Economy — Phase 3)
// Implements FUGLUCK — FINAL COMPETITION DOMAIN CONTRACT Sections 20 & 21
// Public read endpoints for templates and instances, and RBAC-protected administrative endpoints.

import { Router } from "express";
import { attachSession, requireAuth, requireOwnerAdmin } from "../auth/middleware";
import { instanceService } from "../competitions/instanceService";
import { templateService } from "../competitions/templateService";
import { lifecycleEngine } from "../competitions/lifecycleEngine";
import { SandboxAccountingAdapter } from "../accounting/sandboxAdapter";
import { createRateLimiterMiddleware } from "../utils/rateLimiter";

const competitionsLimiter = createRateLimiterMiddleware({
  windowMs: 60 * 1000,
  maxRequests: 60,
  message: "Too many competition requests. Please wait a moment.",
});

export const competitionsRouter = Router();
competitionsRouter.use(competitionsLimiter);

// ---------------------------------------------------------------------------
// Public Read Endpoints
// ---------------------------------------------------------------------------

/**
 * GET /api/competitions/templates
 * Lists all enabled competition templates and their prize schedules.
 */
competitionsRouter.get("/templates", async (req, res) => {
  try {
    // Include disabled templates so an intentionally closed catalog stays empty.
    const allTemplates = await templateService.listTemplates();
    if (allTemplates.length === 0) {
      await templateService.ensureDefaultTemplates(allTemplates);
    }
    // Public player discovery must use the same certification, authority-version,
    // and live-template-shape gate as registration. Admin views still use
    // listTemplates() to inspect disabled and legacy rows.
    const templates = await templateService.listEnabledTemplates();
    const gameId = typeof req.query.gameId === "string" ? req.query.gameId.trim() : "";
    res.json({ templates: gameId ? templates.filter((template) => template.gameId === gameId) : templates });
  } catch (err: any) {
    console.error("[competitions] Failed to load public competition templates:", err);
    res.status(500).json({ error: "Competition catalog is temporarily unavailable. Please retry." });
  }
});

/**
 * GET /api/competitions/balance
 * Returns the authenticated user's current sandbox GEL balance.
 */
competitionsRouter.get("/balance", attachSession, requireAuth, async (req, res) => {
  try {
    const adapter = new SandboxAccountingAdapter();
    const balance = await adapter.getUserBalance(req.userId!);
    res.json({
      availableMinor: balance.availableMinor,
      reservedMinor: balance.reservedMinor,
      currency: "GEL",
      isSandbox: true,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch sandbox balance." });
  }
});

/**
 * POST /api/competitions/sandbox-faucet
 * Grants simulated sandbox test GEL to the authenticated user.
 * Explicitly for QA, automated tests, and demo verification.
 */
competitionsRouter.post("/sandbox-faucet", attachSession, requireAuth, async (req, res) => {
  try {
    const { amountMinor } = req.body ?? {};
    const grantAmount = typeof amountMinor === "number" && amountMinor > 0 ? Math.min(amountMinor, 50_000) : 5_000;
    const adapter = new SandboxAccountingAdapter();
    const balance = await adapter.grantSandboxTestFunds(req.userId!, grantAmount);
    res.json({
      success: true,
      grantedMinor: grantAmount,
      availableMinor: balance.availableMinor,
      reservedMinor: balance.reservedMinor,
      currency: "GEL",
      isSandbox: true,
      message: "Simulated sandbox test funds granted. No real money is charged or withdrawable.",
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to grant sandbox test funds." });
  }
});

/**
 * POST /api/competitions/instances/:id/cancel
 * Allows a waiting participant to cancel their unfilled PENDING_ENTRANTS entry before match lock.
 */
competitionsRouter.post("/instances/:id/cancel", attachSession, requireAuth, async (req, res) => {
  try {
    const instanceId = String(req.params.id);
    const instance = await instanceService.getInstance(instanceId);
    if (!instance?.participants.some(p => p.userId === req.userId)) {
      res.status(403).json({ error: 'Participant ownership required.' });
      return;
    }
    const adapter = new SandboxAccountingAdapter();
    const cancelRes = await lifecycleEngine.cancelUnfilledInstance(instanceId, adapter, "USER_CANCELLED");
    if (!cancelRes.cancelled) {
      res.status(400).json({ error: "Competition cannot be cancelled; it may already be locked or started." });
      return;
    }
    const balance = await adapter.getUserBalance(req.userId!);
    res.json({
      success: true,
      instanceId,
      status: "CANCELLED",
      availableMinor: balance.availableMinor,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to cancel competition entry." });
  }
});

/**
 * GET /api/competitions/templates/:id
 * Retrieves details for a specific template.
 */
competitionsRouter.get("/templates/:id", async (req, res) => {
  try {
    const template = await templateService.getTemplate(String(req.params.id));
    if (!template) {
      res.status(404).json({ error: "Competition template not found." });
      return;
    }
    res.json({ template });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch template." });
  }
});

/**
 * GET /api/competitions/instances/:id
 * Retrieves safe public status and participant summary for an instance.
 * Strictly excludes internal accounting accounts, ledger references, and private data.
 */
competitionsRouter.get("/instances/:id", async (req, res) => {
  try {
    const instance = await instanceService.getPublicInstanceSummary(String(req.params.id));
    if (!instance) {
      res.status(404).json({ error: "Competition instance not found." });
      return;
    }
    res.json({ instance });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch instance." });
  }
});

// ---------------------------------------------------------------------------
// Administrative Mutation Endpoints (Protected by RBAC)
// ---------------------------------------------------------------------------

/**
 * POST /api/competitions/templates
 * Creates a new competition template.
 */
competitionsRouter.post(
  "/templates",
  attachSession,
  requireAuth,
  requireOwnerAdmin,
  async (req, res) => {
    try {
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

      const template = await templateService.createTemplate({
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
      });

      res.status(201).json({ template });
    } catch (err: any) {
      const status = err.name === "GameEligibilityError" || err.name === "TemplateValidationError" ? 400 : 500;
      res.status(status).json({ error: err.message || "Failed to create template." });
    }
  },
);

/**
 * PUT /api/competitions/templates/:id
 * Updates an existing competition template.
 * Guarantees zero mutation to existing competition instances.
 */
competitionsRouter.put(
  "/templates/:id",
  attachSession,
  requireAuth,
  requireOwnerAdmin,
  async (req, res) => {
    try {
      const { title, rulesVersion, skillAssessmentVersion, jurisdiction, enabled, prizes } = req.body ?? {};
      const template = await templateService.updateTemplate(String(req.params.id), {
        title,
        rulesVersion,
        skillAssessmentVersion,
        jurisdiction,
        enabled,
        prizes,
      });
      res.json({ template });
    } catch (err: any) {
      const status = err.name === "TemplateValidationError" ? 400 : 500;
      res.status(status).json({ error: err.message || "Failed to update template." });
    }
  },
);

/**
 * POST /api/competitions/templates/:id/enable
 * Enables a template.
 */
competitionsRouter.post(
  "/templates/:id/enable",
  attachSession,
  requireAuth,
  requireOwnerAdmin,
  async (req, res) => {
    try {
      const template = await templateService.enableTemplate(String(req.params.id));
      res.json({ template });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to enable template." });
    }
  },
);

/**
 * POST /api/competitions/templates/:id/disable
 * Disables a template.
 */
competitionsRouter.post(
  "/templates/:id/disable",
  attachSession,
  requireAuth,
  requireOwnerAdmin,
  async (req, res) => {
    try {
      const template = await templateService.disableTemplate(String(req.params.id));
      res.json({ template });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to disable template." });
    }
  },
);
