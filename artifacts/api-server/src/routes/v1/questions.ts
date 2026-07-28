import { Router, type IRouter } from "express";
import {
  db,
  questionsTable,
  questionOptionsTable,
  subjectsTable,
  topicsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../../middlewares/auth";
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
  const options = await db.select().from(questionOptionsTable).where(eq(questionOptionsTable.questionId, q.id));
  const [subject] = await db.select({ name: subjectsTable.name }).from(subjectsTable).where(eq(subjectsTable.id, q.subjectId));
  const [topic] = await db.select({ name: topicsTable.name }).from(topicsTable).where(eq(topicsTable.id, q.topicId));
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

  let questions = await db.select().from(questionsTable);
  if (subjectId) questions = questions.filter(q => q.subjectId === subjectId);
  if (topicId) questions = questions.filter(q => q.topicId === topicId);
  if (difficulty) questions = questions.filter(q => q.difficulty === difficulty);
  if (type) questions = questions.filter(q => q.type === type);
  if (search) questions = questions.filter(q => q.text.toLowerCase().includes(search.toLowerCase()));

  const total = questions.length;
  const paged = questions.slice(offset, offset + limit);
  const data = await Promise.all(paged.map(buildQuestion));

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
  res.json(await buildQuestion(q));
});

router.delete("/v1/questions/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = DeleteQuestionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(questionsTable).where(eq(questionsTable.id, params.data.id));
  res.json({ message: "Question deleted" });
});

// Bulk import endpoint — accepts an array of questions and creates them all
router.post("/v1/questions/bulk", requireAdmin, async (req, res): Promise<void> => {
  const { z } = await import("zod");
  const schema = z.array(CreateQuestionBody).min(1).max(500);
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const created: unknown[] = [];
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
  }
  res.status(201).json({ created: created.length, ids: created });
});

export default router;
