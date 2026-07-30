import { Router, type IRouter } from "express";
import { db, currentAffairsTable, currentAffairCategoriesTable, currentAffairTagsTable, currentAffairArticleTagsTable, currentAffairBookmarksTable, currentAffairReadHistoryTable, currentAffairQuizzesTable, currentAffairQuizQuestionsTable, currentAffairQuizAttemptsTable, monthlyCurrentAffairsTable, questionsTable, questionOptionsTable } from "@workspace/db";
import { eq, desc, asc, ilike, and, or, sql, lte, inArray } from "drizzle-orm";
import { requireAuth, requireAdmin, type AuthRequest } from "../../middlewares/auth";
import { z } from "zod";
import { createNotificationForStudents, createNotificationForAdmins } from "../../lib/notifications";

const router: IRouter = Router();

// Validation Schemas
const ListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  categoryId: z.coerce.number().int().optional(),
  category: z.string().optional(), // Category slug or name
  tag: z.string().optional(), // Tag slug
  search: z.string().optional(),
  sort: z.enum(["latest", "oldest", "most_viewed", "most_bookmarked"]).default("latest"),
  featured: z.preprocess((val) => val === "true" || val === true, z.boolean()).optional(),
  status: z.enum(["draft", "scheduled", "published", "archived"]).optional(),
});

const CreateArticleSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().optional(),
  content: z.string().min(1),
  categoryId: z.number().int().nullable().optional(),
  category: z.string().optional(),
  imageUrl: z.string().url().nullish().or(z.literal("")),
  publishedDate: z.string().optional(),
  author: z.string().optional(),
  readingTime: z.number().int().nonnegative().optional(),
  highlights: z.string().optional(),
  facts: z.string().optional(),
  examRelevance: z.string().optional(),
  status: z.enum(["draft", "scheduled", "published", "archived"]).default("published"),
  featured: z.boolean().optional(),
  tags: z.array(z.number().int()).optional(), // Array of tag IDs
});

const UpdateArticleSchema = CreateArticleSchema.partial();

const ProgressSchema = z.object({
  articleId: z.number().int(),
  progress: z.number().int().min(0).max(100),
  secondsRead: z.number().int().min(0),
});

const CategorySchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
});

const TagSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
});

const QuizSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(["daily", "weekly", "monthly"]).default("daily"),
  duration: z.number().int().nullable().optional(), // minutes
  publishedDate: z.string().optional(),
  status: z.enum(["draft", "scheduled", "published", "archived"]).default("published"),
  questions: z.array(z.number().int()).optional(), // Array of question IDs
});

const QuizSubmitSchema = z.object({
  quizId: z.number().int(),
  answers: z.array(
    z.object({
      questionId: z.number().int(),
      selectedOptionId: z.number().int().nullable(),
      timeSpent: z.number().int().default(0), // in seconds
    })
  ),
});

const PdfSchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000).max(2100),
  pdfUrl: z.string().url(),
  pdfName: z.string().min(1),
  pdfSize: z.coerce.number().int().nonnegative().default(0),
  revisionNotes: z.string().optional(),
});

