import { Router, type IRouter } from "express";
import {
  db,
  userGoalsTable,
  sessionAnswersTable,
  practiceSessionAnswersTable,
  testSessionsTable,
  practiceSessionsTable,
} from "@workspace/db";
import { eq, and, gte, sql } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../../middlewares/auth";

const router: IRouter = Router();

// Helper to get time boundaries
const getBoundaries = () => {
  const now = new Date();

  const startOfToday = new Date(now);
  startOfToday.setUTCHours(0, 0, 0, 0);

  const startOfWeek = new Date(now);
  const day = startOfWeek.getDay();
  const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
  startOfWeek.setDate(diff);
  startOfWeek.setUTCHours(0, 0, 0, 0);

  const startOfMonth = new Date(now);
  startOfMonth.setDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);

  return { startOfToday, startOfWeek, startOfMonth };
};

// GET /api/v1/goals
router.get(
  "/v1/goals",
  requireAuth,
  async (req: AuthRequest, res): Promise<void> => {
    try {
      const userId = req.userId!;
      const { startOfToday, startOfWeek, startOfMonth } = getBoundaries();

      // 1. Fetch or create user goal target
      let [goal] = await db
        .select()
        .from(userGoalsTable)
        .where(eq(userGoalsTable.userId, userId))
        .limit(1);

      if (!goal) {
        [goal] = await db
          .insert(userGoalsTable)
          .values({
            userId,
            dailyQuestionsTarget: 20,
            weeklyQuestionsTarget: 120,
            monthlyQuestionsTarget: 500,
            dailyMinutesTarget: 45,
            dailyHoursTarget: 0.75,
            practiceAccuracyTarget: 0.75,
            targetExam: "SSC CGL",
            targetScore: 160,
            targetAccuracy: 0.8,
          })
          .returning();
      }

      // 2. Query actual progress
      // A. Solved count for Today, Week, Month
      // Exam answers counts
      const [[{ solvedTodayExam }]] = await Promise.all([
        db
          .select({ solvedTodayExam: sql<number>`count(${sessionAnswersTable.id})::int` })
          .from(sessionAnswersTable)
          .innerJoin(testSessionsTable, eq(sessionAnswersTable.sessionId, testSessionsTable.id))
          .where(
            and(
              eq(testSessionsTable.userId, userId),
              gte(testSessionsTable.startedAt, startOfToday),
              eq(sessionAnswersTable.status, "answered")
            )
          ),
      ]);
      const [[{ solvedWeekExam }]] = await Promise.all([
        db
          .select({ solvedWeekExam: sql<number>`count(${sessionAnswersTable.id})::int` })
          .from(sessionAnswersTable)
          .innerJoin(testSessionsTable, eq(sessionAnswersTable.sessionId, testSessionsTable.id))
          .where(
            and(
              eq(testSessionsTable.userId, userId),
              gte(testSessionsTable.startedAt, startOfWeek),
              eq(sessionAnswersTable.status, "answered")
            )
          ),
      ]);
      const [[{ solvedMonthExam }]] = await Promise.all([
        db
          .select({ solvedMonthExam: sql<number>`count(${sessionAnswersTable.id})::int` })
          .from(sessionAnswersTable)
          .innerJoin(testSessionsTable, eq(sessionAnswersTable.sessionId, testSessionsTable.id))
          .where(
            and(
              eq(testSessionsTable.userId, userId),
              gte(testSessionsTable.startedAt, startOfMonth),
              eq(sessionAnswersTable.status, "answered")
            )
          ),
      ]);

      // Practice answers counts
      const [[{ solvedTodayPrac }]] = await Promise.all([
        db
          .select({ solvedTodayPrac: sql<number>`count(${practiceSessionAnswersTable.id})::int` })
          .from(practiceSessionAnswersTable)
          .innerJoin(practiceSessionsTable, eq(practiceSessionAnswersTable.sessionId, practiceSessionsTable.id))
          .where(
            and(
              eq(practiceSessionsTable.userId, userId),
              gte(practiceSessionsTable.startedAt, startOfToday),
              eq(practiceSessionAnswersTable.status, "answered")
            )
          ),
      ]);
      const [[{ solvedWeekPrac }]] = await Promise.all([
        db
          .select({ solvedWeekPrac: sql<number>`count(${practiceSessionAnswersTable.id})::int` })
          .from(practiceSessionAnswersTable)
          .innerJoin(practiceSessionsTable, eq(practiceSessionAnswersTable.sessionId, practiceSessionsTable.id))
          .where(
            and(
              eq(practiceSessionsTable.userId, userId),
              gte(practiceSessionsTable.startedAt, startOfWeek),
              eq(practiceSessionAnswersTable.status, "answered")
            )
          ),
      ]);
      const [[{ solvedMonthPrac }]] = await Promise.all([
        db
          .select({ solvedMonthPrac: sql<number>`count(${practiceSessionAnswersTable.id})::int` })
          .from(practiceSessionAnswersTable)
          .innerJoin(practiceSessionsTable, eq(practiceSessionAnswersTable.sessionId, practiceSessionsTable.id))
          .where(
            and(
              eq(practiceSessionsTable.userId, userId),
              gte(practiceSessionsTable.startedAt, startOfMonth),
              eq(practiceSessionAnswersTable.status, "answered")
            )
          ),
      ]);

      const solvedToday = Number(solvedTodayExam ?? 0) + Number(solvedTodayPrac ?? 0);
      const solvedWeek = Number(solvedWeekExam ?? 0) + Number(solvedWeekPrac ?? 0);
      const solvedMonth = Number(solvedMonthExam ?? 0) + Number(solvedMonthPrac ?? 0);

      // B. Study hours today (time spent in test sessions + practice sessions in seconds)
      const [[{ examTimeToday }]] = await Promise.all([
        db
          .select({ examTimeToday: sql<number>`coalesce(sum(${sessionAnswersTable.timeSpentSeconds}), 0)::int` })
          .from(sessionAnswersTable)
          .innerJoin(testSessionsTable, eq(sessionAnswersTable.sessionId, testSessionsTable.id))
          .where(
            and(
              eq(testSessionsTable.userId, userId),
              gte(testSessionsTable.startedAt, startOfToday)
            )
          ),
      ]);

      const [[{ pracTimeToday }]] = await Promise.all([
        db
          .select({ pracTimeToday: sql<number>`coalesce(sum(${practiceSessionAnswersTable.timeTakenSeconds}), 0)::int` })
          .from(practiceSessionAnswersTable)
          .innerJoin(practiceSessionsTable, eq(practiceSessionAnswersTable.sessionId, practiceSessionsTable.id))
          .where(
            and(
              eq(practiceSessionsTable.userId, userId),
              gte(practiceSessionsTable.startedAt, startOfToday)
            )
          ),
      ]);

      const totalTimeSeconds = Number(examTimeToday ?? 0) + Number(pracTimeToday ?? 0);
      const hoursToday = Math.round((totalTimeSeconds / 3600) * 100) / 100; // converted to decimal hours (e.g. 1.25 hours)

      res.json({
        targets: {
          dailyQuestions: goal.dailyQuestionsTarget,
          weeklyQuestions: goal.weeklyQuestionsTarget,
          monthlyQuestions: goal.monthlyQuestionsTarget,
          dailyMinutes: goal.dailyMinutesTarget,
          dailyHours: goal.dailyHoursTarget,
          practiceAccuracy: goal.practiceAccuracyTarget,
          targetExam: goal.targetExam,
          targetScore: goal.targetScore,
          targetAccuracy: goal.targetAccuracy,
        },
        progress: {
          dailyQuestions: solvedToday,
          weeklyQuestions: solvedWeek,
          monthlyQuestions: solvedMonth,
          dailyHours: hoursToday,
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

// POST /api/v1/goals
router.post(
  "/v1/goals",
  requireAuth,
  async (req: AuthRequest, res): Promise<void> => {
    try {
      const userId = req.userId!;
      const {
        dailyQuestions,
        weeklyQuestions,
        monthlyQuestions,
        dailyMinutes,
        dailyHours,
        practiceAccuracy,
        targetExam,
        targetScore,
        targetAccuracy,
      } = req.body;

      const [existing] = await db
        .select()
        .from(userGoalsTable)
        .where(eq(userGoalsTable.userId, userId))
        .limit(1);

      if (existing) {
        await db
          .update(userGoalsTable)
          .set({
            dailyQuestionsTarget: dailyQuestions !== undefined ? Number(dailyQuestions) : existing.dailyQuestionsTarget,
            weeklyQuestionsTarget: weeklyQuestions !== undefined ? Number(weeklyQuestions) : existing.weeklyQuestionsTarget,
            monthlyQuestionsTarget: monthlyQuestions !== undefined ? Number(monthlyQuestions) : existing.monthlyQuestionsTarget,
            dailyMinutesTarget: dailyMinutes !== undefined ? Number(dailyMinutes) : existing.dailyMinutesTarget,
            dailyHoursTarget: dailyHours !== undefined ? Number(dailyHours) : existing.dailyHoursTarget,
            practiceAccuracyTarget: practiceAccuracy !== undefined ? Number(practiceAccuracy) : existing.practiceAccuracyTarget,
            targetExam: targetExam !== undefined ? targetExam : existing.targetExam,
            targetScore: targetScore !== undefined ? Number(targetScore) : existing.targetScore,
            targetAccuracy: targetAccuracy !== undefined ? Number(targetAccuracy) : existing.targetAccuracy,
            updatedAt: new Date(),
          })
          .where(eq(userGoalsTable.userId, userId));
      } else {
        await db.insert(userGoalsTable).values({
          userId,
          dailyQuestionsTarget: Number(dailyQuestions ?? 20),
          weeklyQuestionsTarget: Number(weeklyQuestions ?? 120),
          monthlyQuestionsTarget: Number(monthlyQuestions ?? 500),
          dailyMinutesTarget: Number(dailyMinutes ?? 45),
          dailyHoursTarget: Number(dailyHours ?? 0.75),
          practiceAccuracyTarget: Number(practiceAccuracy ?? 0.75),
          targetExam: targetExam ?? "SSC CGL",
          targetScore: Number(targetScore ?? 160),
          targetAccuracy: Number(targetAccuracy ?? 0.8),
        });
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

export default router;
