import {
  pgTable,
  text,
  serial,
  timestamp,
  real,
  integer,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { examCategoriesTable } from "./exam-categories";
import { questionsTable } from "./questions";
import { subjectsTable } from "./subjects";

export const examsTable = pgTable("exams", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  type: text("type", {
    enum: [
      "full_mock",
      "mini_mock",
      "topic_test",
      "chapter_test",
      "daily_quiz",
      "weekly_quiz",
      "pyq",
      "sectional",
    ],
  })
    .notNull()
    .default("full_mock"),
  status: text("status", { enum: ["draft", "published", "archived"] })
    .notNull()
    .default("draft"),
  durationMinutes: integer("duration_minutes").notNull().default(60),
  totalMarks: real("total_marks").notNull().default(100),
  positiveMarks: real("positive_marks").notNull().default(2),
  negativeMarks: real("negative_marks").notNull().default(0.5),
  categoryId: integer("category_id").references(() => examCategoriesTable.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const examSectionsTable = pgTable("exam_sections", {
  id: serial("id").primaryKey(),
  examId: integer("exam_id")
    .notNull()
    .references(() => examsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  durationMinutes: integer("duration_minutes"),
  order: integer("order").notNull().default(1),
  subjectId: integer("subject_id").references(() => subjectsTable.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const examQuestionsTable = pgTable("exam_questions", {
  id: serial("id").primaryKey(),
  examId: integer("exam_id")
    .notNull()
    .references(() => examsTable.id, { onDelete: "cascade" }),
  sectionId: integer("section_id").references(() => examSectionsTable.id),
  questionId: integer("question_id")
    .notNull()
    .references(() => questionsTable.id),
  order: integer("order").notNull().default(1),
});

export const insertExamSchema = createInsertSchema(examsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertExam = z.infer<typeof insertExamSchema>;
export type Exam = typeof examsTable.$inferSelect;

export const insertExamSectionSchema = createInsertSchema(
  examSectionsTable
).omit({ id: true, createdAt: true });
export type InsertExamSection = z.infer<typeof insertExamSectionSchema>;
export type ExamSection = typeof examSectionsTable.$inferSelect;
