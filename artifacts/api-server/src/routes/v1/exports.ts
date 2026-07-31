import { Router, type IRouter } from "express";
import { db, usersTable, resultsTable, examsTable, practiceSessionsTable, currentAffairReadHistoryTable, currentAffairsTable, studyTasksTable, studyPlansTable } from "@workspace/db";
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

// ─── Security helpers ────────────────────────────────────────────────────────

/** Escape a string for safe interpolation into HTML text content. */
function esc(value: string | null | undefined, fallback = ""): string {
  return (value ?? fallback)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/**
 * Quote a value as an RFC 4180 CSV cell.
 * - Doubles any embedded double-quotes.
 * - Always quotes the value (simplest safe approach).
 * - Prefixes with a tab values starting with =, +, -, @ to prevent
 *   spreadsheet formula injection.
 */
function csvCell(value: string | number | boolean | null | undefined): string {
  let s = String(value ?? "");
  // Neutralise formula-injection characters at the start of a value
  if (/^[=+\-@\t\r]/.test(s)) {
    s = "\t" + s;
  }
  // RFC 4180: wrap in double-quotes, escape embedded quotes by doubling
  return `"${s.replace(/"/g, '""')}"`;
}

// ─── New distinct export routes ──────────────────────────────────────────────

// GET /api/v1/exports/pdf/mock-history - Printable HTML of mock test history
router.get(
  "/v1/exports/pdf/mock-history",
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

      const rows = results.map((r) => `
        <tr>
          <td>${esc(r.examTitle, "Mock Exam")}</td>
          <td class="score-highlight">${r.score}/${r.totalMarks}</td>
          <td>${r.accuracy.toFixed(1)}%</td>
          <td>${Math.round((r.timeTakenSeconds ?? 0) / 60)} min</td>
          <td>${new Date(r.createdAt).toLocaleDateString("en-IN")}</td>
        </tr>`).join("");

      const html = `<!DOCTYPE html><html><head><title>Mock Test History</title><style>
        body{font-family:Arial,sans-serif;padding:40px;color:#333}
        h1{color:#4f46e5;border-bottom:2px solid #e2e8f0;padding-bottom:12px}
        table{width:100%;border-collapse:collapse;margin-top:16px;font-size:13px}
        th{background:#f1f5f9;color:#475569;font-weight:bold;text-align:left;padding:10px;border-bottom:2px solid #cbd5e1}
        td{padding:10px;border-bottom:1px solid #e2e8f0}
        .score-highlight{font-weight:bold;color:#4f46e5}
        .print-btn{display:block;width:120px;margin:20px auto;background:#4f46e5;color:#fff;border:none;padding:10px 15px;border-radius:8px;font-weight:bold;cursor:pointer}
        @media print{.print-btn{display:none}}
      </style></head><body>
      <button class="print-btn" onclick="window.print()">Print / PDF</button>
      <h1>Mock Test History &#8212; ${esc(user?.name, "Student")}</h1>
      <p style="color:#64748b;font-size:13px">Total attempts: ${results.length} | Generated: ${new Date().toLocaleDateString("en-IN")}</p>
      <table><thead><tr><th>Exam</th><th>Score</th><th>Accuracy</th><th>Time</th><th>Date</th></tr></thead>
      <tbody>${rows}</tbody></table>
      </body></html>`;

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.status(200).send(html);
    } catch {
      res.status(500).json({ error: "Export failed" });
    }
  }
);

