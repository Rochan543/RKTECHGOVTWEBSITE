import { Router, type IRouter } from "express";
import {
  db,
  subjectsTable,
  topicsTable,
  questionsTable,
  questionOptionsTable,
  questionCollectionsTable,
  questionCollectionItemsTable,
  examsTable,
  examQuestionsTable,
} from "@workspace/db";
import { eq, and, desc, count, ilike, max, sql, inArray } from "drizzle-orm";
import { requireAdmin } from "../../middlewares/auth";

const router: IRouter = Router();

// Apply admin access check only for repository navigation routes
router.use("/v1/repository", requireAdmin);

// Helper function to fetch and format questions with options (identical to questions.ts logic)
async function formatQuestionsWithOptions(pagedResults: any[]) {
  const questionIds = pagedResults.map(r => r.question.id);
  const allOptions = questionIds.length > 0
    ? await db.select().from(questionOptionsTable).where(inArray(questionOptionsTable.questionId, questionIds))
    : [];

  return pagedResults.map(r => {
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
      updatedAt: q.updatedAt,
    };
  });
}

// ─── GET /v1/repository/summary ─────────────────────────────────────────────
router.get("/v1/repository/summary", async (req, res): Promise<void> => {
  try {
    // 1. Total counts
    const [subCount] = await db.select({ val: count() }).from(subjectsTable);
    const [topCount] = await db.select({ val: count() }).from(topicsTable);
    const [qCount] = await db.select({ val: count() }).from(questionsTable);
    const [colCount] = await db.select({ val: count() }).from(questionCollectionsTable).where(eq(questionCollectionsTable.isArchived, false));

    // 2. Recent collections (limit 5) with question count
    const collectionsRaw = await db
      .select({
        id: questionCollectionsTable.id,
        name: questionCollectionsTable.name,
        description: questionCollectionsTable.description,
        isArchived: questionCollectionsTable.isArchived,
        createdAt: questionCollectionsTable.createdAt,
        updatedAt: questionCollectionsTable.updatedAt,
        questionsCount: count(questionCollectionItemsTable.questionId),
      })
      .from(questionCollectionsTable)
      .leftJoin(
        questionCollectionItemsTable,
        eq(questionCollectionsTable.id, questionCollectionItemsTable.collectionId)
      )
      .where(eq(questionCollectionsTable.isArchived, false))
      .groupBy(questionCollectionsTable.id)
      .orderBy(desc(questionCollectionsTable.updatedAt))
      .limit(5);

    const recentCollections = collectionsRaw.map(c => ({
      ...c,
      questionsCount: Number(c.questionsCount),
    }));

    // 3. Recent questions (limit 5)
    const questionsRaw = await db
      .select({
        question: questionsTable,
        subjectName: subjectsTable.name,
        topicName: topicsTable.name,
      })
      .from(questionsTable)
      .leftJoin(subjectsTable, eq(questionsTable.subjectId, subjectsTable.id))
      .leftJoin(topicsTable, eq(questionsTable.topicId, topicsTable.id))
      .orderBy(desc(questionsTable.createdAt))
      .limit(5);

    const recentQuestions = await formatQuestionsWithOptions(questionsRaw);

    // 4. Recently updated topics (limit 5)
    const topicsRaw = await db
      .select({
        id: topicsTable.id,
        name: topicsTable.name,
        subjectId: topicsTable.subjectId,
        subjectName: subjectsTable.name,
        questionCount: count(questionsTable.id),
        lastUpdated: max(questionsTable.updatedAt),
      })
      .from(topicsTable)
      .leftJoin(subjectsTable, eq(topicsTable.subjectId, subjectsTable.id))
      .leftJoin(questionsTable, eq(questionsTable.topicId, topicsTable.id))
      .groupBy(topicsTable.id, subjectsTable.name)
      .orderBy(desc(max(questionsTable.updatedAt)))
      .limit(5);

    const recentlyUpdatedTopics = topicsRaw.map(t => ({
      id: t.id,
      name: t.name,
      subjectId: t.subjectId,
      subjectName: t.subjectName ?? "",
      questionCount: Number(t.questionCount),
      lastUpdated: (t.lastUpdated || new Date()).toISOString(),
    }));

    // 5. Recent imports simulated by grouping questions by date (truncated), subject, topic
    const importsRaw = await db
      .select({
        date: sql<string>`date_trunc('day', ${questionsTable.createdAt})::text`,
        subjectId: questionsTable.subjectId,
        subjectName: subjectsTable.name,
        topicId: questionsTable.topicId,
        topicName: topicsTable.name,
        count: count(questionsTable.id),
      })
      .from(questionsTable)
      .leftJoin(subjectsTable, eq(questionsTable.subjectId, subjectsTable.id))
      .leftJoin(topicsTable, eq(questionsTable.topicId, topicsTable.id))
      .groupBy(
        sql`date_trunc('day', ${questionsTable.createdAt})`,
        questionsTable.subjectId,
        subjectsTable.name,
        questionsTable.topicId,
        topicsTable.name
      )
      .orderBy(desc(sql`date_trunc('day', ${questionsTable.createdAt})`))
      .limit(5);

    const recentImports = importsRaw.map(imp => ({
      date: imp.date ? new Date(imp.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      subjectId: imp.subjectId,
      subjectName: imp.subjectName ?? "",
      topicId: imp.topicId,
      topicName: imp.topicName ?? "",
      count: Number(imp.count),
    }));

    res.json({
      totalSubjects: Number(subCount?.val ?? 0),
      totalTopics: Number(topCount?.val ?? 0),
      totalQuestions: Number(qCount?.val ?? 0),
      totalCollections: Number(colCount?.val ?? 0),
      recentCollections,
      recentQuestions,
      recentImports,
      recentlyUpdatedTopics,
    });
  } catch (error: any) {
    res.status(500).json({ error: "Internal Server Error", message: error.message });
  }
});

// ─── GET /v1/repository/topics/:id/summary ──────────────────────────────────
router.get("/v1/repository/topics/:id/summary", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid topic ID" });
    return;
  }

  try {
    // 1. Check if topic exists
    const [topic] = await db.select().from(topicsTable).where(eq(topicsTable.id, id));
    if (!topic) {
      res.status(404).json({ error: "Topic not found" });
      return;
    }

    // 2. Question counts
    const [qCount] = await db.select({ val: count() }).from(questionsTable).where(eq(questionsTable.topicId, id));
    const totalQuestions = Number(qCount?.val ?? 0);

    // 3. Collection count belonging to this topic (i.e. collections containing at least one question from this topic)
    const [colCount] = await db
      .select({ val: sql<number>`count(distinct ${questionCollectionsTable.id})` })
      .from(questionCollectionsTable)
      .innerJoin(
        questionCollectionItemsTable,
        eq(questionCollectionsTable.id, questionCollectionItemsTable.collectionId)
      )
      .innerJoin(
        questionsTable,
        eq(questionCollectionItemsTable.questionId, questionsTable.id)
      )
      .where(eq(questionsTable.topicId, id));

    const totalCollections = Number(colCount?.val ?? 0);

    // 4. Published Questions: Linked to an exam that is published
    const [pubCount] = await db
      .select({ val: sql<number>`count(distinct ${questionsTable.id})` })
      .from(questionsTable)
      .innerJoin(
        examQuestionsTable,
        eq(questionsTable.id, examQuestionsTable.questionId)
      )
      .innerJoin(
        examsTable,
        eq(examQuestionsTable.examId, examsTable.id)
      )
      .where(
        and(
          eq(questionsTable.topicId, id),
          eq(examsTable.status, "published")
        )
      );

    const publishedQuestions = Number(pubCount?.val ?? 0);
    const draftQuestions = Math.max(0, totalQuestions - publishedQuestions);

    // 5. Difficulty breakdown
    const [easyCountRaw] = await db.select({ val: count() }).from(questionsTable).where(and(eq(questionsTable.topicId, id), eq(questionsTable.difficulty, "easy")));
    const [mediumCountRaw] = await db.select({ val: count() }).from(questionsTable).where(and(eq(questionsTable.topicId, id), eq(questionsTable.difficulty, "medium")));
    const [hardCountRaw] = await db.select({ val: count() }).from(questionsTable).where(and(eq(questionsTable.topicId, id), eq(questionsTable.difficulty, "hard")));

    const easyCount = Number(easyCountRaw?.val ?? 0);
    const mediumCount = Number(mediumCountRaw?.val ?? 0);
    const hardCount = Number(hardCountRaw?.val ?? 0);

    // 6. Recent questions added to this topic
    const recentQRaw = await db
      .select({
        question: questionsTable,
        subjectName: subjectsTable.name,
        topicName: topicsTable.name,
      })
      .from(questionsTable)
      .leftJoin(subjectsTable, eq(questionsTable.subjectId, subjectsTable.id))
      .leftJoin(topicsTable, eq(questionsTable.topicId, topicsTable.id))
      .where(eq(questionsTable.topicId, id))
      .orderBy(desc(questionsTable.createdAt))
      .limit(5);

    const recentQuestions = await formatQuestionsWithOptions(recentQRaw);

    // 7. Recent updates to questions in this topic
    const recentUpdRaw = await db
      .select({
        question: questionsTable,
        subjectName: subjectsTable.name,
        topicName: topicsTable.name,
      })
      .from(questionsTable)
      .leftJoin(subjectsTable, eq(questionsTable.subjectId, subjectsTable.id))
      .leftJoin(topicsTable, eq(questionsTable.topicId, topicsTable.id))
      .where(eq(questionsTable.topicId, id))
      .orderBy(desc(questionsTable.updatedAt))
      .limit(5);

    const recentUpdates = await formatQuestionsWithOptions(recentUpdRaw);

    res.json({
      totalQuestions,
      totalCollections,
      publishedQuestions,
      draftQuestions,
      easyCount,
      mediumCount,
      hardCount,
      recentQuestions,
      recentUpdates,
    });
  } catch (error: any) {
    res.status(500).json({ error: "Internal Server Error", message: error.message });
  }
});

