import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  real,
  index,
  unique,
  jsonb,
  boolean,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const learningRecommendationsTable = pgTable(
  "learning_recommendations",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    type: text("type", { enum: ["collection", "topic", "practice_set"] }).notNull(),
    entityId: integer("entity_id").notNull(),
    score: real("score").notNull().default(0),
    reason: text("reason").notNull(),
    generatedAt: timestamp("generated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("learning_recs_user_id_idx").on(table.userId),
  ]
);

export interface StudyPlanTask {
  id: string;
  type: "collection" | "topic" | "revision";
  entityId: number;
  entityName?: string;
  estimatedTimeMinutes: number;
  targetAccuracy: number;
  status: "pending" | "completed" | "skipped" | "rescheduled";
  rescheduledTo?: string;
}

export const studyPlansTable = pgTable(
  "study_plans",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    date: text("date").notNull(), // format: YYYY-MM-DD
    status: text("status", { enum: ["pending", "completed", "skipped"] })
      .notNull()
      .default("pending"),
    tasks: jsonb("tasks").$type<StudyPlanTask[]>().notNull().default([]),
    generatedAt: timestamp("generated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("study_plans_user_id_idx").on(table.userId),
    index("study_plans_date_idx").on(table.date),
    unique("study_plans_user_date_unique").on(table.userId, table.date),
  ]
);

export const studyPlanTemplatesTable = pgTable(
  "study_plan_templates",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    difficulty: text("difficulty", { enum: ["easy", "medium", "hard"] }).notNull(),
    durationDays: integer("duration_days").notNull(),
    tasks: jsonb("tasks").$type<any[]>().notNull().default([]), // Array of tasks in the plan template
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  }
);

export const userStudyPlanAssignmentsTable = pgTable(
  "user_study_plan_assignments",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    templateId: integer("template_id")
      .notNull()
      .references(() => studyPlanTemplatesTable.id, { onDelete: "cascade" }),
    assignedAt: timestamp("assigned_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("user_study_plan_assignments_user_idx").on(table.userId),
    index("user_study_plan_assignments_template_idx").on(table.templateId),
  ]
);

export const assignedTasksTable = pgTable(
  "assigned_tasks",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    type: text("type", { enum: ["collection", "topic", "practice_set"] }).notNull(),
    entityId: integer("entity_id").notNull(),
    assignedAt: timestamp("assigned_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    status: text("status", { enum: ["pending", "completed"] })
      .notNull()
      .default("pending"),
  },
  (table) => [
    index("assigned_tasks_user_id_idx").on(table.userId),
  ]
);

export type LearningRecommendation = typeof learningRecommendationsTable.$inferSelect;
export type InsertLearningRecommendation = typeof learningRecommendationsTable.$inferInsert;

export type StudyPlan = typeof studyPlansTable.$inferSelect;
export type InsertStudyPlan = typeof studyPlansTable.$inferInsert;

export type StudyPlanTemplate = typeof studyPlanTemplatesTable.$inferSelect;
export type InsertStudyPlanTemplate = typeof studyPlanTemplatesTable.$inferInsert;

export type UserStudyPlanAssignment = typeof userStudyPlanAssignmentsTable.$inferSelect;
export type InsertUserStudyPlanAssignment = typeof userStudyPlanAssignmentsTable.$inferInsert;

export type AssignedTask = typeof assignedTasksTable.$inferSelect;
export type InsertAssignedTask = typeof assignedTasksTable.$inferInsert;

// Adaptive Engine Settings Table
export const adaptiveSettingsTable = pgTable("adaptive_settings", {
  id: serial("id").primaryKey(),
  masteryThreshold: real("mastery_threshold").notNull().default(0.8), // 0 to 1
  accuracyThreshold: real("accuracy_threshold").notNull().default(0.7), // 0 to 1
  weakTopicThreshold: real("weak_topic_threshold").notNull().default(0.5), // 0 to 1
  recommendationFrequency: integer("recommendation_frequency").notNull().default(7), // in days
  sm2Ease: real("sm2_ease").notNull().default(2.5),
  sm2IntervalModifier: real("sm2_interval_modifier").notNull().default(1.0),
  difficultyProgression: text("difficulty_progression").notNull().default("standard"),
  automaticAssignments: boolean("automatic_assignments").notNull().default(true),
  dailyGoalQuestions: integer("daily_goal_questions").notNull().default(10),
  dailyGoalMinutes: integer("daily_goal_minutes").notNull().default(30),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// User goals table (for personalized/assigned goals)
export const userGoalsTable = pgTable("user_goals", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  dailyQuestionsTarget: integer("daily_questions_target").notNull().default(15),
  weeklyQuestionsTarget: integer("weekly_questions_target").notNull().default(100),
  monthlyQuestionsTarget: integer("monthly_questions_target").notNull().default(400),
  dailyMinutesTarget: integer("daily_minutes_target").notNull().default(45),
  dailyHoursTarget: real("daily_hours_target").notNull().default(1.0),
  practiceAccuracyTarget: real("practice_accuracy_target").notNull().default(0.75),
  targetExam: text("target_exam").default("SSC CGL"),
  targetScore: integer("target_score").default(150),
  targetAccuracy: real("target_accuracy").default(0.8),
  assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("user_goals_user_id_idx").on(table.userId),
]);

export type AdaptiveSettings = typeof adaptiveSettingsTable.$inferSelect;
export type InsertAdaptiveSettings = typeof adaptiveSettingsTable.$inferInsert;

export type UserGoal = typeof userGoalsTable.$inferSelect;
export type InsertUserGoal = typeof userGoalsTable.$inferInsert;


