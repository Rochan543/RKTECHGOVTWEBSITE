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

  console.log("--- EXAMS IN DATABASE ---");
  const examsRes = await client.query('SELECT id, title, type, status FROM exams');
  console.log(`Found ${examsRes.rows.length} exams:`);
  console.log(JSON.stringify(examsRes.rows, null, 2));

  console.log("\n--- EXAM QUESTIONS COUNT PER EXAM ---");
  const qCountRes = await client.query('SELECT exam_id, COUNT(*) as count FROM exam_questions GROUP BY exam_id');
  console.log(JSON.stringify(qCountRes.rows, null, 2));

  console.log("\n--- DETAILED EXAM QUESTIONS FOR CALENDAR MOCK TEST ---");
  const calendarExam = examsRes.rows.find(e => e.title.includes("Calendar") || e.title.includes("Calendar MOCK TEST"));
  if (calendarExam) {
    const mappingsRes = await client.query('SELECT * FROM exam_questions WHERE exam_id = $1', [calendarExam.id]);
    console.log(`Mappings in exam_questions for exam_id ${calendarExam.id} (${calendarExam.title}):`);
    console.log(JSON.stringify(mappingsRes.rows, null, 2));
  } else {
    console.log("Calendar MOCK TEST not found in exams. Querying all rows in exam_questions instead:");
    const allMappingsRes = await client.query('SELECT * FROM exam_questions LIMIT 50');
    console.log(JSON.stringify(allMappingsRes.rows, null, 2));
  }

  await client.end();
}

main().catch(console.error);
