import { Router, type IRouter } from "express";
import {
  db,
  usersTable,
  learningRecommendationsTable,
  studyPlansTable,
  questionsTable,
  questionOptionsTable,
  practiceSessionsTable,
  practiceSessionAnswersTable,
  sessionAnswersTable,
  testSessionsTable,
  resultsTable,
  bookmarksTable,
  wrongAnswersTable,
  subjectsTable,
  topicsTable,
  questionCollectionsTable,
  questionCollectionItemsTable,
  studyPlanTemplatesTable,
  userStudyPlanAssignmentsTable,
  assignedTasksTable,
  adaptiveSettingsTable,
  userGoalsTable
} from "@workspace/db";
import { eq, and, desc, asc, inArray, sql, notInArray, count, max, sum } from "drizzle-orm";
import { requireAuth, requireAdmin, type AuthRequest } from "../../middlewares/auth";

const router: IRouter = Router();

// ==========================================
// RECOMMENDATION & MASTERY UTILS
// ==========================================

interface AttemptStats {
  attempted: number;
  correct: number;
  skipped: number;
  totalTimeSeconds: number;
  lastAttemptAt?: Date;
}

interface TopicMastery {
  topicId: number;
  name: string;
  subjectId: number;
  subjectName: string;
  attemptCount: number;
  accuracy: number;
  completion: number;
  recencyScore: number;
  mastery: number;
  avgTimeSeconds: number;
}

interface SubjectMastery {
  subjectId: number;
  name: string;
  attemptCount: number;
  accuracy: number;
  completion: number;
  mastery: number;
  avgTimeSeconds: number;
}

interface CollectionMastery {
  collectionId: number;
  name: string;
  description: string | null;
  questionCount: number;
  attemptedCount: number;
  correctCount: number;
  accuracy: number;
  completionRate: number;
  mastery: number;
  status: "Highly Recommended" | "Recommended" | "Revision Needed" | "Completed";
  score: number;
}

// Fetch all attempts for a user in memory (highly optimized: only 2 queries for history)
async function getUserAttemptHistoryMap(userId: number): Promise<Map<number, { isCorrect: boolean; timeTaken: number; updatedAt: Date }>> {
  const attemptMap = new Map<number, { isCorrect: boolean; timeTaken: number; updatedAt: Date }>();

  // 1. Fetch practice attempts
  const practiceAnswers = await db
    .select({
      questionId: practiceSessionAnswersTable.questionId,
      isCorrect: practiceSessionAnswersTable.isCorrect,
      timeTaken: practiceSessionAnswersTable.timeTakenSeconds,
      updatedAt: practiceSessionAnswersTable.updatedAt,
    })
    .from(practiceSessionAnswersTable)
    .innerJoin(practiceSessionsTable, eq(practiceSessionAnswersTable.sessionId, practiceSessionsTable.id))
    .where(eq(practiceSessionsTable.userId, userId));

  for (const pa of practiceAnswers) {
    attemptMap.set(pa.questionId, {
      isCorrect: pa.isCorrect,
      timeTaken: pa.timeTaken,
      updatedAt: pa.updatedAt,
    });
  }

  // 2. Fetch exam attempts (only submitted/auto_submitted ones)
  const examAnswers = await db
    .select({
      questionId: sessionAnswersTable.questionId,
      isCorrect: sql<boolean>`${questionOptionsTable.isCorrect} = true`,
      timeSpent: sql<number>`coalesce(${sessionAnswersTable.timeSpentSeconds}, 0)::int`,
      updatedAt: sessionAnswersTable.updatedAt,
    })
    .from(sessionAnswersTable)
    .innerJoin(testSessionsTable, eq(sessionAnswersTable.sessionId, testSessionsTable.id))
    .leftJoin(questionOptionsTable, eq(sessionAnswersTable.selectedOptionId, questionOptionsTable.id))
    .where(and(
      eq(testSessionsTable.userId, userId),
      inArray(testSessionsTable.status, ["submitted", "auto_submitted"])
    ));

  for (const ea of examAnswers) {
    const existing = attemptMap.get(ea.questionId);
    // Keep the most recent attempt
    if (!existing || ea.updatedAt > existing.updatedAt) {
      attemptMap.set(ea.questionId, {
        isCorrect: ea.isCorrect,
        timeTaken: ea.timeSpent,
        updatedAt: ea.updatedAt,
      });
    }
  }

  return attemptMap;
}

// Compute comprehensive stats in memory
async function calculateAllMastery(userId: number, attemptMap: Map<number, { isCorrect: boolean; timeTaken: number; updatedAt: Date }>) {
  const attemptedQuestionIds = Array.from(attemptMap.keys());
  type AttemptedQ = { id: number; subjectId: number; topicId: number };

  // Fetch subjects, topics, collections, collection items, question counts, and attempted questions
  const [allSubjects, allTopics, allCollections, collectionItems, topicCounts, subjectCounts, attemptedQuestions] = await Promise.all([
    db.select().from(subjectsTable),
    db.select({
      id: topicsTable.id,
      name: topicsTable.name,
      subjectId: topicsTable.subjectId,
      subjectName: subjectsTable.name,
    }).from(topicsTable).innerJoin(subjectsTable, eq(topicsTable.subjectId, subjectsTable.id)),
    db.select().from(questionCollectionsTable).where(eq(questionCollectionsTable.isArchived, false)),
    db.select({ collectionId: questionCollectionItemsTable.collectionId, questionId: questionCollectionItemsTable.questionId }).from(questionCollectionItemsTable),
    db.select({ topicId: questionsTable.topicId, count: count() }).from(questionsTable).groupBy(questionsTable.topicId),
    db.select({ subjectId: questionsTable.subjectId, count: count() }).from(questionsTable).groupBy(questionsTable.subjectId),
    attemptedQuestionIds.length > 0
      ? db.select({ id: questionsTable.id, subjectId: questionsTable.subjectId, topicId: questionsTable.topicId }).from(questionsTable).where(inArray(questionsTable.id, attemptedQuestionIds))
      : Promise.resolve([] as AttemptedQ[]),
  ]);

  const subjectMap = new Map(allSubjects.map(s => [s.id, s]));
  const topicMap = new Map(allTopics.map(t => [t.id, t]));
  const topicTotalMap = new Map(topicCounts.map(tc => [tc.topicId, Number(tc.count)]));
  const subjectTotalMap = new Map(subjectCounts.map(sc => [sc.subjectId, Number(sc.count)]));

  // Question lists (only for attempted questions!)
  const questionsByTopic = new Map<number, AttemptedQ[]>();
  const questionsBySubject = new Map<number, AttemptedQ[]>();
  for (const q of attemptedQuestions) {
    if (!questionsByTopic.has(q.topicId)) questionsByTopic.set(q.topicId, []);
    questionsByTopic.get(q.topicId)!.push(q);

    if (!questionsBySubject.has(q.subjectId)) questionsBySubject.set(q.subjectId, []);
    questionsBySubject.get(q.subjectId)!.push(q);
  }

  const itemsByCollection = new Map<number, number[]>(); // collectionId -> questionIds
  for (const item of collectionItems) {
    if (!itemsByCollection.has(item.collectionId)) itemsByCollection.set(item.collectionId, []);
    itemsByCollection.get(item.collectionId)!.push(item.questionId);
  }

  const now = new Date();

  function getRecencyScore(lastAttemptAt?: Date): number {
    if (!lastAttemptAt) return 0;
    const diffDays = (now.getTime() - lastAttemptAt.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays <= 3) return 1.0;
    if (diffDays <= 7) return 0.7;
    if (diffDays <= 14) return 0.4;
    return 0.1;
  }

  // Topic mastery calculation
  const topicsMastery: TopicMastery[] = allTopics.map(t => {
    const qList = questionsByTopic.get(t.id) || [];
    const totalQs = topicTotalMap.get(t.id) || 1;

    let attemptedCount = 0;
    let correctCount = 0;
    let totalTime = 0;
    let lastAttemptAt: Date | undefined;

    for (const q of qList) {
      const att = attemptMap.get(q.id);
      if (att) {
        attemptedCount++;
        if (att.isCorrect) correctCount++;
        totalTime += att.timeTaken;
        if (!lastAttemptAt || att.updatedAt > lastAttemptAt) {
          lastAttemptAt = att.updatedAt;
        }
      }
    }

    const accuracy = attemptedCount > 0 ? (correctCount / attemptedCount) * 100 : 0;
    const completion = Math.min((attemptedCount / totalQs) * 100, 100);
    const recency = getRecencyScore(lastAttemptAt);
    const avgTime = attemptedCount > 0 ? totalTime / attemptedCount : 0;

    // Mastery formula: 50% accuracy + 30% completion + 20% recency
    const mastery = attemptedCount > 0
      ? (accuracy * 0.5) + (completion * 0.3) + (recency * 20)
      : 0;

    return {
      topicId: t.id,
      name: t.name,
      subjectId: t.subjectId,
      subjectName: t.subjectName,
      attemptCount: attemptedCount,
      accuracy: Math.round(accuracy * 10) / 10,
      completion: Math.round(completion * 10) / 10,
      recencyScore: recency,
      mastery: Math.round(mastery * 10) / 10,
      avgTimeSeconds: Math.round(avgTime * 10) / 10,
    };
  });

  // Subject mastery calculation
  const subjectsMastery: SubjectMastery[] = allSubjects.map(s => {
    const qList = questionsBySubject.get(s.id) || [];
    const totalQs = subjectTotalMap.get(s.id) || 1;

    let attemptedCount = 0;
    let correctCount = 0;
    let totalTime = 0;
    let lastAttemptAt: Date | undefined;

    for (const q of qList) {
      const att = attemptMap.get(q.id);
      if (att) {
        attemptedCount++;
        if (att.isCorrect) correctCount++;
        totalTime += att.timeTaken;
        if (!lastAttemptAt || att.updatedAt > lastAttemptAt) {
          lastAttemptAt = att.updatedAt;
        }
      }
    }

    const accuracy = attemptedCount > 0 ? (correctCount / attemptedCount) * 100 : 0;
    const completion = Math.min((attemptedCount / totalQs) * 100, 100);
    const recency = getRecencyScore(lastAttemptAt);
    const avgTime = attemptedCount > 0 ? totalTime / attemptedCount : 0;

    const mastery = attemptedCount > 0
      ? (accuracy * 0.5) + (completion * 0.3) + (recency * 20)
      : 0;

    return {
      subjectId: s.id,
      name: s.name,
      attemptCount: attemptedCount,
      accuracy: Math.round(accuracy * 10) / 10,
      completion: Math.round(completion * 10) / 10,
      mastery: Math.round(mastery * 10) / 10,
      avgTimeSeconds: Math.round(avgTime * 10) / 10,
    };
  });

  // Collection mastery calculation
  const collectionsMastery: CollectionMastery[] = allCollections.map(col => {
    const qIds = itemsByCollection.get(col.id) || [];
    const totalQs = qIds.length || 1;

    let attemptedCount = 0;
    let correctCount = 0;
    let wrongCount = 0;
    let totalTime = 0;
    let lastAttemptAt: Date | undefined;

    for (const qId of qIds) {
      const att = attemptMap.get(qId);
      if (att) {
        attemptedCount++;
        if (att.isCorrect) correctCount++;
        else wrongCount++;
        totalTime += att.timeTaken;
        if (!lastAttemptAt || att.updatedAt > lastAttemptAt) {
          lastAttemptAt = att.updatedAt;
        }
      }
    }

    const accuracy = attemptedCount > 0 ? (correctCount / attemptedCount) * 100 : 0;
    const completionRate = Math.min((attemptedCount / totalQs) * 100, 100);
    const recency = getRecencyScore(lastAttemptAt);

    const mastery = attemptedCount > 0
      ? (accuracy * 0.5) + (completionRate * 0.3) + (recency * 20)
      : 0;

    // Collection score & status calculation
    // Score = (100 - accuracy) * 0.5 + (100 - completion) * 0.3 + (wrongCount > 0 ? 20 : 0)
    let score = attemptedCount > 0
      ? ((100 - accuracy) * 0.5) + ((100 - completionRate) * 0.3) + (wrongCount > 0 ? 20 : 0)
      : 85; // Default high recommendation for unattempted collections

    let status: CollectionMastery["status"] = "Recommended";
    if (completionRate === 100 && accuracy >= 80) {
      status = "Completed";
      score = 0; // Completed collection has lowest priority
    } else if ((completionRate === 100 && accuracy < 60) || wrongCount > 0) {
      status = "Revision Needed";
      score = Math.max(score, 75); // Bump score for revision
    } else if (score > 80) {
      status = "Highly Recommended";
    }

    return {
      collectionId: col.id,
      name: col.name,
      description: col.description,
      questionCount: totalQs,
      attemptedCount,
      correctCount,
      accuracy: Math.round(accuracy * 10) / 10,
      completionRate: Math.round(completionRate * 10) / 10,
      mastery: Math.round(mastery * 10) / 10,
      status,
      score: Math.round(score * 10) / 10,
    };
  });

  return {
    topics: topicsMastery,
    subjects: subjectsMastery,
    collections: collectionsMastery,
    attemptMap
  };
}

