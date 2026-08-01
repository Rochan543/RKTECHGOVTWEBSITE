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

  console.log("Checking active user histories across sessions & practice...");

  const usersRes = await client.query("SELECT id, name, email, role FROM users");
  const users = usersRes.rows;

  for (const u of users) {
    const examSessionsRes = await client.query("SELECT COUNT(*) FROM test_sessions WHERE user_id = $1", [u.id]);
    const practiceSessionsRes = await client.query("SELECT COUNT(*) FROM practice_sessions WHERE user_id = $1", [u.id]);
    const bookmarksRes = await client.query("SELECT COUNT(*) FROM bookmarks WHERE user_id = $1", [u.id]);

    const examSessions = parseInt(examSessionsRes.rows[0].count, 10);
    const practiceSessions = parseInt(practiceSessionsRes.rows[0].count, 10);
    const bookmarks = parseInt(bookmarksRes.rows[0].count, 10);

    if (examSessions > 0 || practiceSessions > 0 || bookmarks > 0) {
      console.log(`User ID ${u.id} (${u.email}, ${u.name}):`);
      console.log(`  - Exam Sessions: ${examSessions}`);
      console.log(`  - Practice Sessions: ${practiceSessions}`);
      console.log(`  - Bookmarks: ${bookmarks}`);
    }
  }

  await client.end();
}

main().catch(console.error);
