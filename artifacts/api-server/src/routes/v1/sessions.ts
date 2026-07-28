import { Router, type IRouter } from "express";
import {
  db,
  testSessionsTable,
  sessionAnswersTable,
  resultsTable,
  examsTable,
  examQuestionsTable,
  examSectionsTable,
  questionsTable,
  questionOptionsTable,
  usersTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../../middlewares/auth";
import {
  StartSessionBody,
  GetSessionParams,
  SubmitAnswerParams,
  SubmitAnswerBody,
  SubmitSessionParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/v1/sessions", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const parsed = StartSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = req.userId!;
  const { examId } = parsed.data;

  const [exam] = await db.select().from(examsTable).where(eq(examsTable.id, examId));
  if (!exam) {
    res.status(404).json({ error: "Exam not found" });
    return;
  }

  // Check for in-progress session
  const existing = await db.select().from(testSessionsTable)
    .where(and(eq(testSessionsTable.userId, userId), eq(testSessionsTable.examId, examId), eq(testSessionsTable.status, "in_progress")));
  if (existing.length > 0) {
    // Resume existing session
    const sessionId = existing[0].id;
    return void res.status(201).json(await buildSessionDetail(sessionId));
  }

  const [session] = await db.insert(testSessionsTable).values({
    userId,
    examId,
    status: "in_progress",
  }).returning();

  // Pre-populate session answers for all questions
  const examQuestions = await db.select().from(examQuestionsTable).where(eq(examQuestionsTable.examId, examId));
  for (const eq_ of examQuestions) {
    await db.insert(sessionAnswersTable).values({
      sessionId: session.id,
      questionId: eq_.questionId,
      status: "not_visited",
      timeSpentSeconds: 0,
    });
  }

  res.status(201).json(await buildSessionDetail(session.id));
});

router.get("/v1/sessions", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const userId = req.userId!;
  const sessions = await db.select().from(testSessionsTable).where(eq(testSessionsTable.userId, userId));

  const data = await Promise.all(sessions.map(async (s) => {
    const [exam] = await db.select({ title: examsTable.title, durationMinutes: examsTable.durationMinutes }).from(examsTable).where(eq(examsTable.id, s.examId));
    const answers = await db.select().from(sessionAnswersTable).where(eq(sessionAnswersTable.sessionId, s.id));
    const answered = answers.filter(a => a.status === "answered" || a.status === "marked_answered").length;
    return {
      id: s.id,
      examId: s.examId,
      examTitle: exam?.title ?? "Unknown",
      status: s.status,
      startedAt: s.startedAt,
      submittedAt: s.submittedAt ?? null,
      durationMinutes: exam?.durationMinutes ?? 60,
      currentQuestionIndex: s.currentQuestionIndex ?? 0,
      answeredCount: answered,
      totalQuestions: answers.length,
    };
  }));

  res.json(data);
});

router.get("/v1/sessions/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = GetSessionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const userId = req.userId!;
  const [rawSession] = await db.select({ userId: testSessionsTable.userId }).from(testSessionsTable).where(eq(testSessionsTable.id, params.data.id));
  if (!rawSession) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  if (rawSession.userId !== userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const session = await buildSessionDetail(params.data.id);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  res.json(session);
});

router.patch("/v1/sessions/:id/answer", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = SubmitAnswerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = SubmitAnswerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = req.userId!;
  const sessionId = params.data.id;
  const [rawSession] = await db.select({ userId: testSessionsTable.userId }).from(testSessionsTable).where(eq(testSessionsTable.id, sessionId));
  if (!rawSession) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  if (rawSession.userId !== userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const { questionId, selectedOptionId, status, timeSpentSeconds } = parsed.data;

  const existing = await db.select().from(sessionAnswersTable)
    .where(and(eq(sessionAnswersTable.sessionId, sessionId), eq(sessionAnswersTable.questionId, questionId)));

  if (existing.length > 0) {
    await db.update(sessionAnswersTable).set({
      selectedOptionId: selectedOptionId ?? null,
      status,
      timeSpentSeconds: timeSpentSeconds ?? 0,
    }).where(and(eq(sessionAnswersTable.sessionId, sessionId), eq(sessionAnswersTable.questionId, questionId)));
  } else {
    await db.insert(sessionAnswersTable).values({
      sessionId,
      questionId,
      selectedOptionId: selectedOptionId ?? null,
      status,
      timeSpentSeconds: timeSpentSeconds ?? 0,
    });
  }

  res.json({ message: "Answer saved" });
});