// Generate recommendations and write to cache database table
async function generateRecommendationsForUser(userId: number, attemptMapOpt?: any, dataOpt?: any): Promise<number> {
  const attemptMap = attemptMapOpt || await getUserAttemptHistoryMap(userId);
  const data = dataOpt || await calculateAllMastery(userId, attemptMap);

  // Fetch adaptive engine settings threshold
  const [settings] = await db.select().from(adaptiveSettingsTable).limit(1);
  const weakThreshold = settings ? (settings.weakTopicThreshold * 100) : 55;

  // Clear previous recommendations for this user
  await db.delete(learningRecommendationsTable).where(eq(learningRecommendationsTable.userId, userId));

  const newRecommendations: typeof learningRecommendationsTable.$inferInsert[] = [];

  // 1. Weak Topics (Lowest Accuracy based on dynamic threshold)
  const weakTopics = data.topics
    .filter((t: any) => t.attemptCount > 0 && t.accuracy < weakThreshold)
    .sort((a: any, b: any) => a.accuracy - b.accuracy)
    .slice(0, 3);

  for (const topic of weakTopics) {
    newRecommendations.push({
      userId,
      type: "topic",
      entityId: topic.topicId,
      score: 100 - topic.accuracy, // Higher score for lower accuracy
      reason: `Your accuracy in ${topic.name} is low (${topic.accuracy}%). Practice this topic to improve.`,
    });
  }

  // If no weak topics, recommend popular unattempted topics
  if (newRecommendations.length < 3) {
    const unattemptedTopics = data.topics
      .filter((t: any) => t.attemptCount === 0)
      .slice(0, 3 - newRecommendations.length);

    for (const topic of unattemptedTopics) {
      newRecommendations.push({
        userId,
        type: "topic",
        entityId: topic.topicId,
        score: 50,
        reason: `You haven't practiced ${topic.name} yet. Give it a try to build a foundation.`,
      });
    }
  }

  // 2. Collection recommendations
  const recommendedCols = data.collections
    .filter((col: any) => col.status !== "Completed")
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, 4);

  for (const col of recommendedCols) {
    let reason = `Recommended collection based on your current performance.`;
    if (col.status === "Revision Needed") {
      reason = `You have wrong answers in ${col.name}. Revise this collection.`;
    } else if (col.status === "Highly Recommended") {
      reason = `This collection is highly recommended to improve your weak areas.`;
    }
    newRecommendations.push({
      userId,
      type: "collection",
      entityId: col.collectionId,
      score: col.score,
      reason,
    });
  }

  // 3. Recommended Practice Sessions (Difficulty progression)
  // Let's look at the weakest topic and suggest a progression
  const weakest = data.topics
    .filter((t: any) => t.attemptCount > 0)
    .sort((a: any, b: any) => a.accuracy - b.accuracy)[0];

  if (weakest) {
    newRecommendations.push({
      userId,
      type: "practice_set",
      entityId: weakest.topicId,
      score: 95,
      reason: `Struggling with ${weakest.name} (${weakest.accuracy}% accuracy). Try the progression: ${weakest.name} Easy -> ${weakest.name} Medium -> ${weakest.name} PYQs.`,
    });
  }

  // Insert into recommendations table
  if (newRecommendations.length > 0) {
    await db.insert(learningRecommendationsTable).values(newRecommendations);
  }
  return newRecommendations.length;
}

// Generate / Get Study Plan
async function getOrGenerateStudyPlan(userId: number, dateStr: string, attemptMapOpt?: any, dataOpt?: any): Promise<typeof studyPlansTable.$inferSelect> {
  const [existingPlan] = await db
    .select()
    .from(studyPlansTable)
    .where(and(eq(studyPlansTable.userId, userId), eq(studyPlansTable.date, dateStr)))
    .limit(1);

  if (existingPlan) {
    return existingPlan;
  }

  // Generate a new study plan
  const attemptMap = attemptMapOpt || await getUserAttemptHistoryMap(userId);
  const data = dataOpt || await calculateAllMastery(userId, attemptMap);

  const tasks: any[] = [];

  // Task 1: Weak Topic Practice
  const weakTopic = data.topics
    .filter((t: any) => t.attemptCount > 0 && t.accuracy < 60)
    .sort((a: any, b: any) => a.accuracy - b.accuracy)[0] || data.topics[0];

  if (weakTopic) {
    tasks.push({
      id: `task_topic_${weakTopic.topicId}`,
      type: "topic",
      entityId: weakTopic.topicId,
      estimatedTimeMinutes: 30,
      targetAccuracy: 75,
      status: "pending",
    });
  }

  // Task 2: Recommended Collection Practice
  const bestCol = data.collections
    .filter((c: any) => c.status !== "Completed")
    .sort((a: any, b: any) => b.score - a.score)[0] || data.collections[0];

  if (bestCol) {
    tasks.push({
      id: `task_col_${bestCol.collectionId}`,
      type: "collection",
      entityId: bestCol.collectionId,
      estimatedTimeMinutes: 45,
      targetAccuracy: 80,
      status: "pending",
    });
  }

  // Task 3: Revision Task (if they have wrong answers)
  const wrongCountRes = await db
    .select({ count: count() })
    .from(wrongAnswersTable)
    .where(eq(wrongAnswersTable.userId, userId));
  const hasWrongAnswers = (wrongCountRes[0]?.count ?? 0) > 0;

  if (hasWrongAnswers) {
    tasks.push({
      id: `task_revision_errors`,
      type: "revision",
      entityId: 0, // revision doesn't correspond to a single entity
      estimatedTimeMinutes: 15,
      targetAccuracy: 85,
      status: "pending",
    });
  }

  const [newPlan] = await db
    .insert(studyPlansTable)
    .values({
      userId,
      date: dateStr,
      status: "pending",
      tasks,
    })
    .returning();

  return newPlan;
}

