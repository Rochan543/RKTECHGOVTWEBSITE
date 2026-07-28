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
import { eq, desc } from "drizzle-orm";
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

  const allResults = await db.select().from(resultsTable).where(eq(resultsTable.userId, userId));
  const total = allResults.length;
  const paged = allResults.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice((page - 1) * limit, page * limit);

  const data = await Promise.all(paged.map(async (r) => {
    const [exam] = await db.select({ title: examsTable.title }).from(examsTable).where(eq(examsTable.id, r.examId));
    return {
      id: r.id,
      examId: r.examId,
      examTitle: exam?.title ?? "Exam",
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
    };
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

  const [exam] = await db.select({ title: examsTable.title }).from(examsTable).where(eq(examsTable.id, result.examId));
  const answers = await db.select().from(sessionAnswersTable).where(eq(sessionAnswersTable.sessionId, result.sessionId));

  const questionDetails = await Promise.all(answers.map(async (a) => {
    const [q] = await db.select().from(questionsTable).where(eq(questionsTable.id, a.questionId));
    const options = await db.select().from(questionOptionsTable).where(eq(questionOptionsTable.questionId, a.questionId));
    const correctOption = options.find(o => o.isCorrect);
    const selectedOption = options.find(o => o.id === a.selectedOptionId);
    const isCorrect = selectedOption?.isCorrect ?? false;
    const isSkipped = !a.selectedOptionId || a.status === "not_visited" || a.status === "visited";
    const marksAwarded = isSkipped ? 0 : isCorrect ? (q?.positiveMarks ?? 1) : -(q?.negativeMarks ?? 0);

    const [subject] = q ? await db.select({ name: subjectsTable.name }).from(subjectsTable).where(eq(subjectsTable.id, q.subjectId)) : [null];
    const [topic] = q ? await db.select({ name: topicsTable.name }).from(topicsTable).where(eq(topicsTable.id, q.topicId)) : [null];

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
      subjectName: subject?.name ?? null,
      topicName: topic?.name ?? null,
    };
  }));

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
    subjectBreakdown: [],
  });
});

export default router;
