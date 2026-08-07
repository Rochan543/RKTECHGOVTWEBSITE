import { Router, type IRouter } from "express";
import {
  db,
  examsTable,
  examCategoriesTable,
  examSectionsTable,
  examQuestionsTable,
  testSessionsTable,
  resultsTable,
  notificationsTable,
  examCollectionsTable,
  questionCollectionsTable,
  questionCollectionItemsTable,
  questionsTable,
  questionOptionsTable,
  subjectsTable,
  topicsTable,
} from "@workspace/db";
import { eq, count, desc, and, inArray, sql, asc } from "drizzle-orm";
import { requireAdmin, type AuthRequest } from "../../middlewares/auth";
import { verifyToken } from "../../middlewares/auth";
import { usersTable } from "@workspace/db";
import { createNotificationForStudents, createNotificationForAdmins } from "../../lib/notifications";
import { logger } from "../../lib/logger";
import {
  ListExamsQueryParams,
  CreateExamBody,
  GetExamParams,
  UpdateExamBody,
  UpdateExamParams,
  DeleteExamParams,
  GetExamStatsParams,
} from "@workspace/api-zod";
import type { Request, Response, NextFunction } from "express";

const router: IRouter = Router();

// Optional auth — populates req.userId/userRole if a valid token is present, but never blocks
async function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const token = authHeader.slice(7);
      const payload = verifyToken(token);
      if (payload && typeof payload.userId === "number") {
        const [user] = await db
          .select({ role: usersTable.role, status: usersTable.status })
          .from(usersTable)
          .where(eq(usersTable.id, payload.userId as number));
        if (user && user.status !== "suspended") {
          req.userId = payload.userId as number;
          req.userRole = user.role;
        }
      }
    } catch { /* ignore */ }
  }
  next();
}

router.get("/v1/exams", optionalAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = ListExamsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const { page = 1, limit = 20, categoryId, type, status } = params.data;
  const offset = (page - 1) * limit;

  const isAdmin = req.userRole === "admin" || req.userRole === "super_admin";

  const conditions = [];
  if (status) {
    conditions.push(eq(examsTable.status, status));
  } else if (!isAdmin) {
    conditions.push(eq(examsTable.status, "published"));
  }
  if (categoryId) {
    conditions.push(eq(examsTable.categoryId, categoryId));
  }
  if (type) {
    conditions.push(eq(examsTable.type, type));
  }
  
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const paged = await db.select({
    id: examsTable.id,
    title: examsTable.title,
    description: examsTable.description,
    type: examsTable.type,
    status: examsTable.status,
    durationMinutes: examsTable.durationMinutes,
    totalMarks: examsTable.totalMarks,
    positiveMarks: examsTable.positiveMarks,
    negativeMarks: examsTable.negativeMarks,
    categoryId: examsTable.categoryId,
    categoryName: examCategoriesTable.name,
    createdAt: examsTable.createdAt,
  })
    .from(examsTable)
    .leftJoin(examCategoriesTable, eq(examsTable.categoryId, examCategoriesTable.id))
    .where(whereClause)
    .orderBy(desc(examsTable.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ count: total }] = await db.select({ count: count() })
    .from(examsTable)
    .where(whereClause);

  const examIds = paged.map(e => e.id);

  const qCounts = examIds.length > 0
    ? await db.select({ examId: examQuestionsTable.examId, count: count() })
        .from(examQuestionsTable)
        .where(inArray(examQuestionsTable.examId, examIds))
        .groupBy(examQuestionsTable.examId)
    : [];
  const qCountMap = new Map(qCounts.map(q => [q.examId, Number(q.count)]));

  const aCounts = examIds.length > 0
    ? await db.select({ examId: testSessionsTable.examId, count: count() })
        .from(testSessionsTable)
        .where(inArray(testSessionsTable.examId, examIds))
        .groupBy(testSessionsTable.examId)
    : [];
  const aCountMap = new Map(aCounts.map(a => [a.examId, a.count]));

  const data = paged.map((exam) => ({
    id: exam.id,
    title: exam.title,
    description: exam.description ?? null,
    type: exam.type,
    status: exam.status,
    durationMinutes: exam.durationMinutes,
    totalMarks: exam.totalMarks,
    totalQuestions: qCountMap.get(exam.id) ?? 0,
    positiveMarks: exam.positiveMarks,
    negativeMarks: exam.negativeMarks,
    categoryId: exam.categoryId ?? null,
    categoryName: exam.categoryName ?? null,
    attemptCount: aCountMap.get(exam.id) ?? 0,
    averageScore: null,
    createdAt: exam.createdAt,
  }));

  res.json({ data, total, page, limit });
});