// ─── GET /v1/repository/search ──────────────────────────────────────────────
router.get("/v1/repository/search", async (req, res): Promise<void> => {
  const queryParam = req.query.query;
  if (!queryParam || typeof queryParam !== "string" || !queryParam.trim()) {
    res.json({ subjects: [], topics: [], collections: [], questions: [] });
    return;
  }

  const query = queryParam.trim();
  const searchPattern = `%${query}%`;

  try {
    // Run searches in parallel
    const [subjectsRaw, topicsRaw, collectionsRaw, questionsRaw] = await Promise.all([
      // A. Search subjects
      db
        .select({
          id: subjectsTable.id,
          name: subjectsTable.name,
          description: subjectsTable.description,
          iconUrl: subjectsTable.iconUrl,
          questionCount: count(questionsTable.id),
        })
        .from(subjectsTable)
        .leftJoin(questionsTable, eq(questionsTable.subjectId, subjectsTable.id))
        .where(ilike(subjectsTable.name, searchPattern))
        .groupBy(subjectsTable.id)
        .limit(10),

      // B. Search topics
      db
        .select({
          id: topicsTable.id,
          name: topicsTable.name,
          subjectId: topicsTable.subjectId,
          subjectName: subjectsTable.name,
          questionCount: count(questionsTable.id),
        })
        .from(topicsTable)
        .leftJoin(subjectsTable, eq(topicsTable.subjectId, subjectsTable.id))
        .leftJoin(questionsTable, eq(questionsTable.topicId, topicsTable.id))
        .where(ilike(topicsTable.name, searchPattern))
        .groupBy(topicsTable.id, subjectsTable.name)
        .limit(10),

      // C. Search collections
      db
        .select({
          id: questionCollectionsTable.id,
          name: questionCollectionsTable.name,
          description: questionCollectionsTable.description,
          isArchived: questionCollectionsTable.isArchived,
          createdAt: questionCollectionsTable.createdAt,
          updatedAt: questionCollectionsTable.updatedAt,
          questionsCount: count(questionCollectionItemsTable.questionId),
        })
        .from(questionCollectionsTable)
        .leftJoin(
          questionCollectionItemsTable,
          eq(questionCollectionsTable.id, questionCollectionItemsTable.collectionId)
        )
        .where(
          and(
            eq(questionCollectionsTable.isArchived, false),
            ilike(questionCollectionsTable.name, searchPattern)
          )
        )
        .groupBy(questionCollectionsTable.id)
        .limit(10),

      // D. Search questions
      db
        .select({
          question: questionsTable,
          subjectName: subjectsTable.name,
          topicName: topicsTable.name,
        })
        .from(questionsTable)
        .leftJoin(subjectsTable, eq(questionsTable.subjectId, subjectsTable.id))
        .leftJoin(topicsTable, eq(questionsTable.topicId, topicsTable.id))
        .where(ilike(questionsTable.text, searchPattern))
        .limit(10),
    ]);

    const subjects = subjectsRaw.map(s => ({
      ...s,
      description: s.description ?? null,
      iconUrl: s.iconUrl ?? null,
      questionCount: Number(s.questionCount),
    }));

    const topics = topicsRaw.map(t => ({
      ...t,
      subjectName: t.subjectName ?? "",
      questionCount: Number(t.questionCount),
    }));

    const collections = collectionsRaw.map(c => ({
      ...c,
      questionsCount: Number(c.questionsCount),
    }));

    const questions = await formatQuestionsWithOptions(questionsRaw);

    res.json({
      subjects,
      topics,
      collections,
      questions,
    });
  } catch (error: any) {
    res.status(500).json({ error: "Internal Server Error", message: error.message });
  }
});

export default router;
