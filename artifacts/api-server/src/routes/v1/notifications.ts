import { Router, type IRouter } from "express";
import { db, notificationsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../../middlewares/auth";
import { MarkNotificationReadParams } from "@workspace/api-zod";
import { activeClients } from "../../lib/notifications";

const router: IRouter = Router();

router.get("/v1/notifications/stream", requireAuth, (req: AuthRequest, res): void => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
  });
  res.write("\n");

  const userId = req.userId!;
  const client = { userId, res };
  activeClients.push(client);

  const heartbeat = setInterval(() => {
    res.write(`data: ${JSON.stringify({ type: "heartbeat" })}\n\n`);
  }, 30000);

  req.on("close", () => {
    clearInterval(heartbeat);
    const index = activeClients.indexOf(client);
    if (index !== -1) {
      activeClients.splice(index, 1);
    }
  });
});

router.get("/v1/notifications", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const notifications = await db.select().from(notificationsTable)
    .where(eq(notificationsTable.userId, req.userId!));
  res.json(notifications.map(n => ({
    id: n.id,
    title: n.title,
    body: n.body,
    type: n.type,
    isRead: n.isRead,
    link: n.link ?? null,
    createdAt: n.createdAt,
  })));
});

router.patch("/v1/notifications/:id/read", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const params = MarkNotificationReadParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.update(notificationsTable).set({ isRead: true })
    .where(and(eq(notificationsTable.id, params.data.id), eq(notificationsTable.userId, req.userId!)));
  res.json({ message: "Marked as read" });
});

router.patch("/v1/notifications/read-all", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  await db.update(notificationsTable).set({ isRead: true })
    .where(eq(notificationsTable.userId, req.userId!));
  res.json({ message: "All marked as read" });
});

export default router;
