import { Router, type IRouter } from "express";
import { db, usersTable, resultsTable, examsTable, practiceSessionsTable, currentAffairReadHistoryTable, currentAffairsTable, studyTasksTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../../middlewares/auth";

const router: IRouter = Router();

// GET /api/v1/exports/performance/pdf - Printable HTML layout for saving as PDF
router.get(
  "/v1/exports/performance/pdf",
  requireAuth,
  async (req: AuthRequest, res): Promise<void> => {
    try {
      const userId = req.userId!;

      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
      const results = await db
        .select({
          id: resultsTable.id,
          score: resultsTable.score,
          totalMarks: resultsTable.totalMarks,
          accuracy: resultsTable.accuracy,
          timeTakenSeconds: resultsTable.timeTakenSeconds,
          createdAt: resultsTable.createdAt,
          examTitle: examsTable.title,
        })
        .from(resultsTable)
        .leftJoin(examsTable, eq(resultsTable.examId, examsTable.id))
        .where(eq(resultsTable.userId, userId))
        .orderBy(desc(resultsTable.createdAt));

      const practices = await db
        .select()
        .from(practiceSessionsTable)
        .where(eq(practiceSessionsTable.userId, userId))
        .orderBy(desc(practiceSessionsTable.startedAt));

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Student Performance Report - ${user ? user.name : "Student"}</title>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; line-height: 1.6; padding: 40px; max-width: 900px; margin: auto; }
            h1 { color: #4f46e5; border-bottom: 2px solid #e2e8f0; padding-bottom: 15px; font-size: 28px; }
            h2 { color: #1e293b; font-size: 20px; margin-top: 30px; margin-bottom: 15px; }
            .header-info { display: flex; justify-content: space-between; margin-bottom: 30px; background: #f8fafc; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; }
            .info-block { font-size: 14px; }
            .info-label { font-weight: bold; color: #64748b; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 30px; font-size: 13px; }
            th { background: #f1f5f9; color: #475569; font-weight: bold; text-align: left; padding: 12px; border-bottom: 2px solid #cbd5e1; }
            td { padding: 12px; border-bottom: 1px solid #e2e8f0; color: #334155; }
            .badge { display: inline-block; padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: bold; text-transform: uppercase; }
            .badge-success { background: #d1fae5; color: #065f46; }
            .score-highlight { font-weight: bold; color: #4f46e5; }
            .print-btn { display: block; width: 120px; text-align: center; margin: 20px auto; background: #4f46e5; color: white; border: none; padding: 10px 15px; border-radius: 8px; font-weight: bold; cursor: pointer; }
            @media print {
              .print-btn { display: none; }
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <button class="print-btn" onclick="window.print()">Print / PDF</button>

          <h1>Student Success Performance Report</h1>
          
          <div class="header-info">
            <div class="info-block">
              <p><span class="info-label">Student Name:</span> ${user ? user.name : "N/A"}</p>
              <p><span class="info-label">Email Address:</span> ${user ? user.email : "N/A"}</p>
              <p><span class="info-label">Target Exam:</span> ${user?.role === "student" ? "SSC Exams" : "N/A"}</p>
            </div>
            <div class="info-block">
              <p><span class="info-label">Level:</span> ${user ? user.level : 1}</p>
              <p><span class="info-label">Total XP:</span> ${user ? user.xp : 0} XP</p>
              <p><span class="info-label">Daily Streak:</span> ${user ? user.dailyStreak : 0} Days</p>
            </div>
          </div>

          <h2>Mock Test Attempts History</h2>
          <table>
            <thead>
              <tr>
                <th>Exam Title</th>
                <th>Attempt Date</th>
                <th>Score</th>
                <th>Accuracy</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              ${results.map(r => `
                <tr>
                  <td>${r.examTitle ?? "Practice Mock"}</td>
                  <td>${new Date(r.createdAt).toLocaleDateString()}</td>
                  <td class="score-highlight">${r.score} / ${r.totalMarks}</td>
                  <td>${r.accuracy.toFixed(1)}%</td>
                  <td>${Math.floor((r.timeTakenSeconds ?? 0) / 60)}m ${(r.timeTakenSeconds ?? 0) % 60}s</td>
                </tr>
              `).join('')}
              ${results.length === 0 ? '<tr><td colspan="5" style="text-align:center;">No mock tests attempted yet.</td></tr>' : ''}
            </tbody>
          </table>

          <h2>Practice Sessions Log</h2>
          <table>
            <thead>
              <tr>
                <th>Mode</th>
                <th>Start Date</th>
                <th>Total Questions</th>
                <th>Accuracy</th>
                <th>Time Spent</th>
              </tr>
            </thead>
            <tbody>
              ${practices.slice(0, 15).map(p => `
                <tr>
                  <td><span class="badge badge-success">${p.mode}</span></td>
                  <td>${new Date(p.startedAt).toLocaleDateString()}</td>
                  <td>${p.totalQuestions} Qs</td>
                  <td>${p.accuracy.toFixed(1)}%</td>
                  <td>${Math.floor(p.timeTakenSeconds / 60)}m ${p.timeTakenSeconds % 60}s</td>
                </tr>
              `).join('')}
              ${practices.length === 0 ? '<tr><td colspan="5" style="text-align:center;">No practice sessions logged yet.</td></tr>' : ''}
            </tbody>
          </table>

        </body>
        </html>
      `;

      res.setHeader("Content-Type", "text/html");
      res.send(html);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

// GET /api/v1/exports/study-report - CSV export of study details
router.get(
  "/v1/exports/study-report",
  requireAuth,
  async (req: AuthRequest, res): Promise<void> => {
    try {
      const userId = req.userId!;

      const results = await db
        .select({
          score: resultsTable.score,
          totalMarks: resultsTable.totalMarks,
          accuracy: resultsTable.accuracy,
          timeTakenSeconds: resultsTable.timeTakenSeconds,
          createdAt: resultsTable.createdAt,
          examTitle: examsTable.title,
        })
        .from(resultsTable)
        .leftJoin(examsTable, eq(resultsTable.examId, examsTable.id))
        .where(eq(resultsTable.userId, userId))
        .orderBy(desc(resultsTable.createdAt));

      const practices = await db
        .select()
        .from(practiceSessionsTable)
        .where(eq(practiceSessionsTable.userId, userId))
        .orderBy(desc(practiceSessionsTable.startedAt));

      let csv = "Type,Title/Mode,Date,Score/Questions,Accuracy,TimeSpentSeconds\n";

      for (const r of results) {
        const title = (r.examTitle ?? "Mock Exam").replace(/,/g, " ");
        csv += `Mock Test,${title},${r.createdAt.toISOString()},${r.score}/${r.totalMarks},${r.accuracy.toFixed(1)}%,${r.timeTakenSeconds}\n`;
      }

      for (const p of practices) {
        csv += `Practice Session,${p.mode},${p.startedAt.toISOString()},${p.totalQuestions} Qs,${p.accuracy.toFixed(1)}%,${p.timeTakenSeconds}\n`;
      }

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", 'attachment; filename="study-report.csv"');
      res.status(200).send(csv);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

export default router;
