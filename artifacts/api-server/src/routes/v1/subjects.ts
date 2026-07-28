import { Router, type IRouter } from "express";
import { db, subjectsTable, topicsTable, questionsTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import { requireAdmin } from "../../middlewares/auth";
import { CreateSubjectBody, CreateTopicBody, ListTopicsQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/v1/subjects", async (_req, res): Promise<void> => {
  const subjects = await db.select().from(subjectsTable);
  const result = await Promise.all(subjects.map(async (s) => {
    const [qCount] = await db.select({ count: count() }).from(questionsTable).where(eq(questionsTable.subjectId, s.id));
    return {
      id: s.id,
      name: s.name,
      description: s.description ?? null,
      iconUrl: s.iconUrl ?? null,
      questionCount: qCount?.count ?? 0,
    };
  }));
  res.json(result);
});

router.post("/v1/subjects", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateSubjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [subject] = await db.insert(subjectsTable).values(parsed.data).returning();
  res.status(201).json({ ...subject, questionCount: 0 });
});

router.get("/v1/topics", async (req, res): Promise<void> => {
  const params = ListTopicsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const allTopics = await db.select().from(topicsTable);
  const filtered = params.data.subjectId
    ? allTopics.filter(t => t.subjectId === params.data.subjectId)
    : allTopics;

  const result = await Promise.all(filtered.map(async (t) => {
    const [qCount] = await db.select({ count: count() }).from(questionsTable).where(eq(questionsTable.topicId, t.id));
    const [subject] = await db.select({ name: subjectsTable.name }).from(subjectsTable).where(eq(subjectsTable.id, t.subjectId));
    return {
      id: t.id,
      name: t.name,
      subjectId: t.subjectId,
      subjectName: subject?.name ?? "",
      questionCount: qCount?.count ?? 0,
    };
  }));

  res.json(result);
});

router.post("/v1/topics", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateTopicBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [topic] = await db.insert(topicsTable).values(parsed.data).returning();
  const [subject] = await db.select({ name: subjectsTable.name }).from(subjectsTable).where(eq(subjectsTable.id, topic.subjectId));
  res.status(201).json({ ...topic, subjectName: subject?.name ?? "", questionCount: 0 });
});

export default router;