router.post("/v1/exams", requireAdmin, async (req, res): Promise<void> => {
  const { sections, questionTimerSeconds, autoSubmit, autoSave, ...bodyRest } = req.body;
  const parsed = CreateExamBody.safeParse(bodyRest);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [exam] = await db.insert(examsTable).values({
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    type: parsed.data.type,
    durationMinutes: parsed.data.durationMinutes,
    totalMarks: parsed.data.totalMarks,
    positiveMarks: parsed.data.positiveMarks,
    negativeMarks: parsed.data.negativeMarks,
    categoryId: parsed.data.categoryId ?? null,
    status: parsed.data.status ?? "draft",
    scheduledAt: parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : null,
    endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
    timezone: parsed.data.timezone ?? "UTC",
    questionTimerSeconds: questionTimerSeconds ? parseInt(questionTimerSeconds) : null,
    autoSubmit: autoSubmit !== false,
    autoSave: autoSave !== false,
  }).returning();

  if (Array.isArray(sections)) {
    for (const sec of sections) {
      await db.insert(examSectionsTable).values({
        examId: exam.id,
        name: sec.name,
        durationMinutes: sec.durationMinutes ? parseInt(sec.durationMinutes) : null,
        order: parseInt(sec.order) || 1,
        subjectId: sec.subjectId ? parseInt(sec.subjectId) : null,
        isMandatory: sec.isMandatory !== false,
        positiveMarks: sec.positiveMarks ? parseFloat(sec.positiveMarks) : null,
        negativeMarks: sec.negativeMarks ? parseFloat(sec.negativeMarks) : null,
        navigationRule: sec.navigationRule || "lock_previous",
        autoMove: sec.autoMove !== false,
      });
    }
  }

  // Trigger Notifications
  await createNotificationForAdmins("New Exam Created", `Exam '${exam.title}' has been created successfully.`, "system");
  if (exam.status === "published") {
    await createNotificationForStudents("New Exam Available", `A new exam '${exam.title}' is now published and available for attempt! Go to Test Series to start.`, "new_exam", `/exams/${exam.id}`);
  }

  res.status(201).json({ ...exam, totalQuestions: 0, attemptCount: 0, averageScore: null, categoryName: null });
});

router.get("/v1/exams/:id", optionalAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = GetExamParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [exam] = await db.select().from(examsTable).where(eq(examsTable.id, params.data.id));
  if (!exam) {
    res.status(404).json({ error: "Exam not found" });
    return;
  }
  const sections = await db.select().from(examSectionsTable).where(eq(examSectionsTable.examId, exam.id));
  const [qCount] = await db.select({ count: count() }).from(examQuestionsTable).where(eq(examQuestionsTable.examId, exam.id));
  const [aCount] = await db.select({ count: count() }).from(testSessionsTable).where(eq(testSessionsTable.examId, exam.id));

  const sectionIds = sections.map(s => s.id);
  const sqCounts = sectionIds.length > 0
    ? await db.select({ sectionId: examQuestionsTable.sectionId, count: count() })
        .from(examQuestionsTable)
        .where(inArray(examQuestionsTable.sectionId, sectionIds))
        .groupBy(examQuestionsTable.sectionId)
    : [];
  const sqCountMap = new Map(sqCounts.map(s => [s.sectionId, Number(s.count)]));

  const sectionsWithCount = sections.map((sec) => {
    return {
      id: sec.id,
      name: sec.name,
      questionCount: sqCountMap.get(sec.id) ?? 0,
      durationMinutes: sec.durationMinutes ?? null,
      order: sec.order,
      subjectId: sec.subjectId ?? null,
      isMandatory: sec.isMandatory,
      positiveMarks: sec.positiveMarks,
      negativeMarks: sec.negativeMarks,
      navigationRule: sec.navigationRule,
      autoMove: sec.autoMove,
    };
  });

  res.json({
    id: exam.id,
    title: exam.title,
    description: exam.description ?? null,
    type: exam.type,
    status: exam.status,
    durationMinutes: exam.durationMinutes,
    totalMarks: exam.totalMarks,
    totalQuestions: Number(qCount?.count ?? 0),
    positiveMarks: exam.positiveMarks,
    negativeMarks: exam.negativeMarks,
    categoryId: exam.categoryId ?? null,
    categoryName: null,
    attemptCount: aCount?.count ?? 0,
    averageScore: null,
    sections: sectionsWithCount,
    questionTimerSeconds: exam.questionTimerSeconds,
    autoSubmit: exam.autoSubmit,
    autoSave: exam.autoSave,
    createdAt: exam.createdAt,
  });
});

