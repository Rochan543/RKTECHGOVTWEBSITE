import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./v1/auth";
import dashboardRouter from "./v1/dashboard";
import examCategoriesRouter from "./v1/exam-categories";
import examsRouter from "./v1/exams";
import subjectsRouter from "./v1/subjects";
import questionsRouter from "./v1/questions";
import sessionsRouter from "./v1/sessions";
import resultsRouter from "./v1/results";
import leaderboardRouter from "./v1/leaderboard";
import notificationsRouter from "./v1/notifications";
import notesRouter from "./v1/notes";
import usersRouter from "./v1/users";
import bookmarksRouter from "./v1/bookmarks";
import wrongAnswersRouter from "./v1/wrong-answers";
import settingsRouter from "./v1/settings";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(dashboardRouter);
router.use(examCategoriesRouter);
router.use(examsRouter);
router.use(subjectsRouter);
router.use(questionsRouter);
router.use(sessionsRouter);
router.use(resultsRouter);
router.use(leaderboardRouter);
router.use(notificationsRouter);
router.use(notesRouter);
router.use(usersRouter);
router.use(bookmarksRouter);
router.use(wrongAnswersRouter);
router.use(settingsRouter);

export default router;
