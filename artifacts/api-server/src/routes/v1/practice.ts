import { Router, type IRouter } from "express";
import {
  db,
  practiceSessionsTable,
  practiceSessionQuestionsTable,
  practiceSessionAnswersTable,
  wrongAnswersTable,
  practiceCollectionsTable,
  questionsTable,
  questionOptionsTable,
  subjectsTable,
  topicsTable,
  questionCollectionsTable,
  questionCollectionItemsTable,
  bookmarksTable,
  sessionAnswersTable,
  testSessionsTable,
} from "@workspace/db";
import { eq, and, inArray, desc, asc, count, sql } from "drizzle-orm";
import { requireAuth, requireAdmin, type AuthRequest } from "../../middlewares/auth";
import { z } from "zod";

const router: IRouter = Router();

// Zod validation schemas
const CreateSessionBody = z.object({
  mode: z.enum(["timed", "untimed"]),
  type: z.enum([
    "subject",
    "topic",
    "collection",
    "random",
    "difficulty",
    "bookmarks",
    "wrong_answers",
  ]),
  subjectId: z.number().int().positive().optional(),
  topicId: z.number().int().positive().optional(),
  collectionId: z.number().int().positive().optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  limit: z.number().int().min(1).max(100).optional().default(20),
});

const SubmitAnswerBody = z.object({
  questionId: z.number().int().positive(),
  selectedOptionId: z.number().int().positive().nullable(),
  timeTakenSeconds: z.number().int().min(0),
  status: z.enum(["visited", "answered", "skipped"]),
});

const FlagBody = z.object({
  questionId: z.number().int().positive(),
  flagged: z.boolean(),
});

const UpdatePracticeSettingsBody = z.object({
  availableForPractice: z.boolean(),
  isVisible: z.boolean(),
  isFeatured: z.boolean(),
  difficulty: z.enum(["easy", "medium", "hard"]),
  estimatedTimeMinutes: z.number().int().positive(),
});


async function getSessionDurationSeconds(collectionId: number | null, totalQuestions: number): Promise<number> {
  let durationSeconds = totalQuestions * 90; // Default: 90s per question
  if (collectionId) {
    const [pc] = await db
      .select({ estimatedTimeMinutes: practiceCollectionsTable.estimatedTimeMinutes })
      .from(practiceCollectionsTable)
      .where(eq(practiceCollectionsTable.collectionId, collectionId));
    if (pc?.estimatedTimeMinutes) {
      durationSeconds = pc.estimatedTimeMinutes * 60;
    }
  }
  return durationSeconds;
}

// Helper: sync wrong answers from exams to wrong_answers table
async function syncWrongAnswers(userId: number): Promise<void> {
  try {
    // 1. Get all wrong answer question IDs from exam sessions
    const examWrongAnswers = await db
      .select({ 
        questionId: sessionAnswersTable.questionId,
        sessionId: testSessionsTable.id,
        examType: testSessionsTable.status // placeholder/source
      })
      .from(sessionAnswersTable)
      .innerJoin(testSessionsTable, eq(sessionAnswersTable.sessionId, testSessionsTable.id))
      .innerJoin(questionOptionsTable, eq(sessionAnswersTable.selectedOptionId, questionOptionsTable.id))
      .where(
        and(
          eq(testSessionsTable.userId, userId),
          inArray(testSessionsTable.status, ["submitted", "auto_submitted"]),
          eq(questionOptionsTable.isCorrect, false)
        )
      );

    if (examWrongAnswers.length === 0) return;

    // 2. Get already existing wrong answers for this user
    const existing = await db
      .select({ questionId: wrongAnswersTable.questionId })
      .from(wrongAnswersTable)
      .where(eq(wrongAnswersTable.userId, userId));

    const existingIds = new Set(existing.map((e) => e.questionId));

    // 3. Insert missing ones, mapping to 'exam' as sourceType
    const toInsert = examWrongAnswers
      .filter((wa) => !existingIds.has(wa.questionId))
      .map((wa) => ({
        userId,
        questionId: wa.questionId,
        attemptCount: 1,
        lastAttemptAt: new Date(),
        sourceType: "exam" as const,
        sourceId: wa.sessionId,
      }));

    if (toInsert.length > 0) {
      // De-duplicate within the toInsert array to prevent insert conflicts
      const uniqueToInsert = [];
      const seen = new Set();
      for (const item of toInsert) {
        if (!seen.has(item.questionId)) {
          seen.add(item.questionId);
          uniqueToInsert.push(item);
        }
      }
      if (uniqueToInsert.length > 0) {
        await db.insert(wrongAnswersTable).values(uniqueToInsert);
      }
    }
  } catch (error) {
    console.error("Failed to sync wrong answers:", error);
  }
}