// Helper to start background recommendation updates
function triggerBackgroundRecommendationUpdate(userId: number) {
  generateRecommendationsForUser(userId).catch(err => {
    console.error(`[AdaptiveEngine] Background recommendation failed for user ${userId}:`, err);
  });
}

// ==========================================
// STUDENT ENDPOINTS
// ==========================================

// 1. GET /api/v1/adaptive/dashboard
router.get("/v1/adaptive/dashboard", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const userId = req.userId!;
    const todayStr = new Date().toISOString().split("T")[0];

    // Check if recommendations exist, if not generate them synchronously once
    const recs = await db
      .select()
      .from(learningRecommendationsTable)
      .where(eq(learningRecommendationsTable.userId, userId))
      .limit(1);

    if (recs.length === 0) {
      await generateRecommendationsForUser(userId);
    } else {
      // Recommendations exist, trigger asynchronous background refresh
      triggerBackgroundRecommendationUpdate(userId);
    }

    const plan = await getOrGenerateStudyPlan(userId, todayStr);

    // Fetch study streak
    // Streak is based on practice sessions and exam sessions completed
    const practiceSessions = await db
      .select({ date: sql<string>`TO_CHAR(${practiceSessionsTable.completedAt}, 'YYYY-MM-DD')` })
      .from(practiceSessionsTable)
      .where(and(eq(practiceSessionsTable.userId, userId), eq(practiceSessionsTable.status, "completed")))
      .groupBy(sql`TO_CHAR(${practiceSessionsTable.completedAt}, 'YYYY-MM-DD')`);

    const examSessions = await db
      .select({ date: sql<string>`TO_CHAR(${testSessionsTable.submittedAt}, 'YYYY-MM-DD')` })
      .from(testSessionsTable)
      .where(and(eq(testSessionsTable.userId, userId), inArray(testSessionsTable.status, ["submitted", "auto_submitted"])))
      .groupBy(sql`TO_CHAR(${testSessionsTable.submittedAt}, 'YYYY-MM-DD')`);

    const activityDates = Array.from(new Set([
      ...practiceSessions.map(ps => ps.date),
      ...examSessions.map(es => es.date)
    ])).sort((a, b) => b.localeCompare(a)); // Sort descending

    let streak = 0;
    if (activityDates.length > 0) {
      const today = new Date().toISOString().split("T")[0];
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      let checkDate = activityDates[0] === today ? today : (activityDates[0] === yesterday ? yesterday : null);

      if (checkDate) {
        streak = 1;
        let currentDate = new Date(checkDate);
        for (let i = 1; i < activityDates.length; i++) {
          currentDate.setDate(currentDate.getDate() - 1);
          const expectedStr = currentDate.toISOString().split("T")[0];
          if (activityDates.includes(expectedStr)) {
            streak++;
          } else {
            break;
          }
        }
      }
    }

    // Get stats
    const attemptMap = await getUserAttemptHistoryMap(userId);
    const data = await calculateAllMastery(userId, attemptMap);

    const recommendedCols = data.collections
      .filter(c => c.status === "Highly Recommended" || c.status === "Recommended")
      .slice(0, 3);

    const recommendedTopics = data.topics
      .filter(t => t.mastery < 60)
      .sort((a, b) => a.mastery - b.mastery)
      .slice(0, 3);

    const weakSubjects = data.subjects
      .filter(s => s.mastery < 50)
      .slice(0, 2);

    const weakTopics = data.topics
      .filter(t => t.mastery < 50)
      .sort((a, b) => a.mastery - b.mastery)
      .slice(0, 3);

    const collectionsToRevise = data.collections
      .filter(c => c.status === "Revision Needed")
      .slice(0, 3);

    // Pending revision questions count
    const wrongCountRes = await db
      .select({ count: count() })
      .from(wrongAnswersTable)
      .where(eq(wrongAnswersTable.userId, userId));
    const pendingRevision = wrongCountRes[0]?.count ?? 0;

    // Continue learning shortcut
    const lastSession = await db
      .select()
      .from(practiceSessionsTable)
      .where(eq(practiceSessionsTable.userId, userId))
      .orderBy(desc(practiceSessionsTable.startedAt))
      .limit(1);

    let quickContinueLearning: any = null;
    if (lastSession[0]) {
      const s = lastSession[0];
      if (s.collectionId) {
        const [c] = await db.select().from(questionCollectionsTable).where(eq(questionCollectionsTable.id, s.collectionId));
        if (c) {
          quickContinueLearning = { type: "collection", id: c.id, name: c.name };
        }
      } else if (s.topicId) {
        const [t] = await db.select().from(topicsTable).where(eq(topicsTable.id, s.topicId));
        if (t) {
          quickContinueLearning = { type: "topic", id: t.id, name: t.name };
        }
      }
    }

    if (!quickContinueLearning && recommendedCols[0]) {
      quickContinueLearning = { type: "collection", id: recommendedCols[0].collectionId, name: recommendedCols[0].name };
    }

    // Daily progress goal
    let totalMinutesGoal = 60;
    const [userGoal] = await db
      .select()
      .from(userGoalsTable)
      .where(eq(userGoalsTable.userId, userId))
      .limit(1);

    if (userGoal) {
      totalMinutesGoal = userGoal.dailyMinutesTarget;
    } else {
      const [settings] = await db.select().from(adaptiveSettingsTable).limit(1);
      if (settings) {
        totalMinutesGoal = settings.dailyGoalMinutes;
      }
    }

    const studyTimes = await db
      .select({
        time: sql<number>`coalesce(sum(${practiceSessionsTable.timeTakenSeconds}), 0)::int`
      })
      .from(practiceSessionsTable)
      .where(and(
        eq(practiceSessionsTable.userId, userId),
        sql`TO_CHAR(${practiceSessionsTable.completedAt}, 'YYYY-MM-DD') = ${todayStr}`
      ));
    const completedMinutes = Math.round((studyTimes[0]?.time ?? 0) / 60);

    const completedTasks = plan.tasks.filter(t => t.status === "completed").length;

    res.json({
      todayGoal: {
        targetMinutes: totalMinutesGoal,
        completedMinutes,
        completedTasks,
        totalTasks: plan.tasks.length,
      },
      recommendedCollections: recommendedCols,
      recommendedTopics,
      weakSubjects,
      weakTopics,
      studyStreak: streak,
      collectionsToRevise,
      pendingRevision,
      quickContinueLearning,
    });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message || "Failed to fetch adaptive dashboard statistics" });
  }
});

// 2. GET /api/v1/adaptive/recommendations
router.get("/v1/adaptive/recommendations", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const userId = req.userId!;
    const path = req.query.path as string || "intermediate"; // beginner, intermediate, advanced

    const attemptMap = await getUserAttemptHistoryMap(userId);
    const data = await calculateAllMastery(userId, attemptMap);

    // Custom filtering by difficulty path
    const targetDifficulty = path === "beginner" ? "easy" : (path === "advanced" ? "hard" : "medium");

    // Filter collections by target difficulty
    const collections = data.collections
      .map(col => {
        // Find difficulty distribution
        const isTarget = col.status !== "Completed" && col.score > 20;
        return {
          ...col,
          isRecommendedForPath: isTarget
        };
      })
      .sort((a, b) => b.score - a.score);

    // Topic progression recommendations
    const topicsProgression = data.topics
      .filter(t => t.attemptCount > 0 && t.accuracy < 70)
      .map(t => {
        return {
          topicId: t.topicId,
          name: t.name,
          accuracy: t.accuracy,
          progression: [
            { level: `${t.name} Easy`, difficulty: "easy", completed: t.accuracy > 70 },
            { level: `${t.name} Medium`, difficulty: "medium", completed: t.accuracy > 40 && t.attemptCount > 10 },
            { level: `${t.name} PYQs`, difficulty: "hard", completed: t.accuracy > 85 }
          ]
        };
      });

    res.json({
      path,
      collections,
      topicsProgression,
      recommendedDifficulty: targetDifficulty
    });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message || "Failed to fetch recommendations" });
  }
});

