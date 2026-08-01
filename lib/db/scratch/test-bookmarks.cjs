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

  // 1. Inspect table columns for 'bookmarks'
  const columnsRes = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'bookmarks'
  `);
  console.log("Columns of 'bookmarks' table:");
  console.log(columnsRes.rows);

  // 2. Let's try to insert a test bookmark
  // We need a valid userId and a valid questionId
  const userRes = await client.query("SELECT id FROM users LIMIT 1");
  const questionRes = await client.query("SELECT id FROM questions LIMIT 1");

  if (userRes.rows.length === 0 || questionRes.rows.length === 0) {
    console.error("Missing users or questions to create a test bookmark");
    await client.end();
    return;
  }

  const userId = userRes.rows[0].id;
  const questionId = questionRes.rows[0].id;
  console.log(`Using test userId: ${userId}, questionId: ${questionId}`);

  try {
    const insertRes = await client.query(`
      INSERT INTO bookmarks (user_id, question_id)
      VALUES ($1, $2)
      RETURNING *
    `, [userId, questionId]);
    console.log("Inserted bookmark successfully:", insertRes.rows[0]);

    // 3. Fetch the bookmark using the query used by the backend
    const fetchRes = await client.query(`
      SELECT 
        b.id as bookmark_id,
        b.created_at as bookmarked_at,
        q.id as question_id,
        q.text as question_text,
        s.name as subject_name,
        t.name as topic_name
      FROM bookmarks b
      INNER JOIN questions q ON b.question_id = q.id
      LEFT JOIN subjects s ON q.subject_id = s.id
      LEFT JOIN topics t ON q.topic_id = t.id
      WHERE b.user_id = $1
    `, [userId]);
    console.log("Fetched bookmarks for user:", fetchRes.rows);

    // 4. Delete the test bookmark
    const deleteRes = await client.query(`
      DELETE FROM bookmarks WHERE user_id = $1 AND question_id = $2
    `, [userId, questionId]);
    console.log("Deleted test bookmark successfully, rows affected:", deleteRes.rowCount);

  } catch (err) {
    console.error("Database operation failed:", err.message);
  }

  await client.end();
}

main().catch(console.error);
