import { Router, type IRouter } from "express";
import { db, notesTable, subjectsTable, examCategoriesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../../middlewares/auth";
import { ListNotesQueryParams, CreateNoteBody, GetNoteParams, DeleteNoteParams } from "@workspace/api-zod";

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

  let notes = await db.select().from(notesTable);
  if (subjectId) notes = notes.filter(n => n.subjectId === subjectId);
  if (categoryId) notes = notes.filter(n => n.categoryId === categoryId);
  const total = notes.length;
  const paged = notes.slice((page - 1) * limit, page * limit);
  const data = await Promise.all(paged.map(buildNote));

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
