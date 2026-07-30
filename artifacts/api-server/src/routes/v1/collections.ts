import { Router, type IRouter } from "express";
import {
  db,
  questionCollectionsTable,
  questionCollectionItemsTable,
  questionsTable,
  questionOptionsTable,
  subjectsTable,
  topicsTable,
} from "@workspace/db";
import { eq, and, ilike, count, inArray, asc, desc, sql } from "drizzle-orm";
import { requireAdmin } from "../../middlewares/auth";
import {
  ListCollectionsQueryParams,
  CreateCollectionBody,
  UpdateCollectionBody,
  UpdateCollectionItemsBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

// Apply requireAdmin middleware only to collections endpoints in this router
router.use("/v1/collections", requireAdmin);

// ─── List Collections ────────────────────────────────────────────────────────
router.get("/v1/collections", async (req, res): Promise<void> => {
  const params = ListCollectionsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const {
    page = 1,
    limit = 20,
    search,
    isArchived,
    subjectId,
    topicId,
    difficulty,
    collectionType,
    status,
    sortBy,
    questionCountRange,
  } = params.data;
  const offset = (page - 1) * limit;

  const conditions = [];

  // status filter maps to isArchived
  if (status) {
    if (status === "archived") {
      conditions.push(eq(questionCollectionsTable.isArchived, true));
    } else if (status === "published" || status === "active") {
      conditions.push(eq(questionCollectionsTable.isArchived, false));
    }
  } else if (typeof isArchived === "boolean") {
    conditions.push(eq(questionCollectionsTable.isArchived, isArchived));
  }

  if (search) {
    conditions.push(ilike(questionCollectionsTable.name, `%${search}%`));
  }

  if (subjectId) {
    conditions.push(sql`EXISTS (
      SELECT 1 FROM ${questionCollectionItemsTable} ci
      JOIN ${questionsTable} q ON ci.question_id = q.id
      WHERE ci.collection_id = ${questionCollectionsTable.id} AND q.subject_id = ${subjectId}
    )`);
  }

  if (topicId) {
    conditions.push(sql`EXISTS (
      SELECT 1 FROM ${questionCollectionItemsTable} ci
      JOIN ${questionsTable} q ON ci.question_id = q.id
      WHERE ci.collection_id = ${questionCollectionsTable.id} AND q.topic_id = ${topicId}
    )`);
  }

  if (difficulty) {
    conditions.push(sql`EXISTS (
      SELECT 1 FROM ${questionCollectionItemsTable} ci
      JOIN ${questionsTable} q ON ci.question_id = q.id
      WHERE ci.collection_id = ${questionCollectionsTable.id} AND q.difficulty = ${difficulty}
    )`);
  }

  if (collectionType) {
    const typeLower = collectionType.toLowerCase();
    if (typeLower === "pyq") {
      conditions.push(sql`(${questionCollectionsTable.name} ILIKE '%pyq%' OR ${questionCollectionsTable.name} ILIKE '%previous year%')`);
    } else if (typeLower === "practice" || typeLower === "practice_set") {
      conditions.push(sql`(${questionCollectionsTable.name} ILIKE '%practice%' OR ${questionCollectionsTable.name} ILIKE '%set%')`);
    } else if (typeLower === "quiz") {
      conditions.push(sql`(${questionCollectionsTable.name} ILIKE '%quiz%')`);
    }
  }

  if (questionCountRange) {
    if (questionCountRange === "small") {
      conditions.push(sql`(SELECT COUNT(*) FROM ${questionCollectionItemsTable} ci WHERE ci.collection_id = ${questionCollectionsTable.id}) < 10`);
    } else if (questionCountRange === "medium") {
      conditions.push(sql`(SELECT COUNT(*) FROM ${questionCollectionItemsTable} ci WHERE ci.collection_id = ${questionCollectionsTable.id}) BETWEEN 10 AND 50`);
    } else if (questionCountRange === "large") {
      conditions.push(sql`(SELECT COUNT(*) FROM ${questionCollectionItemsTable} ci WHERE ci.collection_id = ${questionCollectionsTable.id}) > 50`);
    }
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Get total count
  const [countResult] = await db
    .select({ val: count() })
    .from(questionCollectionsTable)
    .where(whereClause);
  const total = Number(countResult?.val ?? 0);

  // Sorting
  let orderByClause = asc(questionCollectionsTable.name);
  if (sortBy) {
    if (sortBy === "newest") {
      orderByClause = desc(questionCollectionsTable.createdAt);
    } else if (sortBy === "oldest") {
      orderByClause = asc(questionCollectionsTable.createdAt);
    } else if (sortBy === "name_desc") {
      orderByClause = desc(questionCollectionsTable.name);
    } else if (sortBy === "name_asc") {
      orderByClause = asc(questionCollectionsTable.name);
    }
  }

  // Get paginated collections with questions count
  const results = await db
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
    .where(whereClause)
    .groupBy(questionCollectionsTable.id)
    .limit(limit)
    .offset(offset)
    .orderBy(orderByClause);

  res.json({
    data: results.map((r) => ({
      ...r,
      questionsCount: Number(r.questionsCount),
    })),
    total,
    page,
    limit,
  });
});

// ─── Create Collection ───────────────────────────────────────────────────────
router.post("/v1/collections", async (req, res): Promise<void> => {
  const parsed = CreateCollectionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [inserted] = await db
    .insert(questionCollectionsTable)
    .values({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
    })
    .returning();

  res.status(201).json({
    ...inserted,
    questionsCount: 0,
  });
});

// ─── Get Collection Details ──────────────────────────────────────────────────
router.get("/v1/collections/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid collection ID" });
    return;
  }

  const [collection] = await db
    .select()
    .from(questionCollectionsTable)
    .where(eq(questionCollectionsTable.id, id));

  if (!collection) {
    res.status(404).json({ error: "Collection not found" });
    return;
  }

  // Fetch items ordered by "order" field
  const items = await db
    .select({
      question: questionsTable,
      order: questionCollectionItemsTable.order,
      subjectName: subjectsTable.name,
      topicName: topicsTable.name,
    })
    .from(questionCollectionItemsTable)
    .innerJoin(
      questionsTable,
      eq(questionCollectionItemsTable.questionId, questionsTable.id)
    )
    .leftJoin(subjectsTable, eq(questionsTable.subjectId, subjectsTable.id))
    .leftJoin(topicsTable, eq(questionsTable.topicId, topicsTable.id))
    .where(eq(questionCollectionItemsTable.collectionId, id))
    .orderBy(asc(questionCollectionItemsTable.order));

  const questionIds = items.map((i) => i.question.id);
  const allOptions =
    questionIds.length > 0
      ? await db
          .select()
          .from(questionOptionsTable)
          .where(inArray(questionOptionsTable.questionId, questionIds))
      : [];

  const questions = items.map((item) => {
    const q = item.question;
    const options = allOptions
      .filter((o) => o.questionId === q.id)
      .map((o) => ({ id: o.id, text: o.text, isCorrect: o.isCorrect }));
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
      subjectName: item.subjectName ?? null,
      topicName: item.topicName ?? null,
      options,
      order: item.order,
      createdAt: q.createdAt,
    };
  });

  res.json({
    ...collection,
    questionsCount: questions.length,
    questions,
  });
});

