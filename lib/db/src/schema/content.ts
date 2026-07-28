import {
  pgTable,
  text,
  serial,
  timestamp,
  boolean,
  integer,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { subjectsTable } from "./subjects";
import { examCategoriesTable } from "./exam-categories";
import { questionsTable } from "./questions";

export const notesTable = pgTable("notes", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  type: text("type", { enum: ["pdf", "docx", "ppt", "image", "video"] })
    .notNull()
    .default("pdf"),
  fileUrl: text("file_url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  size: integer("size").notNull().default(0),
  subjectId: integer("subject_id").references(() => subjectsTable.id),
  categoryId: integer("category_id").references(() => examCategoriesTable.id),
  downloadCount: integer("download_count").default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  body: text("body").notNull(),
  type: text("type", {
    enum: ["exam_result", "new_exam", "announcement", "achievement", "system"],
  })
    .notNull()
    .default("system"),
  isRead: boolean("is_read").notNull().default(false),
  link: text("link"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const bookmarksTable = pgTable(
  "bookmarks",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    questionId: integer("question_id")
      .notNull()
      .references(() => questionsTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("unique_bookmark").on(t.userId, t.questionId)],
);

export const currentAffairsTable = pgTable("current_affairs", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  category: text("category", { enum: ["gk", "current_affairs", "gs_news"] })
    .notNull()
    .default("current_affairs"),
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
});

export const achievementsTable = pgTable(
  "achievements",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    xp: integer("xp").notNull().default(0),
    unlockedAt: timestamp("unlocked_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("unique_user_achievement").on(t.userId, t.type)],
);

export const auditLogsTable = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: integer("entity_id"),
  details: text("details"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertNoteSchema = createInsertSchema(notesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertNote = z.infer<typeof insertNoteSchema>;
export type Note = typeof notesTable.$inferSelect;

export const insertNotificationSchema = createInsertSchema(
  notificationsTable
).omit({ id: true, createdAt: true });
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notificationsTable.$inferSelect;

export type Bookmark = typeof bookmarksTable.$inferSelect;

export const insertCurrentAffairsSchema = createInsertSchema(currentAffairsTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type InsertCurrentAffairs = z.infer<typeof insertCurrentAffairsSchema>;
export type CurrentAffairs = typeof currentAffairsTable.$inferSelect;

export const insertAchievementSchema = createInsertSchema(achievementsTable).omit({
  id: true, unlockedAt: true,
});
export type InsertAchievement = z.infer<typeof insertAchievementSchema>;
export type Achievement = typeof achievementsTable.$inferSelect;

export type AuditLog = typeof auditLogsTable.$inferSelect;

export const fileUploadsTable = pgTable("file_uploads", {
  id: serial("id").primaryKey(),
  fileUrl: text("file_url").notNull(),
  publicId: text("public_id").notNull(),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  fileSize: integer("file_size").notNull(),
  uploadedBy: integer("uploaded_by").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type FileUpload = typeof fileUploadsTable.$inferSelect;
export type InsertFileUpload = typeof fileUploadsTable.$inferInsert;

