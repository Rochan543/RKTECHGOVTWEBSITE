import { Router, type IRouter } from "express";
import {
  db,
  usersTable,
  examsTable,
  questionsTable,
  testSessionsTable,
  resultsTable,
  notesTable,
  auditLogsTable,
} from "@workspace/db";
import { eq, desc, count, sql } from "drizzle-orm";
import { requireAuth, requireSuperAdmin, type AuthRequest } from "../../middlewares/auth";
import { z } from "zod";

const router: IRouter = Router();

// ─── Global Analytics ──────────────────────────────────────────────────────────

router.get(
  "/v1/super-admin/analytics",
  requireSuperAdmin,
  async (_req, res): Promise<void> => {
    const [totalUsers] = await db.select({ value: count() }).from(usersTable);
    const [activeUsers] = await db
      .select({ value: count() })
      .from(usersTable)
      .where(eq(usersTable.status, "active"));
    const [totalAdmins] = await db
      .select({ value: count() })
      .from(usersTable)
      .where(eq(usersTable.role, "admin"));
    const [totalExams] = await db.select({ value: count() }).from(examsTable);
    const [totalQuestions] = await db.select({ value: count() }).from(questionsTable);
    const [totalSessions] = await db.select({ value: count() }).from(testSessionsTable);
    const [totalResults] = await db.select({ value: count() }).from(resultsTable);
    const [totalNotes] = await db.select({ value: count() }).from(notesTable);

    const recentResults = await db
      .select({ accuracy: resultsTable.accuracy, score: resultsTable.score, totalMarks: resultsTable.totalMarks })
      .from(resultsTable)
      .orderBy(desc(resultsTable.createdAt))
      .limit(100);

    const avgAccuracy =
      recentResults.length > 0
        ? recentResults.reduce((s, r) => s + r.accuracy, 0) / recentResults.length
        : 0;
    const avgScore =
      recentResults.length > 0
        ? recentResults.reduce((s, r) => s + (r.score / r.totalMarks) * 100, 0) /
          recentResults.length
        : 0;

    res.json({
      users: {
        total: Number(totalUsers.value),
        active: Number(activeUsers.value),
        admins: Number(totalAdmins.value),
        students: Number(totalUsers.value) - Number(totalAdmins.value),
      },
      content: {
        exams: Number(totalExams.value),
        questions: Number(totalQuestions.value),
        notes: Number(totalNotes.value),
      },
      activity: {
        totalSessions: Number(totalSessions.value),
        totalResults: Number(totalResults.value),
        avgAccuracy: Math.round(avgAccuracy * 10) / 10,
        avgScore: Math.round(avgScore * 10) / 10,
      },
    });
  }
);

// ─── System Health ──────────────────────────────────────────────────────────────

router.get(
  "/v1/super-admin/health",
  requireSuperAdmin,
  async (_req, res): Promise<void> => {
    const start = Date.now();
    try {
      await db.execute(sql`SELECT 1`);
      const dbLatency = Date.now() - start;

      res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        nodeVersion: process.version,
        database: { status: "connected", latencyMs: dbLatency },
      });
    } catch (err) {
      res.status(500).json({
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        database: { status: "error", error: String(err) },
      });
    }
  }
);

// ─── Audit Logs ─────────────────────────────────────────────────────────────────

router.get(
  "/v1/super-admin/audit-logs",
  requireSuperAdmin,
  async (req, res): Promise<void> => {
    const schema = z.object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(50),
    });
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const { page, limit } = parsed.data;

    const all = await db
      .select({
        log: auditLogsTable,
        userName: usersTable.name,
        userEmail: usersTable.email,
      })
      .from(auditLogsTable)
      .leftJoin(usersTable, eq(auditLogsTable.userId, usersTable.id))
      .orderBy(desc(auditLogsTable.createdAt));

    const total = all.length;
    const items = all.slice((page - 1) * limit, page * limit).map((r) => ({
      ...r.log,
      userName: r.userName,
      userEmail: r.userEmail,
    }));

    res.json({ data: items, total, page, limit });
  }
);

// ─── Admin Management ───────────────────────────────────────────────────────────

router.get(
  "/v1/super-admin/admins",
  requireSuperAdmin,
  async (_req, res): Promise<void> => {
    const admins = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.role, "admin"))
      .orderBy(desc(usersTable.createdAt));

    res.json({
      data: admins.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        status: u.status,
        createdAt: u.createdAt,
      })),
      total: admins.length,
    });
  }
);

router.post(
  "/v1/super-admin/admins",
  requireSuperAdmin,
  async (req, res): Promise<void> => {
    const schema = z.object({ userId: z.number().int() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [user] = await db
      .update(usersTable)
      .set({ role: "admin" })
      .where(eq(usersTable.id, parsed.data.userId))
      .returning();
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json({ message: "User promoted to admin", user: { id: user.id, name: user.name, role: user.role } });
  }
);

router.delete(
  "/v1/super-admin/admins/:id",
  requireSuperAdmin,
  async (req, res): Promise<void> => {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }
    const [user] = await db
      .update(usersTable)
      .set({ role: "student" })
      .where(eq(usersTable.id, id))
      .returning();
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json({ message: "Admin role removed", user: { id: user.id, name: user.name, role: user.role } });
  }
);

export default router;