router.put("/v1/exams/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateExamParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [oldExam] = await db.select().from(examsTable).where(eq(examsTable.id, params.data.id));
  const { sections, questionTimerSeconds, autoSubmit, autoSave, ...bodyRest } = req.body;
  const parsed = UpdateExamBody.safeParse(bodyRest);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updateData: Record<string, unknown> = {};
  if (parsed.data.title != null) updateData.title = parsed.data.title;
  if (parsed.data.description != null) updateData.description = parsed.data.description;
  if (parsed.data.status != null) updateData.status = parsed.data.status;
  if (parsed.data.durationMinutes != null) updateData.durationMinutes = parsed.data.durationMinutes;
  if (parsed.data.totalMarks != null) updateData.totalMarks = parsed.data.totalMarks;
  if (parsed.data.positiveMarks != null) updateData.positiveMarks = parsed.data.positiveMarks;
  if (parsed.data.negativeMarks != null) updateData.negativeMarks = parsed.data.negativeMarks;
  if (parsed.data.categoryId !== undefined) updateData.categoryId = parsed.data.categoryId ?? null;
  if (parsed.data.type != null) updateData.type = parsed.data.type;
  if (parsed.data.scheduledAt !== undefined) updateData.scheduledAt = parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : null;
  if (parsed.data.endsAt !== undefined) updateData.endsAt = parsed.data.endsAt ? new Date(parsed.data.endsAt) : null;
  if (parsed.data.timezone != null) updateData.timezone = parsed.data.timezone;
  if (questionTimerSeconds !== undefined) updateData.questionTimerSeconds = questionTimerSeconds ? parseInt(questionTimerSeconds) : null;
  if (autoSubmit !== undefined) updateData.autoSubmit = autoSubmit !== false;
  if (autoSave !== undefined) updateData.autoSave = autoSave !== false;

  const [exam] = await db.update(examsTable).set(updateData).where(eq(examsTable.id, params.data.id)).returning();
  if (!exam) {
    res.status(404).json({ error: "Exam not found" });
    return;
  }

  if (Array.isArray(sections)) {
    const existingSections = await db.select().from(examSectionsTable).where(eq(examSectionsTable.examId, exam.id));
    const sectionIdsInPayload = sections.map(s => s.id ? Number(s.id) : null).filter(Boolean) as number[];
    
    // 1. Delete sections that are not in the payload
    for (const existing of existingSections) {
      if (!sectionIdsInPayload.includes(existing.id)) {
        await db.update(examQuestionsTable).set({ sectionId: null }).where(eq(examQuestionsTable.sectionId, existing.id));
        await db.delete(examSectionsTable).where(eq(examSectionsTable.id, existing.id));
      }
    }
    
    // 2. Create or Update sections in the payload
    for (const sec of sections) {
      const secData = {
        examId: exam.id,
        name: sec.name,
        durationMinutes: sec.durationMinutes ? parseInt(sec.durationMinutes) : null,
        order: parseInt(sec.order) || 1,
        subjectId: sec.subjectId ? parseInt(sec.subjectId) : null,
        isMandatory: sec.isMandatory !== false,
        positiveMarks: sec.positiveMarks ? parseFloat(sec.positiveMarks) : null,
        negativeMarks: sec.negativeMarks ? parseFloat(sec.negativeMarks) : null,
        navigationRule: sec.navigationRule || "lock_previous",
        autoMove: sec.autoMove !== false,
      };
      
      const secId = sec.id ? Number(sec.id) : null;
      if (secId) {
        await db.update(examSectionsTable).set(secData).where(eq(examSectionsTable.id, secId));
      } else {
        await db.insert(examSectionsTable).values(secData);
      }
    }
  }

  // Trigger Notifications
  await createNotificationForAdmins("Exam Updated", `Exam '${exam.title}' has been updated.`, "system");
  const isNowPublished = exam.status === "published" && (!oldExam || oldExam.status !== "published");
  if (isNowPublished) {
    await createNotificationForStudents("New Exam Published", `A new exam '${exam.title}' is now published and available for attempt! Go to Test Series to start.`, "new_exam", `/exams/${exam.id}`);
  } else if (exam.status === "published") {
    await createNotificationForStudents("Exam Updated", `The exam '${exam.title}' has been updated.`, "system", `/exams/${exam.id}`);
  }

  const [qCount] = await db.select({ count: count() }).from(examQuestionsTable).where(eq(examQuestionsTable.examId, exam.id));
  res.json({ ...exam, totalQuestions: Number(qCount?.count ?? 0), attemptCount: 0, averageScore: null, categoryName: null });
});

