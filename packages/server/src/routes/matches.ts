import { desc, eq, or } from "drizzle-orm";
import { Router } from "express";
import { attachSession, requireAuth } from "../auth/middleware";
import { db } from "../db/client";
import { matchesHistory, users } from "../db/schema";

import { createRateLimiterMiddleware } from "../utils/rateLimiter";

const matchHistoryLimiter = createRateLimiterMiddleware({
  windowMs: 60 * 1000,
  maxRequests: 30,
  message: "Too many request attempts. Please try again later.",
});

export const matchesRouter = Router();

matchesRouter.get("/history", attachSession, requireAuth, matchHistoryLimiter, async (req, res) => {
  const userId = req.userId!;
  const records = await db.query.matchesHistory.findMany({
    where: or(eq(matchesHistory.player1Id, userId), eq(matchesHistory.player2Id, userId)),
    orderBy: [desc(matchesHistory.createdAt)],
    limit: 20,
  });

  const enriched = await Promise.all(
    records.map(async (m) => {
      const isP1 = m.player1Id === userId;
      const opponentId = isP1 ? m.player2Id : m.player1Id;
      const opponent = await db.query.users.findFirst({ where: eq(users.id, opponentId) });
      const userScore = isP1 ? m.scoreP1 : m.scoreP2;
      const opponentScore = isP1 ? m.scoreP2 : m.scoreP1;
      const userInputLog = isP1 ? m.inputLogP1 : m.inputLogP2;

      let outcome = "draw";
      if (m.winnerId === userId) outcome = "win";
      else if (m.winnerId) outcome = "loss";

      return {
        id: m.id,
        gameId: m.gameId,
        opponentUsername: opponent?.username ?? "Opponent",
        outcome,
        currency: m.currency,
        stake: m.stake,
        userScore,
        opponentScore,
        seed: m.seed,
        inputLog: userInputLog ?? [],
        createdAt: m.createdAt.toISOString(),
      };
    }),
  );

  res.json({ matches: enriched });
});