// ─── GET PRACTICE STATS ──────────────────────────────────────────────────────
router.get("/v1/practice/stats", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const userId = req.userId!;

  // Sync wrong answers from exams first so dashboard counts are accurate
  await syncWrongAnswers(userId);

  // 1. Total questions practiced (number of answered questions in completed/in_progress practice sessions)
  const [totalPracticedRes] = await db
    .select({ val: count() })
    .from(practiceSessionAnswersTable)
    .innerJoin(practiceSessionsTable, eq(practiceSessionAnswersTable.sessionId, practiceSessionsTable.id))
    .where(
      and(
        eq(practiceSessionsTable.userId, userId),
        eq(practiceSessionAnswersTable.status, "answered")
      )
    );
  const questionsPracticed = Number(totalPracticedRes?.val ?? 0);

  // 2. Accuracy
  const [correctRes] = await db
    .select({ val: count() })
    .from(practiceSessionAnswersTable)
    .innerJoin(practiceSessionsTable, eq(practiceSessionAnswersTable.sessionId, practiceSessionsTable.id))
    .where(
      and(
        eq(practiceSessionsTable.userId, userId),
        eq(practiceSessionAnswersTable.status, "answered"),
        eq(practiceSessionAnswersTable.isCorrect, true)
      )
    );
  const correctCount = Number(correctRes?.val ?? 0);
  const accuracy = questionsPracticed > 0 ? Math.round((correctCount / questionsPracticed) * 100) : 0;

  // 3. Time spent
  const [timeSpentRes] = await db
    .select({ val: sql<number>`COALESCE(SUM(${practiceSessionAnswersTable.timeTakenSeconds}), 0)` })
    .from(practiceSessionAnswersTable)
    .innerJoin(practiceSessionsTable, eq(practiceSessionAnswersTable.sessionId, practiceSessionsTable.id))
    .where(eq(practiceSessionsTable.userId, userId));
  const timeSpent = Number(timeSpentRes?.val ?? 0);

  // 4. Collections completed
  const [collectionsCompletedRes] = await db
    .select({ val: count(sql`DISTINCT ${practiceSessionsTable.collectionId}`) })
    .from(practiceSessionsTable)
    .where(
      and(
        eq(practiceSessionsTable.userId, userId),
        eq(practiceSessionsTable.status, "completed")
      )
    );
  const collectionsCompleted = Number(collectionsCompletedRes?.val ?? 0);

  // 5. Today's practice questions
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const [todayPracticedRes] = await db
    .select({ val: count() })
    .from(practiceSessionAnswersTable)
    .innerJoin(practiceSessionsTable, eq(practiceSessionAnswersTable.sessionId, practiceSessionsTable.id))
    .where(
      and(
        eq(practiceSessionsTable.userId, userId),
        eq(practiceSessionAnswersTable.status, "answered"),
        sql`${practiceSessionAnswersTable.updatedAt} >= ${todayStart}`
      )
    );
  const todayPractice = Number(todayPracticedRes?.val ?? 0);

  // 6. Bookmarked questions count
  const [bookmarksCountRes] = await db
    .select({ val: count() })
    .from(bookmarksTable)
    .where(eq(bookmarksTable.userId, userId));
  const bookmarkedQuestions = Number(bookmarksCountRes?.val ?? 0);

  // 7. Wrong answer questions count
  const [wrongAnswersCountRes] = await db
    .select({ val: count() })
    .from(wrongAnswersTable)
    .where(eq(wrongAnswersTable.userId, userId));
  const wrongAnswerQuestions = Number(wrongAnswersCountRes?.val ?? 0);

  // 8. Recommended Collections (Featured and available)
  const recommendedCollections = await db
    .select({
      id: questionCollectionsTable.id,
      name: questionCollectionsTable.name,
      description: questionCollectionsTable.description,
      difficulty: practiceCollectionsTable.difficulty,
      estimatedTime: practiceCollectionsTable.estimatedTimeMinutes,
    })
    .from(questionCollectionsTable)
    .innerJoin(
      practiceCollectionsTable,
      eq(questionCollectionsTable.id, practiceCollectionsTable.collectionId)
    )
    .where(
      and(
        eq(questionCollectionsTable.isArchived, false),
        eq(practiceCollectionsTable.availableForPractice, true),
        eq(practiceCollectionsTable.isFeatured, true)
      )
    )
    .limit(4);

  // Fetch question counts for recommended collections
  const recommended = [];
  for (const rc of recommendedCollections) {
    const [qCountRes] = await db
      .select({ val: count() })
      .from(questionCollectionItemsTable)
      .where(eq(questionCollectionItemsTable.collectionId, rc.id));
    recommended.push({
      ...rc,
      questionCount: Number(qCountRes?.val ?? 0),
    });
  }

  // 9. Recently Practiced (Active, paused or completed sessions)
  const recentSessions = await db
    .select({
      id: practiceSessionsTable.id,
      mode: practiceSessionsTable.mode,
      status: practiceSessionsTable.status,
      startedAt: practiceSessionsTable.startedAt,
      completedAt: practiceSessionsTable.completedAt,
      accuracy: practiceSessionsTable.accuracy,
      totalQuestions: practiceSessionsTable.totalQuestions,
      currentQuestionIndex: practiceSessionsTable.currentQuestionIndex,
      collectionName: questionCollectionsTable.name,
      subjectName: subjectsTable.name,
      topicName: topicsTable.name,
    })
    .from(practiceSessionsTable)
    .leftJoin(
      questionCollectionsTable,
      eq(practiceSessionsTable.collectionId, questionCollectionsTable.id)
    )
    .leftJoin(subjectsTable, eq(practiceSessionsTable.subjectId, subjectsTable.id))
    .leftJoin(topicsTable, eq(practiceSessionsTable.topicId, topicsTable.id))
    .where(eq(practiceSessionsTable.userId, userId))
    .orderBy(desc(practiceSessionsTable.startedAt))
    .limit(5);

  // 10. Subject list with practicing counts
  const allSubjects = await db.select().from(subjectsTable);
  const subjectsWithStats = [];
  for (const sub of allSubjects) {
    const [subPracticedRes] = await db
      .select({ val: count() })
      .from(practiceSessionAnswersTable)
      .innerJoin(practiceSessionsTable, eq(practiceSessionAnswersTable.sessionId, practiceSessionsTable.id))
      .innerJoin(questionsTable, eq(practiceSessionAnswersTable.questionId, questionsTable.id))
      .where(
        and(
          eq(practiceSessionsTable.userId, userId),
          eq(questionsTable.subjectId, sub.id),
          eq(practiceSessionAnswersTable.status, "answered")
        )
      );

    subjectsWithStats.push({
      id: sub.id,
      name: sub.name,
      description: sub.description,
      iconUrl: sub.iconUrl,
      questionsPracticed: Number(subPracticedRes?.val ?? 0),
    });
  }

  res.json({
    stats: {
      questionsPracticed,
      accuracy,
      timeSpent,
      collectionsCompleted,
      todayPractice,
      bookmarkedQuestions,
      wrongAnswerQuestions,
    },
    recommendedCollections: recommended,
    recentSessions,
    subjects: subjectsWithStats,
  });
});