router.delete("/v1/exams/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = DeleteExamParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const examId = params.data.id;

  try {
    const [oldExam] = await db.select().from(examsTable).where(eq(examsTable.id, examId));
    if (!oldExam) {
      res.status(404).json({ error: "Exam not found" });
      return;
    }

    await db.transaction(async (tx) => {
      // Find results related to this exam
      const results = await tx.select({ id: resultsTable.id }).from(resultsTable).where(eq(resultsTable.examId, examId));
      const resultIds = results.map(r => r.id);

      // 1. Delete notifications related to the exam or results
      await tx.delete(notificationsTable).where(sql`${notificationsTable.link} = ${`/exams/${examId}`} OR ${notificationsTable.link} LIKE ${`/exams/${examId}/%`}`);
      if (resultIds.length > 0) {
        await tx.delete(notificationsTable).where(
          inArray(notificationsTable.link, resultIds.map(id => `/results/${id}`))
        );
      }

      // 2. Delete from resultsTable first (breaks FK constraints from resultsTable.sessionId -> testSessionsTable.id)
      await tx.delete(resultsTable).where(eq(resultsTable.examId, examId));

      // 3. Delete from testSessionsTable (cascades to violationsTable and sessionAnswersTable)
      await tx.delete(testSessionsTable).where(eq(testSessionsTable.examId, examId));

      // 4. Delete from examsTable (cascades to examSectionsTable and examQuestionsTable)
      await tx.delete(examsTable).where(eq(examsTable.id, examId));
    });

    await createNotificationForAdmins("Exam Deleted", `Exam '${oldExam.title}' has been deleted.`, "system");

    res.json({ message: "Exam deleted" });
  } catch (error) {
    logger.error(error, "Error deleting exam");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/v1/exams/:id/stats", async (req, res): Promise<void> => {
  const params = GetExamStatsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const results = await db.select().from(resultsTable).where(eq(resultsTable.examId, params.data.id));
  const total = results.length;
  const avgScore = total > 0 ? results.reduce((s, r) => s + r.score, 0) / total : 0;
  const highest = total > 0 ? Math.max(...results.map(r => r.score)) : 0;
  const avgAcc = total > 0 ? results.reduce((s, r) => s + r.accuracy, 0) / total : 0;

  res.json({
    examId: params.data.id,
    totalAttempts: total,
    averageScore: Math.round(avgScore * 10) / 10,
    highestScore: highest,
    averageAccuracy: Math.round(avgAcc * 10) / 10,
    passRate: 70,
  });
});

router.get("/v1/exams/:id/questions", requireAdmin, async (req, res): Promise<void> => {
  const examId = parseInt(req.params.id as string, 10);
  if (isNaN(examId)) {
    res.status(400).json({ error: "Invalid exam ID" });
    return;
  }
  const mappings = await db
    .select()
    .from(examQuestionsTable)
    .where(eq(examQuestionsTable.examId, examId))
    .orderBy(examQuestionsTable.order);
  res.json(mappings);
});

