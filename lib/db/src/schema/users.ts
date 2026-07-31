import { pgTable, text, serial, timestamp, real, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["student", "admin", "super_admin"] })
    .notNull()
    .default("student"),
  status: text("status", { enum: ["active", "suspended"] })
    .notNull()
    .default("active"),
  phone: text("phone"),
  avatarUrl: text("avatar_url"),
  rank: integer("rank"),
  totalScore: real("total_score").default(0),
  xp: integer("xp").default(0).notNull(),
  level: integer("level").default(1).notNull(),
  dailyStreak: integer("daily_streak").default(0).notNull(),
  weeklyStreak: integer("weekly_streak").default(0).notNull(),
  monthlyStreak: integer("monthly_streak").default(0).notNull(),
  lastActivityDate: text("last_activity_date"),
  city: text("city"),
  college: text("college"),
  resetToken: text("reset_token"),
  resetTokenExpiresAt: timestamp("reset_token_expires_at", {
    withTimezone: true,
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}, (table) => [
  index("users_role_idx").on(table.role),
  index("users_status_idx").on(table.status),
]);

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertUser = (typeof insertUserSchema)['_output'];
export type User = typeof usersTable.$inferSelect;