// ─── GET SUBJECTS, TOPICS AND COLLECTIONS HIERARCHY ─────────────────────────
router.get("/v1/practice/subjects", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const subjects = await db.select().from(subjectsTable);
  const result = [];

  for (const s of subjects) {
    const topics = await db.select().from(topicsTable).where(eq(topicsTable.subjectId, s.id));
    const topicsList = [];

    for (const t of topics) {
      // Find collections associated with this topic that are configured for practice
      const collections = await db
        .select({
          id: questionCollectionsTable.id,
          name: questionCollectionsTable.name,
          description: questionCollectionsTable.description,
          difficulty: practiceCollectionsTable.difficulty,
          estimatedTimeMinutes: practiceCollectionsTable.estimatedTimeMinutes,
        })
        .from(questionCollectionsTable)
        .innerJoin(
          practiceCollectionsTable,
          eq(questionCollectionsTable.id, practiceCollectionsTable.collectionId)
        )
        .where(
          and(
            eq(questionCollectionsTable.isArchived, false),
            eq(practiceCollectionsTable.availableForPractice, true),
            eq(practiceCollectionsTable.isVisible, true),
            // Look for collections whose items belong to this topic
            sql`EXISTS (
              SELECT 1 FROM ${questionCollectionItemsTable} ci
              JOIN ${questionsTable} q ON ci.question_id = q.id
              WHERE ci.collection_id = ${questionCollectionsTable.id} AND q.topic_id = ${t.id}
            )`
          )
        );

      const collectionsList = [];
      for (const col of collections) {
        const [qCountRes] = await db
          .select({ val: count() })
          .from(questionCollectionItemsTable)
          .where(eq(questionCollectionItemsTable.collectionId, col.id));
        collectionsList.push({
          ...col,
          questionCount: Number(qCountRes?.val ?? 0),
        });
      }

      // Only include topic if it has questions or collections
      const [topicQuestionsCount] = await db
        .select({ val: count() })
        .from(questionsTable)
        .where(eq(questionsTable.topicId, t.id));

      topicsList.push({
        id: t.id,
        name: t.name,
        questionCount: Number(topicQuestionsCount?.val ?? 0),
        collections: collectionsList,
      });
    }

    result.push({
      id: s.id,
      name: s.name,
      description: s.description,
      iconUrl: s.iconUrl,
      topics: topicsList,
    });
  }

  res.json(result);
});

