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
  examQuestionsTable,
  currentAffairQuizQuestionsTable,
} from "@workspace/db";
import { eq, count } from "drizzle-orm";
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

    console.log("DELETE ROUTE VERSION 3");
    console.log(`DELETE request received for question: ${questionId}`);
    console.log(`Authenticated User: ${req.userId}, Role: ${req.user?.role}`);

    // Query row counts across all 10 referencing tables for logging and checks
    const [
      [optionsCount],
      [bookmarksCount],
      [wrongAnswersCount],
      [practiceQuestionsCount],
      [practiceAnswersCount],
      [sessionAnswersCount],
      [examQuestionsCount],
      [collectionItemsCount],
      [reportsCount],
      [currentAffairQuizQuestionsCount]
    ] = await Promise.all([
      db.select({ count: count() }).from(questionOptionsTable).where(eq(questionOptionsTable.questionId, questionId)),
      db.select({ count: count() }).from(bookmarksTable).where(eq(bookmarksTable.questionId, questionId)),
      db.select({ count: count() }).from(wrongAnswersTable).where(eq(wrongAnswersTable.questionId, questionId)),
      db.select({ count: count() }).from(practiceSessionQuestionsTable).where(eq(practiceSessionQuestionsTable.questionId, questionId)),
      db.select({ count: count() }).from(practiceSessionAnswersTable).where(eq(practiceSessionAnswersTable.questionId, questionId)),
      db.select({ count: count() }).from(sessionAnswersTable).where(eq(sessionAnswersTable.questionId, questionId)),
      db.select({ count: count() }).from(examQuestionsTable).where(eq(examQuestionsTable.questionId, questionId)),
      db.select({ count: count() }).from(questionCollectionItemsTable).where(eq(questionCollectionItemsTable.questionId, questionId)),
      db.select({ count: count() }).from(questionReportsTable).where(eq(questionReportsTable.questionId, questionId)),
      db.select({ count: count() }).from(currentAffairQuizQuestionsTable).where(eq(currentAffairQuizQuestionsTable.questionId, questionId))
    ]);

    const stats = {
      question_options: Number(optionsCount?.count ?? 0),
      bookmarks: Number(bookmarksCount?.count ?? 0),
      wrong_answers: Number(wrongAnswersCount?.count ?? 0),
      practice_session_questions: Number(practiceQuestionsCount?.count ?? 0),
      practice_session_answers: Number(practiceAnswersCount?.count ?? 0),
      session_answers: Number(sessionAnswersCount?.count ?? 0),
      exam_questions: Number(examQuestionsCount?.count ?? 0),
      collection_items: Number(collectionItemsCount?.count ?? 0),
      reports: Number(reportsCount?.count ?? 0),
      current_affair_quiz_questions: Number(currentAffairQuizQuestionsCount?.count ?? 0)
    };

    console.log(`question_options: ${stats.question_options}`);
    console.log(`bookmarks: ${stats.bookmarks}`);
    console.log(`wrong_answers: ${stats.wrong_answers}`);
    console.log(`practice_session_questions: ${stats.practice_session_questions}`);
    console.log(`practice_session_answers: ${stats.practice_session_answers}`);
    console.log(`session_answers: ${stats.session_answers}`);
    console.log(`exam_questions: ${stats.exam_questions}`);
    console.log(`collection_items: ${stats.collection_items}`);
    console.log(`reports: ${stats.reports}`);
    console.log(`current_affair_quiz_questions: ${stats.current_affair_quiz_questions}`);

    // Only block deletion if actual student attempt/history exists (session_answers or practice_session_answers)
    if (stats.session_answers > 0 || stats.practice_session_answers > 0) {
      res.status(409).json({ error: "This question has been used in student exam/practice history and cannot be deleted." });
      return;
    }

    let deletedCount = 0;
    
    // Wrap the entire cascade deletion inside a database transaction to preserve integrity
    try {
      console.log("Starting transaction...");
      await db.transaction(async (tx) => {
        console.log("Deleting reports...");
        await tx.delete(questionReportsTable).where(eq(questionReportsTable.questionId, questionId));

        console.log("Deleting bookmarks...");
        await tx.delete(bookmarksTable).where(eq(bookmarksTable.questionId, questionId));

        console.log("Deleting wrong answers...");
        await tx.delete(wrongAnswersTable).where(eq(wrongAnswersTable.questionId, questionId));

        console.log("Deleting collection items...");
        await tx.delete(questionCollectionItemsTable).where(eq(questionCollectionItemsTable.questionId, questionId));

        console.log("Deleting exam questions...");
        await tx.delete(examQuestionsTable).where(eq(examQuestionsTable.questionId, questionId));

        console.log("Deleting current affair quiz questions...");
        await tx.delete(currentAffairQuizQuestionsTable).where(eq(currentAffairQuizQuestionsTable.questionId, questionId));

        console.log("Deleting practice session questions...");
        await tx.delete(practiceSessionQuestionsTable).where(eq(practiceSessionQuestionsTable.questionId, questionId));

        console.log("Deleting options...");
        await tx.delete(questionOptionsTable).where(eq(questionOptionsTable.questionId, questionId));

        console.log("Deleting question...");
        const result = await tx.delete(questionsTable).where(eq(questionsTable.id, questionId)).returning();
        deletedCount = result.length;
      });
      console.log("Transaction committed.");
    } catch (txError) {
      console.error("Transaction rolled back.");
      console.error("Reason:", txError);
      throw txError;
    }

    if (deletedCount === 0) {
      res.status(404).json({ error: "Question not found" });
      return;
    }

    res.status(200).json({ success: true });
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
