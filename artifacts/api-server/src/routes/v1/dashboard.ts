import { Router, type IRouter } from "express";
import { db, resultsTable, testSessionsTable, examsTable, questionsTable, usersTable, sessionAnswersTable, examQuestionsTable, subjectsTable, questionOptionsTable } from "@workspace/db";
import { eq, desc, count, and, inArray, sql } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../../middlewares/auth";

const router: IRouter = Router();

router.get("/v1/dashboard/stats", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const userId = req.userId!;

  const [results, [{ totalSessions }]] = await Promise.all([
    db.select({
      score: resultsTable.score,
      totalMarks: resultsTable.totalMarks,
      accuracy: resultsTable.accuracy,
      createdAt: resultsTable.createdAt,
    }).from(resultsTable).where(eq(resultsTable.userId, userId)),
    db.select({ totalSessions: count() })
      .from(testSessionsTable)
      .where(eq(testSessionsTable.userId, userId)),
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
    totalStudyTime: totalSessions * 60,
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

  const examIds = exams.map(e => e.id);
  const qCounts = examIds.length > 0
    ? await db.select({ examId: examQuestionsTable.examId, count: count() })
        .from(examQuestionsTable)
        .where(inArray(examQuestionsTable.examId, examIds))
        .groupBy(examQuestionsTable.examId)
    : [];
  const qCountMap = new Map(qCounts.map(q => [q.examId, q.count]));

  const result = exams.map((exam) => {
    return {
      id: exam.id,
      title: exam.title,
      type: exam.type,
      scheduledAt: null,
      durationMinutes: exam.durationMinutes,
      questionCount: qCountMap.get(exam.id) ?? 0,
      categoryName: null,
    };
  });

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
    examTitle: examsTable.title,
  })
    .from(resultsTable)
    .leftJoin(examsTable, eq(resultsTable.examId, examsTable.id))
    .where(eq(resultsTable.userId, userId))
    .orderBy(desc(resultsTable.createdAt))
    .limit(10);

  const activity = results.map((r) => {
    return {
      id: r.id,
      examTitle: r.examTitle ?? "Unknown Exam",
      score: r.score,
      totalMarks: r.totalMarks,
      accuracy: r.accuracy,
      rank: r.rank ?? null,
      attemptedAt: r.createdAt,
    };
  });

  res.json(activity);
});

router.get("/v1/dashboard/subject-performance", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const userId = req.userId!;

  const [hasResult] = await db.select({ id: resultsTable.id })
    .from(resultsTable)
    .where(eq(resultsTable.userId, userId))
    .limit(1);

  const subjects = await db.select({ id: subjectsTable.id, name: subjectsTable.name }).from(subjectsTable);

  if (!hasResult) {
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

  // Fetch stats per subject aggregated directly in database!
  const answersList = await db.select({
    subjectId: questionsTable.subjectId,
    subjectName: subjectsTable.name,
    correct: sql<number>`count(case when ${sessionAnswersTable.selectedOptionId} = ${questionOptionsTable.id} then 1 end)::int`,
    incorrect: sql<number>`count(case when ${sessionAnswersTable.selectedOptionId} is not null and ${sessionAnswersTable.selectedOptionId} != ${questionOptionsTable.id} then 1 end)::int`,
    skipped: sql<number>`count(case when ${sessionAnswersTable.selectedOptionId} is null or ${sessionAnswersTable.status} in ('not_visited', 'visited') then 1 end)::int`,
  })
    .from(sessionAnswersTable)
    .innerJoin(questionsTable, eq(sessionAnswersTable.questionId, questionsTable.id))
    .innerJoin(subjectsTable, eq(questionsTable.subjectId, subjectsTable.id))
    .innerJoin(testSessionsTable, eq(sessionAnswersTable.sessionId, testSessionsTable.id))
    .leftJoin(questionOptionsTable, and(
      eq(questionOptionsTable.questionId, questionsTable.id),
      eq(questionOptionsTable.isCorrect, true)
    ))
    .where(eq(testSessionsTable.userId, userId))
    .groupBy(questionsTable.subjectId, subjectsTable.name);

  // Now aggregate!
  const subjectStatsMap = new Map<number, {
    subjectId: number;
    subjectName: string;
    correct: number;
    incorrect: number;
    skipped: number;
  }>();

  // Initialize with all subjects
  for (const s of subjects) {
    subjectStatsMap.set(s.id, {
      subjectId: s.id,
      subjectName: s.name,
      correct: 0,
      incorrect: 0,
      skipped: 0,
    });
  }

  for (const row of answersList) {
    const sId = row.subjectId;
    if (subjectStatsMap.has(sId)) {
      const stat = subjectStatsMap.get(sId)!;
      stat.correct = row.correct;
      stat.incorrect = row.incorrect;
      stat.skipped = row.skipped;
    }
  }

  const performance = Array.from(subjectStatsMap.values()).map(stat => {
    const totalAttempted = stat.correct + stat.incorrect;
    const accuracy = totalAttempted > 0 ? (stat.correct / totalAttempted) * 100 : 0;
    return {
      subjectId: stat.subjectId,
      subjectName: stat.subjectName,
      accuracy: Math.round(accuracy * 10) / 10,
      totalAttempted,
      correct: stat.correct,
      incorrect: stat.incorrect,
      skipped: stat.skipped,
    };
  });

  res.json(performance.slice(0, 6));
});

export default router;