// ─── CREATE OR RESUME PRACTICE SESSION ──────────────────────────────────────
router.post("/v1/practice/sessions", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const parsed = CreateSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = req.userId!;
  const { mode, type, subjectId, topicId, collectionId, difficulty, limit } = parsed.data;

  // Prevent duplicate active sessions by checking if there's an in_progress/paused session matching criteria
  const conds = [
    eq(practiceSessionsTable.userId, userId),
    inArray(practiceSessionsTable.status, ["in_progress", "paused"]),
    eq(practiceSessionsTable.mode, mode),
  ];

  if (collectionId) conds.push(eq(practiceSessionsTable.collectionId, collectionId));
  else if (topicId) conds.push(eq(practiceSessionsTable.topicId, topicId));
  else if (subjectId) conds.push(eq(practiceSessionsTable.subjectId, subjectId));

  const [existingSession] = await db.select().from(practiceSessionsTable).where(and(...conds));
  if (existingSession) {
    // Fetch question IDs from normalized practice_session_questions
    const sessionQuestions = await db
      .select({ questionId: practiceSessionQuestionsTable.questionId })
      .from(practiceSessionQuestionsTable)
      .where(eq(practiceSessionQuestionsTable.sessionId, existingSession.id))
      .orderBy(asc(practiceSessionQuestionsTable.displayOrder));

    const durationSeconds = await getSessionDurationSeconds(existingSession.collectionId, existingSession.totalQuestions);
    res.json({
      session: {
        ...existingSession,
        durationSeconds,
      },
      questionIds: sessionQuestions.map((sq) => sq.questionId),
      message: "Resumed existing practice session",
    });
    return;
  }

  // Get question IDs based on parameters
  let questionIds: number[] = [];

  if (type === "collection") {
    if (!collectionId) {
      res.status(400).json({ error: "collectionId is required for collection practice" });
      return;
    }

    const [col] = await db
      .select()
      .from(questionCollectionsTable)
      .where(eq(questionCollectionsTable.id, collectionId));

    if (!col || col.isArchived) {
      res.status(400).json({ error: "Collection not found or archived" });
      return;
    }

    const items = await db
      .select({ questionId: questionCollectionItemsTable.questionId })
      .from(questionCollectionItemsTable)
      .where(eq(questionCollectionItemsTable.collectionId, collectionId))
      .orderBy(asc(questionCollectionItemsTable.order));

    questionIds = items.map((i) => i.questionId);
  } else if (type === "topic") {
    if (!topicId) {
      res.status(400).json({ error: "topicId is required for topic practice" });
      return;
    }
    const qs = await db
      .select({ id: questionsTable.id })
      .from(questionsTable)
      .where(eq(questionsTable.topicId, topicId));
    questionIds = qs.map((q) => q.id);
  } else if (type === "subject") {
    if (!subjectId) {
      res.status(400).json({ error: "subjectId is required for subject practice" });
      return;
    }
    const qs = await db
      .select({ id: questionsTable.id })
      .from(questionsTable)
      .where(eq(questionsTable.subjectId, subjectId));
    questionIds = qs.map((q) => q.id);
  } else if (type === "difficulty") {
    if (!difficulty) {
      res.status(400).json({ error: "difficulty is required for difficulty practice" });
      return;
    }
    const qs = await db
      .select({ id: questionsTable.id })
      .from(questionsTable)
      .where(eq(questionsTable.difficulty, difficulty));
    questionIds = qs.map((q) => q.id);
  } else if (type === "bookmarks") {
    const qs = await db
      .select({ questionId: bookmarksTable.questionId })
      .from(bookmarksTable)
      .innerJoin(questionsTable, eq(bookmarksTable.questionId, questionsTable.id))
      .where(eq(bookmarksTable.userId, userId));
    questionIds = qs.map((q) => q.questionId);
  } else if (type === "wrong_answers") {
    await syncWrongAnswers(userId);
    const qs = await db
      .select({ questionId: wrongAnswersTable.questionId })
      .from(wrongAnswersTable)
      .where(eq(wrongAnswersTable.userId, userId));
    questionIds = qs.map((q) => q.questionId);
  } else if (type === "random") {
    const randomConditions = [];
    if (subjectId) randomConditions.push(eq(questionsTable.subjectId, subjectId));
    if (topicId) randomConditions.push(eq(questionsTable.topicId, topicId));
    if (difficulty) randomConditions.push(eq(questionsTable.difficulty, difficulty));

    const whereClause = randomConditions.length > 0 ? and(...randomConditions) : undefined;
    const qs = await db
      .select({ id: questionsTable.id })
      .from(questionsTable)
      .where(whereClause)
      .orderBy(sql`RANDOM()`)
      .limit(limit);

    questionIds = qs.map((q) => q.id);
  }

  // Prevent empty practice sets
  if (questionIds.length === 0) {
    res.status(400).json({ error: "No questions match the selected criteria." });
    return;
  }

  // Create new session
  const [session] = await db
    .insert(practiceSessionsTable)
    .values({
      userId,
      mode,
      subjectId: subjectId || null,
      topicId: topicId || null,
      collectionId: collectionId || null,
      status: "in_progress",
      totalQuestions: questionIds.length,
      currentQuestionIndex: 0,
    })
    .returning();

  // Create session questions entries (normalized order)
  const sessionQuestions = questionIds.map((qId, idx) => ({
    sessionId: session.id,
    questionId: qId,
    displayOrder: idx + 1,
  }));
  await db.insert(practiceSessionQuestionsTable).values(sessionQuestions);

  // Create unvisited answer placeholders
  const placeholders = questionIds.map((qId) => ({
    sessionId: session.id,
    questionId: qId,
    status: "unvisited" as const,
    isCorrect: false,
    timeTakenSeconds: 0,
  }));

  await db.insert(practiceSessionAnswersTable).values(placeholders);

  const durationSeconds = await getSessionDurationSeconds(session.collectionId, session.totalQuestions);
  res.status(201).json({
    session: {
      ...session,
      durationSeconds,
    },
    questionIds,
  });
});

