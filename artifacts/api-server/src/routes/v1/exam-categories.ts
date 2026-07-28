import { Router, type IRouter } from "express";
import { db, examCategoriesTable, examsTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import { requireAdmin } from "../../middlewares/auth";
import { CreateExamCategoryBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/v1/exam-categories", async (_req, res): Promise<void> => {
  const categories = await db.select().from(examCategoriesTable);

  const result = await Promise.all(categories.map(async (cat) => {
    const [examCount] = await db.select({ count: count() }).from(examsTable).where(eq(examsTable.categoryId, cat.id));
    return {
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      description: cat.description ?? null,
      iconUrl: cat.iconUrl ?? null,
      examCount: examCount?.count ?? 0,
    };
  }));

  res.json(result);
});

router.post("/v1/exam-categories", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateExamCategoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [cat] = await db.insert(examCategoriesTable).values(parsed.data).returning();
  res.status(201).json({ ...cat, examCount: 0 });
});

export default router;
