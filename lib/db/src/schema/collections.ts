import {
  pgTable,
  text,
  serial,
  timestamp,
  boolean,
  integer,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { questionsTable } from "./questions";
import { examsTable } from "./exams";

export const questionCollectionsTable = pgTable("question_collections", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  isArchived: boolean("is_archived").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const questionCollectionItemsTable = pgTable(
  "question_collection_items",
  {
    id: serial("id").primaryKey(),
    collectionId: integer("collection_id")
      .notNull()
      .references(() => questionCollectionsTable.id, { onDelete: "cascade" }),
    questionId: integer("question_id")
      .notNull()
      .references(() => questionsTable.id, { onDelete: "cascade" }),
    order: integer("order").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("collection_items_collection_id_idx").on(table.collectionId),
    index("collection_items_question_id_idx").on(table.questionId),
    unique("collection_items_unique").on(table.collectionId, table.questionId),
  ]
);

export const examCollectionsTable = pgTable(
  "exam_collections",
  {
    id: serial("id").primaryKey(),
    examId: integer("exam_id")
      .notNull()
      .references(() => examsTable.id, { onDelete: "cascade" }),
    collectionId: integer("collection_id")
      .notNull()
      .references(() => questionCollectionsTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("exam_collections_exam_id_idx").on(table.examId),
    index("exam_collections_collection_id_idx").on(table.collectionId),
    unique("exam_collections_unique").on(table.examId, table.collectionId),
  ]
);

export const insertQuestionCollectionSchema = createInsertSchema(
  questionCollectionsTable
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertQuestionCollection = (typeof insertQuestionCollectionSchema)['_output'];
export type QuestionCollection = typeof questionCollectionsTable.$inferSelect;

export const insertQuestionCollectionItemSchema = createInsertSchema(
  questionCollectionItemsTable
).omit({
  id: true,
  createdAt: true,
});
export type InsertQuestionCollectionItem = (typeof insertQuestionCollectionItemSchema)['_output'];
export type QuestionCollectionItem = typeof questionCollectionItemsTable.$inferSelect;

export const insertExamCollectionSchema = createInsertSchema(
  examCollectionsTable
).omit({
  id: true,
  createdAt: true,
});
export type InsertExamCollection = (typeof insertExamCollectionSchema)['_output'];
export type ExamCollection = typeof examCollectionsTable.$inferSelect;
