import { Router, type IRouter } from "express";
import {
  db,
  resultsTable,
  examsTable,
  testSessionsTable,
  sessionAnswersTable,
  questionsTable,
  questionOptionsTable,
  subjectsTable,
  topicsTable,
} from "@workspace/db";
import { eq, desc, inArray, and, count } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../../middlewares/auth";
import { ListResultsQueryParams, GetResultParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/v1/results", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = ListResultsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const { page = 1, limit = 20 } = params.data;
  const userId = req.userId!;
  const offset = (page - 1) * limit;

  const paged = await db.select({
    id: resultsTable.id,
    examId: resultsTable.examId,
    examTitle: examsTable.title,
    score: resultsTable.score,
    totalMarks: resultsTable.totalMarks,
    accuracy: resultsTable.accuracy,
    correct: resultsTable.correct,
    incorrect: resultsTable.incorrect,
    skipped: resultsTable.skipped,
    timeTakenSeconds: resultsTable.timeTakenSeconds,
    rank: resultsTable.rank,
    percentile: resultsTable.percentile,
    createdAt: resultsTable.createdAt,
  })
    .from(resultsTable)
    .leftJoin(examsTable, eq(resultsTable.examId, examsTable.id))
    .where(eq(resultsTable.userId, userId))
    .orderBy(desc(resultsTable.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ count: total }] = await db.select({ count: count() })
    .from(resultsTable)
    .where(eq(resultsTable.userId, userId));

  const data = paged.map((r) => ({
    id: r.id,
    examId: r.examId,
    examTitle: r.examTitle ?? "Exam",
    score: r.score,
    totalMarks: r.totalMarks,
    accuracy: r.accuracy,
    correct: r.correct ?? 0,
    incorrect: r.incorrect ?? 0,
    skipped: r.skipped ?? 0,
    timeTakenSeconds: r.timeTakenSeconds ?? 0,
    rank: r.rank ?? null,
    percentile: r.percentile ?? null,
    attemptedAt: r.createdAt,
  }));

  res.json({ data, total, page, limit });
});

