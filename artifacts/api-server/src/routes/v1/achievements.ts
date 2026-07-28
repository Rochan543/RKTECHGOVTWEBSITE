import { Router, type IRouter } from "express";
import { db, achievementsTable, resultsTable, usersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../../middlewares/auth";

const router: IRouter = Router();

interface AchievementDef {
  type: string;
  title: string;
  description: string;
  xp: number;
  check: (totalTests: number, avgScore: number, bestScore: number, totalCorrect: number) => boolean;
}

const ACHIEVEMENT_DEFS: AchievementDef[] = [
  {
    type: "first_test",
    title: "First Step",
    description: "Complete your first test",
    xp: 50,
    check: (totalTests) => totalTests >= 1,
  },
  {
    type: "five_tests",
    title: "Getting Started",
    description: "Complete 5 tests",
    xp: 100,
    check: (totalTests) => totalTests >= 5,
  },
  {
    type: "ten_tests",
    title: "Dedicated Learner",
    description: "Complete 10 tests",
    xp: 200,
    check: (totalTests) => totalTests >= 10,
  },
  {
    type: "fifty_tests",
    title: "Exam Warrior",
    description: "Complete 50 tests",
    xp: 500,
    check: (totalTests) => totalTests >= 50,
  },
  {
    type: "high_accuracy",
    title: "Sharpshooter",
    description: "Achieve 90%+ average accuracy",
    xp: 300,
    check: (_t, avgScore) => avgScore >= 90,
  },
  {
    type: "perfect_score",
    title: "Perfectionist",
    description: "Score 100% in a test",
    xp: 500,
    check: (_t, _a, bestScore) => bestScore >= 100,
  },
  {
    type: "hundred_correct",
    title: "Century",
    description: "Answer 100 questions correctly",
    xp: 250,
    check: (_t, _a, _b, totalCorrect) => totalCorrect >= 100,
  },
  {
    type: "five_hundred_correct",
    title: "Knowledge Powerhouse",
    description: "Answer 500 questions correctly",
    xp: 1000,
    check: (_t, _a, _b, totalCorrect) => totalCorrect >= 500,
  },
];

router.get(
  "/v1/achievements",
  requireAuth,
  async (req: AuthRequest, res): Promise<void> => {
    const userId = req.userId!;

    const results = await db
      .select()
      .from(resultsTable)
      .where(eq(resultsTable.userId, userId));

    const totalTests = results.length;
    const avgScore =
      totalTests > 0
        ? results.reduce((s, r) => s + (r.score / r.totalMarks) * 100, 0) / totalTests
        : 0;
    const bestScore =
      totalTests > 0
        ? Math.max(...results.map((r) => (r.score / r.totalMarks) * 100))
        : 0;
    const totalCorrect = results.reduce((s, r) => s + (r.correct ?? 0), 0);

    // Sync earned achievements to DB
    const existing = await db
      .select()
      .from(achievementsTable)
      .where(eq(achievementsTable.userId, userId));
    const existingTypes = new Set(existing.map((a) => a.type));

    for (const def of ACHIEVEMENT_DEFS) {
      if (!existingTypes.has(def.type) && def.check(totalTests, avgScore, bestScore, totalCorrect)) {
        try {
          await db.insert(achievementsTable).values({
            userId,
            type: def.type,
            title: def.title,
            description: def.description,
            xp: def.xp,
          });
        } catch {
          // ignore unique constraint violation (race condition)
        }
      }
    }

    // Re-fetch
    const unlocked = await db
      .select()
      .from(achievementsTable)
      .where(eq(achievementsTable.userId, userId))
      .orderBy(desc(achievementsTable.unlockedAt));

    const unlockedTypes = new Set(unlocked.map((a) => a.type));

    const all = ACHIEVEMENT_DEFS.map((def) => ({
      type: def.type,
      title: def.title,
      description: def.description,
      xp: def.xp,
      unlocked: unlockedTypes.has(def.type),
      unlockedAt: unlocked.find((a) => a.type === def.type)?.unlockedAt ?? null,
    }));

    const totalXp = unlocked.reduce((s, a) => s + a.xp, 0);

    res.json({ achievements: all, totalXp, unlockedCount: unlocked.length });
  }
);

export default router;