// 3. GET /api/v1/adaptive/study-plan
router.get("/v1/adaptive/study-plan", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const userId = req.userId!;
    const date = req.query.date as string || new Date().toISOString().split("T")[0];

    const plan = await getOrGenerateStudyPlan(userId, date);

    // Populate entity names for topics & collections in tasks
    const populatedTasks = await Promise.all(plan.tasks.map(async (task) => {
      let entityName = "Revision Practice";
      if (task.type === "topic") {
        const [t] = await db.select({ name: topicsTable.name }).from(topicsTable).where(eq(topicsTable.id, task.entityId));
        entityName = t?.name || "Topic Practice";
      } else if (task.type === "collection") {
        const [c] = await db.select({ name: questionCollectionsTable.name }).from(questionCollectionsTable).where(eq(questionCollectionsTable.id, task.entityId));
        entityName = c?.name || "Collection Practice";
      }

      return {
        ...task,
        entityName,
      };
    }));

    // Generate weekly overview
    const today = new Date(date);
    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7)); // Monday

    const weeklySummary = await Promise.all(Array.from({ length: 7 }, async (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const isoStr = d.toISOString().split("T")[0];

      // Just query the study_plans for this date
      const [dayPlan] = await db
        .select()
        .from(studyPlansTable)
        .where(and(eq(studyPlansTable.userId, userId), eq(studyPlansTable.date, isoStr)))
        .limit(1);

      return {
        date: isoStr,
        totalTasks: dayPlan?.tasks.length ?? 0,
        completedTasks: dayPlan?.tasks.filter((t: any) => t.status === "completed").length ?? 0,
      };
    }));

    res.json({
      date,
      status: plan.status,
      tasks: populatedTasks,
      weeklySummary,
    });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message || "Failed to fetch study plan" });
  }
});

// 4. GET /api/v1/adaptive/revision-queue
router.get("/v1/adaptive/revision-queue", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const userId = req.userId!;

    // 1. Frequently wrong questions
    const freqWrongs = await db
      .select({
        questionId: wrongAnswersTable.questionId,
        text: questionsTable.text,
        difficulty: questionsTable.difficulty,
        subjectName: subjectsTable.name,
        topicName: topicsTable.name,
        priority: sql<number>`1`
      })
      .from(wrongAnswersTable)
      .innerJoin(questionsTable, eq(wrongAnswersTable.questionId, questionsTable.id))
      .leftJoin(subjectsTable, eq(questionsTable.subjectId, subjectsTable.id))
      .leftJoin(topicsTable, eq(questionsTable.topicId, topicsTable.id))
      .where(and(eq(wrongAnswersTable.userId, userId), sql`${wrongAnswersTable.attemptCount} >= 2`))
      .orderBy(desc(wrongAnswersTable.attemptCount))
      .limit(10);

    // 2. Bookmarked questions
    const bookmarks = await db
      .select({
        questionId: bookmarksTable.questionId,
        text: questionsTable.text,
        difficulty: questionsTable.difficulty,
        subjectName: subjectsTable.name,
        topicName: topicsTable.name,
        priority: sql<number>`2`
      })
      .from(bookmarksTable)
      .innerJoin(questionsTable, eq(bookmarksTable.questionId, questionsTable.id))
      .leftJoin(subjectsTable, eq(questionsTable.subjectId, subjectsTable.id))
      .leftJoin(topicsTable, eq(questionsTable.topicId, topicsTable.id))
      .where(eq(bookmarksTable.userId, userId))
      .orderBy(desc(bookmarksTable.createdAt))
      .limit(10);

    // 3. Recently incorrect questions
    const recentWrongs = await db
      .select({
        questionId: wrongAnswersTable.questionId,
        text: questionsTable.text,
        difficulty: questionsTable.difficulty,
        subjectName: subjectsTable.name,
        topicName: topicsTable.name,
        priority: sql<number>`3`
      })
      .from(wrongAnswersTable)
      .innerJoin(questionsTable, eq(wrongAnswersTable.questionId, questionsTable.id))
      .leftJoin(subjectsTable, eq(questionsTable.subjectId, subjectsTable.id))
      .leftJoin(topicsTable, eq(questionsTable.topicId, topicsTable.id))
      .where(and(eq(wrongAnswersTable.userId, userId), sql`${wrongAnswersTable.attemptCount} < 2`))
      .orderBy(desc(wrongAnswersTable.lastAttemptAt))
      .limit(10);

    // Combine avoiding duplicates
    const seen = new Set<number>();
    const queue: any[] = [];

    const addItems = (list: any[], label: string) => {
      for (const item of list) {
        if (!seen.has(item.questionId)) {
          seen.add(item.questionId);
          queue.push({
            id: item.questionId,
            text: item.text,
            difficulty: item.difficulty,
            subjectName: item.subjectName,
            topicName: item.topicName,
            reason: label,
            priority: item.priority
          });
        }
      }
    };

    addItems(freqWrongs, "Frequently Incorrect");
    addItems(bookmarks, "Bookmarked");
    addItems(recentWrongs, "Recently Missed");

    res.json(queue);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message || "Failed to fetch revision queue" });
  }
});

// 5. GET /api/v1/adaptive/mastery
router.get("/v1/adaptive/mastery", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const userId = req.userId!;

    const attemptMap = await getUserAttemptHistoryMap(userId);
    const data = await calculateAllMastery(userId, attemptMap);

    res.json({
      subjects: data.subjects,
      topics: data.topics.slice(0, 15), // Top 15 topics for UI clarity
      collections: data.collections,
    });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message || "Failed to fetch mastery scores" });
  }
});

// 6. POST /api/v1/adaptive/study-plan/regenerate
router.post("/v1/adaptive/study-plan/regenerate", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const userId = req.userId!;
    const todayStr = new Date().toISOString().split("T")[0];

    // Delete existing study plan for today
    await db
      .delete(studyPlansTable)
      .where(and(eq(studyPlansTable.userId, userId), eq(studyPlansTable.date, todayStr)));

    const newPlan = await getOrGenerateStudyPlan(userId, todayStr);

    res.json({ message: "Study plan regenerated", plan: newPlan });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message || "Failed to regenerate study plan" });
  }
});

// 7. POST /api/v1/adaptive/task/complete
router.post("/v1/adaptive/task/complete", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  try {
    const userId = req.userId!;
    const { date, taskId, action, rescheduledTo } = req.body;

    if (!date || !taskId || !action) {
      res.status(400).json({ error: "Missing required fields (date, taskId, action)" });
      return;
    }

    const [plan] = await db
      .select()
      .from(studyPlansTable)
      .where(and(eq(studyPlansTable.userId, userId), eq(studyPlansTable.date, date)))
      .limit(1);

    if (!plan) {
      res.status(404).json({ error: "Study plan not found for this date" });
      return;
    }

    const tasks = plan.tasks;
    const taskIndex = tasks.findIndex(t => t.id === taskId);

    if (taskIndex === -1) {
      res.status(404).json({ error: "Task not found in study plan" });
      return;
    }

    if (action === "complete") {
      tasks[taskIndex].status = "completed";
    } else if (action === "skip") {
      tasks[taskIndex].status = "skipped";
    } else if (action === "reschedule") {
      if (!rescheduledTo) {
        res.status(400).json({ error: "rescheduledTo date is required for reschedule action" });
        return;
      }
      tasks[taskIndex].status = "rescheduled";
      tasks[taskIndex].rescheduledTo = rescheduledTo;

      // Automatically add this rescheduled task to the plan of the rescheduledTo date!
      const targetPlan = await getOrGenerateStudyPlan(userId, rescheduledTo);
      const targetTasks = targetPlan.tasks;
      // Add the rescheduled task to the new plan if not already present
      if (!targetTasks.some(t => t.id === taskId)) {
        targetTasks.push({
          ...tasks[taskIndex],
          status: "pending",
          rescheduledTo: undefined,
        });
        await db
          .update(studyPlansTable)
          .set({ tasks: targetTasks })
          .where(eq(studyPlansTable.id, targetPlan.id));
      }
    }

    // Determine study plan overall status
    let planStatus: "pending" | "completed" | "skipped" = "pending";
    const allDone = tasks.every(t => t.status === "completed" || t.status === "skipped" || t.status === "rescheduled");
    const anyDone = tasks.some(t => t.status === "completed");

    if (allDone) {
      planStatus = anyDone ? "completed" : "skipped";
    }

    const [updatedPlan] = await db
      .update(studyPlansTable)
      .set({ tasks, status: planStatus })
      .where(eq(studyPlansTable.id, plan.id))
      .returning();

    res.json({ message: `Task status updated to ${action}`, plan: updatedPlan });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message || "Failed to update task status" });
  }
});