router.get("/v1/results/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = GetResultParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [result] = await db.select().from(resultsTable).where(eq(resultsTable.id, params.data.id));
  if (!result) {
    res.status(404).json({ error: "Result not found" });
    return;
  }

  if (result.userId !== req.userId!) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const [exam, answers, subjectsList, topicsList] = await Promise.all([
    db.select({ title: examsTable.title }).from(examsTable).where(eq(examsTable.id, result.examId)).then(r => r[0]),
    db.select().from(sessionAnswersTable).where(eq(sessionAnswersTable.sessionId, result.sessionId)),
    db.select({ id: subjectsTable.id, name: subjectsTable.name }).from(subjectsTable),
    db.select({ id: topicsTable.id, name: topicsTable.name }).from(topicsTable),
  ]);

  const questionIds = answers.map(a => a.questionId);
  const [questionsList, optionsList] = await Promise.all([
    questionIds.length > 0 ? db.select().from(questionsTable).where(inArray(questionsTable.id, questionIds)) : [],
    questionIds.length > 0 ? db.select().from(questionOptionsTable).where(inArray(questionOptionsTable.questionId, questionIds)) : [],
  ]);

  const questionMap = new Map(questionsList.map(q => [q.id, q]));
  const optionsMap = new Map<number, typeof questionOptionsTable.$inferSelect[]>();
  for (const o of optionsList) {
    if (!optionsMap.has(o.questionId)) {
      optionsMap.set(o.questionId, []);
    }
    optionsMap.get(o.questionId)!.push(o);
  }

  const subjectMap = new Map(subjectsList.map(s => [s.id, s.name]));
  const topicMap = new Map(topicsList.map(t => [t.id, t.name]));

  const questionDetails = answers.map((a) => {
    const q = questionMap.get(a.questionId);
    const options = optionsMap.get(a.questionId) || [];
    const correctOption = options.find(o => o.isCorrect);
    const selectedOption = options.find(o => o.id === a.selectedOptionId);
    const isCorrect = selectedOption?.isCorrect ?? false;
    const isSkipped = !a.selectedOptionId || a.status === "not_visited" || a.status === "visited";
    const marksAwarded = isSkipped ? 0 : isCorrect ? (q?.positiveMarks ?? 1) : -(q?.negativeMarks ?? 0);

    const subjectName = q ? subjectMap.get(q.subjectId) ?? null : null;
    const topicName = q ? topicMap.get(q.topicId) ?? null : null;

    return {
      questionId: a.questionId,
      text: q?.text ?? "",
      type: q?.type ?? "single_choice",
      imageUrl: q?.imageUrl ?? null,
      yourAnswer: a.selectedOptionId ?? null,
      correctAnswer: correctOption?.id ?? null,
      isCorrect,
      isSkipped,
      marksAwarded,
      timeSpentSeconds: a.timeSpentSeconds ?? 0,
      explanation: q?.explanation ?? null,
      options: options.map(o => ({ id: o.id, text: o.text, isCorrect: o.isCorrect })),
      subjectId: q?.subjectId ?? null,
      subjectName,
      topicId: q?.topicId ?? null,
      topicName,
      difficulty: q?.difficulty ?? "medium",
      positiveMarks: q?.positiveMarks ?? 1,
      negativeMarks: q?.negativeMarks ?? 0,
    };
  });

  const subjectMapStats = new Map<string, { subjectId: number; name: string; correct: number; incorrect: number; skipped: number; timeSpent: number }>();
  for (const q of questionDetails) {
    if (!q.subjectName || q.subjectId === null) continue;
    if (!subjectMapStats.has(q.subjectName)) {
      subjectMapStats.set(q.subjectName, { subjectId: q.subjectId, name: q.subjectName, correct: 0, incorrect: 0, skipped: 0, timeSpent: 0 });
    }
    const stat = subjectMapStats.get(q.subjectName)!;
    stat.timeSpent += q.timeSpentSeconds;
    if (q.isSkipped) stat.skipped++;
    else if (q.isCorrect) stat.correct++;
    else stat.incorrect++;
  }
  const subjectBreakdown = Array.from(subjectMapStats.values()).map(s => {
    const attempted = s.correct + s.incorrect;
    return {
      subjectId: s.subjectId,
      subjectName: s.name,
      correct: s.correct,
      incorrect: s.incorrect,
      skipped: s.skipped,
      accuracy: attempted > 0 ? (s.correct / attempted) * 100 : 0,
      timeSpentSeconds: s.timeSpent,
    };
  });

  const topicMapStats = new Map<string, { topicId: number; name: string; correct: number; incorrect: number; skipped: number; timeSpent: number }>();
  for (const q of questionDetails) {
    if (!q.topicName || q.topicId === null) continue;
    if (!topicMapStats.has(q.topicName)) {
      topicMapStats.set(q.topicName, { topicId: q.topicId, name: q.topicName, correct: 0, incorrect: 0, skipped: 0, timeSpent: 0 });
    }
    const stat = topicMapStats.get(q.topicName)!;
    stat.timeSpent += q.timeSpentSeconds;
    if (q.isSkipped) stat.skipped++;
    else if (q.isCorrect) stat.correct++;
    else stat.incorrect++;
  }
  const topicBreakdown = Array.from(topicMapStats.values()).map(t => {
    const attempted = t.correct + t.incorrect;
    return {
      topicId: t.topicId,
      topicName: t.name,
      correct: t.correct,
      incorrect: t.incorrect,
      skipped: t.skipped,
      accuracy: attempted > 0 ? (t.correct / attempted) * 100 : 0,
      timeSpentSeconds: t.timeSpent,
    };
  });

  const difficultyMapStats = new Map<string, { correct: number; incorrect: number; skipped: number; timeSpent: number }>();
  ["easy", "medium", "hard"].forEach(d => difficultyMapStats.set(d, { correct: 0, incorrect: 0, skipped: 0, timeSpent: 0 }));
  for (const q of questionDetails) {
    const diff = q.difficulty;
    const stat = difficultyMapStats.get(diff) || { correct: 0, incorrect: 0, skipped: 0, timeSpent: 0 };
    stat.timeSpent += q.timeSpentSeconds;
    if (q.isSkipped) stat.skipped++;
    else if (q.isCorrect) stat.correct++;
    else stat.incorrect++;
    difficultyMapStats.set(diff, stat);
  }
  const difficultyBreakdown = Array.from(difficultyMapStats.entries()).map(([diff, val]) => {
    const attempted = val.correct + val.incorrect;
    return {
      difficulty: diff,
      correct: val.correct,
      incorrect: val.incorrect,
      skipped: val.skipped,
      accuracy: attempted > 0 ? (val.correct / attempted) * 100 : 0,
      timeSpentSeconds: val.timeSpent,
    };
  });

  let positiveMarksEarned = 0;
  let negativeMarksDeducted = 0;
  for (const q of questionDetails) {
    if (!q.isSkipped) {
      if (q.isCorrect) {
        positiveMarksEarned += q.positiveMarks;
      } else {
        negativeMarksDeducted += q.negativeMarks;
      }
    }
  }
  const marksBreakdown = {
    totalMarks: result.totalMarks,
    positiveMarksEarned,
    negativeMarksDeducted,
    finalScore: result.score,
  };

  res.json({
    id: result.id,
    examId: result.examId,
    examTitle: exam?.title ?? "Exam",
    score: result.score,
    totalMarks: result.totalMarks,
    accuracy: result.accuracy,
    correct: result.correct ?? 0,
    incorrect: result.incorrect ?? 0,
    skipped: result.skipped ?? 0,
    timeTakenSeconds: result.timeTakenSeconds ?? 0,
    rank: result.rank ?? null,
    percentile: result.percentile ?? null,
    attemptedAt: result.createdAt,
    questions: questionDetails,
    subjectBreakdown,
    topicBreakdown,
    difficultyBreakdown,
    marksBreakdown,
  });
});

export default router;
