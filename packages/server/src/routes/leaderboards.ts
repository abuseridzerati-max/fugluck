import { Router } from "express";
import {
  GAME_MANIFEST_MAP,
  getCertifiedGameIds,
  type LeaderboardEntry,
  type LeaderboardResponse,
} from "@fugluck/shared";
import { pool } from "../db/client";
import { createRateLimiterMiddleware } from "../utils/rateLimiter";
import { logger } from "../utils/safeLogger";

const leaderboardsLimiter = createRateLimiterMiddleware({
  windowMs: 60 * 1000,
  maxRequests: 60,
  message: "Too many leaderboard requests. Please wait a moment.",
});

export const leaderboardsRouter = Router();
leaderboardsRouter.use(leaderboardsLimiter);

/**
 * GET /api/leaderboards?gameId=<slug>&limit=10
 * Public read-only endpoint returning top players ranked by highest verified score
 * and tournament wins. Never exposes private user fields (only public username).
 */
leaderboardsRouter.get("/", async (req, res) => {
  try {
    const rawGameId = typeof req.query.gameId === "string" ? req.query.gameId.trim() : "";
    const gameId = rawGameId && rawGameId !== "all" ? rawGameId : null;

    if (gameId && !GAME_MANIFEST_MAP[gameId]) {
      res.status(400).json({ error: "Unknown gameId." });
      return;
    }

    const parsedLimit = Number.parseInt(String(req.query.limit ?? "10"), 10);
    const limit = Number.isFinite(parsedLimit) ? Math.min(50, Math.max(1, parsedLimit)) : 10;

    const targetGameIds = gameId ? [gameId] : getCertifiedGameIds();
    if (targetGameIds.length === 0) {
      const empty: LeaderboardResponse = { gameId, entries: [] };
      res.json(empty);
      return;
    }

    const { rows } = await pool.query<{
      username: string;
      best_score: number;
      wins: number;
    }>(
      `
      WITH verified_scores AS (
        SELECT player1_id AS user_id, score_p1 AS score
        FROM matches_history
        WHERE status IN ('COMPLETED', 'DRAW')
          AND game_id = ANY($1::text[])
          AND score_p1 > 0
        UNION ALL
        SELECT player2_id AS user_id, score_p2 AS score
        FROM matches_history
        WHERE status IN ('COMPLETED', 'DRAW')
          AND game_id = ANY($1::text[])
          AND score_p2 > 0
        UNION ALL
        SELECT s.user_id, r.score
        FROM competition_authority_results r
        JOIN competition_authority_sessions s ON s.id = r.session_id
        JOIN competition_authority_runs run ON run.id = s.run_id
        WHERE run.status = 'COMPLETED'
          AND run.game_id = ANY($1::text[])
          AND r.score > 0
      ),
      best_by_user AS (
        SELECT user_id, MAX(score)::int AS best_score
        FROM verified_scores
        GROUP BY user_id
      ),
      wins_by_user AS (
        SELECT winner_user_id AS user_id, COUNT(*)::int AS wins
        FROM competition_instances
        WHERE status = 'SETTLED'
          AND winner_user_id IS NOT NULL
          AND game_id = ANY($1::text[])
        GROUP BY winner_user_id
      )
      SELECT
        u.username,
        b.best_score,
        COALESCE(w.wins, 0)::int AS wins
      FROM best_by_user b
      JOIN users u ON u.id = b.user_id
      LEFT JOIN wins_by_user w ON w.user_id = b.user_id
      WHERE u.status = 'active'
      ORDER BY b.best_score DESC, COALESCE(w.wins, 0) DESC, u.username ASC
      LIMIT $2
      `,
      [targetGameIds, limit],
    );

    const entries: LeaderboardEntry[] = rows.map((row, index) => ({
      rank: index + 1,
      username: row.username,
      bestScore: Number(row.best_score) || 0,
      wins: Number(row.wins) || 0,
    }));

    const payload: LeaderboardResponse = { gameId, entries };
    res.setHeader("Cache-Control", "no-store");
    res.json(payload);
  } catch (err) {
    logger.error("[leaderboards] Failed to query leaderboards:", err);
    res.status(500).json({ error: "Leaderboards are temporarily unavailable." });
  }
});