// ─── Update Collection ───────────────────────────────────────────────────────
router.put("/v1/collections/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid collection ID" });
    return;
  }

  const parsed = UpdateCollectionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, any> = {};
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.description !== undefined) {
    updateData.description = parsed.data.description;
  }
  if (parsed.data.isArchived !== undefined) {
    updateData.isArchived = parsed.data.isArchived;
  }

  const [updated] = await db
    .update(questionCollectionsTable)
    .set(updateData)
    .where(eq(questionCollectionsTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Collection not found" });
    return;
  }

  // Get current questions count
  const [countResult] = await db
    .select({ val: count() })
    .from(questionCollectionItemsTable)
    .where(eq(questionCollectionItemsTable.collectionId, id));

  res.json({
    ...updated,
    questionsCount: Number(countResult?.val ?? 0),
  });
});

// ─── Delete Collection ───────────────────────────────────────────────────────
router.delete("/v1/collections/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid collection ID" });
    return;
  }

  const [deleted] = await db
    .delete(questionCollectionsTable)
    .where(eq(questionCollectionsTable.id, id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Collection not found" });
    return;
  }

  res.json({ message: "Collection deleted successfully" });
});

// ─── Update/Set Questions (Items) in Collection ──────────────────────────────
router.post("/v1/collections/:id/items", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid collection ID" });
    return;
  }

  const parsed = UpdateCollectionItemsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { questionIds } = parsed.data;

  // Verify collection exists
  const [collection] = await db
    .select()
    .from(questionCollectionsTable)
    .where(eq(questionCollectionsTable.id, id));

  if (!collection) {
    res.status(404).json({ error: "Collection not found" });
    return;
  }

  // Delete all existing items
  await db
    .delete(questionCollectionItemsTable)
    .where(eq(questionCollectionItemsTable.collectionId, id));

  if (questionIds.length > 0) {
    // Insert new items with sequentially assigned order
    const valuesToInsert = questionIds.map((qId: number, idx: number) => ({
      collectionId: id,
      questionId: qId,
      order: idx + 1,
    }));

    await db.insert(questionCollectionItemsTable).values(valuesToInsert);
  }

  res.json({
    message: "Collection items updated successfully",
    count: questionIds.length,
  });
});