router.post("/v1/exams/:id/questions", requireAdmin, async (req, res): Promise<void> => {
  const examId = parseInt(req.params.id as string, 10);
  if (isNaN(examId)) {
    res.status(400).json({ error: "Invalid exam ID" });
    return;
  }
  const { questions } = req.body;
  if (!Array.isArray(questions)) {
    res.status(400).json({ error: "Questions payload must be an array" });
    return;
  }

  try {
    const seenQuestionIds = new Set<number>();
    const values: { examId: number; sectionId: number | null; questionId: number; order: number }[] = [];

    for (let idx = 0; idx < questions.length; idx++) {
      const q = questions[idx];
      const questionIdParsed = parseInt(q.questionId, 10);
      if (isNaN(questionIdParsed)) {
        continue;
      }
      if (seenQuestionIds.has(questionIdParsed)) {
        continue;
      }
      seenQuestionIds.add(questionIdParsed);

      const sectionIdParsed = q.sectionId ? parseInt(q.sectionId, 10) : null;

      values.push({
        examId,
        sectionId: isNaN(sectionIdParsed as number) ? null : sectionIdParsed,
        questionId: questionIdParsed,
        order: q.order || (values.length + 1),
      });
    }

    await db.transaction(async (tx) => {
      await tx.delete(examQuestionsTable).where(eq(examQuestionsTable.examId, examId));
      if (values.length > 0) {
        await tx.insert(examQuestionsTable).values(values);
      }
    });
  } catch (err: any) {
    logger.error(err, "Error saving exam questions");
    res.status(500).json({ error: "Internal Server Error" });
    return;
  }

  res.json({ success: true, count: questions.length });
});


// ─── Get Exam Collections ──────────────────────────────────────────────────
router.get("/v1/exams/:id/collections", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid exam ID" });
    return;
  }

  const linked = await db
    .select({
      id: questionCollectionsTable.id,
      name: questionCollectionsTable.name,
      description: questionCollectionsTable.description,
      isArchived: questionCollectionsTable.isArchived,
      createdAt: questionCollectionsTable.createdAt,
      updatedAt: questionCollectionsTable.updatedAt,
    })
    .from(examCollectionsTable)
    .innerJoin(questionCollectionsTable, eq(examCollectionsTable.collectionId, questionCollectionsTable.id))
    .where(eq(examCollectionsTable.examId, id));

  res.json(linked);
});