// ==========================================
// ADMIN UTILS & HELPERS
// ==========================================

async function seedDefaultTemplatesIfEmpty() {
  const countRes = await db.select({ val: count() }).from(studyPlanTemplatesTable);
  if (Number(countRes[0]?.val ?? 0) === 0) {
    const defaults = [
      {
        title: "Quantitative Aptitude Booster",
        difficulty: "hard" as const,
        durationDays: 30,
        tasks: [
          { type: "topic", entityId: 1, entityName: "Trigonometric Identities", estimatedTimeMinutes: 30, targetAccuracy: 75 },
          { type: "topic", entityId: 2, entityName: "Simplification & Approximation", estimatedTimeMinutes: 20, targetAccuracy: 80 }
        ]
      },
      {
        title: "General English Vocabulary Foundation",
        difficulty: "medium" as const,
        durationDays: 15,
        tasks: [
          { type: "topic", entityId: 3, entityName: "Sentence Improvement", estimatedTimeMinutes: 25, targetAccuracy: 85 },
          { type: "topic", entityId: 4, entityName: "Synonyms & Antonyms", estimatedTimeMinutes: 15, targetAccuracy: 90 }
        ]
      },
      {
        title: "Reasoning Puzzles & Seating Arrangement",
        difficulty: "hard" as const,
        durationDays: 20,
        tasks: [
          { type: "topic", entityId: 5, entityName: "Coding-Decoding", estimatedTimeMinutes: 35, targetAccuracy: 70 }
        ]
      },
      {
        title: "General Awareness Daily GK Tracker",
        difficulty: "easy" as const,
        durationDays: 45,
        tasks: [
          { type: "topic", entityId: 6, entityName: "Modern Indian History", estimatedTimeMinutes: 40, targetAccuracy: 75 }
        ]
      }
    ];

    await db.insert(studyPlanTemplatesTable).values(defaults);
  }
}

async function regeneratePlansFromTemplate(userId: number, templateId: number): Promise<number> {
  const [template] = await db.select().from(studyPlanTemplatesTable).where(eq(studyPlanTemplatesTable.id, templateId));
  if (!template) return 0;

  // Delete existing future study plans for this user so we overwrite them
  const todayStr = new Date().toISOString().split("T")[0];
  await db.delete(studyPlansTable).where(and(
    eq(studyPlansTable.userId, userId),
    sql`${studyPlansTable.date} >= ${todayStr}`
  ));

  // Generate plans for each day of the template
  const tasks = template.tasks as any[];
  for (let day = 0; day < template.durationDays; day++) {
    const d = new Date();
    d.setDate(d.getDate() + day);
    const dateStr = d.toISOString().split("T")[0];

    let dailyTasks = [];
    if (Array.isArray(tasks[day])) {
      dailyTasks = tasks[day];
    } else if (tasks.length > 0) {
      dailyTasks = tasks;
    }

    const formattedTasks = dailyTasks.map((t: any, idx: number) => ({
      id: `template_${templateId}_day_${day}_task_${idx}`,
      type: t.type || "topic",
      entityId: Number(t.entityId || 1),
      entityName: t.entityName || "Topic Study",
      estimatedTimeMinutes: Number(t.estimatedTimeMinutes || 30),
      targetAccuracy: Number(t.targetAccuracy || 70),
      status: "pending" as const,
    }));

    try {
      await db.insert(studyPlansTable).values({
        userId,
        date: dateStr,
        status: "pending",
        tasks: formattedTasks,
      });
    } catch (e) {
      await db.update(studyPlansTable)
        .set({ tasks: formattedTasks })
        .where(and(eq(studyPlansTable.userId, userId), eq(studyPlansTable.date, dateStr)));
    }
  }
  return template.durationDays;
}

async function addAssignedTaskToDailyPlan(userId: number, dateStr: string, type: "collection" | "topic" | "practice_set", entityId: number) {
  let [plan] = await db.select().from(studyPlansTable).where(and(
    eq(studyPlansTable.userId, userId),
    eq(studyPlansTable.date, dateStr)
  ));

  let tasks = plan?.tasks ? [...plan.tasks] : [];
  
  let entityName = "Assigned Study";
  if (type === "topic") {
    const [topic] = await db.select({ name: topicsTable.name }).from(topicsTable).where(eq(topicsTable.id, entityId));
    if (topic) entityName = topic.name;
  } else if (type === "collection") {
    const [col] = await db.select({ name: questionCollectionsTable.name }).from(questionCollectionsTable).where(eq(questionCollectionsTable.id, entityId));
    if (col) entityName = col.name;
  }

  tasks.push({
    id: `assigned_${Date.now()}_${entityId}`,
    type: type === "practice_set" ? "collection" : type,
    entityId,
    entityName,
    estimatedTimeMinutes: 45,
    targetAccuracy: 75,
    status: "pending",
  });

  if (plan) {
    await db.update(studyPlansTable).set({ tasks }).where(eq(studyPlansTable.id, plan.id));
  } else {
    await db.insert(studyPlansTable).values({
      userId,
      date: dateStr,
      status: "pending",
      tasks,
    });
  }
}

async function forceRegenerateDailyPlan(userId: number, dateStr: string) {
  await db.delete(studyPlansTable).where(and(
    eq(studyPlansTable.userId, userId),
    eq(studyPlansTable.date, dateStr)
  ));
}

// ==========================================
// ADMIN ENDPOINTS
// ==========================================

