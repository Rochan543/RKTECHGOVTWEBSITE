import {
  pgTable,
  text,
  serial,
  timestamp,
  boolean,
  integer,
  real,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { questionsTable } from "./questions";

// Categories Table
export const currentAffairCategoriesTable = pgTable("current_affair_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertCurrentAffairCategorySchema = createInsertSchema(currentAffairCategoriesTable).omit({
  id: true,
  createdAt: true,
});
export type CurrentAffairCategory = typeof currentAffairCategoriesTable.$inferSelect;
export type InsertCurrentAffairCategory = z.infer<typeof insertCurrentAffairCategorySchema>;

// Tags Table
export const currentAffairTagsTable = pgTable("current_affair_tags", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertCurrentAffairTagSchema = createInsertSchema(currentAffairTagsTable).omit({
  id: true,
  createdAt: true,
});
export type CurrentAffairTag = typeof currentAffairTagsTable.$inferSelect;
export type InsertCurrentAffairTag = z.infer<typeof insertCurrentAffairTagSchema>;

// Current Affairs Articles Table
export const currentAffairsTable = pgTable("current_affairs", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  content: text("content").notNull(), // Rich text or markdown
  categoryId: integer("category_id").references(() => currentAffairCategoriesTable.id, { onDelete: "set null" }),
  category: text("category").notNull().default("current_affairs"), // Legacy column compatibility
  imageUrl: text("image_url"),
  publishedDate: timestamp("published_date", { withTimezone: true })
    .notNull()
    .defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  author: text("author").notNull().default("Admin"),
  readingTime: integer("reading_time").notNull().default(0), // Estimated in minutes
  highlights: text("highlights"), // Rich highlights / key bullet points
  facts: text("facts"), // Quick key facts
  examRelevance: text("exam_relevance"), // SSC Exam relevance description
  status: text("status", { enum: ["draft", "scheduled", "published", "archived"] })
    .notNull()
    .default("published"),
  views: integer("views").notNull().default(0),
  bookmarksCount: integer("bookmarks_count").notNull().default(0),
  featured: boolean("featured").notNull().default(false),
}, (table) => [
  index("current_affairs_category_id_idx").on(table.categoryId),
  index("current_affairs_status_pub_date_idx").on(table.status, table.publishedDate),
  index("current_affairs_views_idx").on(table.views),
]);

export const insertCurrentAffairsSchema = createInsertSchema(currentAffairsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type CurrentAffairs = typeof currentAffairsTable.$inferSelect;
export type InsertCurrentAffairs = z.infer<typeof insertCurrentAffairsSchema>;

// Article Tags Join Table
export const currentAffairArticleTagsTable = pgTable("current_affair_article_tags", {
  articleId: integer("article_id")
    .notNull()
    .references(() => currentAffairsTable.id, { onDelete: "cascade" }),
  tagId: integer("tag_id")
    .notNull()
    .references(() => currentAffairTagsTable.id, { onDelete: "cascade" }),
}, (table) => [
  unique("unique_article_tag").on(table.articleId, table.tagId),
]);

// Bookmarks Table
export const currentAffairBookmarksTable = pgTable("current_affair_bookmarks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  articleId: integer("article_id")
    .notNull()
    .references(() => currentAffairsTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => [
  unique("unique_current_affair_bookmark").on(table.userId, table.articleId),
  index("current_affair_bookmarks_user_idx").on(table.userId),
]);

export type CurrentAffairBookmark = typeof currentAffairBookmarksTable.$inferSelect;

// Read History Table
export const currentAffairReadHistoryTable = pgTable("current_affair_read_history", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  articleId: integer("article_id")
    .notNull()
    .references(() => currentAffairsTable.id, { onDelete: "cascade" }),
  progress: integer("progress").notNull().default(0), // Percentage (0 to 100)
  secondsRead: integer("seconds_read").notNull().default(0),
  completed: boolean("completed").notNull().default(false),
  lastReadAt: timestamp("last_read_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => [
  unique("unique_current_affair_read_history").on(table.userId, table.articleId),
  index("current_affair_read_history_user_idx").on(table.userId),
]);

export type CurrentAffairReadHistory = typeof currentAffairReadHistoryTable.$inferSelect;

// Quizzes Table
export const currentAffairQuizzesTable = pgTable("current_affair_quizzes", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  type: text("type", { enum: ["daily", "weekly", "monthly"] })
    .notNull()
    .default("daily"),
  duration: integer("duration"), // in minutes (nullable for untimed)
  publishedDate: timestamp("published_date", { withTimezone: true })
    .notNull()
    .defaultNow(),
  status: text("status", { enum: ["draft", "scheduled", "published", "archived"] })
    .notNull()
    .default("published"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertCurrentAffairQuizSchema = createInsertSchema(currentAffairQuizzesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type CurrentAffairQuiz = typeof currentAffairQuizzesTable.$inferSelect;
export type InsertCurrentAffairQuiz = z.infer<typeof insertCurrentAffairQuizSchema>;

// Quiz Questions Junction Table
export const currentAffairQuizQuestionsTable = pgTable("current_affair_quiz_questions", {
  quizId: integer("quiz_id")
    .notNull()
    .references(() => currentAffairQuizzesTable.id, { onDelete: "cascade" }),
  questionId: integer("question_id")
    .notNull()
    .references(() => questionsTable.id, { onDelete: "cascade" }),
  order: integer("order").notNull().default(1),
}, (table) => [
  unique("unique_quiz_question").on(table.quizId, table.questionId),
]);

export type CurrentAffairQuizQuestion = typeof currentAffairQuizQuestionsTable.$inferSelect;

// Quiz Attempts Table
export const currentAffairQuizAttemptsTable = pgTable("current_affair_quiz_attempts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  quizId: integer("quiz_id")
    .notNull()
    .references(() => currentAffairQuizzesTable.id, { onDelete: "cascade" }),
  score: real("score").notNull().default(0),
  maxScore: real("max_score").notNull().default(0),
  timeSpent: integer("time_spent").notNull().default(0), // seconds
  completed: boolean("completed").notNull().default(false),
  answers: text("answers"), // JSON array of details [{ questionId, selectedOptionId, isCorrect }]
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => [
  index("current_affair_quiz_attempts_user_quiz_idx").on(table.userId, table.quizId),
]);

export type CurrentAffairQuizAttempt = typeof currentAffairQuizAttemptsTable.$inferSelect;

// Monthly Issues Table
export const monthlyCurrentAffairsTable = pgTable("monthly_current_affairs", {
  id: serial("id").primaryKey(),
  month: integer("month").notNull(), // 1 to 12
  year: integer("year").notNull(),
  pdfUrl: text("pdf_url").notNull(),
  pdfName: text("pdf_name").notNull(),
  pdfSize: integer("pdf_size").notNull().default(0),
  downloadCount: integer("download_count").notNull().default(0),
  revisionNotes: text("revision_notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}, (table) => [
  unique("unique_month_year").on(table.month, table.year),
]);

export const insertMonthlyCurrentAffairsSchema = createInsertSchema(monthlyCurrentAffairsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type MonthlyCurrentAffairs = typeof monthlyCurrentAffairsTable.$inferSelect;
export type InsertMonthlyCurrentAffairs = z.infer<typeof insertMonthlyCurrentAffairsSchema>;
