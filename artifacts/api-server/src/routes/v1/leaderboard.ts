import { Router, type IRouter } from "express";
import { db, usersTable, resultsTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { GetLeaderboardQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/v1/leaderboard", async (req, res): Promise<void> => {
  const params = GetLeaderboardQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const { limit = 50 } = params.data;

  // Aggregate stats per user directly in SQL!
  const usersWithStats = await db.select({
    userId: usersTable.id,
    name: usersTable.name,
    avatarUrl: usersTable.avatarUrl,
    totalScore: usersTable.totalScore,
    testsCount: sql<number>`count(${resultsTable.id})::int`,
    avgAccuracy: sql<number>`coalesce(avg(${resultsTable.accuracy}), 0)::float`,
  })
    .from(usersTable)
    .leftJoin(resultsTable, eq(usersTable.id, resultsTable.userId))
    .where(eq(usersTable.status, "active"))
    .groupBy(usersTable.id)
    .orderBy(desc(usersTable.totalScore))
    .limit(limit);

  const leaderboard = usersWithStats.map((u, i) => ({
    rank: i + 1,
    userId: u.userId,
    name: u.name,
    avatarUrl: u.avatarUrl ?? null,
    score: Math.round((u.totalScore ?? 0) * 10) / 10,
    accuracy: Math.round(u.avgAccuracy * 10) / 10,
    testsCount: u.testsCount,
  }));

  res.json(leaderboard);
});

export default router;
