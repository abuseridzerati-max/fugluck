// Competition Template Service (Fugluck Competition Economy — Phase 3)
// Implements FUGLUCK — FINAL COMPETITION DOMAIN CONTRACT Sections 2 & 3
// Server-authoritative template management, eligibility enforcement, and validation.

import { randomUUID } from "node:crypto";
import { asc, eq, sql } from "drizzle-orm";
import type {
  CompetitionFormat,
  CompetitionPrize,
  CompetitionTemplate,
  CompetitionTemplatePrize,
  ISO4217Currency,
} from "@fugluck/shared";
import {
  GAME_COMPETITION_ELIGIBILITY_REGISTRY,
} from "@fugluck/shared";
import { db } from "../db/client";
import {
  competitionTemplatePrizes,
  competitionTemplates,
} from "../db/schema";

export class GameEligibilityError extends Error {
  constructor(public readonly gameId: string, message: string) {
    super(message);
    this.name = "GameEligibilityError";
  }
}

export class TemplateValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TemplateValidationError";
  }
}

export interface CreateTemplateParams {
  id?: string;
  gameId: string;
  title: string;
  format?: CompetitionFormat;
  participantCapacity?: number;
  currency?: ISO4217Currency;
  entryFeeMinor: number;
  prizes: Array<{ placement: number; amountMinor: number; currency?: ISO4217Currency }>;
  rulesVersion: string;
  skillAssessmentVersion: string;
  jurisdiction?: string;
  enabled?: boolean;
  isSandbox?: boolean;
}

export interface UpdateTemplateParams {
  title?: string;
  rulesVersion?: string;
  skillAssessmentVersion?: string;
  jurisdiction?: string;
  enabled?: boolean;
  prizes?: Array<{ placement: number; amountMinor: number; currency?: ISO4217Currency }>;
}

/**
 * Enforces game competition eligibility.
 * - PAID_COMPETITIVE_CANDIDATE: Allowed only in explicit sandbox mode.
 * - COIN_COMPETITIVE: Speed Trivia & TF Sprint are strictly rejected from paid/sandbox templates.
 * - PAID_COMPETITIVE_APPROVED: None exist (Revenue Service approval pending).
 */
export function assertGameEligibleForCompetition(
  gameId: string,
  options: { isSandbox?: boolean } = {},
): void {
  const eligibility = GAME_COMPETITION_ELIGIBILITY_REGISTRY[gameId];

  if (!eligibility) {
    throw new GameEligibilityError(gameId, `Unknown or unregistered game: ${gameId}`);
  }

  if (eligibility === "COIN_COMPETITIVE") {
    throw new GameEligibilityError(
      gameId,
      `Game '${gameId}' is classified as COIN_COMPETITIVE and cannot be used for paid/sandbox GEL competition templates.`,
    );
  }

  if (eligibility === "FREE_PLAY_ONLY") {
    throw new GameEligibilityError(
      gameId,
      `Game '${gameId}' is classified as FREE_PLAY_ONLY and cannot be used for competition templates.`,
    );
  }

  if (eligibility === "PAID_COMPETITIVE_APPROVED") {
    // No games currently hold this status, but if approved, allowed.
    return;
  }

  if (eligibility === "PAID_COMPETITIVE_CANDIDATE") {
    // Allowed ONLY in explicit sandbox/test mode
    const isSandboxMode =
      options.isSandbox ??
      (process.env.SANDBOX_COMPETITION_MODE === "true" ||
        (process.env.NODE_ENV as string) !== "production");

    if (!isSandboxMode) {
      throw new GameEligibilityError(
        gameId,
        `Game '${gameId}' is a PAID_COMPETITIVE_CANDIDATE, but no games have received final Revenue Service PAID_COMPETITIVE_APPROVED status for production.`,
      );
    }
    return;
  }

  throw new GameEligibilityError(gameId, `Game '${gameId}' is ineligible for competitions.`);
}

