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
import { eq, count, desc } from "drizzle-orm";
import { requireAdmin, type AuthRequest } from "../../middlewares/auth";
import { verifyToken } from "../../middlewares/auth";
import { usersTable } from "@workspace/db";
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

  const allExams = await db.select().from(examsTable).orderBy(desc(examsTable.createdAt));
  let filtered = allExams;

  // Admins see all exams unless they explicitly filter by status
  if (status) {
    filtered = filtered.filter(e => e.status === status);
  } else if (!isAdmin) {
    // Students and unauthenticated users only see published exams
    filtered = filtered.filter(e => e.status === "published");
  }

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

  const sectionsWithCount = await Promise.all(sections.map(async (sec) => {
    const [sq] = await db.select({ count: count() }).from(examQuestionsTable).where(eq(examQuestionsTable.sectionId, sec.id));
    return {
      id: sec.id,
      name: sec.name,
      questionCount: sq?.count ?? 0,
      durationMinutes: sec.durationMinutes ?? null,
      order: sec.order,
      subjectId: sec.subjectId ?? null,
      isMandatory: sec.isMandatory,
      positiveMarks: sec.positiveMarks,
      negativeMarks: sec.negativeMarks,
      navigationRule: sec.navigationRule,
      autoMove: sec.autoMove,
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
    const sectionIdsInPayload = sections.map(s => s.id).filter(Boolean);
    
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
      
      if (sec.id) {
        await db.update(examSectionsTable).set(secData).where(eq(examSectionsTable.id, sec.id));
      } else {
        await db.insert(examSectionsTable).values(secData);
      }
    }
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
