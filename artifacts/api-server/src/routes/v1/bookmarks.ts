import { Router, type IRouter } from "express";
import { db, bookmarksTable, questionsTable, questionOptionsTable, subjectsTable, topicsTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../../middlewares/auth";
import { z } from "zod";

const router: IRouter = Router();

const AddBookmarkBody = z.object({ questionId: z.number().int().positive() });
const RemoveBookmarkParams = z.object({ questionId: z.coerce.number().int().positive() });

router.get("/v1/bookmarks", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const userId = req.userId!;
  const bookmarks = await db.select({
    bookmarkId: bookmarksTable.id,
    bookmarkedAt: bookmarksTable.createdAt,
    questionId: questionsTable.id,
    questionText: questionsTable.text,
    questionType: questionsTable.type,
    questionDifficulty: questionsTable.difficulty,
    questionExplanation: questionsTable.explanation,
    questionHint: questionsTable.hint,
    questionImageUrl: questionsTable.imageUrl,
    questionPositiveMarks: questionsTable.positiveMarks,
    questionNegativeMarks: questionsTable.negativeMarks,
    subjectName: subjectsTable.name,
    topicName: topicsTable.name,
  })
    .from(bookmarksTable)
    .innerJoin(questionsTable, eq(bookmarksTable.questionId, questionsTable.id))
    .leftJoin(subjectsTable, eq(questionsTable.subjectId, subjectsTable.id))
    .leftJoin(topicsTable, eq(questionsTable.topicId, topicsTable.id))
    .where(eq(bookmarksTable.userId, userId));

  const questionIds = bookmarks.map(b => b.questionId);
  const optionsList = questionIds.length > 0
    ? await db.select().from(questionOptionsTable).where(inArray(questionOptionsTable.questionId, questionIds))
    : [];

  const optionsMap = new Map<number, typeof questionOptionsTable.$inferSelect[]>();
  for (const o of optionsList) {
    if (!optionsMap.has(o.questionId)) {
      optionsMap.set(o.questionId, []);
    }
    optionsMap.get(o.questionId)!.push(o);
  }

  const result = bookmarks.map((b) => {
    const options = optionsMap.get(b.questionId) ?? [];
    return {
      bookmarkId: b.bookmarkId,
      bookmarkedAt: b.bookmarkedAt,
      question: {
        id: b.questionId,
        text: b.questionText,
        type: b.questionType,
        difficulty: b.questionDifficulty,
        explanation: b.questionExplanation ?? null,
        hint: b.questionHint ?? null,
        imageUrl: b.questionImageUrl ?? null,
        positiveMarks: b.questionPositiveMarks,
        negativeMarks: b.questionNegativeMarks,
        subjectName: b.subjectName ?? null,
        topicName: b.topicName ?? null,
        options: options.map(o => ({ id: o.id, text: o.text, isCorrect: o.isCorrect })),
      },
    };
  });

  res.json(result);
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