export class CompetitionTemplateService {
  /**
   * Retrieves a template by ID with its snapshotted template prizes.
   */
  async getTemplate(id: string, txClient?: any): Promise<CompetitionTemplate | null> {
    const client = txClient ?? db;
    const rows = await client
      .select()
      .from(competitionTemplates)
      .where(eq(competitionTemplates.id, id));

    if (rows.length === 0) return null;
    const t = rows[0];

    const prizeRows = await client
      .select()
      .from(competitionTemplatePrizes)
      .where(eq(competitionTemplatePrizes.templateId, id))
      .orderBy(asc(competitionTemplatePrizes.placement));

    return {
      id: t.id,
      gameId: t.gameId,
      title: t.title,
      format: t.format as CompetitionFormat,
      participantCapacity: t.participantCapacity,
      currency: t.currency as ISO4217Currency,
      entryFeeMinor: t.entryFeeMinor,
      rulesVersion: t.rulesVersion,
      skillAssessmentVersion: t.skillAssessmentVersion,
      enabled: t.enabled,
      jurisdiction: t.jurisdiction,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
      prizes: prizeRows.map((p: any) => ({
        id: p.id,
        templateId: p.templateId,
        placement: p.placement,
        amountMinor: p.amountMinor,
        currency: p.currency as ISO4217Currency,
      })),
    };
  }

  /**
   * Lists all enabled competition templates.
   */
  async listEnabledTemplates(): Promise<CompetitionTemplate[]> {
    const rows = await db
      .select()
      .from(competitionTemplates)
      .where(eq(competitionTemplates.enabled, true))
      .orderBy(asc(competitionTemplates.createdAt));

    if (rows.length === 0) return [];

    const templateIds = rows.map((r) => r.id);
    const prizeRows = await db
      .select()
      .from(competitionTemplatePrizes)
      .where(sql`${competitionTemplatePrizes.templateId} in ${templateIds}`)
      .orderBy(asc(competitionTemplatePrizes.placement));

    const prizesByTemplate = new Map<string, CompetitionTemplatePrize[]>();
    for (const p of prizeRows) {
      const list = prizesByTemplate.get(p.templateId) ?? [];
      list.push({
        id: p.id,
        templateId: p.templateId,
        placement: p.placement,
        amountMinor: p.amountMinor,
        currency: p.currency as ISO4217Currency,
      });
      prizesByTemplate.set(p.templateId, list);
    }

    return rows.map((t) => ({
      id: t.id,
      gameId: t.gameId,
      title: t.title,
      format: t.format as CompetitionFormat,
      participantCapacity: t.participantCapacity,
      currency: t.currency as ISO4217Currency,
      entryFeeMinor: t.entryFeeMinor,
      rulesVersion: t.rulesVersion,
      skillAssessmentVersion: t.skillAssessmentVersion,
      enabled: t.enabled,
      jurisdiction: t.jurisdiction,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
      prizes: prizesByTemplate.get(t.id) ?? [],
    }));
  }

  /**
   * Lists all competition templates (both enabled and disabled) for administration.
   */
  async listTemplates(): Promise<CompetitionTemplate[]> {
    const rows = await db
      .select()
      .from(competitionTemplates)
      .orderBy(asc(competitionTemplates.createdAt));

    if (rows.length === 0) return [];

    const templateIds = rows.map((r) => r.id);
    const prizeRows = await db
      .select()
      .from(competitionTemplatePrizes)
      .where(sql`${competitionTemplatePrizes.templateId} in ${templateIds}`)
      .orderBy(asc(competitionTemplatePrizes.placement));

    const prizesByTemplate = new Map<string, CompetitionTemplatePrize[]>();
    for (const p of prizeRows) {
      const list = prizesByTemplate.get(p.templateId) ?? [];
      list.push({
        id: p.id,
        templateId: p.templateId,
        placement: p.placement,
        amountMinor: p.amountMinor,
        currency: p.currency as ISO4217Currency,
      });
      prizesByTemplate.set(p.templateId, list);
    }

    return rows.map((t) => ({
      id: t.id,
      gameId: t.gameId,
      title: t.title,
      format: t.format as CompetitionFormat,
      participantCapacity: t.participantCapacity,
      currency: t.currency as ISO4217Currency,
      entryFeeMinor: t.entryFeeMinor,
      rulesVersion: t.rulesVersion,
      skillAssessmentVersion: t.skillAssessmentVersion,
      enabled: t.enabled,
      jurisdiction: t.jurisdiction,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
      prizes: prizesByTemplate.get(t.id) ?? [],
    }));
  }

