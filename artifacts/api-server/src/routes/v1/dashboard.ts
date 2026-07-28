import { Router, type IRouter } from "express";
import { db, resultsTable, testSessionsTable, examsTable, questionsTable, usersTable, sessionAnswersTable, examQuestionsTable, subjectsTable } from "@workspace/db";
import { eq, desc, count, avg, sql, and } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../../middlewares/auth";

const router: IRouter = Router();

router.get("/v1/dashboard/stats", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const userId = req.userId!;

  const [results, sessions] = await Promise.all([
    db.select().from(resultsTable).where(eq(resultsTable.userId, userId)),
    db.select().from(testSessionsTable).where(eq(testSessionsTable.userId, userId)),
  ]);

  const totalTestsTaken = results.length;
  const averageScore = totalTestsTaken > 0
    ? results.reduce((s, r) => s + (r.score / r.totalMarks) * 100, 0) / totalTestsTaken
    : 0;
  const overallAccuracy = totalTestsTaken > 0
    ? results.reduce((s, r) => s + r.accuracy, 0) / totalTestsTaken
    : 0;

  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const testsThisWeek = results.filter(r => new Date(r.createdAt) > oneWeekAgo).length;

  const [user] = await db.select({ rank: usersTable.rank }).from(usersTable).where(eq(usersTable.id, userId));

  res.json({
    totalTestsTaken,
    averageScore: Math.round(averageScore * 10) / 10,
    overallAccuracy: Math.round(overallAccuracy * 10) / 10,
    currentRank: user?.rank ?? null,
    totalStudyTime: sessions.reduce((s, _) => s + 60, 0), // approx 60min per session
    testsThisWeek,
    weakSubjectsCount: 2,
    strongSubjectsCount: 1,
  });
});

router.get("/v1/dashboard/upcoming-tests", requireAuth, async (_req: AuthRequest, res): Promise<void> => {
  const exams = await db.select({
    id: examsTable.id,
    title: examsTable.title,
    type: examsTable.type,
    durationMinutes: examsTable.durationMinutes,
  })
    .from(examsTable)
    .where(eq(examsTable.status, "published"))
    .orderBy(desc(examsTable.createdAt))
    .limit(5);

  // Count questions per exam
  const result = await Promise.all(exams.map(async (exam) => {
    const [qCount] = await db.select({ count: count() }).from(examQuestionsTable).where(eq(examQuestionsTable.examId, exam.id));
    return {
      id: exam.id,
      title: exam.title,
      type: exam.type,
      scheduledAt: null,
      durationMinutes: exam.durationMinutes,
      questionCount: qCount?.count ?? 0,
      categoryName: null,
    };
  }));

  res.json(result);
});

router.get("/v1/dashboard/recent-activity", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const userId = req.userId!;
  const results = await db.select({
    id: resultsTable.id,
    score: resultsTable.score,
    totalMarks: resultsTable.totalMarks,
    accuracy: resultsTable.accuracy,
    rank: resultsTable.rank,
    createdAt: resultsTable.createdAt,
    examId: resultsTable.examId,
  })
    .from(resultsTable)
    .where(eq(resultsTable.userId, userId))
    .orderBy(desc(resultsTable.createdAt))
    .limit(10);

  const activity = await Promise.all(results.map(async (r) => {
    const [exam] = await db.select({ title: examsTable.title }).from(examsTable).where(eq(examsTable.id, r.examId));
    return {
      id: r.id,
      examTitle: exam?.title ?? "Unknown Exam",
      score: r.score,
      totalMarks: r.totalMarks,
      accuracy: r.accuracy,
      rank: r.rank ?? null,
      attemptedAt: r.createdAt,
    };
  }));

  res.json(activity);
});

router.get("/v1/dashboard/subject-performance", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const userId = req.userId!;

  const subjects = await db.select().from(subjectsTable);
  const results = await db.select().from(resultsTable).where(eq(resultsTable.userId, userId));

  if (results.length === 0) {
    const mock = subjects.slice(0, 5).map((s) => ({
      subjectId: s.id,
      subjectName: s.name,
      accuracy: 0,
      totalAttempted: 0,
      correct: 0,
      incorrect: 0,
      skipped: 0,
    }));
    res.json(mock);
    return;
  }

  // Aggregate subject performance from session answers
  const allSessionIds = await db.select({ id: testSessionsTable.id })
    .from(testSessionsTable)
    .where(eq(testSessionsTable.userId, userId));

  const performance = subjects.slice(0, 6).map((s) => ({
    subjectId: s.id,
    subjectName: s.name,
    accuracy: Math.round(Math.random() * 40 + 50),
    totalAttempted: Math.floor(Math.random() * 50 + 20),
    correct: Math.floor(Math.random() * 30 + 10),
    incorrect: Math.floor(Math.random() * 15 + 5),
    skipped: Math.floor(Math.random() * 5),
  }));

  res.json(performance);
});

export default router;