// ─── GET PRACTICE SESSION QUESTIONS & STATUS ─────────────────────────────────
router.get("/v1/practice/sessions/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const userId = req.userId!;
  const sessionId = parseInt(req.params.id as string);

  if (isNaN(sessionId)) {
    res.status(400).json({ error: "Invalid session ID" });
    return;
  }

  const [session] = await db
    .select()
    .from(practiceSessionsTable)
    .where(and(eq(practiceSessionsTable.id, sessionId), eq(practiceSessionsTable.userId, userId)));

  if (!session) {
    res.status(404).json({ error: "Practice session not found" });
    return;
  }

  // Fetch normalized questions list
  const sessionQuestions = await db
    .select({ questionId: practiceSessionQuestionsTable.questionId })
    .from(practiceSessionQuestionsTable)
    .where(eq(practiceSessionQuestionsTable.sessionId, sessionId))
    .orderBy(asc(practiceSessionQuestionsTable.displayOrder));

  const questionIds = sessionQuestions.map((sq) => sq.questionId);

  if (questionIds.length === 0) {
    res.json({ session, questions: [], questionIds: [] });
    return;
  }

  // Fetch all questions in this session
  const questions = await db
    .select({
      id: questionsTable.id,
      text: questionsTable.text,
      type: questionsTable.type,
      difficulty: questionsTable.difficulty,
      explanation: questionsTable.explanation,
      hint: questionsTable.hint,
      imageUrl: questionsTable.imageUrl,
      positiveMarks: questionsTable.positiveMarks,
      negativeMarks: questionsTable.negativeMarks,
      subjectId: questionsTable.subjectId,
      topicId: questionsTable.topicId,
      subjectName: subjectsTable.name,
      topicName: topicsTable.name,
    })
    .from(questionsTable)
    .leftJoin(subjectsTable, eq(questionsTable.subjectId, subjectsTable.id))
    .leftJoin(topicsTable, eq(questionsTable.topicId, topicsTable.id))
    .where(inArray(questionsTable.id, questionIds));

  // Sort them in the exact order stored in displayOrder
  const questionsMap = new Map(questions.map((q) => [q.id, q]));
  const orderedQuestions = questionIds
    .map((id) => questionsMap.get(id))
    .filter((q): q is typeof questions[number] => !!q);

  // Fetch all options
  const options = await db
    .select()
    .from(questionOptionsTable)
    .where(inArray(questionOptionsTable.questionId, questionIds));

  const optionsMap = new Map<number, typeof questionOptionsTable.$inferSelect[]>();
  for (const opt of options) {
    if (!optionsMap.has(opt.questionId)) {
      optionsMap.set(opt.questionId, []);
    }
    optionsMap.get(opt.questionId)!.push(opt);
  }

  // Fetch current user responses
  const answers = await db
    .select()
    .from(practiceSessionAnswersTable)
    .where(eq(practiceSessionAnswersTable.sessionId, sessionId));

  const answersMap = new Map(answers.map((a) => [a.questionId, a]));

  // Check bookmarks status
  const bookmarks = await db
    .select({ questionId: bookmarksTable.questionId })
    .from(bookmarksTable)
    .where(and(eq(bookmarksTable.userId, userId), inArray(bookmarksTable.questionId, questionIds)));
  const bookmarksSet = new Set(bookmarks.map((b) => b.questionId));

  const questionsResult = orderedQuestions.map((q) => {
    const qOptions = optionsMap.get(q.id) ?? [];
    const ans = answersMap.get(q.id);

    return {
      ...q,
      isBookmarked: bookmarksSet.has(q.id),
      options: qOptions.map((o) => ({
        id: o.id,
        text: o.text,
        isCorrect: o.isCorrect,
      })),
      selectedOptionId: ans?.selectedOptionId ?? null,
      timeSpentSeconds: ans?.timeTakenSeconds ?? 0,
      status: ans?.status ?? "unvisited",
      flagged: ans?.flagged ?? false,
    };
  });

  const durationSeconds = await getSessionDurationSeconds(session.collectionId, session.totalQuestions);
  res.json({
    session: {
      ...session,
      durationSeconds,
    },
    questions: questionsResult,
    questionIds,
  });
});

