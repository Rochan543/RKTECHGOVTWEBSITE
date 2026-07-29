import { Router, type IRouter } from "express";
import { db, usersTable, resultsTable, examsTable, questionsTable, testSessionsTable, notesTable, violationsTable, sessionAnswersTable } from "@workspace/db";
import { eq, count, desc, inArray, and, sql } from "drizzle-orm";
import { logger } from "../../lib/logger";
import { requireAdmin, requireAuth, type AuthRequest } from "../../middlewares/auth";
import { ListUsersQueryParams, GetUserParams, UpdateUserParams, UpdateUserBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/v1/users", requireAdmin, async (req, res): Promise<void> => {
  const params = ListUsersQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const { page = 1, limit = 20, search, status, role } = params.data;
  const offset = (page - 1) * limit;

  const conditions = [];
  if (status) {
    conditions.push(eq(usersTable.status, status));
  }
  if (role) {
    conditions.push(eq(usersTable.role, role));
  }
  if (search) {
    const searchLower = `%${search.toLowerCase()}%`;
    conditions.push(
      sql`lower(${usersTable.name}) like ${searchLower} or lower(${usersTable.email}) like ${searchLower}`
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const paged = await db.select({
    id: usersTable.id,
    name: usersTable.name,
    email: usersTable.email,
    role: usersTable.role,
    status: usersTable.status,
    phone: usersTable.phone,
    avatarUrl: usersTable.avatarUrl,
    rank: usersTable.rank,
    totalScore: usersTable.totalScore,
    createdAt: usersTable.createdAt,
  })
    .from(usersTable)
    .where(whereClause)
    .orderBy(desc(usersTable.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ count: total }] = await db.select({ count: count() })
    .from(usersTable)
    .where(whereClause);

  const data = paged.map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    status: u.status,
    phone: u.phone ?? null,
    avatarUrl: u.avatarUrl ?? null,
    rank: u.rank ?? null,
    totalScore: u.totalScore ?? null,
    createdAt: u.createdAt,
  }));

  res.json({ data, total, page, limit });
});

router.get("/v1/users/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = GetUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, params.data.id));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const results = await db.select().from(resultsTable).where(eq(resultsTable.userId, user.id));
  const totalTestsTaken = results.length;
  const averageScore = totalTestsTaken > 0 ? results.reduce((s, r) => s + (r.score / r.totalMarks) * 100, 0) / totalTestsTaken : 0;
  const overallAccuracy = totalTestsTaken > 0 ? results.reduce((s, r) => s + r.accuracy, 0) / totalTestsTaken : 0;

  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    phone: user.phone ?? null,
    avatarUrl: user.avatarUrl ?? null,
    rank: user.rank ?? null,
    totalScore: user.totalScore ?? null,
    createdAt: user.createdAt,
    stats: {
      totalTestsTaken,
      averageScore: Math.round(averageScore * 10) / 10,
      overallAccuracy: Math.round(overallAccuracy * 10) / 10,
      currentRank: user.rank ?? null,
      totalStudyTime: totalTestsTaken * 60,
      testsThisWeek: 0,
      weakSubjectsCount: 0,
      strongSubjectsCount: 0,
    },
  });
});

router.patch("/v1/users/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = UpdateUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const targetId = Number(params.data.id);
  const currentUserId = Number(req.userId);
  const isAdmin = req.userRole === "admin" || req.userRole === "super_admin";
  
  logger.info({ currentUserId, targetId, userRole: req.userRole, isAdmin }, "PATCH /v1/users/:id profile update request");

  if (!isAdmin && currentUserId !== targetId) {
    res.status(403).json({ error: "Forbidden: You cannot modify other users' profiles." });
    return;
  }

  // Only admins can change status or role
  if (!isAdmin && (parsed.data.role !== undefined || parsed.data.status !== undefined)) {
    res.status(403).json({ error: "Forbidden: Only admins can change user status or role." });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.phone !== undefined) updateData.phone = parsed.data.phone;
  if (parsed.data.avatarUrl !== undefined) updateData.avatarUrl = parsed.data.avatarUrl;

  if (isAdmin) {
    if (parsed.data.status !== undefined) updateData.status = parsed.data.status;
    if (parsed.data.role !== undefined) updateData.role = parsed.data.role;
  }

  const [user] = await db.update(usersTable).set(updateData).where(eq(usersTable.id, targetId)).returning();
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    phone: user.phone ?? null,
    avatarUrl: user.avatarUrl ?? null,
    rank: user.rank ?? null,
    totalScore: user.totalScore ?? null,
    createdAt: user.createdAt,
  });
});

