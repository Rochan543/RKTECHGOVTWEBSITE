import { Router, type IRouter } from "express";
import {
  db, sessionAnswersTable, questionsTable, questionOptionsTable,
  testSessionsTable, examsTable, subjectsTable, topicsTable,
} from "@workspace/db";
import { eq, inArray, and } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../../middlewares/auth";

const router: IRouter = Router();

router.get("/v1/wrong-answers", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const userId = req.userId!;

  // 1. Get wrong answers with all details except other options
  const wrongAnswersList = await db.select({
    sessionId: testSessionsTable.id,
    examTitle: examsTable.title,
    submittedAt: testSessionsTable.submittedAt,
    startedAt: testSessionsTable.startedAt,
    // Question details
    questionId: questionsTable.id,
    questionText: questionsTable.text,
    questionType: questionsTable.type,
    questionDifficulty: questionsTable.difficulty,
    questionExplanation: questionsTable.explanation,
    questionImageUrl: questionsTable.imageUrl,
    subjectName: subjectsTable.name,
    topicName: topicsTable.name,
    yourAnswerId: sessionAnswersTable.selectedOptionId,
  })
    .from(sessionAnswersTable)
    .innerJoin(testSessionsTable, eq(sessionAnswersTable.sessionId, testSessionsTable.id))
    .innerJoin(questionsTable, eq(sessionAnswersTable.questionId, questionsTable.id))
    .innerJoin(examsTable, eq(testSessionsTable.examId, examsTable.id))
    .innerJoin(questionOptionsTable, eq(sessionAnswersTable.selectedOptionId, questionOptionsTable.id))
    .leftJoin(subjectsTable, eq(questionsTable.subjectId, subjectsTable.id))
    .leftJoin(topicsTable, eq(questionsTable.topicId, topicsTable.id))
    .where(
      and(
        eq(testSessionsTable.userId, userId),
        inArray(testSessionsTable.status, ["submitted", "auto_submitted"]),
        eq(questionOptionsTable.isCorrect, false)
      )
    );

  const questionIds = wrongAnswersList.map(wa => wa.questionId);

  // 2. Fetch all options for these questions in one query (if any wrong answers exist)
  const optionsList = questionIds.length > 0
    ? await db.select().from(questionOptionsTable).where(inArray(questionOptionsTable.questionId, questionIds))
    : [];

  const optionsMap = new Map<number, typeof questionOptionsTable.$inferSelect[]>();
  for (const opt of optionsList) {
    if (!optionsMap.has(opt.questionId)) {
      optionsMap.set(opt.questionId, []);
    }
    optionsMap.get(opt.questionId)!.push(opt);
  }

  const response = wrongAnswersList.map((wa) => {
    const options = optionsMap.get(wa.questionId) ?? [];
    const correctOption = options.find(o => o.isCorrect);

    return {
      sessionId: wa.sessionId,
      examTitle: wa.examTitle ?? "Unknown Exam",
      attemptedAt: wa.submittedAt ?? wa.startedAt,
      question: {
        id: wa.questionId,
        text: wa.questionText,
        type: wa.questionType,
        difficulty: wa.questionDifficulty,
        explanation: wa.questionExplanation ?? null,
        imageUrl: wa.questionImageUrl ?? null,
        subjectName: wa.subjectName ?? null,
        topicName: wa.topicName ?? null,
        options: options.map(o => ({ id: o.id, text: o.text, isCorrect: o.isCorrect })),
        yourAnswerId: wa.yourAnswerId,
        correctAnswerId: correctOption?.id ?? null,
      },
    };
  });

  res.json(response);
});

export default router;