// Helper: Calculate Streak
async function getReadingStreak(userId: number): Promise<number> {
  const history = await db
    .select({
      dateStr: sql<string>`TO_CHAR(timezone('Asia/Kolkata', ${currentAffairReadHistoryTable.lastReadAt}), 'YYYY-MM-DD')`
    })
    .from(currentAffairReadHistoryTable)
    .where(eq(currentAffairReadHistoryTable.userId, userId))
    .orderBy(desc(currentAffairReadHistoryTable.lastReadAt));

  if (history.length === 0) return 0;

  const readDates = Array.from(new Set(history.map((h) => h.dateStr)));
  
  // Calculate consecutive days starting from today or yesterday
  const tzOffset = 5.5 * 60 * 60 * 1000; // IST offset
  const todayIST = new Date(Date.now() + tzOffset).toISOString().split("T")[0];
  const yesterdayIST = new Date(Date.now() - 24 * 60 * 60 * 1000 + tzOffset).toISOString().split("T")[0];

  if (readDates[0] !== todayIST && readDates[0] !== yesterdayIST) {
    return 0; // Streak broken
  }

  let streak = 0;
  let checkDate = new Date(readDates[0]);

  for (const dateStr of readDates) {
    const formattedCheck = checkDate.toISOString().split("T")[0];
    if (dateStr === formattedCheck) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}


// ==========================================
// STUDENT ROUTES
// ==========================================

// Get Categories Config
router.get(
  "/v1/current-affairs/categories",
  requireAuth,
  async (req, res): Promise<void> => {
    try {
      const categories = await db
        .select()
        .from(currentAffairCategoriesTable)
        .orderBy(asc(currentAffairCategoriesTable.name));

      // Fetch article counts per category
      const counts = await db
        .select({
          categoryId: currentAffairsTable.categoryId,
          count: sql<number>`count(*)::int`,
        })
        .from(currentAffairsTable)
        .where(
          and(
            eq(currentAffairsTable.status, "published"),
            lte(currentAffairsTable.publishedDate, new Date())
          )
        )
        .groupBy(currentAffairsTable.categoryId);

      const countMap = new Map(counts.map((c) => [c.categoryId, c.count]));

      const result = categories.map((cat) => ({
        ...cat,
        articleCount: countMap.get(cat.id) || 0,
      }));

      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// Get Tags List
router.get(
  "/v1/current-affairs/tags",
  requireAuth,
  async (req, res): Promise<void> => {
    try {
      const tags = await db
        .select()
        .from(currentAffairTagsTable)
        .orderBy(asc(currentAffairTagsTable.name));
      res.json(tags);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// Search articles
router.get(
  "/v1/current-affairs/search",
  requireAuth,
  async (req: AuthRequest, res): Promise<void> => {
    try {
      const q = req.query.q as string;
      const month = req.query.month ? parseInt(req.query.month as string, 10) : undefined;
      const year = req.query.year ? parseInt(req.query.year as string, 10) : undefined;

      const conditions = [
        eq(currentAffairsTable.status, "published"),
        lte(currentAffairsTable.publishedDate, new Date()),
      ];

      if (q) {
        conditions.push(
          or(
            ilike(currentAffairsTable.title, `%${q}%`),
            ilike(currentAffairsTable.content, `%${q}%`),
            ilike(currentAffairsTable.subtitle, `%${q}%`)
          ) as any
        );
      }

      if (month) {
        conditions.push(sql`EXTRACT(MONTH FROM ${currentAffairsTable.publishedDate}) = ${month}`);
      }
      if (year) {
        conditions.push(sql`EXTRACT(YEAR FROM ${currentAffairsTable.publishedDate}) = ${year}`);
      }

      const items = await db
        .select()
        .from(currentAffairsTable)
        .where(and(...conditions))
        .orderBy(desc(currentAffairsTable.publishedDate))
        .limit(50);

      res.json(items);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// Bookmarks List
router.get(
  "/v1/current-affairs/bookmarks",
  requireAuth,
  async (req: AuthRequest, res): Promise<void> => {
    try {
      const bookmarks = await db
        .select({
          bookmarkId: currentAffairBookmarksTable.id,
          bookmarkedAt: currentAffairBookmarksTable.createdAt,
          article: currentAffairsTable,
        })
        .from(currentAffairBookmarksTable)
        .innerJoin(currentAffairsTable, eq(currentAffairBookmarksTable.articleId, currentAffairsTable.id))
        .where(eq(currentAffairBookmarksTable.userId, req.userId!))
        .orderBy(desc(currentAffairBookmarksTable.createdAt));

      res.json(bookmarks);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// Add Bookmark
router.post(
  "/v1/current-affairs/bookmark",
  requireAuth,
  async (req: AuthRequest, res): Promise<void> => {
    try {
      const { articleId } = z.object({ articleId: z.number().int() }).parse(req.body);

      // Check if bookmark already exists
      const [existing] = await db
        .select()
        .from(currentAffairBookmarksTable)
        .where(
          and(
            eq(currentAffairBookmarksTable.userId, req.userId!),
            eq(currentAffairBookmarksTable.articleId, articleId)
          )
        );

      if (existing) {
        res.json(existing);
        return;
      }

      const [bookmark] = await db
        .insert(currentAffairBookmarksTable)
        .values({
          userId: req.userId!,
          articleId,
        })
        .returning();

      // Safe update count
      await db
        .update(currentAffairsTable)
        .set({ bookmarksCount: sql`${currentAffairsTable.bookmarksCount} + 1` })
        .where(eq(currentAffairsTable.id, articleId));

      res.status(201).json(bookmark);
    } catch (err: any) {
      res.status(err instanceof z.ZodError ? 400 : 500).json({ error: err.message });
    }
  }
);

// Remove Bookmark
router.delete(
  "/v1/current-affairs/bookmark/:id",
  requireAuth,
  async (req: AuthRequest, res): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: "Invalid ID" });
        return;
      }

      // Supports deleting by bookmark ID OR article ID
      const [bookmark] = await db
        .select()
        .from(currentAffairBookmarksTable)
        .where(
          and(
            eq(currentAffairBookmarksTable.userId, req.userId!),
            or(
              eq(currentAffairBookmarksTable.id, id),
              eq(currentAffairBookmarksTable.articleId, id)
            )
          )
        );

      if (!bookmark) {
        res.status(404).json({ error: "Bookmark not found" });
        return;
      }

      await db.delete(currentAffairBookmarksTable).where(eq(currentAffairBookmarksTable.id, bookmark.id));

      // Decrement bookmark counter
      await db
        .update(currentAffairsTable)
        .set({ bookmarksCount: sql`GREATEST(0, ${currentAffairsTable.bookmarksCount} - 1)` })
        .where(eq(currentAffairsTable.id, bookmark.articleId));

      res.json({ message: "Bookmark removed" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// Get Read History
router.get(
  "/v1/current-affairs/history",
  requireAuth,
  async (req: AuthRequest, res): Promise<void> => {
    try {
      const history = await db
        .select({
          historyId: currentAffairReadHistoryTable.id,
          progress: currentAffairReadHistoryTable.progress,
          secondsRead: currentAffairReadHistoryTable.secondsRead,
          completed: currentAffairReadHistoryTable.completed,
          lastReadAt: currentAffairReadHistoryTable.lastReadAt,
          article: currentAffairsTable,
        })
        .from(currentAffairReadHistoryTable)
        .innerJoin(currentAffairsTable, eq(currentAffairReadHistoryTable.articleId, currentAffairsTable.id))
        .where(eq(currentAffairReadHistoryTable.userId, req.userId!))
        .orderBy(desc(currentAffairReadHistoryTable.lastReadAt));

      // Calculate streak & today's progress stats
      const streak = await getReadingStreak(req.userId!);
      
      const tzOffset = 5.5 * 60 * 60 * 1000;
      const todayIST = new Date(Date.now() + tzOffset).toISOString().split("T")[0];
      const todayReads = history.filter((h) => 
        new Date(h.lastReadAt.getTime() + tzOffset).toISOString().split("T")[0] === todayIST
      ).length;

      res.json({
        history,
        streak,
        todayProgress: {
          reads: todayReads,
          target: 3,
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// Save Reading History Progress
router.post(
  "/v1/current-affairs/history/progress",
  requireAuth,
  async (req: AuthRequest, res): Promise<void> => {
    try {
      const { articleId, progress, secondsRead } = ProgressSchema.parse(req.body);
      const userId = req.userId!;

      const [existing] = await db
        .select()
        .from(currentAffairReadHistoryTable)
        .where(
          and(
            eq(currentAffairReadHistoryTable.userId, userId),
            eq(currentAffairReadHistoryTable.articleId, articleId)
          )
        );

      const completed = progress === 100;

      let record;
      if (existing) {
        const [updated] = await db
          .update(currentAffairReadHistoryTable)
          .set({
            progress: Math.max(existing.progress, progress),
            secondsRead: existing.secondsRead + secondsRead,
            completed: existing.completed || completed,
            lastReadAt: new Date(),
          })
          .where(eq(currentAffairReadHistoryTable.id, existing.id))
          .returning();
        record = updated;
      } else {
        const [inserted] = await db
          .insert(currentAffairReadHistoryTable)
          .values({
            userId,
            articleId,
            progress,
            secondsRead,
            completed,
            lastReadAt: new Date(),
          })
          .returning();
        record = inserted;
      }

      res.json(record);
    } catch (err: any) {
      res.status(err instanceof z.ZodError ? 400 : 500).json({ error: err.message });
    }
  }
);

// Quiz List
router.get(
  "/v1/current-affairs/quiz",
  requireAuth,
  async (req: AuthRequest, res): Promise<void> => {
    try {
      const type = req.query.type as "daily" | "weekly" | "monthly" | undefined;
      const conditions = [
        eq(currentAffairQuizzesTable.status, "published"),
        lte(currentAffairQuizzesTable.publishedDate, new Date()),
      ];
      if (type) {
        conditions.push(eq(currentAffairQuizzesTable.type, type));
      }

      const quizzes = await db
        .select()
        .from(currentAffairQuizzesTable)
        .where(and(...conditions))
        .orderBy(desc(currentAffairQuizzesTable.publishedDate));

      // Fetch user's attempts
      const attempts = await db
        .select()
        .from(currentAffairQuizAttemptsTable)
        .where(eq(currentAffairQuizAttemptsTable.userId, req.userId!));

      const attemptMap = new Map(attempts.map((a) => [a.quizId, a]));

      // Get count of questions in each quiz
      const questionCounts = await db
        .select({
          quizId: currentAffairQuizQuestionsTable.quizId,
          count: sql<number>`count(*)::int`,
        })
        .from(currentAffairQuizQuestionsTable)
        .groupBy(currentAffairQuizQuestionsTable.quizId);

      const countMap = new Map(questionCounts.map((qc) => [qc.quizId, qc.count]));

      const result = quizzes.map((q) => {
        const attempt = attemptMap.get(q.id);
        return {
          ...q,
          questionCount: countMap.get(q.id) || 0,
          attempted: !!attempt,
          score: attempt ? attempt.score : null,
          maxScore: attempt ? attempt.maxScore : null,
          completed: attempt ? attempt.completed : false,
          timeSpent: attempt ? attempt.timeSpent : null,
        };
      });

      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// Specific Quiz Details (with questions, hiding correct answer!)
router.get(
  "/v1/current-affairs/quiz/:id",
  requireAuth,
  async (req: AuthRequest, res): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: "Invalid ID" });
        return;
      }

      const [quiz] = await db
        .select()
        .from(currentAffairQuizzesTable)
        .where(eq(currentAffairQuizzesTable.id, id));

      if (!quiz) {
        res.status(404).json({ error: "Quiz not found" });
        return;
      }

      // Check if attempt exists
      const [attempt] = await db
        .select()
        .from(currentAffairQuizAttemptsTable)
        .where(
          and(
            eq(currentAffairQuizAttemptsTable.userId, req.userId!),
            eq(currentAffairQuizAttemptsTable.quizId, id)
          )
        );

      // Fetch questions linked to quiz
      const quizQuestions = await db
        .select({
          order: currentAffairQuizQuestionsTable.order,
          question: questionsTable,
        })
        .from(currentAffairQuizQuestionsTable)
        .innerJoin(questionsTable, eq(currentAffairQuizQuestionsTable.questionId, questionsTable.id))
        .where(eq(currentAffairQuizQuestionsTable.quizId, id))
        .orderBy(asc(currentAffairQuizQuestionsTable.order));

      if (quizQuestions.length === 0) {
        res.json({ quiz, questions: [], attempt });
        return;
      }

      // Fetch all options for these questions in one query (No N+1)
      const questionIds = quizQuestions.map((qq) => qq.question.id);
      const options = await db
        .select()
        .from(questionOptionsTable)
        .where(inArray(questionOptionsTable.questionId, questionIds))
        .orderBy(asc(questionOptionsTable.order));

      const optionsMap = new Map<number, typeof options>();
      for (const opt of options) {
        if (!optionsMap.has(opt.questionId)) {
          optionsMap.set(opt.questionId, []);
        }
        optionsMap.get(opt.questionId)!.push(opt);
      }

      // Format questions, strip isCorrect details unless user already completed it
      const formattedQuestions = quizQuestions.map((qq) => {
        const rawOpts = optionsMap.get(qq.question.id) || [];
        const opts = rawOpts.map((o) => ({
          id: o.id,
          text: o.text,
          order: o.order,
          // Only show isCorrect if user attempted/completed this quiz
          ...(attempt ? { isCorrect: o.isCorrect } : {}),
        }));

        return {
          id: qq.question.id,
          text: qq.question.text,
          type: qq.question.type,
          difficulty: qq.question.difficulty,
          imageUrl: qq.question.imageUrl,
          positiveMarks: qq.question.positiveMarks,
          negativeMarks: qq.question.negativeMarks,
          explanation: attempt ? qq.question.explanation : null,
          hint: qq.question.hint,
          order: qq.order,
          options: opts,
        };
      });

      res.json({
        quiz,
        questions: formattedQuestions,
        attempt,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// Submit Quiz Attempt
router.post(
  "/v1/current-affairs/quiz/submit",
  requireAuth,
  async (req: AuthRequest, res): Promise<void> => {
    try {
      const { quizId, answers } = QuizSubmitSchema.parse(req.body);
      const userId = req.userId!;

      const [quiz] = await db
        .select()
        .from(currentAffairQuizzesTable)
        .where(eq(currentAffairQuizzesTable.id, quizId));

      if (!quiz) {
        res.status(404).json({ error: "Quiz not found" });
        return;
      }

      // Fetch questions and correct options in bulk
      const quizQuestions = await db
        .select({
          questionId: questionsTable.id,
          positiveMarks: questionsTable.positiveMarks,
          negativeMarks: questionsTable.negativeMarks,
          explanation: questionsTable.explanation,
        })
        .from(currentAffairQuizQuestionsTable)
        .innerJoin(questionsTable, eq(currentAffairQuizQuestionsTable.questionId, questionsTable.id))
        .where(eq(currentAffairQuizQuestionsTable.quizId, quizId));

      const questionIds = quizQuestions.map((q) => q.questionId);
      if (questionIds.length === 0) {
        res.status(400).json({ error: "Quiz has no questions" });
        return;
      }

      const options = await db
        .select()
        .from(questionOptionsTable)
        .where(
          and(
            inArray(questionOptionsTable.questionId, questionIds),
            eq(questionOptionsTable.isCorrect, true)
          )
        );

      const correctOptionMap = new Map(options.map((o) => [o.questionId, o.id]));
      const questionMap = new Map(quizQuestions.map((q) => [q.questionId, q]));

      let totalScore = 0;
      let maxScore = 0;
      let totalCorrect = 0;
      let totalIncorrect = 0;
      let totalSpent = 0;

      const responses = answers.map((ans) => {
        const qInfo = questionMap.get(ans.questionId);
        if (!qInfo) return null;

        const correctOptId = correctOptionMap.get(ans.questionId);
        const isCorrect = ans.selectedOptionId === correctOptId;
        const scoreEarned = isCorrect
          ? qInfo.positiveMarks
          : ans.selectedOptionId
          ? -qInfo.negativeMarks
          : 0;

        totalScore += scoreEarned;
        maxScore += qInfo.positiveMarks;
        totalSpent += ans.timeSpent;

        if (ans.selectedOptionId) {
          if (isCorrect) totalCorrect++;
          else totalIncorrect++;
        }

        return {
          questionId: ans.questionId,
          selectedOptionId: ans.selectedOptionId,
          correctOptionId: correctOptId,
          isCorrect,
          scoreEarned,
          timeSpent: ans.timeSpent,
        };
      }).filter(Boolean);

      // Save Attempt
      const [attempt] = await db
        .insert(currentAffairQuizAttemptsTable)
        .values({
          userId,
          quizId,
          score: Math.max(0, totalScore), // score cannot be negative for dashboard metrics
          maxScore,
          timeSpent: totalSpent,
          completed: true,
          answers: JSON.stringify(responses),
        })
        .returning();

      // Trigger achievement or notifications if needed
      await createNotificationForStudents(
        "Quiz Completed",
        `You scored ${Math.max(0, totalScore)}/${maxScore} in current affairs quiz '${quiz.title}'!`,
        "exam_result",
        `/current-affairs`
      );

      res.status(201).json({
        attempt,
        summary: {
          totalCorrect,
          totalIncorrect,
          score: Math.max(0, totalScore),
          maxScore,
          totalQuestions: quizQuestions.length,
          timeSpent: totalSpent,
        },
        responses,
      });
    } catch (err: any) {
      res.status(err instanceof z.ZodError ? 400 : 500).json({ error: err.message });
    }
  }
);

// Monthly current affairs
router.get(
  "/v1/current-affairs/monthly",
  requireAuth,
  async (req, res): Promise<void> => {
    try {
      const items = await db
        .select()
        .from(monthlyCurrentAffairsTable)
        .orderBy(desc(monthlyCurrentAffairsTable.year), desc(monthlyCurrentAffairsTable.month));

      res.json(items);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// Track Monthly PDF download
router.post(
  "/v1/current-affairs/monthly/:id/download",
  requireAuth,
  async (req, res): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: "Invalid ID" });
        return;
      }

      await db
        .update(monthlyCurrentAffairsTable)
        .set({ downloadCount: sql`${monthlyCurrentAffairsTable.downloadCount} + 1` })
        .where(eq(monthlyCurrentAffairsTable.id, id));

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// Get Paginated Articles list for student dashboard / search / filters
router.get(
  "/v1/current-affairs",
  requireAuth,
  async (req: AuthRequest, res): Promise<void> => {
    try {
      const parsed = ListQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.message });
        return;
      }
      const { page, limit, categoryId, category, tag, search, sort, featured, status } = parsed.data;
      const offset = (page - 1) * limit;

      const conditions = [];

      // Students can ONLY view published articles that have passed the published date
      if (req.userRole === "student") {
        conditions.push(eq(currentAffairsTable.status, "published"));
        conditions.push(lte(currentAffairsTable.publishedDate, new Date()));
      } else {
        // Admins can filter by status
        if (status) {
          conditions.push(eq(currentAffairsTable.status, status));
        }
      }

      if (featured !== undefined) {
        conditions.push(eq(currentAffairsTable.featured, featured));
      }

      if (categoryId) {
        conditions.push(eq(currentAffairsTable.categoryId, categoryId));
      }

      if (category) {
        const [catRecord] = await db
          .select({ id: currentAffairCategoriesTable.id })
          .from(currentAffairCategoriesTable)
          .where(
            or(
              eq(currentAffairCategoriesTable.slug, category),
              ilike(currentAffairCategoriesTable.name, category)
            )
          );
        if (catRecord) {
          conditions.push(eq(currentAffairsTable.categoryId, catRecord.id));
        } else {
          // Fallback legacy categories check
          conditions.push(eq(currentAffairsTable.category, category));
        }
      }

      if (tag) {
        const [tagRecord] = await db
          .select({ id: currentAffairTagsTable.id })
          .from(currentAffairTagsTable)
          .where(eq(currentAffairTagsTable.slug, tag));
        if (tagRecord) {
          // Join condition using subquery or inner join later.
          // For simplicity in drizzle, compile article ids from junction table.
          const matchingArticles = await db
            .select({ articleId: currentAffairArticleTagsTable.articleId })
            .from(currentAffairArticleTagsTable)
            .where(eq(currentAffairArticleTagsTable.tagId, tagRecord.id));
          const articleIds = matchingArticles.map((ma) => ma.articleId);
          if (articleIds.length > 0) {
            conditions.push(inArray(currentAffairsTable.id, articleIds));
          } else {
            // No articles match tag
            res.json({ data: [], total: 0, page, limit });
            return;
          }
        }
      }

      if (search) {
        conditions.push(
          or(
            ilike(currentAffairsTable.title, `%${search}%`),
            ilike(currentAffairsTable.content, `%${search}%`),
            ilike(currentAffairsTable.subtitle, `%${search}%`)
          )
        );
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      // Sorting
      let orderByClause = desc(currentAffairsTable.publishedDate);
      if (sort === "oldest") orderByClause = asc(currentAffairsTable.publishedDate);
      else if (sort === "most_viewed") orderByClause = desc(currentAffairsTable.views);
      else if (sort === "most_bookmarked") orderByClause = desc(currentAffairsTable.bookmarksCount);

      // Perform paginated query
      const [items, [{ total }]] = await Promise.all([
        db
          .select({
            id: currentAffairsTable.id,
            title: currentAffairsTable.title,
            subtitle: currentAffairsTable.subtitle,
            content: currentAffairsTable.content,
            category: currentAffairsTable.category,
            categoryId: currentAffairsTable.categoryId,
            imageUrl: currentAffairsTable.imageUrl,
            publishedDate: currentAffairsTable.publishedDate,
            createdAt: currentAffairsTable.createdAt,
            updatedAt: currentAffairsTable.updatedAt,
            author: currentAffairsTable.author,
            readingTime: currentAffairsTable.readingTime,
            highlights: currentAffairsTable.highlights,
            facts: currentAffairsTable.facts,
            examRelevance: currentAffairsTable.examRelevance,
            status: currentAffairsTable.status,
            views: currentAffairsTable.views,
            bookmarksCount: currentAffairsTable.bookmarksCount,
            featured: currentAffairsTable.featured,
            categoryName: currentAffairCategoriesTable.name,
            categorySlug: currentAffairCategoriesTable.slug,
          })
          .from(currentAffairsTable)
          .leftJoin(currentAffairCategoriesTable, eq(currentAffairsTable.categoryId, currentAffairCategoriesTable.id))
          .where(whereClause)
          .orderBy(orderByClause)
          .limit(limit)
          .offset(offset),
        db
          .select({ total: sql<number>`count(*)::int` })
          .from(currentAffairsTable)
          .where(whereClause),
      ]);

      if (items.length === 0) {
        res.json({ data: [], total: 0, page, limit });
        return;
      }

      // Fetch tag mappings in bulk (Zero N+1!)
      const articleIds = items.map((i) => i.id);
      const tagJoins = await db
        .select({
          articleId: currentAffairArticleTagsTable.articleId,
          id: currentAffairTagsTable.id,
          name: currentAffairTagsTable.name,
          slug: currentAffairTagsTable.slug,
        })
        .from(currentAffairArticleTagsTable)
        .innerJoin(currentAffairTagsTable, eq(currentAffairArticleTagsTable.tagId, currentAffairTagsTable.id))
        .where(inArray(currentAffairArticleTagsTable.articleId, articleIds));

      const tagsByArticle = new Map<number, any[]>();
      for (const tj of tagJoins) {
        if (!tagsByArticle.has(tj.articleId)) {
          tagsByArticle.set(tj.articleId, []);
        }
        tagsByArticle.get(tj.articleId)!.push({ id: tj.id, name: tj.name, slug: tj.slug });
      }

      // Fetch user's bookmarks list to set isBookmarked flag
      const bookmarks = await db
        .select()
        .from(currentAffairBookmarksTable)
        .where(eq(currentAffairBookmarksTable.userId, req.userId!));
      const bookmarkedIds = new Set(bookmarks.map((b) => b.articleId));

      const responseData = items.map((item) => ({
        ...item,
        tags: tagsByArticle.get(item.id) || [],
        isBookmarked: bookmarkedIds.has(item.id),
      }));

      res.json({ data: responseData, total: total ?? 0, page, limit });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// Get Specific Article details
router.get(
  "/v1/current-affairs/:id",
  requireAuth,
  async (req: AuthRequest, res): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: "Invalid ID" });
        return;
      }

      // Safely increment view count asynchronously
      db
        .update(currentAffairsTable)
        .set({ views: sql`${currentAffairsTable.views} + 1` })
        .where(eq(currentAffairsTable.id, id))
        .then(() => {});

      const [item] = await db
        .select({
          id: currentAffairsTable.id,
          title: currentAffairsTable.title,
          subtitle: currentAffairsTable.subtitle,
          content: currentAffairsTable.content,
          category: currentAffairsTable.category,
          categoryId: currentAffairsTable.categoryId,
          imageUrl: currentAffairsTable.imageUrl,
          publishedDate: currentAffairsTable.publishedDate,
          createdAt: currentAffairsTable.createdAt,
          updatedAt: currentAffairsTable.updatedAt,
          author: currentAffairsTable.author,
          readingTime: currentAffairsTable.readingTime,
          highlights: currentAffairsTable.highlights,
          facts: currentAffairsTable.facts,
          examRelevance: currentAffairsTable.examRelevance,
          status: currentAffairsTable.status,
          views: currentAffairsTable.views,
          bookmarksCount: currentAffairsTable.bookmarksCount,
          featured: currentAffairsTable.featured,
          categoryName: currentAffairCategoriesTable.name,
          categorySlug: currentAffairCategoriesTable.slug,
        })
        .from(currentAffairsTable)
        .leftJoin(currentAffairCategoriesTable, eq(currentAffairsTable.categoryId, currentAffairCategoriesTable.id))
        .where(eq(currentAffairsTable.id, id));

      if (!item) {
        res.status(404).json({ error: "Not found" });
        return;
      }

      // Fetch article tags
      const tagJoins = await db
        .select({
          id: currentAffairTagsTable.id,
          name: currentAffairTagsTable.name,
          slug: currentAffairTagsTable.slug,
        })
        .from(currentAffairArticleTagsTable)
        .innerJoin(currentAffairTagsTable, eq(currentAffairArticleTagsTable.tagId, currentAffairTagsTable.id))
        .where(eq(currentAffairArticleTagsTable.articleId, id));

      // Fetch if bookmarked
      const [bookmark] = await db
        .select()
        .from(currentAffairBookmarksTable)
        .where(
          and(
            eq(currentAffairBookmarksTable.userId, req.userId!),
            eq(currentAffairBookmarksTable.articleId, id)
          )
        );

      // Fetch related articles (same category or same tags, up to 3)
      let related: any[] = [];
      if (item.categoryId) {
        related = await db
          .select({
            id: currentAffairsTable.id,
            title: currentAffairsTable.title,
            imageUrl: currentAffairsTable.imageUrl,
            publishedDate: currentAffairsTable.publishedDate,
          })
          .from(currentAffairsTable)
          .where(
            and(
              eq(currentAffairsTable.categoryId, item.categoryId),
              eq(currentAffairsTable.status, "published"),
              lte(currentAffairsTable.publishedDate, new Date()),
              sql`${currentAffairsTable.id} != ${id}`
            )
          )
          .orderBy(desc(currentAffairsTable.publishedDate))
          .limit(3);
      }

      res.json({
        ...item,
        tags: tagJoins,
        isBookmarked: !!bookmark,
        related,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);


// ==========================================
// ADMIN ROUTES (requireAdmin check)
// ==========================================

// Create Article
router.post(
  "/v1/admin/current-affairs",
  requireAdmin,
  async (req: AuthRequest, res): Promise<void> => {
    try {
      const parsed = CreateArticleSchema.parse(req.body);
      const { tags, publishedDate: pd, ...fields } = parsed;

      // Handle category fallback text compatibility
      let legacyCategory = fields.category || "current_affairs";
      if (fields.categoryId && !fields.category) {
        const [cat] = await db
          .select()
          .from(currentAffairCategoriesTable)
          .where(eq(currentAffairCategoriesTable.id, fields.categoryId));
        if (cat) legacyCategory = cat.slug;
      }

      const publishedDate = pd ? new Date(pd) : new Date();

      const [item] = await db
        .insert(currentAffairsTable)
        .values({
          ...fields,
          category: legacyCategory as any,
          publishedDate,
          status: fields.status as any,
        })
        .returning();

      // Associate tags
      if (tags && tags.length > 0) {
        const tagInserts = tags.map((tId) => ({
          articleId: item.id,
          tagId: tId,
        }));
        await db.insert(currentAffairArticleTagsTable).values(tagInserts);
      }

      // Notifications
      if (item.status === "published" && item.publishedDate <= new Date()) {
        await createNotificationForAdmins("New Current Affairs", `Article '${item.title}' has been published.`, "system");
        await createNotificationForStudents("New Current Affairs", `New Current Affairs article '${item.title}' is available.`, "announcement", `/current-affairs`);
      }

      res.status(201).json(item);
    } catch (err: any) {
      res.status(err instanceof z.ZodError ? 400 : 500).json({ error: err.message });
    }
  }
);

// Edit Article
router.put(
  "/v1/admin/current-affairs/:id",
  requireAdmin,
  async (req: AuthRequest, res): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: "Invalid ID" });
        return;
      }

      const parsed = UpdateArticleSchema.parse(req.body);
      const { tags, publishedDate: pd, ...fields } = parsed;

      let legacyCategory = fields.category;
      if (fields.categoryId) {
        const [cat] = await db
          .select()
          .from(currentAffairCategoriesTable)
          .where(eq(currentAffairCategoriesTable.id, fields.categoryId));
        if (cat) legacyCategory = cat.slug;
      }

      const updatePayload: any = {
        ...fields,
        updatedAt: new Date(),
        ...(pd ? { publishedDate: new Date(pd) } : {}),
      };
      if (legacyCategory) {
        updatePayload.category = legacyCategory;
      }

      const [item] = await db
        .update(currentAffairsTable)
        .set(updatePayload)
        .where(eq(currentAffairsTable.id, id))
        .returning();

      if (!item) {
        res.status(404).json({ error: "Not found" });
        return;
      }

      // Sync tags: delete old ones, insert new ones
      if (tags !== undefined) {
        await db.delete(currentAffairArticleTagsTable).where(eq(currentAffairArticleTagsTable.articleId, id));
        if (tags.length > 0) {
          const tagInserts = tags.map((tId) => ({
            articleId: id,
            tagId: tId,
          }));
          await db.insert(currentAffairArticleTagsTable).values(tagInserts);
        }
      }

      res.json(item);
    } catch (err: any) {
      res.status(err instanceof z.ZodError ? 400 : 500).json({ error: err.message });
    }
  }
);

// Delete Article
router.delete(
  "/v1/admin/current-affairs/:id",
  requireAdmin,
  async (req: AuthRequest, res): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: "Invalid ID" });
        return;
      }

      await db.delete(currentAffairsTable).where(eq(currentAffairsTable.id, id));
      res.json({ message: "Deleted" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// Publish Article Immediately
router.post(
  "/v1/admin/current-affairs/publish",
  requireAdmin,
  async (req: AuthRequest, res): Promise<void> => {
    try {
      const { articleId } = z.object({ articleId: z.number().int() }).parse(req.body);

      const [item] = await db
        .update(currentAffairsTable)
        .set({ status: "published", publishedDate: new Date(), updatedAt: new Date() })
        .where(eq(currentAffairsTable.id, articleId))
        .returning();

      if (!item) {
        res.status(404).json({ error: "Article not found" });
        return;
      }

      await createNotificationForStudents("New Current Affairs", `New Current Affairs article '${item.title}' is available.`, "announcement", `/current-affairs`);

      res.json(item);
    } catch (err: any) {
      res.status(err instanceof z.ZodError ? 400 : 500).json({ error: err.message });
    }
  }
);

// Schedule Article Publishing
router.post(
  "/v1/admin/current-affairs/schedule",
  requireAdmin,
  async (req: AuthRequest, res): Promise<void> => {
    try {
      const { articleId, publishDate } = z
        .object({ articleId: z.number().int(), publishDate: z.string() })
        .parse(req.body);

      const [item] = await db
        .update(currentAffairsTable)
        .set({ status: "scheduled", publishedDate: new Date(publishDate), updatedAt: new Date() })
        .where(eq(currentAffairsTable.id, articleId))
        .returning();

      if (!item) {
        res.status(404).json({ error: "Article not found" });
        return;
      }

      res.json(item);
    } catch (err: any) {
      res.status(err instanceof z.ZodError ? 400 : 500).json({ error: err.message });
    }
  }
);

// Add Category
router.post(
  "/v1/admin/current-affairs/categories",
  requireAdmin,
  async (req, res): Promise<void> => {
    try {
      const parsed = CategorySchema.parse(req.body);
      const [cat] = await db.insert(currentAffairCategoriesTable).values(parsed).returning();
      res.status(201).json(cat);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// Delete Category
router.delete(
  "/v1/admin/current-affairs/categories/:id",
  requireAdmin,
  async (req, res): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: "Invalid ID" });
        return;
      }
      await db.delete(currentAffairCategoriesTable).where(eq(currentAffairCategoriesTable.id, id));
      res.json({ message: "Category deleted" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// Edit Category
router.put(
  "/v1/admin/current-affairs/categories/:id",
  requireAdmin,
  async (req, res): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: "Invalid ID" });
        return;
      }
      const parsed = CategorySchema.parse(req.body);
      const [cat] = await db
        .update(currentAffairCategoriesTable)
        .set(parsed)
        .where(eq(currentAffairCategoriesTable.id, id))
        .returning();
      if (!cat) {
        res.status(404).json({ error: "Category not found" });
        return;
      }
      res.json(cat);
    } catch (err: any) {
      res.status(err instanceof z.ZodError ? 400 : 500).json({ error: err.message });
    }
  }
);

// Add Tag
router.post(
  "/v1/admin/current-affairs/tags",
  requireAdmin,
  async (req, res): Promise<void> => {
    try {
      const parsed = TagSchema.parse(req.body);
      const [tag] = await db.insert(currentAffairTagsTable).values(parsed).returning();
      res.status(201).json(tag);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// Delete Tag
router.delete(
  "/v1/admin/current-affairs/tags/:id",
  requireAdmin,
  async (req, res): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: "Invalid ID" });
        return;
      }
      await db.delete(currentAffairTagsTable).where(eq(currentAffairTagsTable.id, id));
      res.json({ message: "Tag deleted" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// Edit Tag
router.put(
  "/v1/admin/current-affairs/tags/:id",
  requireAdmin,
  async (req, res): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: "Invalid ID" });
        return;
      }
      const parsed = TagSchema.parse(req.body);
      const [tag] = await db
        .update(currentAffairTagsTable)
        .set(parsed)
        .where(eq(currentAffairTagsTable.id, id))
        .returning();
      if (!tag) {
        res.status(404).json({ error: "Tag not found" });
        return;
      }
      res.json(tag);
    } catch (err: any) {
      res.status(err instanceof z.ZodError ? 400 : 500).json({ error: err.message });
    }
  }
);

// Add/Replace Monthly PDF Info
router.post(
  [
    "/v1/admin/current-affairs/pdf",
    "/v1/admin/current-affairs/monthly"
  ],
  requireAdmin,
  async (req: AuthRequest, res): Promise<void> => {
    try {
      const parsed = PdfSchema.parse(req.body);

      // Check if PDF for month/year exists
      const [existing] = await db
        .select()
        .from(monthlyCurrentAffairsTable)
        .where(
          and(
            eq(monthlyCurrentAffairsTable.month, parsed.month),
            eq(monthlyCurrentAffairsTable.year, parsed.year)
          )
        );

      let record;
      if (existing) {
        const [updated] = await db
          .update(monthlyCurrentAffairsTable)
          .set({
            pdfUrl: parsed.pdfUrl,
            pdfName: parsed.pdfName,
            pdfSize: parsed.pdfSize,
            revisionNotes: parsed.revisionNotes || existing.revisionNotes,
            updatedAt: new Date(),
          })
          .where(eq(monthlyCurrentAffairsTable.id, existing.id))
          .returning();
        record = updated;
      } else {
        const [inserted] = await db
          .insert(monthlyCurrentAffairsTable)
          .values({
            ...parsed,
          })
          .returning();
        record = inserted;
      }

      await createNotificationForStudents(
        "Monthly PDF Released",
        `Monthly Current Affairs PDF for ${parsed.month}/${parsed.year} is now available for download!`,
        "announcement",
        "/current-affairs"
      );

      res.status(201).json(record);
    } catch (err: any) {
      res.status(err instanceof z.ZodError ? 400 : 500).json({ error: err.message });
    }
  }
);

// Edit/Replace Monthly PDF Info (by id)
router.put(
  [
    "/v1/admin/current-affairs/pdf/:id",
    "/v1/admin/current-affairs/monthly/:id"
  ],
  requireAdmin,
  async (req: AuthRequest, res): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: "Invalid ID" });
        return;
      }
      const parsed = PdfSchema.parse(req.body);
      const [updated] = await db
        .update(monthlyCurrentAffairsTable)
        .set({
          ...parsed,
          updatedAt: new Date(),
        })
        .where(eq(monthlyCurrentAffairsTable.id, id))
        .returning();

      if (!updated) {
        res.status(404).json({ error: "Monthly PDF compilation not found" });
        return;
      }
      res.json(updated);
    } catch (err: any) {
      res.status(err instanceof z.ZodError ? 400 : 500).json({ error: err.message });
    }
  }
);

// Admin Quiz CRUD: Create Quiz
router.post(
  "/v1/admin/current-affairs/quizzes",
  requireAdmin,
  async (req: AuthRequest, res): Promise<void> => {
    try {
      const { questions, publishedDate: pd, ...fields } = QuizSchema.parse(req.body);

      const publishedDate = pd ? new Date(pd) : new Date();

      const [quiz] = await db
        .insert(currentAffairQuizzesTable)
        .values({
          ...fields,
          publishedDate,
        })
        .returning();

      if (questions && questions.length > 0) {
        const questionLinks = questions.map((qId, idx) => ({
          quizId: quiz.id,
          questionId: qId,
          order: idx + 1,
        }));
        await db.insert(currentAffairQuizQuestionsTable).values(questionLinks);
      }

      res.status(201).json(quiz);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// Admin Quiz CRUD: Edit Quiz
router.put(
  "/v1/admin/current-affairs/quizzes/:id",
  requireAdmin,
  async (req: AuthRequest, res): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: "Invalid ID" });
        return;
      }

      const { questions, publishedDate: pd, ...fields } = QuizSchema.partial().parse(req.body);

      const updatePayload: any = {
        ...fields,
        updatedAt: new Date(),
        ...(pd ? { publishedDate: new Date(pd) } : {}),
      };

      const [quiz] = await db
        .update(currentAffairQuizzesTable)
        .set(updatePayload)
        .where(eq(currentAffairQuizzesTable.id, id))
        .returning();

      if (!quiz) {
        res.status(404).json({ error: "Quiz not found" });
        return;
      }

      if (questions !== undefined) {
        await db.delete(currentAffairQuizQuestionsTable).where(eq(currentAffairQuizQuestionsTable.quizId, id));
        if (questions.length > 0) {
          const questionLinks = questions.map((qId, idx) => ({
            quizId: id,
            questionId: qId,
            order: idx + 1,
          }));
          await db.insert(currentAffairQuizQuestionsTable).values(questionLinks);
        }
      }

      res.json(quiz);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// Admin Quiz CRUD: Delete Quiz
router.delete(
  "/v1/admin/current-affairs/quizzes/:id",
  requireAdmin,
  async (req: AuthRequest, res): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: "Invalid ID" });
        return;
      }

      await db.delete(currentAffairQuizzesTable).where(eq(currentAffairQuizzesTable.id, id));
      res.json({ message: "Quiz deleted" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// Admin PDF CRUD: Delete/Archive Monthly PDF
router.delete(
  [
    "/v1/admin/current-affairs/pdf/:id",
    "/v1/admin/current-affairs/monthly/:id"
  ],
  requireAdmin,
  async (req: AuthRequest, res): Promise<void> => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: "Invalid ID" });
        return;
      }

      await db.delete(monthlyCurrentAffairsTable).where(eq(monthlyCurrentAffairsTable.id, id));
      res.json({ message: "Monthly PDF issue deleted" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);


// ==========================================
// BACKGROUND AUTOMATED SCHEDULER TRIGGER
// ==========================================
// In a server environment, we can check for publishing scheduled posts on user requests
// or via cron. To be robust, let's call this update before fetching listings.
// This is done implicitly in GET /v1/current-affairs (by filtering status = 'published' and date <= now),
// but we can also trigger a sync query.
router.post(
  "/v1/admin/current-affairs/sync-scheduled",
  requireAdmin,
  async (req, res): Promise<void> => {
    try {
      const now = new Date();
      // Find scheduled posts that should be published now
      const items = await db
        .select()
        .from(currentAffairsTable)
        .where(
          and(
            eq(currentAffairsTable.status, "scheduled"),
            lte(currentAffairsTable.publishedDate, now)
          )
        );

      if (items.length > 0) {
        const itemIds = items.map((i) => i.id);
        await db
          .update(currentAffairsTable)
          .set({ status: "published" })
          .where(inArray(currentAffairsTable.id, itemIds));

        // Trigger notifications
        for (const item of items) {
          await createNotificationForStudents("New Current Affairs", `New Current Affairs article '${item.title}' is available.`, "announcement", `/current-affairs`);
        }
      }

      res.json({ publishedCount: items.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);


export default router;
