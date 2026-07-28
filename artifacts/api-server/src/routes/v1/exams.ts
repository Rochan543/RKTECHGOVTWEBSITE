import { Router, type IRouter } from "express";
import {
  db,
  examsTable,
  examCategoriesTable,
  examSectionsTable,
  examQuestionsTable,
  testSessionsTable,
  resultsTable,
} from "@workspace/db";
import { eq, count, avg, desc, and } from "drizzle-orm";
import { requireAdmin, requireAuth, type AuthRequest } from "../../middlewares/auth";
import {
  ListExamsQueryParams,
  CreateExamBody,
  GetExamParams,
  UpdateExamBody,
  UpdateExamParams,
  DeleteExamParams,
  GetExamStatsParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/v1/exams", async (req, res): Promise<void> => {
  const params = ListExamsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const { page = 1, limit = 20, categoryId, type, status } = params.data;
  const offset = (page - 1) * limit;

  let query = db.select().from(examsTable);
  // Manual filter application
  const allExams = await db.select().from(examsTable);
  let filtered = allExams;
  if (status) filtered = filtered.filter(e => e.status === status);
  else filtered = filtered.filter(e => e.status === "published");
  if (categoryId) filtered = filtered.filter(e => e.categoryId === categoryId);
  if (type) filtered = filtered.filter(e => e.type === type);

  const total = filtered.length;
  const paged = filtered.slice(offset, offset + limit);

  const data = await Promise.all(paged.map(async (exam) => {
    const [qCount] = await db.select({ count: count() }).from(examQuestionsTable).where(eq(examQuestionsTable.examId, exam.id));
    const [aCount] = await db.select({ count: count() }).from(testSessionsTable).where(eq(testSessionsTable.examId, exam.id));
    let categoryName: string | null = null;
    if (exam.categoryId) {
      const [cat] = await db.select({ name: examCategoriesTable.name }).from(examCategoriesTable).where(eq(examCategoriesTable.id, exam.categoryId));
      categoryName = cat?.name ?? null;
    }
    return {
      id: exam.id,
      title: exam.title,
      description: exam.description ?? null,
      type: exam.type,
      status: exam.status,
      durationMinutes: exam.durationMinutes,
      totalMarks: exam.totalMarks,
      totalQuestions: qCount?.count ?? 0,
      positiveMarks: exam.positiveMarks,
      negativeMarks: exam.negativeMarks,
      categoryId: exam.categoryId ?? null,
      categoryName,
      attemptCount: aCount?.count ?? 0,
      averageScore: null,
      createdAt: exam.createdAt,
    };
  }));

  res.json({ data, total, page, limit });
});

router.post("/v1/exams", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateExamBody.safeParse(req.body);
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
  }).returning();
  res.status(201).json({ ...exam, totalQuestions: 0, attemptCount: 0, averageScore: null, categoryName: null });
});

router.get("/v1/exams/:id", async (req, res): Promise<void> => {
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

  const sectionsWithCount = await Promise.all(sections.map(async (sec) => {
    const [sq] = await db.select({ count: count() }).from(examQuestionsTable).where(eq(examQuestionsTable.sectionId, sec.id));
    return {
      id: sec.id,
      name: sec.name,
      questionCount: sq?.count ?? 0,
      durationMinutes: sec.durationMinutes ?? null,
      order: sec.order,
      subjectId: sec.subjectId ?? null,
    };
  }));

  res.json({
    id: exam.id,
    title: exam.title,
    description: exam.description ?? null,
    type: exam.type,
    status: exam.status,
    durationMinutes: exam.durationMinutes,
    totalMarks: exam.totalMarks,
    totalQuestions: qCount?.count ?? 0,
    positiveMarks: exam.positiveMarks,
    negativeMarks: exam.negativeMarks,
    categoryId: exam.categoryId ?? null,
    categoryName: null,
    attemptCount: aCount?.count ?? 0,
    averageScore: null,
    sections: sectionsWithCount,
    createdAt: exam.createdAt,
  });
});

router.put("/v1/exams/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateExamParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateExamBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updateData: Record<string, unknown> = {};
  if (parsed.data.title != null) updateData.title = parsed.data.title;
  if (parsed.data.description != null) updateData.description = parsed.data.description;
  if (parsed.data.status != null) updateData.status = parsed.data.status;
  if (parsed.data.durationMinutes != null) updateData.durationMinutes = parsed.data.durationMinutes;

  const [exam] = await db.update(examsTable).set(updateData).where(eq(examsTable.id, params.data.id)).returning();
  if (!exam) {
    res.status(404).json({ error: "Exam not found" });
    return;
  }
  res.json({ ...exam, totalQuestions: 0, attemptCount: 0, averageScore: null, categoryName: null });
});

router.delete("/v1/exams/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = DeleteExamParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(examsTable).where(eq(examsTable.id, params.data.id));
  res.json({ message: "Exam deleted" });
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

export default router;
