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
  
  // Get all questions
  const questionsRes = await client.query('SELECT id, text FROM questions');
  console.log(`Total questions: ${questionsRes.rows.length}`);

  const qIds = questionsRes.rows.map(r => r.id);

  console.log("Analyzing questions and their attempt counts...");
  
  const results = [];
  for (const qId of qIds) {
    const sessionRes = await client.query('SELECT COUNT(*) FROM session_answers WHERE question_id = $1', [qId]);
    const practiceARes = await client.query('SELECT COUNT(*) FROM practice_session_answers WHERE question_id = $1', [qId]);
    const practiceQRes = await client.query('SELECT COUNT(*) FROM practice_session_questions WHERE question_id = $1', [qId]);
    
    const session_answers_count = parseInt(sessionRes.rows[0].count, 10);
    const practice_session_answers_count = parseInt(practiceARes.rows[0].count, 10);
    const practice_session_questions_count = parseInt(practiceQRes.rows[0].count, 10);
    
    const isBlocked = session_answers_count > 0 || practice_session_answers_count > 0 || practice_session_questions_count > 0;
    
    results.push({
      id: qId,
      session_answers: session_answers_count,
      practice_session_answers: practice_session_answers_count,
      practice_session_questions: practice_session_questions_count,
      isBlocked
    });
  }

  const blocked = results.filter(r => r.isBlocked);
  const deletable = results.filter(r => !r.isBlocked);

  console.log(`\nBlocked Questions (${blocked.length}):`);
  console.log(blocked.slice(0, 10)); // print first 10
  if (blocked.length > 10) console.log(`... and ${blocked.length - 10} more`);

  console.log(`\nDeletable Questions (${deletable.length}):`);
  console.log(deletable.slice(0, 10)); // print first 10
  if (deletable.length > 10) console.log(`... and ${deletable.length - 10} more`);

  await client.end();
}

main().catch(console.error);