// ─── Save Exam Collections & Sync Questions ─────────────────────────────────
router.post("/v1/exams/:id/collections", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid exam ID" });
    return;
  }

  const { collectionIds, questions } = req.body;
  if (!Array.isArray(collectionIds)) {
    res.status(400).json({ error: "collectionIds must be an array" });
    return;
  }

  const valuesToInsert: { examId: number; sectionId: number | null; questionId: number; order: number }[] = [];

  if (Array.isArray(questions)) {
    // If customized questions are passed, use them directly
    for (let idx = 0; idx < questions.length; idx++) {
      const q = questions[idx];
      valuesToInsert.push({
        examId: id,
        sectionId: q.sectionId ? parseInt(q.sectionId, 10) : null,
        questionId: parseInt(q.questionId, 10),
        order: q.order || (idx + 1),
      });
    }
  } else {
    // Retrieve all questions from the collections and auto-map
    let mergedQuestionsRaw: any[] = [];
    if (collectionIds.length > 0) {
      const items = await db
        .select({
          question: questionsTable,
          subjectName: subjectsTable.name,
        })
        .from(questionCollectionItemsTable)
        .innerJoin(questionsTable, eq(questionCollectionItemsTable.questionId, questionsTable.id))
        .leftJoin(subjectsTable, eq(questionsTable.subjectId, subjectsTable.id))
        .where(inArray(questionCollectionItemsTable.collectionId, collectionIds))
        .orderBy(asc(questionCollectionItemsTable.order));

      // Deduplicate by questionId
      const seenIds = new Set<number>();
      for (const item of items) {
        if (!seenIds.has(item.question.id)) {
          seenIds.add(item.question.id);
          mergedQuestionsRaw.push(item);
        }
      }
    }

    // Get current exam sections to map questions to them
    const sections = await db.select().from(examSectionsTable).where(eq(examSectionsTable.examId, id));
    
    if (mergedQuestionsRaw.length > 0 && sections.length === 0) {
      res.status(400).json({ error: "This exam does not have any sections configured. Please configure at least one section first." });
      return;
    }

    const sectionBySubject = new Map<number, number>();
    for (const s of sections) {
      if (s.subjectId) {
        sectionBySubject.set(s.subjectId, s.id);
      }
    }

    // Fetch subjects to check their names in case of fallback
    const subjects = await db.select().from(subjectsTable);
    const subjectMap = new Map(subjects.map(s => [s.id, s]));

    for (let idx = 0; idx < mergedQuestionsRaw.length; idx++) {
      const q = mergedQuestionsRaw[idx].question;
      let targetSectionId: number | null = null;

      if (sectionBySubject.has(q.subjectId)) {
        targetSectionId = sectionBySubject.get(q.subjectId)!;
      } else if (sections.length === 1) {
        targetSectionId = sections[0].id;
      } else {
        // Look for a section with a name matching the subject name
        const sub = subjectMap.get(q.subjectId);
        const matchingSec = sections.find(s => s.name.toLowerCase() === sub?.name.toLowerCase());
        if (matchingSec) {
          targetSectionId = matchingSec.id;
        } else {
          const subName = sub?.name || `Subject #${q.subjectId}`;
          res.status(400).json({
            error: `Question "${q.text.slice(0, 30)}..." belongs to "${subName}", but no matching section was found in the exam. Please add a section for "${subName}" first.`
          });
          return;
        }
      }

      valuesToInsert.push({
        examId: id,
        sectionId: targetSectionId,
        questionId: q.id,
        order: idx + 1
      });
    }
  }

  // Update DB inside transaction
  await db.transaction(async (tx) => {
    // Delete existing associations
    await tx.delete(examCollectionsTable).where(eq(examCollectionsTable.examId, id));
    
    // Insert new associations
    if (collectionIds.length > 0) {
      await tx.insert(examCollectionsTable).values(
        collectionIds.map(cId => ({ examId: id, collectionId: cId }))
      );
    }

    // Only sync exam questions if collections are specified or questions are explicitly provided
    if (collectionIds.length > 0 || questions !== undefined) {
      // Clear existing exam questions
      await tx.delete(examQuestionsTable).where(eq(examQuestionsTable.examId, id));

      // Insert new questions
      if (valuesToInsert.length > 0) {
        await tx.insert(examQuestionsTable).values(valuesToInsert);
      }
    }
  });

  res.json({ success: true, count: valuesToInsert.length });
});

// ─── Unlink Collection from Exam ───────────────────────────────────────────
router.delete("/v1/exams/:id/collections/:collectionId", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const collectionId = parseInt(req.params.collectionId as string, 10);
  if (isNaN(id) || isNaN(collectionId)) {
    res.status(400).json({ error: "Invalid ID parameters" });
    return;
  }

  await db.transaction(async (tx) => {
    // Delete association
    await tx
      .delete(examCollectionsTable)
      .where(and(eq(examCollectionsTable.examId, id), eq(examCollectionsTable.collectionId, collectionId)));
      
    // Re-sync exam questions based on remaining collections
    const remaining = await tx
      .select({ collectionId: examCollectionsTable.collectionId })
      .from(examCollectionsTable)
      .where(eq(examCollectionsTable.examId, id));
      
    const remainingIds = remaining.map(r => r.collectionId);
    
    // Clear exam questions
    await tx.delete(examQuestionsTable).where(eq(examQuestionsTable.examId, id));
    
    if (remainingIds.length > 0) {
      const items = await tx
        .select({
          question: questionsTable,
        })
        .from(questionCollectionItemsTable)
        .innerJoin(questionsTable, eq(questionCollectionItemsTable.questionId, questionsTable.id))
        .where(inArray(questionCollectionItemsTable.collectionId, remainingIds))
        .orderBy(asc(questionCollectionItemsTable.order));
        
      const seenIds = new Set<number>();
      const mergedQuestionsRaw: typeof items = [];
      for (const item of items) {
        if (!seenIds.has(item.question.id)) {
          seenIds.add(item.question.id);
          mergedQuestionsRaw.push(item);
        }
      }
      
      const sections = await tx.select().from(examSectionsTable).where(eq(examSectionsTable.examId, id));
      const sectionBySubject = new Map<number, number>();
      for (const s of sections) {
        if (s.subjectId) {
          sectionBySubject.set(s.subjectId, s.id);
        }
      }
      
      const subjects = await tx.select().from(subjectsTable);
      const subjectMap = new Map(subjects.map(s => [s.id, s]));
      
      const valuesToInsert: any[] = [];
      for (let idx = 0; idx < mergedQuestionsRaw.length; idx++) {
        const q = mergedQuestionsRaw[idx].question;
        let targetSectionId: number | null = null;
        
        if (sectionBySubject.has(q.subjectId)) {
          targetSectionId = sectionBySubject.get(q.subjectId)!;
        } else if (sections.length === 1) {
          targetSectionId = sections[0].id;
        } else {
          const sub = subjectMap.get(q.subjectId);
          const matchingSec = sections.find(s => s.name.toLowerCase() === sub?.name.toLowerCase());
          if (matchingSec) {
            targetSectionId = matchingSec.id;
          }
        }
        
        if (targetSectionId !== null) {
          valuesToInsert.push({
            examId: id,
            sectionId: targetSectionId,
            questionId: q.id,
            order: idx + 1
          });
        }
      }
      
      if (valuesToInsert.length > 0) {
        await tx.insert(examQuestionsTable).values(valuesToInsert);
      }
    }
  });

  res.json({ success: true });
});