// 8. GET /api/v1/adaptive/admin
router.get("/v1/adaptive/admin", requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  try {
    await seedDefaultTemplatesIfEmpty();

    // 1. Students Needing Help
    const lowAccuracyStudents = await db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        avgAccuracy: sql<number>`avg(${resultsTable.accuracy})::real`,
        avgScore: sql<number>`avg(${resultsTable.score})::real`,
        totalTests: count(resultsTable.id),
      })
      .from(resultsTable)
      .innerJoin(usersTable, eq(resultsTable.userId, usersTable.id))
      .groupBy(usersTable.id)
      .orderBy(asc(sql`avg(${resultsTable.accuracy})`))
      .limit(10);

    // 2. Most Difficult Topics
    const difficultTopics = await db
      .select({
        topicId: questionsTable.topicId,
        topicName: topicsTable.name,
        subjectName: subjectsTable.name,
        avgAccuracy: sql<number>`avg(case when ${practiceSessionAnswersTable.isCorrect} = true then 100.0 else 0.0 end)::real`,
        attempts: count(practiceSessionAnswersTable.id),
      })
      .from(practiceSessionAnswersTable)
      .innerJoin(questionsTable, eq(practiceSessionAnswersTable.questionId, questionsTable.id))
      .innerJoin(topicsTable, eq(questionsTable.topicId, topicsTable.id))
      .innerJoin(subjectsTable, eq(topicsTable.subjectId, subjectsTable.id))
      .where(eq(practiceSessionAnswersTable.status, "answered"))
      .groupBy(questionsTable.topicId, topicsTable.name, subjectsTable.name)
      .orderBy(asc(sql`avg(case when ${practiceSessionAnswersTable.isCorrect} = true then 100.0 else 0.0 end)`))
      .limit(10);

    // 3. Collections with Lowest Completion
    const lowCompletionCollections = await db
      .select({
        id: questionCollectionsTable.id,
        name: questionCollectionsTable.name,
        completionRate: sql<number>`(count(case when ${practiceSessionsTable.status} = 'completed' then 1 end) * 100.0 / count(*))::real`,
        attemptsCount: count(practiceSessionsTable.id),
      })
      .from(practiceSessionsTable)
      .innerJoin(questionCollectionsTable, eq(practiceSessionsTable.collectionId, questionCollectionsTable.id))
      .groupBy(questionCollectionsTable.id)
      .orderBy(asc(sql`(count(case when ${practiceSessionsTable.status} = 'completed' then 1 end) * 100.0 / count(*))`))
      .limit(10);

    // 4. Most Improved Students
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const mostImproved = await db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        recentAccuracy: sql<number>`avg(case when ${resultsTable.createdAt} >= ${sevenDaysAgo} then ${resultsTable.accuracy} end)::real`,
        olderAccuracy: sql<number>`avg(case when ${resultsTable.createdAt} < ${sevenDaysAgo} then ${resultsTable.accuracy} end)::real`,
        testsCount: count(resultsTable.id),
      })
      .from(resultsTable)
      .innerJoin(usersTable, eq(resultsTable.userId, usersTable.id))
      .groupBy(usersTable.id)
      .having(sql`avg(case when ${resultsTable.createdAt} >= ${sevenDaysAgo} then ${resultsTable.accuracy} end) > avg(case when ${resultsTable.createdAt} < ${sevenDaysAgo} then ${resultsTable.accuracy} end)`)
      .orderBy(desc(sql`avg(case when ${resultsTable.createdAt} >= ${sevenDaysAgo} then ${resultsTable.accuracy} end) - avg(case when ${resultsTable.createdAt} < ${sevenDaysAgo} then ${resultsTable.accuracy} end)`))
      .limit(10);

    // 5. Least Active Students
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const leastActive = await db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        recentTests: sql<number>`count(case when ${resultsTable.createdAt} >= ${fourteenDaysAgo} then 1 end)::int`,
        totalTests: count(resultsTable.id),
      })
      .from(resultsTable)
      .innerJoin(usersTable, eq(resultsTable.userId, usersTable.id))
      .groupBy(usersTable.id)
      .orderBy(asc(sql`count(case when ${resultsTable.createdAt} >= ${fourteenDaysAgo} then 1 end)`), asc(count(resultsTable.id)))
      .limit(10);

    // 6. Live recommendations
    const recommendationsRaw = await db
      .select({
        id: learningRecommendationsTable.id,
        userId: learningRecommendationsTable.userId,
        studentName: usersTable.name,
        type: learningRecommendationsTable.type,
        entityId: learningRecommendationsTable.entityId,
        score: learningRecommendationsTable.score,
        reason: learningRecommendationsTable.reason,
      })
      .from(learningRecommendationsTable)
      .innerJoin(usersTable, eq(learningRecommendationsTable.userId, usersTable.id))
      .orderBy(desc(learningRecommendationsTable.generatedAt))
      .limit(20);

    const recommendations = [];
    for (const rec of recommendationsRaw) {
      let entityName = "Practice Set";
      if (rec.type === "topic") {
        const [topic] = await db.select({ name: topicsTable.name }).from(topicsTable).where(eq(topicsTable.id, rec.entityId));
        if (topic) entityName = topic.name;
      } else if (rec.type === "collection") {
        const [col] = await db.select({ name: questionCollectionsTable.name }).from(questionCollectionsTable).where(eq(questionCollectionsTable.id, rec.entityId));
        if (col) entityName = col.name;
      }
      recommendations.push({
        id: rec.id,
        userId: rec.userId,
        studentName: rec.studentName,
        topicName: entityName,
        type: rec.type,
        entityId: rec.entityId,
        priority: rec.score >= 80 ? "high" : rec.score >= 50 ? "medium" : "low",
        reason: rec.reason,
      });
    }

    // 7. Live Study Plans templates list
    const templates = await db.select().from(studyPlanTemplatesTable);
    const studyPlans = [];
    for (const t of templates) {
      const assignedUsers = await db
        .select({ userId: userStudyPlanAssignmentsTable.userId })
        .from(userStudyPlanAssignmentsTable)
        .where(eq(userStudyPlanAssignmentsTable.templateId, t.id));
      
      const studentsCount = assignedUsers.length;
      let completionRate = 0;

      if (studentsCount > 0) {
        const userIds = assignedUsers.map(u => u.userId);
        const plans = await db
          .select()
          .from(studyPlansTable)
          .where(inArray(studyPlansTable.userId, userIds));

        let totalTasks = 0;
        let completedTasks = 0;

        for (const plan of plans) {
          const tasks = (plan.tasks || []) as any[];
          for (const task of tasks) {
            // Check if task belongs to this template
            if (task && typeof task.id === "string" && task.id.startsWith(`template_${t.id}`)) {
              totalTasks++;
              if (task.status === "completed") {
                completedTasks++;
              }
            }
          }
        }

        if (totalTasks > 0) {
          completionRate = Math.round((completedTasks * 100) / totalTasks);
        }
      }

      studyPlans.push({
        id: t.id,
        title: t.title,
        difficulty: t.difficulty,
        durationDays: t.durationDays,
        studentsCount,
        completionRate,
        tasks: t.tasks,
      });
    }

    // 8. Live Revision Queues stats for students
    const studentsList = await db
      .select({ id: usersTable.id, name: usersTable.name, avgAccuracy: sql<number>`avg(${resultsTable.accuracy})::real` })
      .from(usersTable)
      .leftJoin(resultsTable, eq(usersTable.id, resultsTable.userId))
      .where(eq(usersTable.role, "student"))
      .groupBy(usersTable.id);

    const threeDaysAgoForOverdue = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    const wrongCounts = await db
      .select({ userId: wrongAnswersTable.userId, val: count() })
      .from(wrongAnswersTable)
      .groupBy(wrongAnswersTable.userId);

    const bookmarkCounts = await db
      .select({ userId: bookmarksTable.userId, val: count() })
      .from(bookmarksTable)
      .groupBy(bookmarksTable.userId);

    const overdueCounts = await db
      .select({ userId: wrongAnswersTable.userId, val: count() })
      .from(wrongAnswersTable)
      .where(sql`${wrongAnswersTable.lastAttemptAt} < ${threeDaysAgoForOverdue}`)
      .groupBy(wrongAnswersTable.userId);

    const wrongCountsMap = new Map(wrongCounts.map(item => [item.userId, Number(item.val ?? 0)]));
    const bookmarkCountsMap = new Map(bookmarkCounts.map(item => [item.userId, Number(item.val ?? 0)]));
    const overdueCountsMap = new Map(overdueCounts.map(item => [item.userId, Number(item.val ?? 0)]));

    const revisionQueues = [];
    for (const student of studentsList) {
      const wrongCount = wrongCountsMap.get(student.id) ?? 0;
      const bookmarkCount = bookmarkCountsMap.get(student.id) ?? 0;
      const queueSize = wrongCount + bookmarkCount;
      const overdueCount = overdueCountsMap.get(student.id) ?? 0;

      revisionQueues.push({
        studentId: student.id,
        studentName: student.name,
        queueSize,
        overdueCount,
        subjectAccuracy: Math.round(Number(student.avgAccuracy ?? 75)),
      });
    }

    // 9. live mastery metrics
    const [avgAccuracyRes] = await db.select({ val: sql<number>`avg(${practiceSessionsTable.accuracy})::real` }).from(practiceSessionsTable).where(eq(practiceSessionsTable.status, "completed"));
    const classAvgMastery = Math.round(Number(avgAccuracyRes?.val ?? 0));

    const today = new Date();
    today.setHours(0,0,0,0);
    const [activeTodayRes] = await db.select({ val: count(sql`DISTINCT ${practiceSessionsTable.userId}`) }).from(practiceSessionsTable).where(sql`${practiceSessionsTable.completedAt} >= ${today}`);
    const activeToday = Number(activeTodayRes?.val ?? 0);

    const topicAccuracy = await db
      .select({
        topicId: questionsTable.topicId,
        avgAcc: sql<number>`avg(case when ${practiceSessionAnswersTable.isCorrect} = true then 100.0 else 0.0 end)::real`,
      })
      .from(practiceSessionAnswersTable)
      .innerJoin(questionsTable, eq(practiceSessionAnswersTable.questionId, questionsTable.id))
      .where(eq(practiceSessionAnswersTable.status, "answered"))
      .groupBy(questionsTable.topicId);

    const highlyMasteredCount = topicAccuracy.filter(t => t.avgAcc >= 75).length;
    const underReviewCount = topicAccuracy.filter(t => t.avgAcc < 65).length;

    const allSubjects = await db.select().from(subjectsTable);
    const subjectMastery = [];
    for (const sub of allSubjects) {
      const [subAccRes] = await db
        .select({ avgAcc: sql<number>`avg(case when ${practiceSessionAnswersTable.isCorrect} = true then 100.0 else 0.0 end)::real` })
        .from(practiceSessionAnswersTable)
        .innerJoin(questionsTable, eq(practiceSessionAnswersTable.questionId, questionsTable.id))
        .where(and(eq(questionsTable.subjectId, sub.id), eq(practiceSessionAnswersTable.status, "answered")));
      
      subjectMastery.push({
        id: sub.id,
        name: sub.name,
        mastery: Math.round(Number(subAccRes?.avgAcc ?? 0)),
      });
    }

    // 10. recommendation trends weekly
    const recommendationTrends = [];
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0,0,0,0);
      const nextD = new Date(d);
      nextD.setDate(nextD.getDate() + 1);

      const [genRes] = await db.select({ val: count() }).from(learningRecommendationsTable).where(and(
        sql`${learningRecommendationsTable.generatedAt} >= ${d}`,
        sql`${learningRecommendationsTable.generatedAt} < ${nextD}`
      ));

      const [resRes] = await db.select({ val: count() }).from(practiceSessionsTable).where(and(
        eq(practiceSessionsTable.status, "completed"),
        sql`${practiceSessionsTable.completedAt} >= ${d}`,
        sql`${practiceSessionsTable.completedAt} < ${nextD}`
      ));

      recommendationTrends.push({
        day: days[d.getDay()],
        generated: Number(genRes?.val ?? 0),
        resolved: Number(resRes?.val ?? 0),
      });
    }

    res.json({
      studentsNeedingHelp: lowAccuracyStudents,
      mostDifficultTopics: difficultTopics,
      collectionsLowestCompletion: lowCompletionCollections,
      mostImprovedStudents: mostImproved.map(s => ({
        ...s,
        improvement: Math.round(((s.recentAccuracy ?? 0) - (s.olderAccuracy ?? 0)) * 10) / 10
      })),
      leastActiveStudents: leastActive,
      recommendations,
      studyPlans,
      revisionQueues,
      mastery: {
        classAverageMastery: classAvgMastery,
        highlyMasteredTopics: highlyMasteredCount,
        topicsUnderReview: underReviewCount,
        studentsActiveToday: activeToday,
        subjectMastery,
      },
      recommendationTrends,
    });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message || "Failed to fetch admin adaptive dashboard statistics" });
  }
});

