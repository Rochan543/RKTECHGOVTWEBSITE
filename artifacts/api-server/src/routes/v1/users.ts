import { Router, type IRouter } from "express";
import { db, usersTable, resultsTable, examsTable, questionsTable, testSessionsTable, notesTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
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

  let users = await db.select().from(usersTable);
  if (search) users = users.filter(u => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()));
  if (status) users = users.filter(u => u.status === status);
  if (role) users = users.filter(u => u.role === role);

  const total = users.length;
  const paged = users.slice((page - 1) * limit, page * limit);

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

router.patch("/v1/users/:id", requireAdmin, async (req, res): Promise<void> => {
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
  const updateData: Record<string, unknown> = {};
  if (parsed.data.status != null) updateData.status = parsed.data.status;
  if (parsed.data.role != null) updateData.role = parsed.data.role;
  if (parsed.data.name != null) updateData.name = parsed.data.name;
  if (parsed.data.phone != null) updateData.phone = parsed.data.phone;

  const [user] = await db.update(usersTable).set(updateData).where(eq(usersTable.id, params.data.id)).returning();
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
  const [totalUsers] = await db.select({ count: count() }).from(usersTable);
  const [activeUsers] = await db.select({ count: count() }).from(usersTable).where(eq(usersTable.status, "active"));
  const [totalExams] = await db.select({ count: count() }).from(examsTable);
  const [publishedExams] = await db.select({ count: count() }).from(examsTable).where(eq(examsTable.status, "published"));
  const [totalQuestions] = await db.select({ count: count() }).from(questionsTable);
  const [totalSessions] = await db.select({ count: count() }).from(testSessionsTable);

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

export default router;
