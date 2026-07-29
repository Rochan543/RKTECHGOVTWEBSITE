import {
  pgTable,
  text,
  serial,
  timestamp,
  real,
  boolean,
  integer,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { subjectsTable, topicsTable } from "./subjects";

export const questionsTable = pgTable("questions", {
  id: serial("id").primaryKey(),
  text: text("text").notNull(),
  type: text("type", {
    enum: [
      "single_choice",
      "multiple_choice",
      "true_false",
      "integer",
      "numerical",
    ],
  })
    .notNull()
    .default("single_choice"),
  difficulty: text("difficulty", { enum: ["easy", "medium", "hard"] })
    .notNull()
    .default("medium"),
  explanation: text("explanation"),
  hint: text("hint"),
  imageUrl: text("image_url"),
  positiveMarks: real("positive_marks").notNull().default(1),
  negativeMarks: real("negative_marks").notNull().default(0),
  subjectId: integer("subject_id")
    .notNull()
    .references(() => subjectsTable.id),
  topicId: integer("topic_id")
    .notNull()
    .references(() => topicsTable.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}, (table) => [
  index("questions_subject_id_idx").on(table.subjectId),
  index("questions_topic_id_idx").on(table.topicId),
]);

export const questionOptionsTable = pgTable("question_options", {
  id: serial("id").primaryKey(),
  questionId: integer("question_id")
    .notNull()
    .references(() => questionsTable.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  isCorrect: boolean("is_correct").notNull().default(false),
  order: integer("order").default(1),
}, (table) => [
  index("question_options_question_id_idx").on(table.questionId),
]);

export const insertQuestionSchema = createInsertSchema(questionsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertQuestion = z.infer<typeof insertQuestionSchema>;
export type Question = typeof questionsTable.$inferSelect;

export const insertQuestionOptionSchema = createInsertSchema(
  questionOptionsTable
).omit({ id: true });
export type InsertQuestionOption = z.infer<typeof insertQuestionOptionSchema>;
export type QuestionOption = typeof questionOptionsTable.$inferSelect;