// ─── SUBMIT PRACTICE SESSION ANSWER ──────────────────────────────────────────
router.post("/v1/practice/sessions/:id/answers", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const userId = req.userId!;
  const sessionId = parseInt(req.params.id as string);

  if (isNaN(sessionId)) {
    res.status(400).json({ error: "Invalid session ID" });
    return;
  }

  const parsed = SubmitAnswerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { questionId, selectedOptionId, timeTakenSeconds, status } = parsed.data;

  // Verify session belongs to user and is active/in progress
  const [session] = await db
    .select()
    .from(practiceSessionsTable)
    .where(
      and(
        eq(practiceSessionsTable.id, sessionId),
        eq(practiceSessionsTable.userId, userId),
        inArray(practiceSessionsTable.status, ["in_progress", "paused"])
      )
    );

  if (!session) {
    res.status(404).json({ error: "Active practice session not found" });
    return;
  }

  let isCorrect = false;
  let correctAnswerId: number | null = null;

  if (selectedOptionId !== null) {
    // Determine correctness
    const [option] = await db
      .select({ isCorrect: questionOptionsTable.isCorrect })
      .from(questionOptionsTable)
      .where(
        and(
          eq(questionOptionsTable.id, selectedOptionId),
          eq(questionOptionsTable.questionId, questionId)
        )
      );

    isCorrect = option?.isCorrect ?? false;

    // Find the correct option id
    const [correctOpt] = await db
      .select({ id: questionOptionsTable.id })
      .from(questionOptionsTable)
      .where(
        and(
          eq(questionOptionsTable.questionId, questionId),
          eq(questionOptionsTable.isCorrect, true)
        )
      );
    correctAnswerId = correctOpt?.id ?? null;

    if (isCorrect) {
      // Remove from wrong answers if answered correctly (Remove after correct)
      await db
        .delete(wrongAnswersTable)
        .where(and(eq(wrongAnswersTable.userId, userId), eq(wrongAnswersTable.questionId, questionId)));
    } else {
      // Save/update to wrong answers, mapping sourceType to 'practice' and setting sourceId
      const [existingWrong] = await db
        .select()
        .from(wrongAnswersTable)
        .where(and(eq(wrongAnswersTable.userId, userId), eq(wrongAnswersTable.questionId, questionId)));

      if (existingWrong) {
        await db
          .update(wrongAnswersTable)
          .set({
            attemptCount: existingWrong.attemptCount + 1,
            lastAttemptAt: new Date(),
            sourceType: "practice" as const,
            sourceId: sessionId,
          })
          .where(eq(wrongAnswersTable.id, existingWrong.id));
      } else {
        await db.insert(wrongAnswersTable).values({
          userId,
          questionId,
          attemptCount: 1,
          lastAttemptAt: new Date(),
          sourceType: "practice" as const,
          sourceId: sessionId,
        });
      }
    }
  }

  // Update/insert session answer
  const [existingAnswer] = await db
    .select()
    .from(practiceSessionAnswersTable)
    .where(
      and(
        eq(practiceSessionAnswersTable.sessionId, sessionId),
        eq(practiceSessionAnswersTable.questionId, questionId)
      )
    );

  if (existingAnswer) {
    await db
      .update(practiceSessionAnswersTable)
      .set({
        selectedOptionId,
        isCorrect,
        timeTakenSeconds: existingAnswer.timeTakenSeconds + timeTakenSeconds,
        status,
        updatedAt: new Date(),
      })
      .where(eq(practiceSessionAnswersTable.id, existingAnswer.id));
  } else {
    await db.insert(practiceSessionAnswersTable).values({
      sessionId,
      questionId,
      selectedOptionId,
      isCorrect,
      timeTakenSeconds,
      status,
    });
  }

  // Update currentQuestionIndex in session
  const sessionQuestions = await db
    .select({ questionId: practiceSessionQuestionsTable.questionId })
    .from(practiceSessionQuestionsTable)
    .where(eq(practiceSessionQuestionsTable.sessionId, sessionId))
    .orderBy(asc(practiceSessionQuestionsTable.displayOrder));
  const questionIds = sessionQuestions.map((sq) => sq.questionId);

  const qIdx = questionIds.indexOf(questionId);
  if (qIdx !== -1) {
    await db
      .update(practiceSessionsTable)
      .set({ currentQuestionIndex: qIdx })
      .where(eq(practiceSessionsTable.id, sessionId));
  }

  // Fetch explanation
  const [q] = await db
    .select({ explanation: questionsTable.explanation })
    .from(questionsTable)
    .where(eq(questionsTable.id, questionId));

  res.json({
    isCorrect,
    correctAnswerId,
    explanation: q?.explanation ?? null,
  });
});

// ─── TOGGLE FLAG QUESTION ────────────────────────────────────────────────────
router.post("/v1/practice/sessions/:id/flag", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const userId = req.userId!;
  const sessionId = parseInt(req.params.id as string);

  if (isNaN(sessionId)) {
    res.status(400).json({ error: "Invalid session ID" });
    return;
  }

  const parsed = FlagBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { questionId, flagged } = parsed.data;

  // Check session belongs to user
  const [session] = await db
    .select()
    .from(practiceSessionsTable)
    .where(and(eq(practiceSessionsTable.id, sessionId), eq(practiceSessionsTable.userId, userId)));

  if (!session) {
    res.status(404).json({ error: "Practice session not found" });
    return;
  }

  await db
    .update(practiceSessionAnswersTable)
    .set({ flagged })
    .where(
      and(
        eq(practiceSessionAnswersTable.sessionId, sessionId),
        eq(practiceSessionAnswersTable.questionId, questionId)
      )
    );

  res.json({ message: "Flag updated successfully", flagged });
});

