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
  
  // Get all users
  const usersRes = await client.query('SELECT id, name, email, role FROM users');
  console.log("Users in the database:");
  console.log(usersRes.rows);

  // Get all bookmarks
  const bookmarksRes = await client.query('SELECT * FROM bookmarks');
  console.log("\nBookmarks in the database:");
  console.log(bookmarksRes.rows);

  await client.end();
}

main().catch(console.error);