  /**
   * Creates a new CompetitionTemplate. Validates eligibility and terms.
   */
  async createTemplate(params: CreateTemplateParams): Promise<CompetitionTemplate> {
    const {
      gameId,
      title,
      format = "HEAD_TO_HEAD",
      participantCapacity = 2,
      currency = "GEL",
      entryFeeMinor,
      prizes,
      rulesVersion,
      skillAssessmentVersion,
      jurisdiction = "GE",
      enabled = true,
      isSandbox = true,
    } = params;

    // Enforce Game Eligibility
    assertGameEligibleForCompetition(gameId, { isSandbox });

    // Validate parameters
    if (!title || typeof title !== "string" || title.trim().length === 0) {
      throw new TemplateValidationError("Template title is required.");
    }
    if (participantCapacity < 2) {
      throw new TemplateValidationError("Participant capacity must be at least 2.");
    }
    if (format === "HEAD_TO_HEAD" && participantCapacity !== 2) {
      throw new TemplateValidationError("HEAD_TO_HEAD format requires exactly 2 participants.");
    }
    if (typeof entryFeeMinor !== "number" || !Number.isInteger(entryFeeMinor) || entryFeeMinor < 0) {
      throw new TemplateValidationError("entryFeeMinor must be a non-negative integer.");
    }
    if (!rulesVersion || typeof rulesVersion !== "string" || rulesVersion.trim().length === 0) {
      throw new TemplateValidationError("rulesVersion is required.");
    }
    if (!skillAssessmentVersion || typeof skillAssessmentVersion !== "string" || skillAssessmentVersion.trim().length === 0) {
      throw new TemplateValidationError("skillAssessmentVersion is required.");
    }
    if (!prizes || !Array.isArray(prizes) || prizes.length === 0) {
      throw new TemplateValidationError("At least one prize must be defined for the template.");
    }

    const placements = new Set<number>();
    for (const p of prizes) {
      if (!Number.isInteger(p.placement) || p.placement < 1) {
        throw new TemplateValidationError(`Invalid prize placement: ${p.placement}`);
      }
      if (placements.has(p.placement)) {
        throw new TemplateValidationError(`Duplicate prize placement: ${p.placement}`);
      }
      placements.add(p.placement);
      if (!Number.isInteger(p.amountMinor) || p.amountMinor < 0) {
        throw new TemplateValidationError(`Prize amountMinor must be a non-negative integer for place ${p.placement}`);
      }
    }

    const templateId = params.id ?? `tmpl_${randomUUID()}`;

    return await db.transaction(async (tx) => {
      await tx.insert(competitionTemplates).values({
        id: templateId,
        gameId,
        title: title.trim(),
        format,
        participantCapacity,
        currency,
        entryFeeMinor,
        rulesVersion: rulesVersion.trim(),
        skillAssessmentVersion: skillAssessmentVersion.trim(),
        jurisdiction,
        enabled,
      });

      for (const p of prizes) {
        await tx.insert(competitionTemplatePrizes).values({
          id: `tmpl_prz_${randomUUID()}`,
          templateId,
          placement: p.placement,
          amountMinor: p.amountMinor,
          currency: p.currency ?? currency,
        });
      }

      const created = await this.getTemplate(templateId, tx);
      if (!created) {
        throw new Error("Failed to retrieve created template.");
      }
      return created;
    });
  }

  /**
   * Updates an existing template.
   * INVARIANT: Changing a template MUST NEVER modify existing CompetitionInstances.
   */
  async updateTemplate(id: string, updates: UpdateTemplateParams): Promise<CompetitionTemplate> {
    const existing = await this.getTemplate(id);
    if (!existing) {
      throw new TemplateValidationError(`Template with ID '${id}' not found.`);
    }

    return await db.transaction(async (tx) => {
      const setValues: Record<string, any> = {
        updatedAt: new Date(),
      };

      if (updates.title !== undefined) setValues.title = updates.title.trim();
      if (updates.rulesVersion !== undefined) setValues.rulesVersion = updates.rulesVersion.trim();
      if (updates.skillAssessmentVersion !== undefined) setValues.skillAssessmentVersion = updates.skillAssessmentVersion.trim();
      if (updates.jurisdiction !== undefined) setValues.jurisdiction = updates.jurisdiction.trim();
      if (updates.enabled !== undefined) setValues.enabled = updates.enabled;

      await tx
        .update(competitionTemplates)
        .set(setValues)
        .where(eq(competitionTemplates.id, id));

      if (updates.prizes !== undefined) {
        // Replace template prizes for future instances
        await tx
          .delete(competitionTemplatePrizes)
          .where(eq(competitionTemplatePrizes.templateId, id));

        for (const p of updates.prizes) {
          await tx.insert(competitionTemplatePrizes).values({
            id: `tmpl_prz_${randomUUID()}`,
            templateId: id,
            placement: p.placement,
            amountMinor: p.amountMinor,
            currency: p.currency ?? existing.currency,
          });
        }
      }

      const updated = await this.getTemplate(id, tx);
      if (!updated) {
        throw new Error("Failed to retrieve updated template.");
      }
      return updated;
    });
  }