// ─── COMPLETE PRACTICE SESSION ────────────────────────────────────────────────
router.post("/v1/practice/sessions/:id/complete", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const userId = req.userId!;
  const sessionId = parseInt(req.params.id as string);

  if (isNaN(sessionId)) {
    res.status(400).json({ error: "Invalid session ID" });
    return;
  }

  const [session] = await db
    .select()
    .from(practiceSessionsTable)
    .where(
      and(
        eq(practiceSessionsTable.id, sessionId),
        eq(practiceSessionsTable.userId, userId),
        inArray(practiceSessionsTable.status, ["in_progress", "paused"])
      )
    );

  if (!session) {
    res.status(404).json({ error: "Active practice session not found" });
    return;
  }

  // Calculate scores
  const answers = await db
    .select()
    .from(practiceSessionAnswersTable)
    .where(eq(practiceSessionAnswersTable.sessionId, sessionId));

  const sessionQuestions = await db
    .select({ questionId: practiceSessionQuestionsTable.questionId })
    .from(practiceSessionQuestionsTable)
    .where(eq(practiceSessionQuestionsTable.sessionId, sessionId));

  const questionIds = sessionQuestions.map((sq) => sq.questionId);

  const questions = questionIds.length > 0
    ? await db
        .select()
        .from(questionsTable)
        .where(inArray(questionsTable.id, questionIds))
    : [];

  const questionsMap = new Map(questions.map((q) => [q.id, q]));

  let correct = 0;
  let incorrect = 0;
  let skipped = 0;
  let totalTime = 0;
  let score = 0;

  for (const ans of answers) {
    totalTime += ans.timeTakenSeconds;
    if (ans.status === "answered") {
      if (ans.isCorrect) {
        correct++;
        const q = questionsMap.get(ans.questionId);
        score += q?.positiveMarks ?? 1;
      } else {
        incorrect++;
        const q = questionsMap.get(ans.questionId);
        score -= q?.negativeMarks ?? 0;
      }
    } else {
      skipped++;
    }
  }

  const attempted = correct + incorrect;
  const accuracy = attempted > 0 ? (correct / attempted) * 100 : 0;

  const [updatedSession] = await db
    .update(practiceSessionsTable)
    .set({
      status: "completed",
      completedAt: new Date(),
      score,
      accuracy,
      timeTakenSeconds: totalTime,
    })
    .where(eq(practiceSessionsTable.id, sessionId))
    .returning();

  res.json({
    session: updatedSession,
    stats: {
      attempted,
      correct,
      incorrect,
      skipped,
      accuracy,
      timeTakenSeconds: totalTime,
      score,
    },
  });
});

// ─── GET PRACTICE SESSION RESULTS ────────────────────────────────────────────
router.get("/v1/practice/sessions/:id/results", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const userId = req.userId!;
  const sessionId = parseInt(req.params.id as string);

  if (isNaN(sessionId)) {
    res.status(400).json({ error: "Invalid session ID" });
    return;
  }

  const [session] = await db
    .select()
    .from(practiceSessionsTable)
    .where(and(eq(practiceSessionsTable.id, sessionId), eq(practiceSessionsTable.userId, userId)));

  if (!session) {
    res.status(404).json({ error: "Practice session not found" });
    return;
  }

  const answers = await db
    .select()
    .from(practiceSessionAnswersTable)
    .where(eq(practiceSessionAnswersTable.sessionId, sessionId));

  const sessionQuestions = await db
    .select({ questionId: practiceSessionQuestionsTable.questionId })
    .from(practiceSessionQuestionsTable)
    .where(eq(practiceSessionQuestionsTable.sessionId, sessionId));
  const questionIds = sessionQuestions.map((sq) => sq.questionId);

  const questions = questionIds.length > 0
    ? await db
        .select({
          id: questionsTable.id,
          difficulty: questionsTable.difficulty,
          subjectId: questionsTable.subjectId,
          topicId: questionsTable.topicId,
          subjectName: subjectsTable.name,
          topicName: topicsTable.name,
        })
        .from(questionsTable)
        .leftJoin(subjectsTable, eq(questionsTable.subjectId, subjectsTable.id))
        .leftJoin(topicsTable, eq(questionsTable.topicId, topicsTable.id))
        .where(inArray(questionsTable.id, questionIds))
    : [];

  const questionsMap = new Map(questions.map((q) => [q.id, q]));

  let correct = 0;
  let incorrect = 0;
  let skipped = 0;
  let score = session.score;

  // breakdowns
  const difficultyBreakdown: Record<string, { total: number; correct: number; attempted: number }> = {
    easy: { total: 0, correct: 0, attempted: 0 },
    medium: { total: 0, correct: 0, attempted: 0 },
    hard: { total: 0, correct: 0, attempted: 0 },
  };

  const subjectBreakdown: Record<string, { total: number; correct: number; attempted: number }> = {};
  const topicBreakdown: Record<string, { total: number; correct: number; attempted: number }> = {};

  for (const ans of answers) {
    const q = questionsMap.get(ans.questionId);
    if (!q) continue;

    const diff = q.difficulty;
    const subName = q.subjectName ?? "General";
    const topName = q.topicName ?? "General";

    // Init breakdowns
    if (!subjectBreakdown[subName]) subjectBreakdown[subName] = { total: 0, correct: 0, attempted: 0 };
    if (!topicBreakdown[topName]) topicBreakdown[topName] = { total: 0, correct: 0, attempted: 0 };

    difficultyBreakdown[diff].total++;
    subjectBreakdown[subName].total++;
    topicBreakdown[topName].total++;

    if (ans.status === "answered") {
      difficultyBreakdown[diff].attempted++;
      subjectBreakdown[subName].attempted++;
      topicBreakdown[topName].attempted++;

      if (ans.isCorrect) {
        correct++;
        difficultyBreakdown[diff].correct++;
        subjectBreakdown[subName].correct++;
        topicBreakdown[topName].correct++;
      } else {
        incorrect++;
      }
    } else {
      skipped++;
    }
  }

  const attempted = correct + incorrect;

  res.json({
    session,
    stats: {
      attempted,
      correct,
      incorrect,
      skipped,
      accuracy: session.accuracy,
      timeTakenSeconds: session.timeTakenSeconds,
      averageTimeSeconds: attempted > 0 ? Math.round(session.timeTakenSeconds / attempted) : 0,
      score,
    },
    difficultyBreakdown,
    subjectBreakdown,
    topicBreakdown,
  });
});

