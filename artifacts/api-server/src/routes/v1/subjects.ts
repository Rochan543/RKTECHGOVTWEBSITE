import { Router, type IRouter } from "express";
import { db, subjectsTable, topicsTable, questionsTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import { requireAdmin } from "../../middlewares/auth";
import { CreateSubjectBody, CreateTopicBody, ListTopicsQueryParams } from "@workspace/api-zod";
import { z } from "zod";
import { createNotificationForStudents, createNotificationForAdmins } from "../../lib/notifications";

const router: IRouter = Router();

router.get("/v1/subjects", async (_req, res): Promise<void> => {
  const { count: countFn, eq } = await import("drizzle-orm");
  const subjects = await db
    .select({
      id: subjectsTable.id,
      name: subjectsTable.name,
      description: subjectsTable.description,
      iconUrl: subjectsTable.iconUrl,
      questionCount: countFn(questionsTable.id),
    })
    .from(subjectsTable)
    .leftJoin(questionsTable, eq(questionsTable.subjectId, subjectsTable.id))
    .groupBy(subjectsTable.id);

  const result = subjects.map(s => ({
    id: s.id,
    name: s.name,
    description: s.description ?? null,
    iconUrl: s.iconUrl ?? null,
    questionCount: Number(s.questionCount ?? 0),
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
  await createNotificationForAdmins("New Subject Added", `Subject '${subject.name}' has been created.`, "system");
  await createNotificationForStudents("New Subject Available", `A new subject '${subject.name}' is now available for practice.`, "announcement", "/practice");
  res.status(201).json({ ...subject, questionCount: 0 });
});

router.put("/v1/subjects/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const schema = z.object({ name: z.string().min(1), description: z.string().nullish() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [subject] = await db.update(subjectsTable)
    .set({ name: parsed.data.name, description: parsed.data.description ?? null })
    .where(eq(subjectsTable.id, id)).returning();
  if (!subject) { res.status(404).json({ error: "Subject not found" }); return; }
  const [qCount] = await db.select({ count: count() }).from(questionsTable).where(eq(questionsTable.subjectId, id));
  res.json({ ...subject, questionCount: qCount?.count ?? 0 });
});

router.delete("/v1/subjects/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  await db.delete(subjectsTable).where(eq(subjectsTable.id, id));
  res.json({ message: "Subject deleted" });
});

router.get("/v1/topics", async (req, res): Promise<void> => {
  const params = ListTopicsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const subjectId = params.data.subjectId;
  const { count: countFn, eq } = await import("drizzle-orm");

  const query = db
    .select({
      id: topicsTable.id,
      name: topicsTable.name,
      subjectId: topicsTable.subjectId,
      subjectName: subjectsTable.name,
      questionCount: countFn(questionsTable.id),
    })
    .from(topicsTable)
    .leftJoin(subjectsTable, eq(topicsTable.subjectId, subjectsTable.id))
    .leftJoin(questionsTable, eq(questionsTable.topicId, topicsTable.id))
    .groupBy(topicsTable.id, subjectsTable.name);

  const topicsResult = subjectId
    ? await query.where(eq(topicsTable.subjectId, subjectId))
    : await query;

  const result = topicsResult.map(t => ({
    id: t.id,
    name: t.name,
    subjectId: t.subjectId,
    subjectName: t.subjectName ?? "",
    questionCount: Number(t.questionCount ?? 0),
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
  await createNotificationForAdmins("New Topic Added", `Topic '${topic.name}' has been created under Subject '${subject?.name ?? ""}'.`, "system");
  await createNotificationForStudents("New Topic Added", `A new topic '${topic.name}' has been added under Subject '${subject?.name ?? ""}'.`, "announcement", "/practice");
  res.status(201).json({ ...topic, subjectName: subject?.name ?? "", questionCount: 0 });
});

router.put("/v1/topics/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const schema = z.object({ name: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [topic] = await db.update(topicsTable).set({ name: parsed.data.name }).where(eq(topicsTable.id, id)).returning();
  if (!topic) { res.status(404).json({ error: "Topic not found" }); return; }
  const [subject] = await db.select({ name: subjectsTable.name }).from(subjectsTable).where(eq(subjectsTable.id, topic.subjectId));
  const [qCount] = await db.select({ count: count() }).from(questionsTable).where(eq(questionsTable.topicId, id));
  res.json({ ...topic, subjectName: subject?.name ?? "", questionCount: qCount?.count ?? 0 });
});

router.delete("/v1/topics/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  await db.delete(topicsTable).where(eq(topicsTable.id, id));
  res.json({ message: "Topic deleted" });
});

export default router;
