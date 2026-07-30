import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  boolean,
  real,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const userBadgesTable = pgTable("user_badges", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  badgeType: text("badge_type").notNull(), // perfect_accuracy, top_performer, consistency_award, speed_solver, etc.
  earnedAt: timestamp("earned_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("user_badges_user_id_idx").on(table.userId),
  unique("unique_user_badge").on(table.userId, table.badgeType),
]);

export const dailyLoginRewardsTable = pgTable("daily_login_rewards", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  claimDate: text("claim_date").notNull(), // YYYY-MM-DD
  xpEarned: integer("xp_earned").notNull().default(20),
  claimedAt: timestamp("claimed_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("daily_login_rewards_user_id_idx").on(table.userId),
  unique("unique_user_login_reward").on(table.userId, table.claimDate),
]);

export const dailyMissionsTable = pgTable("daily_missions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  date: text("date").notNull(), // YYYY-MM-DD
  missionType: text("mission_type").notNull(), // solve_questions, read_ca, complete_revision, finish_study_task, take_mock, practice_weak, complete_quiz
  description: text("description").notNull(),
  targetCount: integer("target_count").notNull(),
  currentCount: integer("current_count").notNull().default(0),
  completed: boolean("completed").notNull().default(false),
  xpReward: integer("xp_reward").notNull().default(10),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("daily_missions_user_id_idx").on(table.userId),
  index("daily_missions_date_idx").on(table.date),
  unique("unique_user_mission_type_date").on(table.userId, table.missionType, table.date),
]);

export const studyTasksTable = pgTable("study_tasks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull(), // Quantitative, Reasoning, English, General Awareness, Computer, Custom
  priority: text("priority").notNull().default("medium"), // high, medium, low
  durationMinutes: integer("duration_minutes").notNull().default(60),
  completed: boolean("completed").notNull().default(false),
  date: text("date").notNull(), // YYYY-MM-DD
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("study_tasks_user_id_idx").on(table.userId),
  index("study_tasks_date_idx").on(table.date),
]);

export const gamificationConfigTable = pgTable("gamification_config", {
  id: serial("id").primaryKey(),
  dailyLoginXp: integer("daily_login_xp").notNull().default(20),
  solveQuestionXp: integer("solve_question_xp").notNull().default(2),
  readArticleXp: integer("read_article_xp").notNull().default(5),
  completeMissionXp: integer("complete_mission_xp").notNull().default(50),
  perfectAccuracyXp: integer("perfect_accuracy_xp").notNull().default(100),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