// 9. GET /api/v1/adaptive/admin/templates
router.get("/v1/adaptive/admin/templates", requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  try {
    await seedDefaultTemplatesIfEmpty();
    const templates = await db.select().from(studyPlanTemplatesTable).orderBy(desc(studyPlanTemplatesTable.createdAt));
    res.json(templates);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch study plan templates" });
  }
});

// 10. POST /api/v1/adaptive/admin/templates
router.post("/v1/adaptive/admin/templates", requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  try {
    const { title, difficulty, durationDays, tasks } = req.body;
    if (!title || typeof title !== "string" || !title.trim()) {
      res.status(400).json({ error: "Title is required and must be a non-empty string" });
      return;
    }
    if (!difficulty || !["easy", "medium", "hard"].includes(difficulty)) {
      res.status(400).json({ error: "Difficulty must be one of: easy, medium, hard" });
      return;
    }
    if (!durationDays || isNaN(Number(durationDays)) || Number(durationDays) <= 0) {
      res.status(400).json({ error: "Duration (Days) must be a positive number" });
      return;
    }

    const [newTemplate] = await db.insert(studyPlanTemplatesTable).values({
      title,
      difficulty,
      durationDays: Number(durationDays),
      tasks: tasks || [],
    }).returning();
    res.status(201).json(newTemplate);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to create study plan template" });
  }
});

// 11. PUT /api/v1/adaptive/admin/templates/:id
router.put("/v1/adaptive/admin/templates/:id", requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const { title, difficulty, durationDays, tasks } = req.body;
    if (!title || typeof title !== "string" || !title.trim()) {
      res.status(400).json({ error: "Title is required and must be a non-empty string" });
      return;
    }
    if (!difficulty || !["easy", "medium", "hard"].includes(difficulty)) {
      res.status(400).json({ error: "Difficulty must be one of: easy, medium, hard" });
      return;
    }
    if (!durationDays || isNaN(Number(durationDays)) || Number(durationDays) <= 0) {
      res.status(400).json({ error: "Duration (Days) must be a positive number" });
      return;
    }

    const [updated] = await db.update(studyPlanTemplatesTable).set({
      title,
      difficulty,
      durationDays: Number(durationDays),
      tasks: tasks || [],
      updatedAt: new Date(),
    }).where(eq(studyPlanTemplatesTable.id, id)).returning();
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to update study plan template" });
  }
});

// 12. DELETE /api/v1/adaptive/admin/templates/:id
router.delete("/v1/adaptive/admin/templates/:id", requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    await db.delete(studyPlanTemplatesTable).where(eq(studyPlanTemplatesTable.id, id));
    res.json({ message: "Template deleted successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to delete study plan template" });
  }
});

// 13. POST /api/v1/adaptive/admin/assign/template
router.post("/v1/adaptive/admin/assign/template", requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  try {
    const { userIds, templateId } = req.body;
    if (!Array.isArray(userIds) || userIds.length === 0 || !templateId) {
      res.status(400).json({ error: "Invalid userIds or templateId (must provide at least one student)" });
      return;
    }
    await db.delete(userStudyPlanAssignmentsTable).where(inArray(userStudyPlanAssignmentsTable.userId, userIds));
    
    const values = userIds.map(userId => ({
      userId,
      templateId,
    }));
    await db.insert(userStudyPlanAssignmentsTable).values(values);
    
    for (const userId of userIds) {
      await regeneratePlansFromTemplate(userId, templateId);
    }
    res.json({ message: "Successfully assigned template to students" });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to assign study plan template" });
  }
});

// 14. POST /api/v1/adaptive/admin/assign/recommendation
router.post("/v1/adaptive/admin/assign/recommendation", requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  try {
    const { userIds, type, entityId } = req.body;
    if (!Array.isArray(userIds) || !type || !entityId) {
      res.status(400).json({ error: "Invalid parameters" });
      return;
    }
    const values = userIds.map(userId => ({
      userId,
      type,
      entityId,
      status: "pending" as const,
    }));
    await db.insert(assignedTasksTable).values(values);
    
    const todayStr = new Date().toISOString().split("T")[0];
    for (const userId of userIds) {
      await addAssignedTaskToDailyPlan(userId, todayStr, type, entityId);
    }
    res.json({ message: "Successfully assigned recommendation to students" });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to assign recommendation" });
  }
});

// 15. POST /api/v1/adaptive/admin/assign/remove
router.post("/v1/adaptive/admin/assign/remove", requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  try {
    const { userId, templateId, assignedTaskId } = req.body;
    if (templateId) {
      await db.delete(userStudyPlanAssignmentsTable)
        .where(and(eq(userStudyPlanAssignmentsTable.userId, userId), eq(userStudyPlanAssignmentsTable.templateId, templateId)));
    }
    if (assignedTaskId) {
      await db.delete(assignedTasksTable).where(eq(assignedTasksTable.id, assignedTaskId));
    }
    res.json({ message: "Assignment removed successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to remove assignment" });
  }
});

// 16. POST /api/v1/adaptive/admin/assign/recalculate
router.post("/v1/adaptive/admin/assign/recalculate", requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  try {
    const { userId } = req.body;
    if (!userId) {
      res.status(400).json({ error: "User ID is required" });
      return;
    }
    const todayStr = new Date().toISOString().split("T")[0];
    await forceRegenerateDailyPlan(userId, todayStr);
    res.json({ message: "Recalculation successful" });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to recalculate assignments" });
  }
});

// 17. POST /api/v1/adaptive/admin/clear-queue
router.post("/v1/adaptive/admin/clear-queue", requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  try {
    const { userId } = req.body;
    if (!userId) {
      res.status(400).json({ error: "User ID is required" });
      return;
    }
    await db.delete(wrongAnswersTable).where(eq(wrongAnswersTable.userId, userId));
    res.json({ message: "Successfully cleared student revision queue" });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to clear revision queue" });
  }
});

// 18. GET /api/v1/adaptive/admin/settings
router.get("/v1/adaptive/admin/settings", requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  try {
    const [settings] = await db.select().from(adaptiveSettingsTable).limit(1);
    if (!settings) {
      res.json({
        masteryThreshold: 0.8,
        accuracyThreshold: 0.7,
        weakTopicThreshold: 0.5,
        recommendationFrequency: 7,
        sm2Ease: 2.5,
        sm2IntervalModifier: 1.0,
        difficultyProgression: "standard",
        automaticAssignments: true,
        dailyGoalQuestions: 10,
        dailyGoalMinutes: 30,
      });
      return;
    }
    res.json(settings);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch adaptive settings" });
  }
});

// 19. POST /api/v1/adaptive/admin/settings
router.post("/v1/adaptive/admin/settings", requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  try {
    const body = req.body;
    const [existing] = await db.select().from(adaptiveSettingsTable).limit(1);
    let record;
    if (existing) {
      const [updated] = await db
        .update(adaptiveSettingsTable)
        .set({
          masteryThreshold: Number(body.masteryThreshold ?? existing.masteryThreshold),
          accuracyThreshold: Number(body.accuracyThreshold ?? existing.accuracyThreshold),
          weakTopicThreshold: Number(body.weakTopicThreshold ?? existing.weakTopicThreshold),
          recommendationFrequency: parseInt(body.recommendationFrequency ?? existing.recommendationFrequency, 10),
          sm2Ease: Number(body.sm2Ease ?? existing.sm2Ease),
          sm2IntervalModifier: Number(body.sm2IntervalModifier ?? existing.sm2IntervalModifier),
          difficultyProgression: body.difficultyProgression ?? existing.difficultyProgression,
          automaticAssignments: body.automaticAssignments ?? existing.automaticAssignments,
          dailyGoalQuestions: parseInt(body.dailyGoalQuestions ?? existing.dailyGoalQuestions, 10),
          dailyGoalMinutes: parseInt(body.dailyGoalMinutes ?? existing.dailyGoalMinutes, 10),
          updatedAt: new Date(),
        })
        .where(eq(adaptiveSettingsTable.id, existing.id))
        .returning();
      record = updated;
    } else {
      const [inserted] = await db
        .insert(adaptiveSettingsTable)
        .values({
          masteryThreshold: Number(body.masteryThreshold ?? 0.8),
          accuracyThreshold: Number(body.accuracyThreshold ?? 0.7),
          weakTopicThreshold: Number(body.weakTopicThreshold ?? 0.5),
          recommendationFrequency: parseInt(body.recommendationFrequency ?? 7, 10),
          sm2Ease: Number(body.sm2Ease ?? 2.5),
          sm2IntervalModifier: Number(body.sm2IntervalModifier ?? 1.0),
          difficultyProgression: body.difficultyProgression ?? "standard",
          automaticAssignments: body.automaticAssignments ?? true,
          dailyGoalQuestions: parseInt(body.dailyGoalQuestions ?? 10, 10),
          dailyGoalMinutes: parseInt(body.dailyGoalMinutes ?? 30, 10),
        })
        .returning();
      record = inserted;
    }
    res.json(record);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to update settings" });
  }
});

