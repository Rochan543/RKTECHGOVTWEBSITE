import { Router, type IRouter } from "express";
import { db, testSessionsTable, violationsTable } from "@workspace/db";
import { eq, and, count } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../../middlewares/auth";
import { z } from "zod";

const router: IRouter = Router();

const RecordViolationBody = z.object({
  type: z.enum(["tab_switch", "window_blur", "fullscreen_exit", "context_menu", "copy_attempt"]),
});

const MAX_VIOLATIONS = 5;

router.post(
  "/v1/sessions/:id/violations",
  requireAuth,
  async (req: AuthRequest, res): Promise<void> => {
    const sessionId = parseInt(req.params.id as string, 10);
    if (isNaN(sessionId)) {
      res.status(400).json({ error: "Invalid session ID" });
      return;
    }

    const parsed = RecordViolationBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const userId = req.userId!;

    const [session] = await db
      .select()
      .from(testSessionsTable)
      .where(
        and(
          eq(testSessionsTable.id, sessionId),
          eq(testSessionsTable.userId, userId),
          eq(testSessionsTable.status, "in_progress")
        )
      );

    if (!session) {
      res.status(404).json({ error: "Session not found or not in progress" });
      return;
    }

    await db.insert(violationsTable).values({
      sessionId,
      userId,
      type: parsed.data.type,
    });

    const [{ value: violationCount }] = await db
      .select({ value: count() })
      .from(violationsTable)
      .where(eq(violationsTable.sessionId, sessionId));

    const shouldAutoSubmit = violationCount >= MAX_VIOLATIONS;

    if (shouldAutoSubmit) {
      await db
        .update(testSessionsTable)
        .set({ status: "auto_submitted", submittedAt: new Date() })
        .where(eq(testSessionsTable.id, sessionId));
    }

    res.json({
      violationCount: Number(violationCount),
      maxViolations: MAX_VIOLATIONS,
      autoSubmitted: shouldAutoSubmit,
      warning: !shouldAutoSubmit
        ? `Warning ${violationCount}/${MAX_VIOLATIONS}: Exam will be auto-submitted after ${MAX_VIOLATIONS} violations.`
        : undefined,
    });
  }
);

router.get(
  "/v1/sessions/:id/violations",
  requireAuth,
  async (req: AuthRequest, res): Promise<void> => {
    const sessionId = parseInt(req.params.id as string, 10);
    if (isNaN(sessionId)) {
      res.status(400).json({ error: "Invalid session ID" });
      return;
    }

    const userId = req.userId!;
    const [session] = await db
      .select()
      .from(testSessionsTable)
      .where(and(eq(testSessionsTable.id, sessionId), eq(testSessionsTable.userId, userId)));

    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    const violations = await db
      .select()
      .from(violationsTable)
      .where(eq(violationsTable.sessionId, sessionId));

    res.json({ violations, total: violations.length, maxViolations: MAX_VIOLATIONS });
  }
);

export default router;
