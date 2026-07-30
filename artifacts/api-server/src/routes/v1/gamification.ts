import { Router, type IRouter } from "express";
import { db, usersTable, userBadgesTable, dailyLoginRewardsTable, gamificationConfigTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../../middlewares/auth";

const router: IRouter = Router();

// Helper to get YYYY-MM-DD date in UTC
const getTodayStr = () => new Date().toISOString().split("T")[0];

const getYesterdayStr = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
};

// GET /api/v1/gamification/profile
router.get(
  "/v1/gamification/profile",
  requireAuth,
  async (req: AuthRequest, res): Promise<void> => {
    try {
      const userId = req.userId!;
      const todayStr = getTodayStr();

      // 1. Get user details
      const [user] = await db
        .select({
          xp: usersTable.xp,
          level: usersTable.level,
          dailyStreak: usersTable.dailyStreak,
          weeklyStreak: usersTable.weeklyStreak,
          monthlyStreak: usersTable.monthlyStreak,
          lastActivityDate: usersTable.lastActivityDate,
        })
        .from(usersTable)
        .where(eq(usersTable.id, userId));

      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      // 2. Check if login reward was claimed today
      const [loginReward] = await db
        .select()
        .from(dailyLoginRewardsTable)
        .where(
          and(
            eq(dailyLoginRewardsTable.userId, userId),
            eq(dailyLoginRewardsTable.claimDate, todayStr)
          )
        )
        .limit(1);

      // 3. Get badges
      const badges = await db
        .select()
        .from(userBadgesTable)
        .where(eq(userBadgesTable.userId, userId));

      // 4. Get gamification configurations
      let [config] = await db.select().from(gamificationConfigTable).limit(1);
      if (!config) {
        // Seed default config if missing
        [config] = await db
          .insert(gamificationConfigTable)
          .values({
            dailyLoginXp: 20,
            solveQuestionXp: 2,
            readArticleXp: 5,
            completeMissionXp: 50,
            perfectAccuracyXp: 100,
          })
          .returning();
      }

      res.json({
        xp: user.xp,
        level: user.level,
        dailyStreak: user.dailyStreak,
        weeklyStreak: user.weeklyStreak,
        monthlyStreak: user.monthlyStreak,
        lastActivityDate: user.lastActivityDate,
        loginClaimedToday: !!loginReward,
        badges: badges.map((b) => ({
          badgeType: b.badgeType,
          earnedAt: b.earnedAt,
        })),
        config: {
          dailyLoginXp: config.dailyLoginXp,
          solveQuestionXp: config.solveQuestionXp,
          readArticleXp: config.readArticleXp,
          completeMissionXp: config.completeMissionXp,
          perfectAccuracyXp: config.perfectAccuracyXp,
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

// POST /api/v1/gamification/claim-login
router.post(
  "/v1/gamification/claim-login",
  requireAuth,
  async (req: AuthRequest, res): Promise<void> => {
    try {
      const userId = req.userId!;
      const todayStr = getTodayStr();
      const yesterdayStr = getYesterdayStr();

      // Check if already claimed
      const [existing] = await db
        .select()
        .from(dailyLoginRewardsTable)
        .where(
          and(
            eq(dailyLoginRewardsTable.userId, userId),
            eq(dailyLoginRewardsTable.claimDate, todayStr)
          )
        )
        .limit(1);

      if (existing) {
        res.status(400).json({ error: "Daily login reward already claimed today" });
        return;
      }

      // Get configuration
      let [config] = await db.select().from(gamificationConfigTable).limit(1);
      const xpReward = config ? config.dailyLoginXp : 20;

      // Get current user stats
      const [user] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, userId));

      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      // Calculate new streaks
      let newDailyStreak = user.dailyStreak;
      let newWeeklyStreak = user.weeklyStreak;
      let newMonthlyStreak = user.monthlyStreak;

      const lastAct = user.lastActivityDate;

      if (!lastAct) {
        newDailyStreak = 1;
      } else if (lastAct === yesterdayStr) {
        newDailyStreak += 1;
      } else if (lastAct !== todayStr) {
        // Streak broken
        newDailyStreak = 1;
      }

      // Recalculate weekly and monthly streaks based on daily count thresholds
      if (newDailyStreak > 0 && newDailyStreak % 7 === 0 && lastAct !== todayStr) {
        newWeeklyStreak += 1;
      }
      if (newDailyStreak > 0 && newDailyStreak % 30 === 0 && lastAct !== todayStr) {
        newMonthlyStreak += 1;
      }

      // Calculate level up (Level = floor(XP / 500) + 1)
      const newXp = user.xp + xpReward;
      const newLevel = Math.floor(newXp / 500) + 1;
      const leveledUp = newLevel > user.level;

      // Apply updates to user in SQL
      await db
        .update(usersTable)
        .set({
          xp: newXp,
          level: newLevel,
          dailyStreak: newDailyStreak,
          weeklyStreak: newWeeklyStreak,
          monthlyStreak: newMonthlyStreak,
          lastActivityDate: todayStr,
          totalScore: (user.totalScore ?? 0) + (xpReward / 10), // also increment leaderboard score slightly
        })
        .where(eq(usersTable.id, userId));

      // Record claim
      await db.insert(dailyLoginRewardsTable).values({
        userId,
        claimDate: todayStr,
        xpEarned: xpReward,
      });

      // Award dynamic badges if streak milestones are hit
      const checkAndAwardBadge = async (badgeType: string) => {
        const [hasBadge] = await db
          .select()
          .from(userBadgesTable)
          .where(
            and(
              eq(userBadgesTable.userId, userId),
              eq(userBadgesTable.badgeType, badgeType)
            )
          )
          .limit(1);

        if (!hasBadge) {
          await db.insert(userBadgesTable).values({
            userId,
            badgeType,
          });
        }
      };

      if (newDailyStreak >= 7) await checkAndAwardBadge("consistency_award");
      if (newWeeklyStreak >= 4) await checkAndAwardBadge("consistency_master");

      res.json({
        success: true,
        xpEarned: xpReward,
        newXp,
        newLevel,
        dailyStreak: newDailyStreak,
        weeklyStreak: newWeeklyStreak,
        monthlyStreak: newMonthlyStreak,
        leveledUp,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

// GET /api/v1/admin/gamification/config
router.get(
  "/v1/admin/gamification/config",
  requireAuth,
  async (req: AuthRequest, res): Promise<void> => {
    try {
      let [config] = await db.select().from(gamificationConfigTable).limit(1);
      if (!config) {
        [config] = await db
          .insert(gamificationConfigTable)
          .values({
            dailyLoginXp: 20,
            solveQuestionXp: 2,
            readArticleXp: 5,
            completeMissionXp: 50,
            perfectAccuracyXp: 100,
          })
          .returning();
      }
      res.json(config);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

// POST /api/v1/admin/gamification/config
router.post(
  "/v1/admin/gamification/config",
  requireAuth,
  async (req: AuthRequest, res): Promise<void> => {
    try {
      if (req.userRole !== "admin" && req.userRole !== "super_admin") {
        res.status(403).json({ error: "Access denied" });
        return;
      }

      const { dailyLoginXp, solveQuestionXp, readArticleXp, completeMissionXp, perfectAccuracyXp } = req.body;

      let [config] = await db.select().from(gamificationConfigTable).limit(1);

      if (config) {
        await db
          .update(gamificationConfigTable)
          .set({
            dailyLoginXp: Number(dailyLoginXp),
            solveQuestionXp: Number(solveQuestionXp),
            readArticleXp: Number(readArticleXp),
            completeMissionXp: Number(completeMissionXp),
            perfectAccuracyXp: Number(perfectAccuracyXp),
            updatedAt: new Date(),
          })
          .where(eq(gamificationConfigTable.id, config.id));
      } else {
        await db.insert(gamificationConfigTable).values({
          dailyLoginXp: Number(dailyLoginXp),
          solveQuestionXp: Number(solveQuestionXp),
          readArticleXp: Number(readArticleXp),
          completeMissionXp: Number(completeMissionXp),
          perfectAccuracyXp: Number(perfectAccuracyXp),
        });
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

export default router;
