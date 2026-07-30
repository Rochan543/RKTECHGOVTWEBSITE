import { Router, type IRouter } from "express";
import { db, studyTasksTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../../middlewares/auth";

const router: IRouter = Router();

// GET /api/v1/study-planner/tasks
router.get(
  "/v1/study-planner/tasks",
  requireAuth,
  async (req: AuthRequest, res): Promise<void> => {
    try {
      const userId = req.userId!;
      const tasks = await db
        .select()
        .from(studyTasksTable)
        .where(eq(studyTasksTable.userId, userId))
        .orderBy(studyTasksTable.createdAt);

      res.json(tasks);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

// POST /api/v1/study-planner/tasks
router.post(
  "/v1/study-planner/tasks",
  requireAuth,
  async (req: AuthRequest, res): Promise<void> => {
    try {
      const userId = req.userId!;
      const { title, description, category, priority, durationMinutes, date } = req.body;

      if (!title) {
        res.status(400).json({ error: "Task title is required" });
        return;
      }

      const [task] = await db
        .insert(studyTasksTable)
        .values({
          userId,
          title,
          description: description ?? null,
          category: category ?? "Custom",
          priority: priority ?? "medium",
          durationMinutes: durationMinutes ? Number(durationMinutes) : 60,
          completed: false,
          date,
        })
        .returning();

      res.json(task);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

// PUT /api/v1/study-planner/tasks/:id
router.put(
  "/v1/study-planner/tasks/:id",
  requireAuth,
  async (req: AuthRequest, res): Promise<void> => {
    try {
      const userId = req.userId!;
      const taskId = Number(req.params.id);
      const { title, description, category, priority, durationMinutes, completed, date } = req.body;

      const [existing] = await db
        .select()
        .from(studyTasksTable)
        .where(and(eq(studyTasksTable.id, taskId), eq(studyTasksTable.userId, userId)))
        .limit(1);

      if (!existing) {
        res.status(404).json({ error: "Task not found" });
        return;
      }

      const [updated] = await db
        .update(studyTasksTable)
        .set({
          title: title !== undefined ? title : existing.title,
          description: description !== undefined ? description : existing.description,
          category: category !== undefined ? category : existing.category,
          priority: priority !== undefined ? priority : existing.priority,
          durationMinutes: durationMinutes !== undefined ? Number(durationMinutes) : existing.durationMinutes,
          completed: completed !== undefined ? Boolean(completed) : existing.completed,
          date: date !== undefined ? date : existing.date,
        })
        .where(and(eq(studyTasksTable.id, taskId), eq(studyTasksTable.userId, userId)))
        .returning();

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

// DELETE /api/v1/study-planner/tasks/:id
router.delete(
  "/v1/study-planner/tasks/:id",
  requireAuth,
  async (req: AuthRequest, res): Promise<void> => {
    try {
      const userId = req.userId!;
      const taskId = Number(req.params.id);

      const [existing] = await db
        .select()
        .from(studyTasksTable)
        .where(and(eq(studyTasksTable.id, taskId), eq(studyTasksTable.userId, userId)))
        .limit(1);

      if (!existing) {
        res.status(404).json({ error: "Task not found" });
        return;
      }

      await db
        .delete(studyTasksTable)
        .where(and(eq(studyTasksTable.id, taskId), eq(studyTasksTable.userId, userId)));

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

export default router;
