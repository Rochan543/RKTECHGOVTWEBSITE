import { Router, type IRouter } from "express";
import { db, usersTable, resultsTable, testSessionsTable, sessionAnswersTable, questionsTable } from "@workspace/db";
import { eq, desc, and, gte, sql } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../../middlewares/auth";

const router: IRouter = Router();

const getBoundaries = () => {
  const now = new Date();

  const startOfToday = new Date(now);
  startOfToday.setUTCHours(0, 0, 0, 0);

  const startOfWeek = new Date(now);
  const day = startOfWeek.getDay();
  const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
  startOfWeek.setDate(diff);
  startOfWeek.setUTCHours(0, 0, 0, 0);

  const startOfMonth = new Date(now);
  startOfMonth.setDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);

  return { startOfToday, startOfWeek, startOfMonth };
};

// GET /api/v1/leaderboard
router.get("/v1/leaderboard", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const { period, subjectId, examId, city, college, limit = 50 } = req.query;
    const { startOfToday, startOfWeek, startOfMonth } = getBoundaries();

    // Base query conditions
    const userConditions = [eq(usersTable.status, "active")];
    const resultConditions = [];

    // Apply location filters
    if (city) {
      userConditions.push(eq(usersTable.city, city as string));
    }
    if (college) {
      userConditions.push(eq(usersTable.college, college as string));
    }

    // Apply period filters
    if (period === "daily") {
      resultConditions.push(gte(resultsTable.createdAt, startOfToday));
    } else if (period === "weekly") {
      resultConditions.push(gte(resultsTable.createdAt, startOfWeek));
    } else if (period === "monthly") {
      resultConditions.push(gte(resultsTable.createdAt, startOfMonth));
    }

    // Apply exam filter
    if (examId) {
      resultConditions.push(eq(resultsTable.examId, Number(examId)));
    }

    let leaderboardData;

    // Check if we need to filter by subject
    if (subjectId) {
      const subId = Number(subjectId);
      // For subject-wise, we sum score from result sessions where the questions are of the specified subject
      leaderboardData = await db
        .select({
          userId: usersTable.id,
          name: usersTable.name,
          avatarUrl: usersTable.avatarUrl,
          city: usersTable.city,
          college: usersTable.college,
          score: sql<number>`coalesce(sum(${resultsTable.score}), 0)::float`,
          testsCount: sql<number>`count(distinct ${resultsTable.id})::int`,
          accuracy: sql<number>`coalesce(avg(${resultsTable.accuracy}), 0)::float`,
        })
        .from(usersTable)
        .innerJoin(resultsTable, eq(usersTable.id, resultsTable.userId))
        .innerJoin(testSessionsTable, eq(resultsTable.sessionId, testSessionsTable.id))
        .innerJoin(sessionAnswersTable, eq(testSessionsTable.id, sessionAnswersTable.sessionId))
        .innerJoin(questionsTable, eq(sessionAnswersTable.questionId, questionsTable.id))
        .where(
          and(
            ...userConditions,
            ...resultConditions,
            eq(questionsTable.subjectId, subId)
          )
        )
        .groupBy(usersTable.id)
        .orderBy(desc(sql`coalesce(sum(${resultsTable.score}), 0)`))
        .limit(Number(limit));
    } else {
      // Normal query grouped by user
      const isPeriodActive = period && period !== "overall";
      
      if (isPeriodActive || examId) {
        leaderboardData = await db
          .select({
            userId: usersTable.id,
            name: usersTable.name,
            avatarUrl: usersTable.avatarUrl,
            city: usersTable.city,
            college: usersTable.college,
            score: sql<number>`coalesce(sum(${resultsTable.score}), 0)::float`,
            testsCount: sql<number>`count(distinct ${resultsTable.id})::int`,
            accuracy: sql<number>`coalesce(avg(${resultsTable.accuracy}), 0)::float`,
          })
          .from(usersTable)
          .innerJoin(resultsTable, eq(usersTable.id, resultsTable.userId))
          .where(and(...userConditions, ...resultConditions))
          .groupBy(usersTable.id)
          .orderBy(desc(sql`coalesce(sum(${resultsTable.score}), 0)`))
          .limit(Number(limit));
      } else {
        // Overall: query using usersTable.totalScore and all results
        leaderboardData = await db
          .select({
            userId: usersTable.id,
            name: usersTable.name,
            avatarUrl: usersTable.avatarUrl,
            city: usersTable.city,
            college: usersTable.college,
            score: sql<number>`coalesce(${usersTable.totalScore}, 0)::float`,
            testsCount: sql<number>`count(${resultsTable.id})::int`,
            accuracy: sql<number>`coalesce(avg(${resultsTable.accuracy}), 0)::float`,
          })
          .from(usersTable)
          .leftJoin(resultsTable, eq(usersTable.id, resultsTable.userId))
          .where(and(...userConditions))
          .groupBy(usersTable.id)
          .orderBy(desc(usersTable.totalScore))
          .limit(Number(limit));
      }
    }

    const leaderboard = leaderboardData.map((u, i) => ({
      rank: i + 1,
      userId: u.userId,
      name: u.name,
      avatarUrl: u.avatarUrl ?? null,
      city: u.city ?? null,
      college: u.college ?? null,
      score: Math.round(u.score * 10) / 10,
      accuracy: Math.round(u.accuracy * 10) / 10,
      testsCount: u.testsCount,
    }));

    res.json(leaderboard);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