// ─── Duplicate Collection ────────────────────────────────────────────────────
router.post("/v1/collections/:id/duplicate", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid collection ID" });
    return;
  }

  const [source] = await db
    .select()
    .from(questionCollectionsTable)
    .where(eq(questionCollectionsTable.id, id));

  if (!source) {
    res.status(404).json({ error: "Collection not found" });
    return;
  }

  // Insert a copy metadata
  const [duplicated] = await db
    .insert(questionCollectionsTable)
    .values({
      name: `Copy of ${source.name}`,
      description: source.description,
    })
    .returning();

  // Retrieve source items
  const items = await db
    .select()
    .from(questionCollectionItemsTable)
    .where(eq(questionCollectionItemsTable.collectionId, id))
    .orderBy(asc(questionCollectionItemsTable.order));

  if (items.length > 0) {
    const valuesToInsert = items.map((item) => ({
      collectionId: duplicated.id,
      questionId: item.questionId,
      order: item.order,
    }));

    await db.insert(questionCollectionItemsTable).values(valuesToInsert);
  }

  res.status(201).json({
    ...duplicated,
    questionsCount: items.length,
  });
});

// ─── Archive/Unarchive Collection ────────────────────────────────────────────
router.post("/v1/collections/:id/archive", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid collection ID" });
    return;
  }

  const [source] = await db
    .select()
    .from(questionCollectionsTable)
    .where(eq(questionCollectionsTable.id, id));

  if (!source) {
    res.status(404).json({ error: "Collection not found" });
    return;
  }

  // Toggle archive status
  const [updated] = await db
    .update(questionCollectionsTable)
    .set({ isArchived: !source.isArchived })
    .where(eq(questionCollectionsTable.id, id))
    .returning();

  // Get count
  const [countResult] = await db
    .select({ val: count() })
    .from(questionCollectionItemsTable)
    .where(eq(questionCollectionItemsTable.collectionId, id));

  res.json({
    ...updated,
    questionsCount: Number(countResult?.val ?? 0),
  });
});

// ─── Get Collection Questions ────────────────────────────────────────────────
router.get("/v1/collections/:id/questions", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid collection ID" });
    return;
  }

  // Fetch items ordered by "order" field
  const items = await db
    .select({
      question: questionsTable,
      order: questionCollectionItemsTable.order,
      subjectName: subjectsTable.name,
      topicName: topicsTable.name,
    })
    .from(questionCollectionItemsTable)
    .innerJoin(
      questionsTable,
      eq(questionCollectionItemsTable.questionId, questionsTable.id)
    )
    .leftJoin(subjectsTable, eq(questionsTable.subjectId, subjectsTable.id))
    .leftJoin(topicsTable, eq(questionsTable.topicId, topicsTable.id))
    .where(eq(questionCollectionItemsTable.collectionId, id))
    .orderBy(asc(questionCollectionItemsTable.order));

  const questionIds = items.map((i) => i.question.id);
  const allOptions =
    questionIds.length > 0
      ? await db
          .select()
          .from(questionOptionsTable)
          .where(inArray(questionOptionsTable.questionId, questionIds))
      : [];

  const questions = items.map((item) => {
    const q = item.question;
    const options = allOptions
      .filter((o) => o.questionId === q.id)
      .map((o) => ({ id: o.id, text: o.text, isCorrect: o.isCorrect }));
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
      subjectName: item.subjectName ?? null,
      topicName: item.topicName ?? null,
      options,
      order: item.order,
      createdAt: q.createdAt,
    };
  });

  res.json(questions);
});

export default router;
