import { Router, type IRouter } from "express";
import {
  db, sessionAnswersTable, questionsTable, questionOptionsTable,
  testSessionsTable, examsTable, subjectsTable, topicsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../../middlewares/auth";

const router: IRouter = Router();

router.get("/v1/wrong-answers", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const userId = req.userId!;

  // Get all submitted sessions for this user
  const sessions = await db.select().from(testSessionsTable)
    .where(eq(testSessionsTable.userId, userId));
  const submittedSessions = sessions.filter(s => s.status === "submitted" || s.status === "auto_submitted");

  const wrongAnswers: unknown[] = [];

  for (const session of submittedSessions) {
    const answers = await db.select().from(sessionAnswersTable)
      .where(eq(sessionAnswersTable.sessionId, session.id));

    const [exam] = await db.select({ title: examsTable.title }).from(examsTable)
      .where(eq(examsTable.id, session.examId));

    for (const answer of answers) {
      if (!answer.selectedOptionId) continue; // skipped — not a wrong answer

      const [selectedOption] = await db.select().from(questionOptionsTable)
        .where(eq(questionOptionsTable.id, answer.selectedOptionId));
      if (!selectedOption || selectedOption.isCorrect) continue; // correct — skip

      const [q] = await db.select().from(questionsTable)
        .where(eq(questionsTable.id, answer.questionId));
      if (!q) continue;

      const options = await db.select().from(questionOptionsTable)
        .where(eq(questionOptionsTable.questionId, q.id));
      const correctOption = options.find(o => o.isCorrect);

      const [subject] = await db.select({ name: subjectsTable.name }).from(subjectsTable)
        .where(eq(subjectsTable.id, q.subjectId));
      const [topic] = await db.select({ name: topicsTable.name }).from(topicsTable)
        .where(eq(topicsTable.id, q.topicId));

      wrongAnswers.push({
        sessionId: session.id,
        examTitle: exam?.title ?? "Unknown Exam",
        attemptedAt: session.submittedAt ?? session.startedAt,
        question: {
          id: q.id,
          text: q.text,
          type: q.type,
          difficulty: q.difficulty,
          explanation: q.explanation ?? null,
          imageUrl: q.imageUrl ?? null,
          subjectName: subject?.name ?? null,
          topicName: topic?.name ?? null,
          options: options.map(o => ({ id: o.id, text: o.text, isCorrect: o.isCorrect })),
          yourAnswerId: answer.selectedOptionId,
          correctAnswerId: correctOption?.id ?? null,
        },
      });
    }
  }

  res.json(wrongAnswers);
});

export default router;
