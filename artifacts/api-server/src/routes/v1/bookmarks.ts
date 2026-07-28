import { Router, type IRouter } from "express";
import { db, bookmarksTable, questionsTable, questionOptionsTable, subjectsTable, topicsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../../middlewares/auth";
import { z } from "zod";

const router: IRouter = Router();

const AddBookmarkBody = z.object({ questionId: z.number().int().positive() });
const RemoveBookmarkParams = z.object({ questionId: z.coerce.number().int().positive() });

router.get("/v1/bookmarks", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const userId = req.userId!;
  const bookmarks = await db.select().from(bookmarksTable).where(eq(bookmarksTable.userId, userId));

  const result = await Promise.all(bookmarks.map(async (b) => {
    const [q] = await db.select().from(questionsTable).where(eq(questionsTable.id, b.questionId));
    if (!q) return null;
    const options = await db.select().from(questionOptionsTable).where(eq(questionOptionsTable.questionId, q.id));
    const [subject] = await db.select({ name: subjectsTable.name }).from(subjectsTable).where(eq(subjectsTable.id, q.subjectId));
    const [topic] = await db.select({ name: topicsTable.name }).from(topicsTable).where(eq(topicsTable.id, q.topicId));
    return {
      bookmarkId: b.id,
      bookmarkedAt: b.createdAt,
      question: {
        id: q.id,
        text: q.text,
        type: q.type,
        difficulty: q.difficulty,
        explanation: q.explanation ?? null,
        hint: q.hint ?? null,
        imageUrl: q.imageUrl ?? null,
        positiveMarks: q.positiveMarks,
        negativeMarks: q.negativeMarks,
        subjectName: subject?.name ?? null,
        topicName: topic?.name ?? null,
        options: options.map(o => ({ id: o.id, text: o.text, isCorrect: o.isCorrect })),
      },
    };
  }));

  res.json(result.filter(Boolean));
});

router.post("/v1/bookmarks", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const parsed = AddBookmarkBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const userId = req.userId!;
  const { questionId } = parsed.data;

  const existing = await db.select().from(bookmarksTable)
    .where(and(eq(bookmarksTable.userId, userId), eq(bookmarksTable.questionId, questionId)));
  if (existing.length > 0) {
    res.status(409).json({ error: "Already bookmarked" });
    return;
  }

  const [bookmark] = await db.insert(bookmarksTable).values({ userId, questionId }).returning();
  res.status(201).json({ id: bookmark.id, questionId, bookmarkedAt: bookmark.createdAt });
});

router.delete("/v1/bookmarks/:questionId", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const parsed = RemoveBookmarkParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid questionId" });
    return;
  }
  const userId = req.userId!;
  await db.delete(bookmarksTable)
    .where(and(eq(bookmarksTable.userId, userId), eq(bookmarksTable.questionId, parsed.data.questionId)));
  res.json({ message: "Bookmark removed" });
});

export default router;