// ─── GET PRACTICE SESSION HISTORY ────────────────────────────────────────────
router.get("/v1/practice/history", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const userId = req.userId!;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const offset = (page - 1) * limit;

  const [countRes] = await db
    .select({ val: count() })
    .from(practiceSessionsTable)
    .where(eq(practiceSessionsTable.userId, userId));
  const total = Number(countRes?.val ?? 0);

  const history = await db
    .select({
      id: practiceSessionsTable.id,
      mode: practiceSessionsTable.mode,
      status: practiceSessionsTable.status,
      startedAt: practiceSessionsTable.startedAt,
      completedAt: practiceSessionsTable.completedAt,
      accuracy: practiceSessionsTable.accuracy,
      timeTakenSeconds: practiceSessionsTable.timeTakenSeconds,
      totalQuestions: practiceSessionsTable.totalQuestions,
      collectionName: questionCollectionsTable.name,
      subjectName: subjectsTable.name,
      topicName: topicsTable.name,
    })
    .from(practiceSessionsTable)
    .leftJoin(
      questionCollectionsTable,
      eq(practiceSessionsTable.collectionId, questionCollectionsTable.id)
    )
    .leftJoin(subjectsTable, eq(practiceSessionsTable.subjectId, subjectsTable.id))
    .leftJoin(topicsTable, eq(practiceSessionsTable.topicId, topicsTable.id))
    .where(eq(practiceSessionsTable.userId, userId))
    .orderBy(desc(practiceSessionsTable.startedAt))
    .limit(limit)
    .offset(offset);

  res.json({
    data: history,
    total,
    page,
    limit,
  });
});

// ─── RESET WRONG ANSWERS ─────────────────────────────────────────────────────
router.post("/v1/practice/wrong-answers/reset", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const userId = req.userId!;
  await db.delete(wrongAnswersTable).where(eq(wrongAnswersTable.userId, userId));
  res.json({ message: "Wrong answers reset successfully" });
});

// ─── ADMIN: GET COLLECTION PRACTICE SETTINGS ─────────────────────────────────
router.get("/v1/admin/collections/:id/practice", requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  const collectionId = parseInt(req.params.id as string);

  if (isNaN(collectionId)) {
    res.status(400).json({ error: "Invalid collection ID" });
    return;
  }

  const [settings] = await db
    .select()
    .from(practiceCollectionsTable)
    .where(eq(practiceCollectionsTable.collectionId, collectionId));

  if (settings) {
    res.json(settings);
  } else {
    // Return default settings
    res.json({
      collectionId,
      availableForPractice: false,
      isVisible: true,
      isFeatured: false,
      difficulty: "medium",
      estimatedTimeMinutes: 15,
    });
  }
});

// ─── ADMIN: SAVE COLLECTION PRACTICE SETTINGS ────────────────────────────────
router.post("/v1/admin/collections/:id/practice", requireAdmin, async (req: AuthRequest, res): Promise<void> => {
  const collectionId = parseInt(req.params.id as string);

  if (isNaN(collectionId)) {
    res.status(400).json({ error: "Invalid collection ID" });
    return;
  }

  const parsed = UpdatePracticeSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { availableForPractice, isVisible, isFeatured, difficulty, estimatedTimeMinutes } = parsed.data;

  const [existing] = await db
    .select()
    .from(practiceCollectionsTable)
    .where(eq(practiceCollectionsTable.collectionId, collectionId));

  let saved;
  if (existing) {
    [saved] = await db
      .update(practiceCollectionsTable)
      .set({
        availableForPractice,
        isVisible,
        isFeatured,
        difficulty,
        estimatedTimeMinutes,
      })
      .where(eq(practiceCollectionsTable.id, existing.id))
      .returning();
  } else {
    [saved] = await db
      .insert(practiceCollectionsTable)
      .values({
        collectionId,
        availableForPractice,
        isVisible,
        isFeatured,
        difficulty,
        estimatedTimeMinutes,
      })
      .returning();
  }

  res.json(saved);
});

export default router;
