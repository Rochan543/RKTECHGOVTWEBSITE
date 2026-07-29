import { Router, type IRouter } from "express";
import { db, notesTable, subjectsTable, examCategoriesTable } from "@workspace/db";
import { eq, and, desc, count } from "drizzle-orm";
import { requireAdmin } from "../../middlewares/auth";
import { ListNotesQueryParams, CreateNoteBody, GetNoteParams, DeleteNoteParams } from "@workspace/api-zod";
import { z } from "zod";
import { createNotificationForStudents, createNotificationForAdmins } from "../../lib/notifications";

const router: IRouter = Router();

async function buildNote(n: typeof notesTable.$inferSelect) {
  const subject = n.subjectId
    ? (await db.select({ name: subjectsTable.name }).from(subjectsTable).where(eq(subjectsTable.id, n.subjectId)))[0]
    : null;
  return {
    id: n.id,
    title: n.title,
    description: n.description ?? null,
    type: n.type,
    fileUrl: n.fileUrl,
    thumbnailUrl: n.thumbnailUrl ?? null,
    size: n.size,
    subjectId: n.subjectId ?? null,
    categoryId: n.categoryId ?? null,
    subjectName: subject?.name ?? null,
    downloadCount: n.downloadCount ?? 0,
    createdAt: n.createdAt,
  };
}

router.get("/v1/notes", async (req, res): Promise<void> => {
  const params = ListNotesQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const { page = 1, limit = 20, subjectId, categoryId } = params.data;
  const offset = (page - 1) * limit;

  const conditions = [];
  if (subjectId) {
    conditions.push(eq(notesTable.subjectId, subjectId));
  }
  if (categoryId) {
    conditions.push(eq(notesTable.categoryId, categoryId));
  }
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const paged = await db.select({
    id: notesTable.id,
    title: notesTable.title,
    description: notesTable.description,
    type: notesTable.type,
    fileUrl: notesTable.fileUrl,
    thumbnailUrl: notesTable.thumbnailUrl,
    size: notesTable.size,
    subjectId: notesTable.subjectId,
    categoryId: notesTable.categoryId,
    subjectName: subjectsTable.name,
    downloadCount: notesTable.downloadCount,
    createdAt: notesTable.createdAt,
  })
    .from(notesTable)
    .leftJoin(subjectsTable, eq(notesTable.subjectId, subjectsTable.id))
    .where(whereClause)
    .orderBy(desc(notesTable.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ count: total }] = await db.select({ count: count() })
    .from(notesTable)
    .where(whereClause);

  const data = paged.map(n => ({
    id: n.id,
    title: n.title,
    description: n.description ?? null,
    type: n.type,
    fileUrl: n.fileUrl,
    thumbnailUrl: n.thumbnailUrl ?? null,
    size: n.size,
    subjectId: n.subjectId ?? null,
    categoryId: n.categoryId ?? null,
    subjectName: n.subjectName ?? null,
    downloadCount: n.downloadCount ?? 0,
    createdAt: n.createdAt,
  }));

  res.json({ data, total, page, limit });
});

router.post("/v1/notes", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateNoteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [note] = await db.insert(notesTable).values({
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    type: parsed.data.type,
    fileUrl: parsed.data.fileUrl,
    thumbnailUrl: parsed.data.thumbnailUrl ?? null,
    size: parsed.data.size,
    subjectId: parsed.data.subjectId ?? null,
    categoryId: parsed.data.categoryId ?? null,
  }).returning();

  // Trigger Notifications
  await createNotificationForAdmins("New Study Material", `Study material '${note.title}' has been uploaded.`, "system");
  await createNotificationForStudents("New Study Material", `New study material '${note.title}' has been uploaded. Check it out in Study Material!`, "announcement", "/notes");

  res.status(201).json(await buildNote(note));
});

router.get("/v1/notes/:id", async (req, res): Promise<void> => {
  const params = GetNoteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [note] = await db.select().from(notesTable).where(eq(notesTable.id, params.data.id));
  if (!note) {
    res.status(404).json({ error: "Note not found" });
    return;
  }
  res.json(await buildNote(note));
});

router.put("/v1/notes/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const schema = z.object({
    title: z.string().min(1).optional(),
    description: z.string().nullish(),
    type: z.enum(["pdf", "docx", "ppt", "image", "video"]).optional(),
    fileUrl: z.string().url().optional(),
    thumbnailUrl: z.string().nullish(),
    size: z.number().optional(),
    subjectId: z.number().nullish(),
    categoryId: z.number().nullish(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const updateData: Record<string, unknown> = {};
  if (parsed.data.title != null) updateData.title = parsed.data.title;
  if (parsed.data.description !== undefined) updateData.description = parsed.data.description;
  if (parsed.data.type != null) updateData.type = parsed.data.type;
  if (parsed.data.fileUrl != null) updateData.fileUrl = parsed.data.fileUrl;
  if (parsed.data.thumbnailUrl !== undefined) updateData.thumbnailUrl = parsed.data.thumbnailUrl;
  if (parsed.data.size != null) updateData.size = parsed.data.size;
  if (parsed.data.subjectId !== undefined) updateData.subjectId = parsed.data.subjectId;
  if (parsed.data.categoryId !== undefined) updateData.categoryId = parsed.data.categoryId;
  const [note] = await db.update(notesTable).set(updateData).where(eq(notesTable.id, id)).returning();
  if (!note) { res.status(404).json({ error: "Note not found" }); return; }
  res.json(await buildNote(note));
});

router.delete("/v1/notes/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = DeleteNoteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(notesTable).where(eq(notesTable.id, params.data.id));
  res.json({ message: "Note deleted" });
});

export default router;
