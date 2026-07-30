import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  real,
  boolean,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { questionsTable, questionOptionsTable } from "./questions";
import { questionCollectionsTable } from "./collections";
import { subjectsTable, topicsTable } from "./subjects";

export const practiceSessionsTable = pgTable("practice_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  mode: text("mode", {
    enum: [
      "timed",
      "untimed",
      "random",
      "difficulty",
      "pyq",
      "bookmarks",
      "wrong_answers",
      "collection",
      "topic",
      "subject",
    ],
  }).notNull(),
  subjectId: integer("subject_id")
    .references(() => subjectsTable.id, { onDelete: "set null" }),
  topicId: integer("topic_id")
    .references(() => topicsTable.id, { onDelete: "set null" }),
  collectionId: integer("collection_id")
    .references(() => questionCollectionsTable.id, { onDelete: "set null" }),
  status: text("status", { enum: ["in_progress", "paused", "completed", "abandoned"] })
    .notNull()
    .default("in_progress"),
  startedAt: timestamp("started_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  score: real("score").notNull().default(0),
  accuracy: real("accuracy").notNull().default(0),
  timeTakenSeconds: integer("time_taken_seconds").notNull().default(0),
  totalQuestions: integer("total_questions").notNull().default(0),
  currentQuestionIndex: integer("current_question_index").notNull().default(0),
}, (table) => [
  index("practice_sessions_user_id_idx").on(table.userId),
  index("practice_sessions_status_idx").on(table.status),
]);

export const practiceSessionQuestionsTable = pgTable("practice_session_questions", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id")
    .notNull()
    .references(() => practiceSessionsTable.id, { onDelete: "cascade" }),
  questionId: integer("question_id")
    .notNull()
    .references(() => questionsTable.id, { onDelete: "cascade" }),
  displayOrder: integer("display_order").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => [
  index("practice_session_questions_session_id_idx").on(table.sessionId),
  index("practice_session_questions_question_id_idx").on(table.questionId),
  unique("practice_session_questions_unique").on(table.sessionId, table.questionId),
]);

export const practiceSessionAnswersTable = pgTable("practice_session_answers", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id")
    .notNull()
    .references(() => practiceSessionsTable.id, { onDelete: "cascade" }),
  questionId: integer("question_id")
    .notNull()
    .references(() => questionsTable.id, { onDelete: "cascade" }),
  selectedOptionId: integer("selected_option_id")
    .references(() => questionOptionsTable.id, { onDelete: "set null" }),
  isCorrect: boolean("is_correct").notNull().default(false),
  timeTakenSeconds: integer("time_taken_seconds").notNull().default(0),
  flagged: boolean("flagged").notNull().default(false),
  status: text("status", { enum: ["unvisited", "visited", "answered", "skipped"] })
    .notNull()
    .default("unvisited"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}, (table) => [
  index("practice_session_answers_session_id_idx").on(table.sessionId),
  index("practice_session_answers_question_id_idx").on(table.questionId),
  unique("practice_session_answers_unique").on(table.sessionId, table.questionId),
]);

export const wrongAnswersTable = pgTable("wrong_answers", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  questionId: integer("question_id")
    .notNull()
    .references(() => questionsTable.id, { onDelete: "cascade" }),
  attemptCount: integer("attempt_count").notNull().default(1),
  lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  sourceType: text("source_type", { enum: ["practice", "mock_test", "exam"] })
    .notNull()
    .default("practice"),
  sourceId: integer("source_id"),
}, (table) => [
  index("wrong_answers_user_id_idx").on(table.userId),
  index("wrong_answers_question_id_idx").on(table.questionId),
  unique("wrong_answers_unique").on(table.userId, table.questionId),
]);

export const practiceCollectionsTable = pgTable("practice_collections", {
  id: serial("id").primaryKey(),
  collectionId: integer("collection_id")
    .notNull()
    .references(() => questionCollectionsTable.id, { onDelete: "cascade" }),
  availableForPractice: boolean("available_for_practice").notNull().default(false),
  isVisible: boolean("is_visible").notNull().default(true),
  isFeatured: boolean("is_featured").notNull().default(false),
  difficulty: text("difficulty", { enum: ["easy", "medium", "hard"] })
    .notNull()
    .default("medium"),
  estimatedTimeMinutes: integer("estimated_time_minutes").notNull().default(15),
}, (table) => [
  index("practice_collections_collection_id_idx").on(table.collectionId),
  unique("practice_collections_unique_col").on(table.collectionId),
]);