// GET /api/v1/exports/pdf/current-affairs-summary - Printable HTML of current affairs reading history
router.get(
  "/v1/exports/pdf/current-affairs-summary",
  requireAuth,
  async (req: AuthRequest, res): Promise<void> => {
    try {
      const userId = req.userId!;
      const [user] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, userId));

      const history = await db
        .select({
          articleTitle: currentAffairsTable.title,
          category: currentAffairsTable.category,
          progress: currentAffairReadHistoryTable.progress,
          secondsRead: currentAffairReadHistoryTable.secondsRead,
          completed: currentAffairReadHistoryTable.completed,
          lastReadAt: currentAffairReadHistoryTable.lastReadAt,
        })
        .from(currentAffairReadHistoryTable)
        .leftJoin(currentAffairsTable, eq(currentAffairReadHistoryTable.articleId, currentAffairsTable.id))
        .where(eq(currentAffairReadHistoryTable.userId, userId))
        .orderBy(desc(currentAffairReadHistoryTable.lastReadAt));

      const rows = history.map((h) => `
        <tr>
          <td>${esc(h.articleTitle, "Article")}</td>
          <td>${esc(h.category, "-")}</td>
          <td>${h.progress}%</td>
          <td>${Math.round((h.secondsRead ?? 0) / 60)} min</td>
          <td><span class="badge ${h.completed ? "badge-done" : "badge-pending"}">${h.completed ? "Done" : "In Progress"}</span></td>
          <td>${new Date(h.lastReadAt).toLocaleDateString("en-IN")}</td>
        </tr>`).join("");

      const completedCount = history.filter(h => h.completed).length;

      const html = `<!DOCTYPE html><html><head><title>Current Affairs Reading Summary</title><style>
        body{font-family:Arial,sans-serif;padding:40px;color:#333}
        h1{color:#d97706;border-bottom:2px solid #e2e8f0;padding-bottom:12px}
        .stats{display:flex;gap:24px;margin-bottom:24px}
        .stat{background:#fef3c7;padding:12px 20px;border-radius:8px;font-size:13px}
        .stat b{display:block;font-size:22px;color:#d97706}
        table{width:100%;border-collapse:collapse;font-size:13px}
        th{background:#fef9c3;color:#92400e;font-weight:bold;text-align:left;padding:10px;border-bottom:2px solid #fde68a}
        td{padding:10px;border-bottom:1px solid #fef3c7}
        .badge{padding:3px 8px;border-radius:4px;font-size:11px;font-weight:bold}
        .badge-done{background:#d1fae5;color:#065f46}
        .badge-pending{background:#fef3c7;color:#92400e}
        .print-btn{display:block;width:120px;margin:20px auto;background:#d97706;color:#fff;border:none;padding:10px 15px;border-radius:8px;font-weight:bold;cursor:pointer}
        @media print{.print-btn{display:none}}
      </style></head><body>
      <button class="print-btn" onclick="window.print()">Print / PDF</button>
      <h1>Current Affairs Reading Summary &#8212; ${esc(user?.name, "Student")}</h1>
      <div class="stats">
        <div class="stat"><b>${history.length}</b>Articles Read</div>
        <div class="stat"><b>${completedCount}</b>Completed</div>
        <div class="stat"><b>${history.length - completedCount}</b>In Progress</div>
      </div>
      <table><thead><tr><th>Article</th><th>Category</th><th>Progress</th><th>Time Spent</th><th>Status</th><th>Last Read</th></tr></thead>
      <tbody>${rows}</tbody></table>
      </body></html>`;

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.status(200).send(html);
    } catch {
      res.status(500).json({ error: "Export failed" });
    }
  }
);

// GET /api/v1/exports/pdf/study-plan - Printable HTML of study tasks / planner
router.get(
  "/v1/exports/pdf/study-plan",
  requireAuth,
  async (req: AuthRequest, res): Promise<void> => {
    try {
      const userId = req.userId!;
      const [user] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, userId));

      const tasks = await db
        .select()
        .from(studyTasksTable)
        .where(eq(studyTasksTable.userId, userId))
        .orderBy(desc(studyTasksTable.date));

      const plans = await db
        .select({ date: studyPlansTable.date, status: studyPlansTable.status })
        .from(studyPlansTable)
        .where(eq(studyPlansTable.userId, userId))
        .orderBy(desc(studyPlansTable.date))
        .limit(30);

      // Group tasks by date
      const byDate: Record<string, typeof tasks> = {};
      for (const t of tasks) {
        if (!byDate[t.date]) byDate[t.date] = [];
        byDate[t.date].push(t);
      }

      const taskRows = Object.entries(byDate)
        .sort((a, b) => b[0].localeCompare(a[0]))
        .flatMap(([date, dateTasks]) =>
          dateTasks.map(t => `
          <tr>
            <td>${esc(date)}</td>
            <td>${esc(t.title)}</td>
            <td>${esc(t.category)}</td>
            <td>${t.durationMinutes} min</td>
            <td style="text-transform:capitalize">${esc(t.priority)}</td>
            <td><span class="badge ${t.completed ? "badge-done" : "badge-pending"}">${t.completed ? "Done" : "Pending"}</span></td>
          </tr>`)
        ).join("");

      const completedTasks = tasks.filter(t => t.completed).length;
      const completedPlans = plans.filter(p => p.status === "completed").length;

      const html = `<!DOCTYPE html><html><head><title>Study Plan &amp; Calendar</title><style>
        body{font-family:Arial,sans-serif;padding:40px;color:#333}
        h1{color:#059669;border-bottom:2px solid #e2e8f0;padding-bottom:12px}
        .stats{display:flex;gap:24px;margin-bottom:24px}
        .stat{background:#d1fae5;padding:12px 20px;border-radius:8px;font-size:13px}
        .stat b{display:block;font-size:22px;color:#059669}
        table{width:100%;border-collapse:collapse;font-size:13px}
        th{background:#ecfdf5;color:#065f46;font-weight:bold;text-align:left;padding:10px;border-bottom:2px solid #a7f3d0}
        td{padding:10px;border-bottom:1px solid #ecfdf5}
        .badge{padding:3px 8px;border-radius:4px;font-size:11px;font-weight:bold}
        .badge-done{background:#d1fae5;color:#065f46}
        .badge-pending{background:#fef3c7;color:#92400e}
        .print-btn{display:block;width:120px;margin:20px auto;background:#059669;color:#fff;border:none;padding:10px 15px;border-radius:8px;font-weight:bold;cursor:pointer}
        @media print{.print-btn{display:none}}
      </style></head><body>
      <button class="print-btn" onclick="window.print()">Print / PDF</button>
      <h1>Study Plan &amp; Calendar &#8212; ${esc(user?.name, "Student")}</h1>
      <div class="stats">
        <div class="stat"><b>${tasks.length}</b>Total Tasks</div>
        <div class="stat"><b>${completedTasks}</b>Completed</div>
        <div class="stat"><b>${completedPlans}</b>Full Days Done</div>
      </div>
      <table><thead><tr><th>Date</th><th>Task</th><th>Subject</th><th>Duration</th><th>Priority</th><th>Status</th></tr></thead>
      <tbody>${taskRows || "<tr><td colspan=\"6\" style=\"text-align:center;color:#94a3b8\">No study tasks recorded yet</td></tr>"}</tbody></table>
      </body></html>`;

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.status(200).send(html);
    } catch {
      res.status(500).json({ error: "Export failed" });
    }
  }
);

