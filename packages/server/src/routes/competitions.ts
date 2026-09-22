// Competition HTTP Routes (Fugluck Competition Economy — Phase 3)
// Implements FUGLUCK — FINAL COMPETITION DOMAIN CONTRACT Sections 20 & 21
// Public read endpoints for templates and instances, and RBAC-protected administrative endpoints.

import { Router } from "express";
import { attachSession, requireAuth, requireOwnerAdmin } from "../auth/middleware";
import { instanceService } from "../competitions/instanceService";
import { templateService } from "../competitions/templateService";
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
competitionsRouter.get("/templates", async (_req, res) => {
  try {
    const templates = await templateService.listEnabledTemplates();
    res.json({ templates });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to list templates." });
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
