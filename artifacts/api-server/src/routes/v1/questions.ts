import { Router, type IRouter } from "express";
import {
  db,
  questionsTable,
  questionOptionsTable,
  subjectsTable,
  topicsTable,
  questionReportsTable,
  bookmarksTable,
  wrongAnswersTable,
  practiceSessionQuestionsTable,
  practiceSessionAnswersTable,
  questionCollectionItemsTable,
  sessionAnswersTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAdmin, requireAuth, type AuthRequest } from "../../middlewares/auth";
import { createNotificationForStudents, createNotificationForAdmins } from "../../lib/notifications";
import {
  ListQuestionsQueryParams,
  CreateQuestionBody,
  GetQuestionParams,
  UpdateQuestionParams,
  UpdateQuestionBody,
  DeleteQuestionParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function buildQuestion(q: typeof questionsTable.$inferSelect) {
  const [options, subject, topic] = await Promise.all([
    db.select().from(questionOptionsTable).where(eq(questionOptionsTable.questionId, q.id)),
    q.subjectId ? db.select({ name: subjectsTable.name }).from(subjectsTable).where(eq(subjectsTable.id, q.subjectId)).then(r => r[0]) : null,
    q.topicId ? db.select({ name: topicsTable.name }).from(topicsTable).where(eq(topicsTable.id, q.topicId)).then(r => r[0]) : null,
  ]);
  return {
    id: q.id,
    text: q.text,
    type: q.type,
    difficulty: q.difficulty,
    explanation: q.explanation ?? null,
    hint: q.hint ?? null,
    imageUrl: q.imageUrl ?? null,
    positiveMarks: q.positiveMarks,
    negativeMarks: q.negativeMarks,
    subjectId: q.subjectId,
    topicId: q.topicId,
    subjectName: subject?.name ?? null,
    topicName: topic?.name ?? null,
    options: options.map(o => ({ id: o.id, text: o.text, isCorrect: o.isCorrect })),
    createdAt: q.createdAt,
  };
}

router.get("/v1/questions", async (req, res): Promise<void> => {
  const params = ListQuestionsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const { page = 1, limit = 20, subjectId, topicId, difficulty, type, search } = params.data;
  const offset = (page - 1) * limit;

  const { and, eq, ilike, inArray, count: countFn } = await import("drizzle-orm");

  const conditions = [];
  if (subjectId) conditions.push(eq(questionsTable.subjectId, subjectId));
  if (topicId) conditions.push(eq(questionsTable.topicId, topicId));
  if (difficulty) conditions.push(eq(questionsTable.difficulty, difficulty));
  if (type) conditions.push(eq(questionsTable.type, type));
  if (search) conditions.push(ilike(questionsTable.text, `%${search}%`));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [countResult] = await db
    .select({ val: countFn() })
    .from(questionsTable)
    .where(whereClause);
  const total = Number(countResult?.val ?? 0);

  const pagedResults = await db
    .select({
      question: questionsTable,
      subjectName: subjectsTable.name,
      topicName: topicsTable.name,
    })
    .from(questionsTable)
    .leftJoin(subjectsTable, eq(questionsTable.subjectId, subjectsTable.id))
    .leftJoin(topicsTable, eq(questionsTable.topicId, topicsTable.id))
    .where(whereClause)
    .limit(limit)
    .offset(offset);

  const questionIds = pagedResults.map(r => r.question.id);
  const allOptions = questionIds.length > 0
    ? await db.select().from(questionOptionsTable).where(inArray(questionOptionsTable.questionId, questionIds))
    : [];

  const data = pagedResults.map(r => {
    const q = r.question;
    const options = allOptions
      .filter(o => o.questionId === q.id)
      .map(o => ({ id: o.id, text: o.text, isCorrect: o.isCorrect }));
    return {
      id: q.id,
      text: q.text,
      type: q.type,
      difficulty: q.difficulty,
      explanation: q.explanation ?? null,
      hint: q.hint ?? null,
      imageUrl: q.imageUrl ?? null,
      positiveMarks: q.positiveMarks,
      negativeMarks: q.negativeMarks,
      subjectId: q.subjectId,
      topicId: q.topicId,
      subjectName: r.subjectName ?? null,
      topicName: r.topicName ?? null,
      options,
      createdAt: q.createdAt,
    };
  });

  res.json({ data, total, page, limit });
});

router.post("/v1/questions", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateQuestionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { options, ...rest } = parsed.data;
  const [q] = await db.insert(questionsTable).values({
    text: rest.text,
    type: rest.type,
    difficulty: rest.difficulty,
    explanation: rest.explanation ?? null,
    hint: rest.hint ?? null,
    imageUrl: rest.imageUrl ?? null,
    positiveMarks: rest.positiveMarks,
    negativeMarks: rest.negativeMarks,
    subjectId: rest.subjectId,
    topicId: rest.topicId,
  }).returning();

  for (let i = 0; i < options.length; i++) {
    await db.insert(questionOptionsTable).values({
      questionId: q.id,
      text: options[i].text,
      isCorrect: options[i].isCorrect,
      order: i + 1,
    });
  }

  res.status(201).json(await buildQuestion(q));
});