// GET /api/v1/exports/csv/practice-history - CSV of practice sessions only
router.get(
  "/v1/exports/csv/practice-history",
  requireAuth,
  async (req: AuthRequest, res): Promise<void> => {
    try {
      const userId = req.userId!;
      const practices = await db
        .select()
        .from(practiceSessionsTable)
        .where(eq(practiceSessionsTable.userId, userId))
        .orderBy(desc(practiceSessionsTable.startedAt));

      const header = ["Date", "Mode", "Questions", "Correct", "Accuracy (%)", "Time (sec)"].map(csvCell).join(",");
      const rows = practices.map((p) => {
        const correct = Math.round((p.accuracy / 100) * p.totalQuestions);
        return [
          new Date(p.startedAt).toISOString(),
          p.mode,
          p.totalQuestions,
          correct,
          p.accuracy.toFixed(1),
          p.timeTakenSeconds,
        ].map(csvCell).join(",");
      });

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="practice-history.csv"');
      res.status(200).send([header, ...rows].join("\r\n") + "\r\n");
    } catch {
      res.status(500).json({ error: "Export failed" });
    }
  }
);

// GET /api/v1/exports/csv/revision-history - CSV of current affairs reading history (revision records)
router.get(
  "/v1/exports/csv/revision-history",
  requireAuth,
  async (req: AuthRequest, res): Promise<void> => {
    try {
      const userId = req.userId!;
      const history = await db
        .select({
          articleTitle: currentAffairsTable.title,
          category: currentAffairsTable.category,
          progress: currentAffairReadHistoryTable.progress,
          secondsRead: currentAffairReadHistoryTable.secondsRead,
          completed: currentAffairReadHistoryTable.completed,
          lastReadAt: currentAffairReadHistoryTable.lastReadAt,
        })
        .from(currentAffairReadHistoryTable)
        .leftJoin(currentAffairsTable, eq(currentAffairReadHistoryTable.articleId, currentAffairsTable.id))
        .where(eq(currentAffairReadHistoryTable.userId, userId))
        .orderBy(desc(currentAffairReadHistoryTable.lastReadAt));

      const header = ["Article", "Category", "Progress (%)", "Time Read (sec)", "Completed", "Last Read"].map(csvCell).join(",");
      const rows = history.map((h) => [
        h.articleTitle ?? "Article",
        h.category ?? "",
        h.progress,
        h.secondsRead,
        h.completed ? "Yes" : "No",
        new Date(h.lastReadAt).toISOString(),
      ].map(csvCell).join(","));

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="revision-history.csv"');
      res.status(200).send([header, ...rows].join("\r\n") + "\r\n");
    } catch {
      res.status(500).json({ error: "Export failed" });
    }
  }
);

export default router;
