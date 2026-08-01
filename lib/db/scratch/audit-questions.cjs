const { Pool } = require('pg');
const fs = require('fs');

const envPath = 'c:/Users/premr/Downloads/RKTECHGOVTWEBSITEV2zip/RKTECHGOVTWEBSITEV2zip/artifacts/api-server/.env';
const envContent = fs.readFileSync(envPath, 'utf8');
const dbUrlMatch = envContent.match(/APP_DATABASE_URL="([^"]+)"/) || envContent.match(/DATABASE_URL="([^"]+)"/);
if (!dbUrlMatch) {
  console.error("No database URL found in .env");
  process.exit(1);
}
const connectionString = dbUrlMatch[1];
const cleanConnectionString = connectionString
  .replace(/sslmode=[^&]*/g, "")
  .replace(/channel_binding=[^&]*/g, "")
  .replace(/\?&/g, "?")
  .replace(/&&/g, "&")
  .replace(/[&?]$/g, "");

const pool = new Pool({
  connectionString: cleanConnectionString,
  ssl: { rejectUnauthorized: false },
  max: 20 // Allow up to 20 concurrent connections
});

async function main() {
  console.log("Connecting to database pool. Fetching question stats...");

  const questionsRes = await pool.query("SELECT id, text FROM questions ORDER BY id ASC");
  const questions = questionsRes.rows;

  console.log(`Total questions in database: ${questions.length}`);

  const results = await Promise.all(questions.map(async (q) => {
    const qId = q.id;
    const [
      optRes, bmkRes, wrgRes, prqRes, praRes, sesRes, exmRes, colRes, repRes, curRes
    ] = await Promise.all([
      pool.query("SELECT count(*)::int as count FROM question_options WHERE question_id = $1", [qId]),
      pool.query("SELECT count(*)::int as count FROM bookmarks WHERE question_id = $1", [qId]),
      pool.query("SELECT count(*)::int as count FROM wrong_answers WHERE question_id = $1", [qId]),
      pool.query("SELECT count(*)::int as count FROM practice_session_questions WHERE question_id = $1", [qId]),
      pool.query("SELECT count(*)::int as count FROM practice_session_answers WHERE question_id = $1", [qId]),
      pool.query("SELECT count(*)::int as count FROM session_answers WHERE question_id = $1", [qId]),
      pool.query("SELECT count(*)::int as count FROM exam_questions WHERE question_id = $1", [qId]),
      pool.query("SELECT count(*)::int as count FROM question_collection_items WHERE question_id = $1", [qId]),
      pool.query("SELECT count(*)::int as count FROM question_reports WHERE question_id = $1", [qId]),
      pool.query("SELECT count(*)::int as count FROM current_affair_quiz_questions WHERE question_id = $1", [qId])
    ]);

    return {
      id: qId,
      text: q.text,
      stats: {
        question_options: optRes.rows[0].count,
        bookmarks: bmkRes.rows[0].count,
        wrong_answers: wrgRes.rows[0].count,
        practice_session_questions: prqRes.rows[0].count,
        practice_session_answers: praRes.rows[0].count,
        session_answers: sesRes.rows[0].count,
        exam_questions: exmRes.rows[0].count,
        question_collection_items: colRes.rows[0].count,
        question_reports: repRes.rows[0].count,
        current_affair_quiz_questions: curRes.rows[0].count
      }
    };
  }));

  for (const r of results) {
    const hasReferences = Object.values(r.stats).some(c => c > 0);
    if (hasReferences) {
      console.log(`\nQuestion ID: ${r.id}`);
      console.log(`Text: "${r.text.substring(0, 60)}..."`);
      console.log(`↓`);
      console.log(`question_options: ${r.stats.question_options}`);
      console.log(`bookmarks: ${r.stats.bookmarks}`);
      console.log(`wrong_answers: ${r.stats.wrong_answers}`);
      console.log(`practice_session_questions: ${r.stats.practice_session_questions}`);
      console.log(`practice_session_answers: ${r.stats.practice_session_answers}`);
      console.log(`session_answers: ${r.stats.session_answers}`);
      console.log(`exam_questions: ${r.stats.exam_questions}`);
      console.log(`question_collection_items: ${r.stats.question_collection_items}`);
      console.log(`question_reports: ${r.stats.question_reports}`);
      console.log(`current_affair_quiz_questions: ${r.stats.current_affair_quiz_questions}`);
    }
  }

  await pool.end();
}

main().catch(console.error);
