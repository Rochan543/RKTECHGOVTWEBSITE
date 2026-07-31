import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const examCategoriesTable = pgTable("exam_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  iconUrl: text("icon_url"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertExamCategorySchema = createInsertSchema(
  examCategoriesTable
).omit({ id: true, createdAt: true });
export type InsertExamCategory = z.infer<typeof insertExamCategorySchema>;
export type ExamCategory = typeof examCategoriesTable.$inferSelect;