router.get("/v1/admin/stats", requireAdmin, async (_req, res): Promise<void> => {
  const [
    [totalUsers],
    [activeUsers],
    [totalExams],
    [publishedExams],
    [totalQuestions],
    [totalSessions]
  ] = await Promise.all([
    db.select({ count: count() }).from(usersTable),
    db.select({ count: count() }).from(usersTable).where(eq(usersTable.status, "active")),
    db.select({ count: count() }).from(examsTable),
    db.select({ count: count() }).from(examsTable).where(eq(examsTable.status, "published")),
    db.select({ count: count() }).from(questionsTable),
    db.select({ count: count() }).from(testSessionsTable),
  ]);

  res.json({
    totalUsers: totalUsers?.count ?? 0,
    activeUsers: activeUsers?.count ?? 0,
    totalExams: totalExams?.count ?? 0,
    publishedExams: publishedExams?.count ?? 0,
    totalQuestions: totalQuestions?.count ?? 0,
    totalSessions: totalSessions?.count ?? 0,
    revenueThisMonth: 0,
    newUsersThisWeek: 0,
  });
});

router.get("/v1/users/:id/sessions", requireAdmin, async (req, res): Promise<void> => {
  const params = GetUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const userId = params.data.id;

  const answersSubquery = db
    .select({
      sessionId: sessionAnswersTable.sessionId,
      total: count().as("total"),
      answered: sql<number>`count(case when ${sessionAnswersTable.status} in ('answered', 'marked_answered') then 1 end)::int`.as("answered"),
    })
    .from(sessionAnswersTable)
    .groupBy(sessionAnswersTable.sessionId)
    .as("answers_sub");

  const sessions = await db
    .select({
      id: testSessionsTable.id,
      status: testSessionsTable.status,
      startedAt: testSessionsTable.startedAt,
      submittedAt: testSessionsTable.submittedAt,
      examId: testSessionsTable.examId,
      examTitle: examsTable.title,
      userName: usersTable.name,
      score: resultsTable.score,
      totalMarks: resultsTable.totalMarks,
      accuracy: resultsTable.accuracy,
      correctCount: resultsTable.correct,
      incorrectCount: resultsTable.incorrect,
      skippedCount: resultsTable.skipped,
      timeTakenSeconds: resultsTable.timeTakenSeconds,
      answersTotal: sql<number>`COALESCE(${answersSubquery.total}, 0)::int`,
      answersAnswered: sql<number>`COALESCE(${answersSubquery.answered}, 0)::int`,
    })
    .from(testSessionsTable)
    .leftJoin(examsTable, eq(testSessionsTable.examId, examsTable.id))
    .leftJoin(usersTable, eq(testSessionsTable.userId, usersTable.id))
    .leftJoin(resultsTable, eq(testSessionsTable.id, resultsTable.sessionId))
    .leftJoin(answersSubquery, eq(testSessionsTable.id, answersSubquery.sessionId))
    .where(eq(testSessionsTable.userId, userId))
    .orderBy(desc(testSessionsTable.startedAt));

  res.json(sessions);
});

router.get("/v1/users/:id/violations", requireAdmin, async (req, res): Promise<void> => {
  const params = GetUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const userId = params.data.id;
  
  const rawViolations = await db
    .select({
      id: violationsTable.id,
      sessionId: violationsTable.sessionId,
      type: violationsTable.type,
      createdAt: violationsTable.createdAt,
      examTitle: examsTable.title,
      userName: usersTable.name,
      count: sql<number>`count(*) over (partition by ${violationsTable.sessionId})::int`,
    })
    .from(violationsTable)
    .innerJoin(testSessionsTable, eq(violationsTable.sessionId, testSessionsTable.id))
    .leftJoin(examsTable, eq(testSessionsTable.examId, examsTable.id))
    .leftJoin(usersTable, eq(testSessionsTable.userId, usersTable.id))
    .where(eq(testSessionsTable.userId, userId))
    .orderBy(desc(violationsTable.createdAt));

  const severityMap: Record<string, string> = {
    tab_switch: "medium",
    window_blur: "low",
    fullscreen_exit: "high",
    context_menu: "low",
    copy_attempt: "high",
  };

  const descriptionMap: Record<string, string> = {
    tab_switch: "Switched tab or minimized browser window",
    window_blur: "Lost focus on exam window",
    fullscreen_exit: "Exited fullscreen mode",
    context_menu: "Right-clicked or opened context menu",
    copy_attempt: "Attempted to copy content",
  };

  const data = rawViolations.map(v => ({
    ...v,
    severity: severityMap[v.type] || "low",
    description: descriptionMap[v.type] || "Security violation detected",
  }));

  res.json(data);
});

export default router;
