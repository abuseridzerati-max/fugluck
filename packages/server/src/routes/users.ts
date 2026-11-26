import { Router } from "express";
import type { PersonalBestsResponse } from "@fugluck/shared";
import { attachSession, requireAuth } from "../auth/middleware";
import { pool } from "../db/client";
import { createRateLimiterMiddleware } from "../utils/rateLimiter";
import { logger } from "../utils/safeLogger";

const personalBestsLimiter = createRateLimiterMiddleware({
  windowMs: 60 * 1000,
  maxRequests: 60,
  message: "Too many requests. Please wait a moment.",
});

export const usersRouter = Router();

/**
 * GET /api/users/me/personal-bests
 * Authenticated endpoint returning { bests: { [gameId]: bestScore } }
 * across the logged-in user's verified matches and authority runs.
 */
usersRouter.get("/me/personal-bests", attachSession, requireAuth, personalBestsLimiter, async (req, res) => {
  try {
    const userId = req.userId!;
    const { rows } = await pool.query<{ game_id: string; best_score: number }>(
      `
      WITH user_scores AS (
        SELECT game_id, score_p1 AS score
        FROM matches_history
        WHERE status IN ('COMPLETED', 'DRAW')
          AND player1_id = $1
          AND score_p1 > 0
        UNION ALL
        SELECT game_id, score_p2 AS score
        FROM matches_history
        WHERE status IN ('COMPLETED', 'DRAW')
          AND player2_id = $1
          AND score_p2 > 0
        UNION ALL
        SELECT run.game_id, r.score
        FROM competition_authority_results r
        JOIN competition_authority_sessions s ON s.id = r.session_id
        JOIN competition_authority_runs run ON run.id = s.run_id
        WHERE run.status = 'COMPLETED'
          AND s.user_id = $1
          AND r.score > 0
      )
      SELECT game_id, MAX(score)::int AS best_score
      FROM user_scores
      GROUP BY game_id
      `,
      [userId],
    );

    const bests: Record<string, number> = {};
    for (const row of rows) {
      const score = Number(row.best_score) || 0;
      if (score > 0) {
        bests[row.game_id] = score;
      }
    }

    const payload: PersonalBestsResponse = { bests };
    res.setHeader("Cache-Control", "no-store");
    res.json(payload);
  } catch (err) {
    logger.error("[users] Failed to fetch personal bests:", err);
    res.status(500).json({ error: "Failed to load personal bests." });
  }
});
