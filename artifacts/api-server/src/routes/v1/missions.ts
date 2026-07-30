import { Router, type IRouter } from "express";
import {
  db,
  usersTable,
  dailyMissionsTable,
  sessionAnswersTable,
  practiceSessionAnswersTable,
  testSessionsTable,
  practiceSessionsTable,
  currentAffairReadHistoryTable,
  currentAffairQuizAttemptsTable,
  studyPlansTable,
  resultsTable,
  notificationsTable,
} from "@workspace/db";
import { eq, and, gte, sql } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../../middlewares/auth";

const router: IRouter = Router();

const getTodayStr = () => new Date().toISOString().split("T")[0];

router.get(
  "/v1/missions/today",
  requireAuth,
  async (req: AuthRequest, res): Promise<void> => {
    try {
      const userId = req.userId!;
      const todayStr = getTodayStr();
      const startOfToday = new Date();
      startOfToday.setUTCHours(0, 0, 0, 0);

      // 1. Get or create missions for today
      let missions = await db
        .select()
        .from(dailyMissionsTable)
        .where(
          and(
            eq(dailyMissionsTable.userId, userId),
            eq(dailyMissionsTable.date, todayStr)
          )
        );

      if (missions.length === 0) {
        const defaultMissions = [
          {
            userId,
            date: todayStr,
            missionType: "solve_questions",
            description: "Solve 20 Questions",
            targetCount: 20,
            xpReward: 30,
          },
          {
            userId,
            date: todayStr,
            missionType: "read_ca",
            description: "Read 2 Current Affairs articles",
            targetCount: 2,
            xpReward: 15,
          },
          {
            userId,
            date: todayStr,
            missionType: "complete_revision",
            description: "Complete a Revision Queue session",
            targetCount: 1,
            xpReward: 20,
          },
          {
            userId,
            date: todayStr,
            missionType: "finish_study_task",
            description: "Finish at least 1 Study Plan Task",
            targetCount: 1,
            xpReward: 20,
          },
          {
            userId,
            date: todayStr,
            missionType: "take_mock",
            description: "Take 1 Mock Test",
            targetCount: 1,
            xpReward: 50,
          },
          {
            userId,
            date: todayStr,
            missionType: "practice_weak",
            description: "Practice a Weak Topic set",
            targetCount: 1,
            xpReward: 30,
          },
          {
            userId,
            date: todayStr,
            missionType: "complete_quiz",
            description: "Complete a Daily Quiz",
            targetCount: 1,
            xpReward: 25,
          },
        ];

        missions = await db
          .insert(dailyMissionsTable)
          .values(defaultMissions)
          .returning();
      }

      // 2. Query today's accomplishments to update progress
      // A. Solve questions count (exams + practice sessions)
      const [[{ examQuestionsCount }]] = await Promise.all([
        db
          .select({ examQuestionsCount: sql<number>`count(${sessionAnswersTable.id})::int` })
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

      const [[{ practiceQuestionsCount }]] = await Promise.all([
        db
          .select({ practiceQuestionsCount: sql<number>`count(${practiceSessionAnswersTable.id})::int` })
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

      const totalSolvedCount = Number(examQuestionsCount ?? 0) + Number(practiceQuestionsCount ?? 0);

      // B. Read CA count
      const [[{ caReadCount }]] = await Promise.all([
        db
          .select({ caReadCount: sql<number>`count(${currentAffairReadHistoryTable.id})::int` })
          .from(currentAffairReadHistoryTable)
          .where(
            and(
              eq(currentAffairReadHistoryTable.userId, userId),
              eq(currentAffairReadHistoryTable.completed, true),
              gte(currentAffairReadHistoryTable.lastReadAt, startOfToday)
            )
          ),
      ]);

      // C. Take Mock Test
      const [[{ mockTestCount }]] = await Promise.all([
        db
          .select({ mockTestCount: sql<number>`count(${resultsTable.id})::int` })
          .from(resultsTable)
          .where(
            and(
              eq(resultsTable.userId, userId),
              gte(resultsTable.createdAt, startOfToday)
            )
          ),
      ]);

      // D. Complete Daily Quiz
      const [[{ dailyQuizCount }]] = await Promise.all([
        db
          .select({ dailyQuizCount: sql<number>`count(${currentAffairQuizAttemptsTable.id})::int` })
          .from(currentAffairQuizAttemptsTable)
          .where(
            and(
              eq(currentAffairQuizAttemptsTable.userId, userId),
              eq(currentAffairQuizAttemptsTable.completed, true),
              gte(currentAffairQuizAttemptsTable.createdAt, startOfToday)
            )
          ),
      ]);

      // E. Study Plan tasks & revision
      const [studyPlan] = await db
        .select()
        .from(studyPlansTable)
        .where(
          and(
            eq(studyPlansTable.userId, userId),
            eq(studyPlansTable.date, todayStr)
          )
        )
        .limit(1);

      let finishedStudyTasks = 0;
      let finishedRevisionTasks = 0;

      if (studyPlan && studyPlan.tasks) {
        const tasks = studyPlan.tasks as any[];
        finishedStudyTasks = tasks.filter((t) => t.status === "completed").length;
        finishedRevisionTasks = tasks.filter((t) => t.type === "revision" && t.status === "completed").length;
      }

      // F. Practice Weak Topic (timed/practice sessions for topics where historical accuracy is < 60%)
      const [[{ weakTopicCount }]] = await Promise.all([
        db
          .select({ weakTopicCount: sql<number>`count(${practiceSessionsTable.id})::int` })
          .from(practiceSessionsTable)
          .where(
            and(
              eq(practiceSessionsTable.userId, userId),
              eq(practiceSessionsTable.mode, "topic"),
              eq(practiceSessionsTable.status, "completed"),
              gte(practiceSessionsTable.startedAt, startOfToday)
            )
          ),
      ]);

      // Map dynamic counts to missionTypes
      const countsMap: Record<string, number> = {
        solve_questions: totalSolvedCount,
        read_ca: Number(caReadCount ?? 0),
        complete_revision: finishedRevisionTasks > 0 ? 1 : 0,
        finish_study_task: finishedStudyTasks > 0 ? 1 : 0,
        take_mock: Number(mockTestCount ?? 0),
        practice_weak: Number(weakTopicCount ?? 0),
        complete_quiz: Number(dailyQuizCount ?? 0),
      };

      // 3. Update mission progress and grant XP on new completion
      const updatedMissions = [];
      let totalXpGained = 0;

      const [user] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, userId))
        .limit(1);

      let currentXp = user ? user.xp : 0;
      let currentLevel = user ? user.level : 1;

      for (const m of missions) {
        const currentCount = countsMap[m.missionType] ?? 0;
        const shouldBeCompleted = currentCount >= m.targetCount;
        const newlyCompleted = shouldBeCompleted && !m.completed;

        if (m.currentCount !== currentCount || m.completed !== shouldBeCompleted) {
          await db
            .update(dailyMissionsTable)
            .set({
              currentCount: Math.min(currentCount, m.targetCount),
              completed: shouldBeCompleted,
              updatedAt: new Date(),
            })
            .where(eq(dailyMissionsTable.id, m.id));

          m.currentCount = Math.min(currentCount, m.targetCount);
          m.completed = shouldBeCompleted;
        }

        if (newlyCompleted) {
          totalXpGained += m.xpReward;
          // Trigger notification
          await db.insert(notificationsTable).values({
            userId,
            title: "Daily Mission Completed!",
            body: `Congrats! You've completed "${m.description}" and earned ${m.xpReward} XP.`,
            type: "achievement",
          });
        }

        updatedMissions.push(m);
      }

      if (totalXpGained > 0 && user) {
        const newXp = currentXp + totalXpGained;
        const newLevel = Math.floor(newXp / 500) + 1;
        const leveledUp = newLevel > currentLevel;

        await db
          .update(usersTable)
          .set({
            xp: newXp,
            level: newLevel,
            totalScore: (user.totalScore ?? 0) + (totalXpGained / 10),
          })
          .where(eq(usersTable.id, userId));

        if (leveledUp) {
          await db.insert(notificationsTable).values({
            userId,
            title: "Level Up!",
            body: `Congratulations! You have reached Level ${newLevel}!`,
            type: "achievement",
          });
        }
      }

      res.json({
        missions: updatedMissions,
        xpGained: totalXpGained,
        newXp: currentXp + totalXpGained,
        newLevel: Math.floor((currentXp + totalXpGained) / 500) + 1,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

export default router;
