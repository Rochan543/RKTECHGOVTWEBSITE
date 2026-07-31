import {
  pgTable,
  text,
  serial,
  timestamp,
  real,
  integer,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { usersTable } from "./users";
import { examsTable } from "./exams";
import { questionsTable } from "./questions";
import { questionOptionsTable } from "./questions";

export const testSessionsTable = pgTable("test_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id),
  examId: integer("exam_id")
    .notNull()
    .references(() => examsTable.id),
  status: text("status", {
    enum: ["in_progress", "submitted", "auto_submitted", "abandoned"],
  })
    .notNull()
    .default("in_progress"),
  currentQuestionIndex: integer("current_question_index").default(0),
  currentSectionIndex: integer("current_section_index").default(0),
  startedAt: timestamp("started_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
}, (table) => [
  index("test_sessions_user_id_idx").on(table.userId),
  index("test_sessions_exam_id_idx").on(table.examId),
]);

export const sessionAnswersTable = pgTable("session_answers", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id")
    .notNull()
    .references(() => testSessionsTable.id, { onDelete: "cascade" }),
  questionId: integer("question_id")
    .notNull()
    .references(() => questionsTable.id),
  selectedOptionId: integer("selected_option_id").references(
    () => questionOptionsTable.id
  ),
  status: text("status", {
    enum: ["not_visited", "visited", "answered", "marked", "marked_answered"],
  })
    .notNull()
    .default("not_visited"),
  timeSpentSeconds: integer("time_spent_seconds").default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}, (table) => [
  index("session_answers_session_id_idx").on(table.sessionId),
  index("session_answers_question_id_idx").on(table.questionId),
]);

export const resultsTable = pgTable("results", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id")
    .notNull()
    .references(() => testSessionsTable.id),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id),
  examId: integer("exam_id")
    .notNull()
    .references(() => examsTable.id),
  score: real("score").notNull().default(0),
  totalMarks: real("total_marks").notNull(),
  correct: integer("correct").default(0),
  incorrect: integer("incorrect").default(0),
  skipped: integer("skipped").default(0),
  timeTakenSeconds: integer("time_taken_seconds").default(0),
  accuracy: real("accuracy").notNull().default(0),
  rank: integer("rank"),
  percentile: real("percentile"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => [
  index("results_user_id_idx").on(table.userId),
  index("results_exam_id_idx").on(table.examId),
  index("results_session_id_idx").on(table.sessionId),
]);

export const violationsTable = pgTable("violations", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id")
    .notNull()
    .references(() => testSessionsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  type: text("type", {
    enum: ["tab_switch", "window_blur", "fullscreen_exit", "context_menu", "copy_attempt"],
  }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => [
  index("violations_session_id_idx").on(table.sessionId),
  index("violations_user_id_idx").on(table.userId),
]);

export type Violation = typeof violationsTable.$inferSelect;
export type InsertViolation = typeof violationsTable.$inferInsert;

export const insertTestSessionSchema = createInsertSchema(
  testSessionsTable
).omit({ id: true, startedAt: true });
export type InsertTestSession = (typeof insertTestSessionSchema)['_output'];
export type TestSession = typeof testSessionsTable.$inferSelect;

export const insertSessionAnswerSchema = createInsertSchema(
  sessionAnswersTable
).omit({ id: true, updatedAt: true });
export type InsertSessionAnswer = (typeof insertSessionAnswerSchema)['_output'];
export type SessionAnswer = typeof sessionAnswersTable.$inferSelect;

export const insertResultSchema = createInsertSchema(resultsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertResult = (typeof insertResultSchema)['_output'];
export type Result = typeof resultsTable.$inferSelect;
