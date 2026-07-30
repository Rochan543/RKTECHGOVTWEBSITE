import { Router, type IRouter } from "express";
import {
  db,
  resultsTable,
  practiceSessionsTable,
  sessionAnswersTable,
  practiceSessionAnswersTable,
  currentAffairReadHistoryTable,
  studyPlansTable,
  subjectsTable,
  questionsTable,
} from "@workspace/db";
import { eq, and, gte, sql } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../../middlewares/auth";

const router: IRouter = Router();

const getDaysArray = (numDays: number) => {
  const arr = [];
  const now = new Date();
  for (let i = numDays - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    arr.push(d.toISOString().split("T")[0]);
  }
  return arr;
};

// GET /api/v1/analytics/timeline
router.get(
  "/v1/analytics/timeline",
  requireAuth,
  async (req: AuthRequest, res): Promise<void> => {
    try {
      const userId = req.userId!;
      const range = (req.query.range as string) || "7days";
      const numDays = range === "30days" ? 30 : 7;
      const dates = getDaysArray(numDays);
      const startOfRange = new Date();
      startOfRange.setDate(startOfRange.getDate() - numDays);
      startOfRange.setUTCHours(0, 0, 0, 0);

      // Fetch all exam results in range
      const examResults = await db
        .select()
        .from(resultsTable)
        .where(
          and(
            eq(resultsTable.userId, userId),
            gte(resultsTable.createdAt, startOfRange)
          )
        );

      // Fetch all practice sessions in range
      const practiceSessions = await db
        .select()
        .from(practiceSessionsTable)
        .where(
          and(
            eq(practiceSessionsTable.userId, userId),
            gte(practiceSessionsTable.startedAt, startOfRange)
          )
        );

      // Fetch CA read history in range
      const caReads = await db
        .select()
        .from(currentAffairReadHistoryTable)
        .where(
          and(
            eq(currentAffairReadHistoryTable.userId, userId),
            eq(currentAffairReadHistoryTable.completed, true),
            gte(currentAffairReadHistoryTable.lastReadAt, startOfRange)
          )
        );

      // Group in memory by YYYY-MM-DD
      const timelineMap = new Map<string, {
        accuracy: number;
        speed: number; // Avg seconds per question
        attempts: number;
        hours: number;
        revision: number;
        currentAffairs: number;
        mockTests: number;
        mastery: number;
      }>();

      for (const d of dates) {
        timelineMap.set(d, {
          accuracy: 0,
          speed: 0,
          attempts: 0,
          hours: 0,
          revision: 0,
          currentAffairs: 0,
          mockTests: 0,
          mastery: 50, // default baseline
        });
      }

      // Populate exams
      for (const r of examResults) {
        const dStr = r.createdAt.toISOString().split("T")[0];
        if (timelineMap.has(dStr)) {
          const day = timelineMap.get(dStr)!;
          day.mockTests += 1;
          day.attempts += (r.correct ?? 0) + (r.incorrect ?? 0);
          day.hours += (r.timeTakenSeconds ?? 0) / 3600;
          day.speed += r.timeTakenSeconds ?? 0;
          // Weighted accuracy calculation later
        }
      }

      // Populate practices
      for (const p of practiceSessions) {
        if (!p.completedAt) continue;
        const dStr = p.completedAt.toISOString().split("T")[0];
        if (timelineMap.has(dStr)) {
          const day = timelineMap.get(dStr)!;
          day.attempts += p.totalQuestions;
          day.hours += p.timeTakenSeconds / 3600;
          day.speed += p.timeTakenSeconds;
          if (p.mode === "pyq" || p.mode === "collection") {
            day.revision += 1;
          }
        }
      }

      // Populate CA
      for (const ca of caReads) {
        const dStr = ca.lastReadAt.toISOString().split("T")[0];
        if (timelineMap.has(dStr)) {
          const day = timelineMap.get(dStr)!;
          day.currentAffairs += 1;
        }
      }

      // Aggregate accuracy and speed averages per day
      const result = dates.map((date) => {
        const day = timelineMap.get(date)!;

        // Calculate average accuracy for this day dynamically
        const dayExams = examResults.filter(
          (r) => r.createdAt.toISOString().split("T")[0] === date
        );
        const dayPractices = practiceSessions.filter(
          (p) => p.completedAt && p.completedAt.toISOString().split("T")[0] === date
        );

        let totalCorrect = 0;
        let totalAttempted = 0;

        for (const e of dayExams) {
          totalCorrect += e.correct ?? 0;
          totalAttempted += (e.correct ?? 0) + (e.incorrect ?? 0);
        }
        for (const p of dayPractices) {
          totalCorrect += Math.round((p.accuracy / 100) * p.totalQuestions);
          totalAttempted += p.totalQuestions;
        }

        const accuracy = totalAttempted > 0 ? (totalCorrect / totalAttempted) * 100 : 0;
        const avgSpeed = totalAttempted > 0 ? day.speed / totalAttempted : 0;

        // Mastery progression based on accuracy and completion
        const mastery = totalAttempted > 0 ? Math.min(Math.round(accuracy * 0.9), 100) : 50;

        return {
          date,
          accuracy: Math.round(accuracy * 10) / 10,
          speed: Math.round(avgSpeed * 10) / 10, // seconds per question
          attempts: day.attempts,
          hours: Math.round(day.hours * 100) / 100,
          revision: day.revision,
          currentAffairs: day.currentAffairs,
          mockTests: day.mockTests,
          adaptiveMastery: mastery,
        };
      });

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

// GET /api/v1/analytics/ai-insights
router.get(
  "/v1/analytics/ai-insights",
  requireAuth,
  async (req: AuthRequest, res): Promise<void> => {
    try {
      const userId = req.userId!;
      const todayStr = new Date().toISOString().split("T")[0];

      // 1. Fetch subjects performance
      const subjects = await db.select().from(subjectsTable);
      const results = await db
        .select()
        .from(resultsTable)
        .where(eq(resultsTable.userId, userId));

      const practiceSessions = await db
        .select()
        .from(practiceSessionsTable)
        .where(eq(practiceSessionsTable.userId, userId));

      // Calculate subject-wise accuracy
      const subjectStats = subjects.map((sub) => {
        const relevantExams = results.filter((r) => r.score > 0); // placeholder mapping
        // In practice sessions, we have explicit subjectId
        const relevantPractices = practiceSessions.filter((p) => p.subjectId === sub.id && p.status === "completed");

        let correct = 0;
        let total = 0;

        for (const p of relevantPractices) {
          correct += Math.round((p.accuracy / 100) * p.totalQuestions);
          total += p.totalQuestions;
        }

        const accuracy = total > 0 ? (correct / total) * 100 : 0;

        return {
          id: sub.id,
          name: sub.name,
          accuracy,
          totalAttempted: total,
        };
      });

      // Strengths & Weaknesses
      const strengths = subjectStats
        .filter((s) => s.totalAttempted > 10 && s.accuracy >= 70)
        .map((s) => s.name);
      
      const weaknesses = subjectStats
        .filter((s) => s.totalAttempted > 0 && s.accuracy < 60)
        .map((s) => s.name);

      // Default fallbacks if not enough data
      if (strengths.length === 0) {
        strengths.push(subjectStats[0]?.name || "Quantitative Aptitude");
      }
      if (weaknesses.length === 0) {
        weaknesses.push(subjectStats[1]?.name || "General Awareness");
      }

      // Best Time To Study
      // Group results/practices by hour of day
      const hoursMap = new Map<number, number>();
      for (const r of results) {
        const hr = r.createdAt.getHours();
        hoursMap.set(hr, (hoursMap.get(hr) || 0) + 1);
      }
      for (const p of practiceSessions) {
        if (!p.completedAt) continue;
        const hr = p.completedAt.getHours();
        hoursMap.set(hr, (hoursMap.get(hr) || 0) + 1);
      }

      let bestHour = 9; // default 9 AM
      let maxCount = 0;
      hoursMap.forEach((val, key) => {
        if (val > maxCount) {
          maxCount = val;
          bestHour = key;
        }
      });

      const getHourLabel = (hr: number) => {
        if (hr === 0) return "12 AM (Midnight)";
        if (hr === 12) return "12 PM (Noon)";
        return hr > 12 ? `${hr - 12} PM` : `${hr} AM`;
      };
      
      const bestTimeLabel = maxCount > 0 
        ? `${getHourLabel(bestHour)} to ${getHourLabel((bestHour + 2) % 24)}` 
        : "9 AM to 11 AM (Morning)";

      // Expected Exam Readiness
      const overallAvgAccuracy = results.length > 0 
        ? results.reduce((s, r) => s + r.accuracy, 0) / results.length 
        : 65;

      const examReadiness = Math.round(Math.min(overallAvgAccuracy * 1.1, 95));

      // Study Suggestions & Revision Advice
      const studySuggestions = [
        `Dedicate 45 minutes to practicing topic quizzes on ${weaknesses[0]}.`,
        "Attempt at least 1 mock exam every 2 days to build exam stamina.",
        "Focus on improving answer speed; target below 40s per question in English Section.",
      ];

      const revisionAdvice = `Your accuracy in ${weaknesses[0]} is currently ${Math.round(subjectStats.find(s=>s.name === weaknesses[0])?.accuracy || 45)}%. Prioritize the revision queue for this subject.`;

      // Summaries
      const dailySummary = `Today you spent ${Math.round(practiceSessions.filter(p => p.completedAt && p.completedAt.toISOString().split("T")[0] === todayStr).reduce((s, p) => s + p.timeTakenSeconds, 0) / 60)} minutes practicing.`;
      
      const weeklySummary = `This week you have attempted ${results.length} mocks and maintained a ${Math.round(overallAvgAccuracy)}% accuracy rate.`;

      res.json({
        strengths,
        weaknesses,
        studySuggestions,
        bestTimeToStudy: bestTimeLabel,
        recommendedSubjects: weaknesses,
        expectedExamReadiness: `${examReadiness}% Ready`,
        revisionAdvice,
        dailySummary,
        weeklySummary,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

export default router;
