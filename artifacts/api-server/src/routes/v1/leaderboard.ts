import { Router, type IRouter } from "express";
import { db, usersTable, resultsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { GetLeaderboardQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/v1/leaderboard", async (req, res): Promise<void> => {
  const params = GetLeaderboardQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const { limit = 50 } = params.data;

  const users = await db.select().from(usersTable).where(eq(usersTable.status, "active")).limit(limit);

  const leaderboard = await Promise.all(users.map(async (u, i) => {
    const results = await db.select().from(resultsTable).where(eq(resultsTable.userId, u.id));
    const totalScore = results.reduce((s, r) => s + r.score, 0);
    const avgAcc = results.length > 0 ? results.reduce((s, r) => s + r.accuracy, 0) / results.length : 0;
    return {
      rank: i + 1,
      userId: u.id,
      name: u.name,
      avatarUrl: u.avatarUrl ?? null,
      score: Math.round(totalScore * 10) / 10,
      accuracy: Math.round(avgAcc * 10) / 10,
      testsCount: results.length,
    };
  }));

  leaderboard.sort((a, b) => b.score - a.score);
  leaderboard.forEach((e, i) => { e.rank = i + 1; });

  res.json(leaderboard.slice(0, limit));
});

export default router;
