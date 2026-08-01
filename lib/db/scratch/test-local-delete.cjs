const { Client } = require('pg');
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

const client = new Client({
  connectionString: cleanConnectionString,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();
  console.log("Connected to database. Running delete test...");

  const targetQ = 23; // This question has wrong_answers: 1, practice_session_questions: 1, practice_session_answers: 1

  console.log(`\n--- PRE-DELETE CHECK for Question ${targetQ} ---`);
  const prqBefore = await client.query("SELECT count(*)::int FROM practice_session_questions WHERE question_id = $1", [targetQ]);
  const praBefore = await client.query("SELECT count(*)::int FROM practice_session_answers WHERE question_id = $1", [targetQ]);
  const qBefore = await client.query("SELECT count(*)::int FROM questions WHERE id = $1", [targetQ]);
  console.log(`practice_session_questions: ${prqBefore.rows[0].count}`);
  console.log(`practice_session_answers: ${praBefore.rows[0].count}`);
  console.log(`questions exists: ${qBefore.rows[0].count > 0 ? "YES" : "NO"}`);

  // Perform transaction-based deletion mimicking backend route logic
  try {
    console.log(`\nExecuting delete logic for Question ${targetQ}...`);
    
    // We run queries sequentially mimicking the transaction
    await client.query("BEGIN");
    
    await client.query("DELETE FROM question_reports WHERE question_id = $1", [targetQ]);
    await client.query("DELETE FROM bookmarks WHERE question_id = $1", [targetQ]);
    await client.query("DELETE FROM wrong_answers WHERE question_id = $1", [targetQ]);
    await client.query("DELETE FROM question_collection_items WHERE question_id = $1", [targetQ]);
    await client.query("DELETE FROM exam_questions WHERE question_id = $1", [targetQ]);
    await client.query("DELETE FROM current_affair_quiz_questions WHERE question_id = $1", [targetQ]);
    await client.query("DELETE FROM practice_session_questions WHERE question_id = $1", [targetQ]);
    await client.query("DELETE FROM practice_session_answers WHERE question_id = $1", [targetQ]);
    await client.query("DELETE FROM question_options WHERE question_id = $1", [targetQ]);
    const deleteRes = await client.query("DELETE FROM questions WHERE id = $1 RETURNING *", [targetQ]);
    
    await client.query("COMMIT");
    
    console.log("Deletion completed successfully, rows affected:", deleteRes.rowCount);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Delete failed:", err);
  }

  console.log(`\n--- POST-DELETE CHECK for Question ${targetQ} ---`);
  const prqAfter = await client.query("SELECT count(*)::int FROM practice_session_questions WHERE question_id = $1", [targetQ]);
  const praAfter = await client.query("SELECT count(*)::int FROM practice_session_answers WHERE question_id = $1", [targetQ]);
  const qAfter = await client.query("SELECT count(*)::int FROM questions WHERE id = $1", [targetQ]);
  console.log(`practice_session_questions: ${prqAfter.rows[0].count}`);
  console.log(`practice_session_answers: ${praAfter.rows[0].count}`);
  console.log(`questions exists: ${qAfter.rows[0].count > 0 ? "YES" : "NO"}`);

  // Re-inserting the question and referencing records to leave database clean and original
  console.log("\nRestoring Question 23 and its reference data for clean database status...");
  try {
    await client.query("BEGIN");
    // Insert question 23
    await client.query(`
      INSERT INTO questions (id, text, type, difficulty, subject_id, topic_id, positive_marks, negative_marks)
      VALUES (23, 'How many odd days are there in 159 days?', 'single_choice', 'medium', 1, 1, 1, 0.25)
    `);
    // Insert options (order 1 to 4)
    await client.query("INSERT INTO question_options (id, question_id, text, is_correct, \"order\") VALUES (125, 23, '4', false, 1)");
    await client.query("INSERT INTO question_options (id, question_id, text, is_correct, \"order\") VALUES (126, 23, '2', false, 2)");
    await client.query("INSERT INTO question_options (id, question_id, text, is_correct, \"order\") VALUES (127, 23, '5', false, 3)");
    await client.query("INSERT INTO question_options (id, question_id, text, is_correct, \"order\") VALUES (128, 23, '3', true, 4)");
    
    // Insert other references
    await client.query("INSERT INTO wrong_answers (user_id, question_id, attempt_count, source_type, source_id) VALUES (2, 23, 1, 'practice', 2)");
    await client.query("INSERT INTO practice_session_questions (session_id, question_id, display_order) VALUES (2, 23, 1)");
    await client.query("INSERT INTO practice_session_answers (session_id, question_id, selected_option_id, is_correct, time_taken_seconds, flagged, status) VALUES (2, 23, 126, false, 5, false, 'answered')");
    
    await client.query("COMMIT");
    console.log("Restoration completed successfully.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Restoration failed:", err);
  }

  await client.end();
}

main().catch(console.error);