router.get("/v1/questions/:id", async (req, res): Promise<void> => {
  const params = GetQuestionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [q] = await db.select().from(questionsTable).where(eq(questionsTable.id, params.data.id));
  if (!q) {
    res.status(404).json({ error: "Question not found" });
    return;
  }
  res.json(await buildQuestion(q));
});

router.put("/v1/questions/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateQuestionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateQuestionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updateData: Record<string, unknown> = {};
  if (parsed.data.text != null) updateData.text = parsed.data.text;
  if (parsed.data.difficulty != null) updateData.difficulty = parsed.data.difficulty;
  if (parsed.data.explanation != null) updateData.explanation = parsed.data.explanation;
  if (parsed.data.hint != null) updateData.hint = parsed.data.hint;

  const [q] = await db.update(questionsTable).set(updateData).where(eq(questionsTable.id, params.data.id)).returning();
  if (!q) {
    res.status(404).json({ error: "Question not found" });
    return;
  }
  const [subject] = await db.select({ name: subjectsTable.name }).from(subjectsTable).where(eq(subjectsTable.id, q.subjectId));
  await createNotificationForAdmins("Question Updated", `A question has been updated in the Question Bank under Subject '${subject?.name ?? ""}'.`, "system");
  res.json(await buildQuestion(q));
});

router.delete("/v1/questions/:id", requireAdmin, async (req, res): Promise<void> => {
  try {
    const params = DeleteQuestionParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const questionId = params.data.id;

    // Check for references in active session or practice tables
    const [practiceQ, practiceA, sessionA, wrongA, bookmark, collectionItem] = await Promise.all([
      db.select({ id: practiceSessionQuestionsTable.id }).from(practiceSessionQuestionsTable).where(eq(practiceSessionQuestionsTable.questionId, questionId)).limit(1),
      db.select({ id: practiceSessionAnswersTable.id }).from(practiceSessionAnswersTable).where(eq(practiceSessionAnswersTable.questionId, questionId)).limit(1),
      db.select({ id: sessionAnswersTable.id }).from(sessionAnswersTable).where(eq(sessionAnswersTable.questionId, questionId)).limit(1),
      db.select({ id: wrongAnswersTable.id }).from(wrongAnswersTable).where(eq(wrongAnswersTable.questionId, questionId)).limit(1),
      db.select({ id: bookmarksTable.id }).from(bookmarksTable).where(eq(bookmarksTable.questionId, questionId)).limit(1),
      db.select({ id: questionCollectionItemsTable.id }).from(questionCollectionItemsTable).where(eq(questionCollectionItemsTable.questionId, questionId)).limit(1)
    ]);

    if (
      practiceQ.length > 0 ||
      practiceA.length > 0 ||
      sessionA.length > 0 ||
      wrongA.length > 0 ||
      bookmark.length > 0 ||
      collectionItem.length > 0
    ) {
      res.status(409).json({ error: "This question is referenced by practice sessions and cannot be deleted." });
      return;
    }

    // Delete child records first to ensure no constraint violations
    await db.delete(questionOptionsTable).where(eq(questionOptionsTable.questionId, questionId));
    await db.delete(questionReportsTable).where(eq(questionReportsTable.questionId, questionId));

    // Delete the main question record
    const result = await db.delete(questionsTable).where(eq(questionsTable.id, questionId)).returning();

    if (result.length === 0) {
      res.status(404).json({ error: "Question not found" });
      return;
    }

    res.json({ message: "Question deleted" });
  } catch (error) {
    console.error("Error deleting question:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Internal Server Error" });
  }
});