router.post("/v1/sessions/:id/submit", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = SubmitSessionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const sessionId = params.data.id;
  const userId = req.userId!;

  const [session] = await db.select().from(testSessionsTable).where(eq(testSessionsTable.id, sessionId));
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  if (session.userId !== userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  if (session.status !== "in_progress") {
    res.status(400).json({ error: "Session already submitted" });
    return;
  }

  const [exam] = await db.select().from(examsTable).where(eq(examsTable.id, session.examId));
  const answers = await db.select().from(sessionAnswersTable).where(eq(sessionAnswersTable.sessionId, sessionId));

  let score = 0;
  let correct = 0;
  let incorrect = 0;
  let skipped = 0;
  let totalTime = 0;

  for (const answer of answers) {
    totalTime += answer.timeSpentSeconds ?? 0;
    if (answer.status === "not_visited" || answer.status === "visited" || !answer.selectedOptionId) {
      skipped++;
      continue;
    }
    const [option] = await db.select().from(questionOptionsTable).where(eq(questionOptionsTable.id, answer.selectedOptionId));
    const [question] = await db.select().from(questionsTable).where(eq(questionsTable.id, answer.questionId));
    if (option?.isCorrect) {
      score += question?.positiveMarks ?? 1;
      correct++;
    } else {
      score -= question?.negativeMarks ?? 0;
      incorrect++;
    }
  }

  const accuracy = answers.length > 0 ? (correct / answers.length) * 100 : 0;
  const totalMarks = exam?.totalMarks ?? 100;

  await db.update(testSessionsTable).set({
    status: "submitted",
    submittedAt: new Date(),
  }).where(eq(testSessionsTable.id, sessionId));

  const [result] = await db.insert(resultsTable).values({
    sessionId,
    userId,
    examId: session.examId,
    score: Math.max(0, score),
    totalMarks,
    correct,
    incorrect,
    skipped,
    timeTakenSeconds: totalTime,
    accuracy: Math.round(accuracy * 10) / 10,
    rank: null,
    percentile: null,
  }).returning();

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
  });
});

async function buildSessionDetail(sessionId: number) {
  const [session] = await db.select().from(testSessionsTable).where(eq(testSessionsTable.id, sessionId));
  if (!session) return null;

  const [exam] = await db.select().from(examsTable).where(eq(examsTable.id, session.examId));
  const sections = await db.select().from(examSectionsTable).where(eq(examSectionsTable.examId, session.examId));
  const examQs = await db.select().from(examQuestionsTable).where(eq(examQuestionsTable.examId, session.examId));
  const answers = await db.select().from(sessionAnswersTable).where(eq(sessionAnswersTable.sessionId, sessionId));
  const answerMap = new Map(answers.map(a => [a.questionId, a]));

  const questions = await Promise.all(examQs.map(async (eq_) => {
    const [q] = await db.select().from(questionsTable).where(eq(questionsTable.id, eq_.questionId));
    const options = await db.select().from(questionOptionsTable).where(eq(questionOptionsTable.questionId, eq_.questionId));
    const answer = answerMap.get(eq_.questionId);
    return {
      id: eq_.id,
      questionId: eq_.questionId,
      text: q?.text ?? "",
      type: q?.type ?? "single_choice",
      imageUrl: q?.imageUrl ?? null,
      options: options.map(o => ({ id: o.id, text: o.text })),
      status: answer?.status ?? "not_visited",
      selectedOptionId: answer?.selectedOptionId ?? null,
      timeSpentSeconds: answer?.timeSpentSeconds ?? 0,
      order: eq_.order,
    };
  }));

  const sectionDetails = await Promise.all(sections.map(async (sec) => {
    const [sq] = await db.select().from(examQuestionsTable).where(eq(examQuestionsTable.sectionId, sec.id));
    return {
      id: sec.id,
      name: sec.name,
      questionCount: examQs.filter(q => q.sectionId === sec.id).length,
      durationMinutes: sec.durationMinutes ?? null,
      order: sec.order,
      subjectId: sec.subjectId ?? null,
    };
  }));

  return {
    id: session.id,
    examId: session.examId,
    examTitle: exam?.title ?? "Exam",
    status: session.status,
    startedAt: session.startedAt,
    submittedAt: session.submittedAt ?? null,
    durationMinutes: exam?.durationMinutes ?? 60,
    currentSectionIndex: session.currentSectionIndex ?? 0,
    questions: questions.sort((a, b) => a.order - b.order),
    sections: sectionDetails,
  };
}

export default router;
