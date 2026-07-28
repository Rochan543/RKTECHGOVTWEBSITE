import { Router, type IRouter } from "express";
import { db, currentAffairsTable } from "@workspace/db";
import { eq, desc, ilike, and } from "drizzle-orm";
import { requireAuth, requireAdmin, type AuthRequest } from "../../middlewares/auth";
import { z } from "zod";

const router: IRouter = Router();

const ListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  category: z.enum(["gk", "current_affairs", "gs_news"]).optional(),
  search: z.string().optional(),
});

const CreateSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  category: z.enum(["gk", "current_affairs", "gs_news"]).default("current_affairs"),
  imageUrl: z.string().url().optional(),
  publishedDate: z.string().datetime().optional(),
});

const UpdateSchema = CreateSchema.partial();

router.get(
  "/v1/current-affairs",
  requireAuth,
  async (req: AuthRequest, res): Promise<void> => {
    const parsed = ListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const { page, limit, category, search } = parsed.data;

    const conditions = [];
    if (category) conditions.push(eq(currentAffairsTable.category, category));
    if (search) conditions.push(ilike(currentAffairsTable.title, `%${search}%`));

    const allItems = await db
      .select()
      .from(currentAffairsTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(currentAffairsTable.publishedDate));

    const total = allItems.length;
    const items = allItems.slice((page - 1) * limit, page * limit);

    res.json({ data: items, total, page, limit });
  }
);

router.get(
  "/v1/current-affairs/:id",
  requireAuth,
  async (req, res): Promise<void> => {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }
    const [item] = await db
      .select()
      .from(currentAffairsTable)
      .where(eq(currentAffairsTable.id, id));
    if (!item) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(item);
  }
);

router.post(
  "/v1/current-affairs",
  requireAdmin,
  async (req: AuthRequest, res): Promise<void> => {
    const parsed = CreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [item] = await db
      .insert(currentAffairsTable)
      .values({
        ...parsed.data,
        publishedDate: parsed.data.publishedDate
          ? new Date(parsed.data.publishedDate)
          : new Date(),
      })
      .returning();
    res.status(201).json(item);
  }
);

router.put(
  "/v1/current-affairs/:id",
  requireAdmin,
  async (req: AuthRequest, res): Promise<void> => {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }
    const parsed = UpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const { publishedDate: pd, ...rest } = parsed.data;
    const [item] = await db
      .update(currentAffairsTable)
      .set({ ...rest, updatedAt: new Date(), ...(pd ? { publishedDate: new Date(pd) } : {}) })
      .where(eq(currentAffairsTable.id, id))
      .returning();
    if (!item) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(item);
  }
);

router.delete(
  "/v1/current-affairs/:id",
  requireAdmin,
  async (req: AuthRequest, res): Promise<void> => {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }
    await db.delete(currentAffairsTable).where(eq(currentAffairsTable.id, id));
    res.json({ message: "Deleted" });
  }
);

export default router;