// 20. POST /api/v1/adaptive/admin/assign/weak-topic
router.post("/v1/adaptive/admin/assign/weak-topic", requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  try {
    const { userIds, topicId } = req.body;
    if (!Array.isArray(userIds) || !topicId) {
      res.status(400).json({ error: "Invalid userIds or topicId" });
      return;
    }
    const values = userIds.map(userId => ({
      userId,
      type: "topic" as const,
      entityId: topicId,
      status: "pending" as const,
    }));
    await db.insert(assignedTasksTable).values(values);

    const todayStr = new Date().toISOString().split("T")[0];
    for (const userId of userIds) {
      await addAssignedTaskToDailyPlan(userId, todayStr, "topic", topicId);
    }
    res.json({ message: "Successfully assigned weak topic to students" });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to assign weak topic" });
  }
});

// 21. POST /api/v1/adaptive/admin/assign/revision-queue
router.post("/v1/adaptive/admin/assign/revision-queue", requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  try {
    const { userIds, questionId } = req.body;
    if (!Array.isArray(userIds) || !questionId) {
      res.status(400).json({ error: "Invalid userIds or questionId" });
      return;
    }
    for (const userId of userIds) {
      const [existing] = await db
        .select()
        .from(wrongAnswersTable)
        .where(and(eq(wrongAnswersTable.userId, userId), eq(wrongAnswersTable.questionId, questionId)));
      if (existing) {
        await db
          .update(wrongAnswersTable)
          .set({
            attemptCount: existing.attemptCount + 1,
            lastAttemptAt: new Date(),
          })
          .where(eq(wrongAnswersTable.id, existing.id));
      } else {
        await db.insert(wrongAnswersTable).values({
          userId,
          questionId,
          attemptCount: 1,
          sourceType: "practice",
        });
      }
    }
    res.json({ message: "Successfully assigned question to revision queues" });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to assign revision queue" });
  }
});

// 22. POST /api/v1/adaptive/admin/assign/goals
router.post("/v1/adaptive/admin/assign/goals", requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  try {
    const { userIds, dailyQuestionsTarget, dailyMinutesTarget, practiceAccuracyTarget } = req.body;
    if (!Array.isArray(userIds)) {
      res.status(400).json({ error: "Invalid userIds" });
      return;
    }
    for (const userId of userIds) {
      const [existing] = await db
        .select()
        .from(userGoalsTable)
        .where(eq(userGoalsTable.userId, userId));
      if (existing) {
        await db
          .update(userGoalsTable)
          .set({
            dailyQuestionsTarget: parseInt(dailyQuestionsTarget ?? existing.dailyQuestionsTarget, 10),
            dailyMinutesTarget: parseInt(dailyMinutesTarget ?? existing.dailyMinutesTarget, 10),
            practiceAccuracyTarget: Number(practiceAccuracyTarget ?? existing.practiceAccuracyTarget),
            updatedAt: new Date(),
          })
          .where(eq(userGoalsTable.id, existing.id));
      } else {
        await db.insert(userGoalsTable).values({
          userId,
          dailyQuestionsTarget: parseInt(dailyQuestionsTarget ?? 15, 10),
          dailyMinutesTarget: parseInt(dailyMinutesTarget ?? 45, 10),
          practiceAccuracyTarget: Number(practiceAccuracyTarget ?? 0.75),
        });
      }
    }
    res.json({ message: "Successfully assigned goals to students" });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to assign goals" });
  }
});

// 23. POST /api/v1/adaptive/admin/assign/reset
router.post("/v1/adaptive/admin/assign/reset", requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  try {
    const { userIds } = req.body;
    if (!Array.isArray(userIds)) {
      res.status(400).json({ error: "Invalid userIds" });
      return;
    }
    await db.delete(userStudyPlanAssignmentsTable).where(inArray(userStudyPlanAssignmentsTable.userId, userIds));
    await db.delete(assignedTasksTable).where(inArray(assignedTasksTable.userId, userIds));
    await db.delete(userGoalsTable).where(inArray(userGoalsTable.userId, userIds));
    await db.delete(studyPlansTable).where(inArray(studyPlansTable.userId, userIds));
    await db.delete(wrongAnswersTable).where(inArray(wrongAnswersTable.userId, userIds));
    res.json({ message: "Successfully reset student adaptive assignments and state" });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to reset student assignments" });
  }
});

// Helper to regenerate revision queue based on student actual history
async function regenerateRevisionQueueForUser(userId: number, attemptMapOpt?: any): Promise<number> {
  const attemptMap = attemptMapOpt || await getUserAttemptHistoryMap(userId);

  const existingWrong = await db
    .select()
    .from(wrongAnswersTable)
    .where(eq(wrongAnswersTable.userId, userId));
  
  const existingMap = new Map(existingWrong.map(w => [w.questionId, w]));
  
  const inserts: typeof wrongAnswersTable.$inferInsert[] = [];
  const deleteIds: number[] = [];
  
  for (const [questionId, attempt] of attemptMap.entries()) {
    if (!attempt.isCorrect) {
      const existing = existingMap.get(questionId);
      if (existing) {
        if (attempt.updatedAt > existing.lastAttemptAt) {
          await db
            .update(wrongAnswersTable)
            .set({ lastAttemptAt: attempt.updatedAt })
            .where(eq(wrongAnswersTable.id, existing.id));
        }
      } else {
        inserts.push({
          userId,
          questionId,
          attemptCount: 1,
          lastAttemptAt: attempt.updatedAt,
          sourceType: "practice",
        });
      }
    } else {
      const existing = existingMap.get(questionId);
      if (existing) {
        deleteIds.push(questionId);
      }
    }
  }

  if (inserts.length > 0) {
    await db.insert(wrongAnswersTable).values(inserts);
  }

  if (deleteIds.length > 0) {
    await db.delete(wrongAnswersTable).where(and(
      eq(wrongAnswersTable.userId, userId),
      inArray(wrongAnswersTable.questionId, deleteIds)
    ));
  }

  const [res] = await db
    .select({ count: count() })
    .from(wrongAnswersTable)
    .where(eq(wrongAnswersTable.userId, userId));
  return Number(res?.count ?? 0);
}

// 24. POST /api/v1/adaptive/admin/re-evaluate
router.post("/v1/adaptive/admin/re-evaluate", requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  try {
    const students = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.role, "student"));

    const [settings] = await db.select().from(adaptiveSettingsTable).limit(1);

    const todayStr = new Date().toISOString().split("T")[0];

    let studentsProcessed = 0;
    let recommendationsGenerated = 0;
    let studyPlansGenerated = 0;
    let revisionItemsGenerated = 0;

    await Promise.all(
      students.map(async (student) => {
        const userId = student.id;
        const attemptMap = await getUserAttemptHistoryMap(userId);
        const data = await calculateAllMastery(userId, attemptMap);

        // 1. Recalculate mastery and generate recommendations
        const recsCount = await generateRecommendationsForUser(userId, attemptMap, data);
        recommendationsGenerated += recsCount;

        // 2. Regenerate study plans (Assignments & Daily goals)
        const assignments = await db
          .select()
          .from(userStudyPlanAssignmentsTable)
          .where(eq(userStudyPlanAssignmentsTable.userId, userId));

        if (assignments.length > 0) {
          for (const ass of assignments) {
            const plansCount = await regeneratePlansFromTemplate(userId, ass.templateId);
            studyPlansGenerated += plansCount;
          }
        } else {
          await forceRegenerateDailyPlan(userId, todayStr);
          await getOrGenerateStudyPlan(userId, todayStr, attemptMap, data);
          studyPlansGenerated += 1;
        }

        // 3. Regenerate revision queue
        const queueCount = await regenerateRevisionQueueForUser(userId, attemptMap);
        revisionItemsGenerated += queueCount;

        studentsProcessed += 1;
      })
    );

    res.json({
      studentsProcessed,
      recommendationsGenerated,
      studyPlansGenerated,
      revisionItemsGenerated,
    });
  } catch (err: any) {
    console.error("Re-evaluation failed:", err);
    res.status(500).json({ error: err.message || "Failed to execute adaptive re-evaluation" });
  }
});

export default router;