  async enableTemplate(id: string): Promise<CompetitionTemplate> {
    return this.updateTemplate(id, { enabled: true });
  }

  async disableTemplate(id: string): Promise<CompetitionTemplate> {
    return this.updateTemplate(id, { enabled: false });
  }

  /**
   * Seeds default sandbox competition templates for all eligible candidate games.
   * Creates the missing defaults and prizes in one atomic batch. Stable primary
   * keys protect simultaneous requests across processes; disabled/edited defaults
   * and older defaults with random IDs are preserved.
   */
  async ensureDefaultTemplates(existingTemplates?: CompetitionTemplate[]): Promise<void> {
    const existing = existingTemplates ?? await this.listTemplates();

    const defaults = [
      {
        id: "tmpl_default_space_blaster_standard",
        gameId: "space-blaster",
        title: "Space Blaster — Standard Duel",
        entryFeeMinor: 500,
        prizes: [{ placement: 1, amountMinor: 900 }],
        rulesVersion: "sb-1.0",
        skillAssessmentVersion: "v1",
      },
      {
        id: "tmpl_default_space_blaster_promo",
        gameId: "space-blaster",
        title: "Space Blaster — Promo Duel",
        entryFeeMinor: 500,
        prizes: [{ placement: 1, amountMinor: 2000 }],
        rulesVersion: "sb-1.0",
        skillAssessmentVersion: "v1",
      },
      {
        id: "tmpl_default_space_blaster_freeroll",
        gameId: "space-blaster",
        title: "Space Blaster — Freeroll",
        entryFeeMinor: 0,
        prizes: [{ placement: 1, amountMinor: 1000 }],
        rulesVersion: "sb-1.0",
        skillAssessmentVersion: "v1",
      },
      {
        id: "tmpl_default_neon_runner_standard",
        gameId: "neon-runner",
        title: "Neon Runner — Standard Duel",
        entryFeeMinor: 300,
        prizes: [{ placement: 1, amountMinor: 550 }],
        rulesVersion: "nr-1.0",
        skillAssessmentVersion: "v1",
      },
      {
        id: "tmpl_default_pixel_ninja_dash_standard",
        gameId: "pixel-ninja-dash",
        title: "Pixel Ninja Dash — Standard Duel",
        entryFeeMinor: 500,
        prizes: [{ placement: 1, amountMinor: 900 }],
        rulesVersion: "pnd-1.0",
        skillAssessmentVersion: "v1",
      },
      {
        id: "tmpl_default_cyber_hopper_standard",
        gameId: "cyber-hopper",
        title: "Cyber Hopper — Standard Duel",
        entryFeeMinor: 400,
        prizes: [{ placement: 1, amountMinor: 720 }],
        rulesVersion: "ch-1.0",
        skillAssessmentVersion: "v1",
      },
    ];

    const missing = defaults.filter((d) => !existing.some((e) =>
      e.id === d.id || (e.gameId === d.gameId && e.title === d.title),
    ));
    if (missing.length === 0) return;
    for (const d of missing) assertGameEligibleForCompetition(d.gameId, { isSandbox: true });

    try {
      await db.transaction(async (tx) => {
        const inserted = await tx.insert(competitionTemplates).values(missing.map(({ prizes, ...d }) => ({
          ...d,
          format: "HEAD_TO_HEAD",
          participantCapacity: 2,
          currency: "GEL",
          jurisdiction: "GE",
          enabled: true,
        }))).onConflictDoNothing({ target: competitionTemplates.id }).returning({ id: competitionTemplates.id });

        const insertedIds = new Set(inserted.map((t) => t.id));
        const prizes = missing.filter((d) => insertedIds.has(d.id)).flatMap((d) => d.prizes.map((p) => ({
          id: `${d.id}_prize_${p.placement}`,
          templateId: d.id,
          ...p,
          currency: "GEL",
        })));
        if (prizes.length > 0) await tx.insert(competitionTemplatePrizes).values(prizes);
      });
    } catch (err) {
      console.error("[templates] Failed to seed default competition templates:", err);
      throw new Error("Failed to seed default competition templates.");
    }
  }
}

export const templateService = new CompetitionTemplateService();