// ─── Preview Merged Collections Questions ───────────────────────────────────
router.post("/v1/exams/preview-collections", requireAdmin, async (req, res): Promise<void> => {
  const { collectionIds } = req.body;
  if (!Array.isArray(collectionIds) || collectionIds.length === 0) {
    res.json({
      totalQuestions: 0,
      totalMarks: 0,
      duplicatesRemoved: 0,
      difficultyDistribution: { easy: 0, medium: 0, hard: 0 },
      collections: [],
      questions: [],
    });
    return;
  }

  // Get collections metadata
  const collections = await db
    .select({ id: questionCollectionsTable.id, name: questionCollectionsTable.name })
    .from(questionCollectionsTable)
    .where(inArray(questionCollectionsTable.id, collectionIds));

  // Get items
  const items = await db
    .select({
      question: questionsTable,
      subjectName: subjectsTable.name,
      topicName: topicsTable.name,
    })
    .from(questionCollectionItemsTable)
    .innerJoin(questionsTable, eq(questionCollectionItemsTable.questionId, questionsTable.id))
    .leftJoin(subjectsTable, eq(questionsTable.subjectId, subjectsTable.id))
    .leftJoin(topicsTable, eq(questionsTable.topicId, topicsTable.id))
    .where(inArray(questionCollectionItemsTable.collectionId, collectionIds))
    .orderBy(asc(questionCollectionItemsTable.order));

  // Deduplicate questions by question.id
  const seenIds = new Set<number>();
  const mergedQuestionsRaw: typeof items = [];
  let duplicatesRemoved = 0;

  for (const item of items) {
    if (seenIds.has(item.question.id)) {
      duplicatesRemoved++;
    } else {
      seenIds.add(item.question.id);
      mergedQuestionsRaw.push(item);
    }
  }

  const questionIds = mergedQuestionsRaw.map(i => i.question.id);
  const allOptions = questionIds.length > 0
    ? await db.select().from(questionOptionsTable).where(inArray(questionOptionsTable.questionId, questionIds))
    : [];

  let totalMarks = 0;
  const difficultyDistribution = { easy: 0, medium: 0, hard: 0 };

  const questions = mergedQuestionsRaw.map((item, idx) => {
    const q = item.question;
    const options = allOptions
      .filter(o => o.questionId === q.id)
      .map(o => ({ id: o.id, text: o.text, isCorrect: o.isCorrect }));

    totalMarks += q.positiveMarks;
    
    const diff = q.difficulty as "easy" | "medium" | "hard";
    if (difficultyDistribution[diff] !== undefined) {
      difficultyDistribution[diff]++;
    }

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
      order: idx + 1,
      createdAt: q.createdAt,
    };
  });

  res.json({
    totalQuestions: questions.length,
    totalMarks,
    duplicatesRemoved,
    difficultyDistribution,
    collections,
    questions,
  });
});

export default router;