// Bulk import endpoint — accepts an array of questions and creates them all
router.post("/v1/questions/bulk", requireAdmin, async (req, res): Promise<void> => {
  const { z } = await import("zod");
  const schema = z.array(CreateQuestionBody).min(1).max(5000);
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const created: unknown[] = [];
  let lastSubjectId: number | null = null;
  let lastTopicId: number | null = null;
  for (const item of parsed.data) {
    const { options, ...rest } = item;
    const [q] = await db.insert(questionsTable).values({
      text: rest.text,
      type: rest.type,
      difficulty: rest.difficulty,
      explanation: rest.explanation ?? null,
      hint: rest.hint ?? null,
      imageUrl: rest.imageUrl ?? null,
      positiveMarks: rest.positiveMarks,
      negativeMarks: rest.negativeMarks,
      subjectId: rest.subjectId,
      topicId: rest.topicId,
    }).returning();
    for (let i = 0; i < options.length; i++) {
      await db.insert(questionOptionsTable).values({
        questionId: q.id,
        text: options[i].text,
        isCorrect: options[i].isCorrect,
        order: i + 1,
      });
    }
    created.push({ id: q.id });
    lastSubjectId = rest.subjectId;
    lastTopicId = rest.topicId;
  }

  // Trigger Notifications
  if (created.length > 0 && lastSubjectId && lastTopicId) {
    const [subject] = await db.select({ name: subjectsTable.name }).from(subjectsTable).where(eq(subjectsTable.id, lastSubjectId));
    const [topic] = await db.select({ name: topicsTable.name }).from(topicsTable).where(eq(topicsTable.id, lastTopicId));
    await createNotificationForAdmins("Questions Imported", `Successfully imported ${created.length} questions for Subject: ${subject?.name ?? ""} / Topic: ${topic?.name ?? ""}.`, "system");
    await createNotificationForStudents("New Questions Added", `New practice questions have been added to Subject: ${subject?.name ?? ""} / Topic: ${topic?.name ?? ""}.`, "announcement", "/practice");
  }

  res.status(201).json({ created: created.length, ids: created });
});

// Parse bulk questions document for previewing
router.post("/v1/questions/import/parse", requireAdmin, async (req, res): Promise<void> => {
  try {
    const { fileName, mimeType, fileData } = req.body;
    if (!fileData) {
      res.status(400).json({ error: "Missing fileData parameter." });
      return;
    }

    let base64Content = fileData;
    if (fileData.includes(";base64,")) {
      base64Content = fileData.split(";base64,")[1];
    }
    const buffer = Buffer.from(base64Content, "base64");

    const { parseDocument } = await import("../../lib/parser");
    const report = await parseDocument(buffer, fileName || "import.txt", mimeType || "text/plain");

    res.json(report);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error parsing document";
    res.status(500).json({ error: msg });
  }
});

router.post("/v1/questions/:id/report", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const questionId = Number(req.params.id);
    const userId = req.userId!;
    const { reason } = req.body;

    if (!reason || typeof reason !== "string") {
      res.status(400).json({ error: "Reason is required." });
      return;
    }

    await db.insert(questionReportsTable).values({
      questionId,
      userId,
      reason,
    });

    res.status(201).json({ success: true, message: "Report submitted successfully." });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to submit question report." });
  }
});

export default router;
