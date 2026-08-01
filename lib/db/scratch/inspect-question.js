const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Read database URL from .env
const envPath = 'c:/Users/premr/Downloads/RKTECHGOVTWEBSITEV2zip/RKTECHGOVTWEBSITEV2zip/artifacts/api-server/.env';
const envContent = fs.readFileSync(envPath, 'utf8');
const dbUrlMatch = envContent.match(/APP_DATABASE_URL="([^"]+)"/) || envContent.match(/DATABASE_URL="([^"]+)"/);
if (!dbUrlMatch) {
  console.error("No database URL found in .env");
  process.exit(1);
}
const connectionString = dbUrlMatch[1];
console.log("Connecting to:", connectionString.substring(0, 45) + "...");

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
  const qId = 22;

  // Let's first query if question 22 exists
  const questionRes = await client.query('SELECT * FROM questions WHERE id = $1', [qId]);
  console.log(`Question ID ${qId} exists:`, questionRes.rows.length > 0 ? 'YES' : 'NO');
  if (questionRes.rows.length > 0) {
    console.log("Question data:", questionRes.rows[0]);
  }

  const tables = [
    'session_answers',
    'practice_session_answers',
    'practice_session_questions',
    'exam_questions',
    'question_collection_items',
    'wrong_answers',
    'bookmarks',
    'question_reports',
    'question_options'
  ];

  for (const table of tables) {
    try {
      const res = await client.query(`SELECT COUNT(*) FROM ${table} WHERE question_id = $1`, [qId]);
      console.log(`Table '${table}' count for ID ${qId}:`, res.rows[0].count);
    } catch (e) {
      console.error(`Error querying ${table}:`, e.message);
    }
  }

  await client.end();
}

main().catch(console.error);
