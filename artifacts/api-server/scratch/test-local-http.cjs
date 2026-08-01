const { createHmac } = require('crypto');
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// 1. Load .env
const envPath = path.resolve(__dirname, '../.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const sessionSecretMatch = envContent.match(/SESSION_SECRET=([^\r\n]+)/);
const dbUrlMatch = envContent.match(/APP_DATABASE_URL="([^"]+)"/) || envContent.match(/DATABASE_URL="([^"]+)"/);

if (!sessionSecretMatch || !dbUrlMatch) {
  console.error("Missing config in .env");
  process.exit(1);
}

const JWT_SECRET = sessionSecretMatch[1].trim();
const connectionString = dbUrlMatch[1];
const cleanConnectionString = connectionString
  .replace(/sslmode=[^&]*/g, "")
  .replace(/channel_binding=[^&]*/g, "")
  .replace(/\?&/g, "?")
  .replace(/&&/g, "&")
  .replace(/[&?]$/g, "");

function signToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000) })).toString("base64url");
  const sig = createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${sig}`;
}

async function main() {
  const client = new Client({
    connectionString: cleanConnectionString,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  // Find admin or super_admin user
  const userRes = await client.query("SELECT id, role FROM users WHERE role IN ('admin', 'super_admin') LIMIT 1");
  const admin = userRes.rows[0];
  if (!admin) {
    console.error("No admin user found in database!");
    await client.end();
    process.exit(1);
  }
  console.log(`Using admin user: ID ${admin.id}, Role ${admin.role}`);

  const token = signToken({ userId: admin.id, role: admin.role });

  // Get a subject and topic
  const subjRes = await client.query("SELECT id FROM subjects LIMIT 1");
  const topicRes = await client.query("SELECT id FROM topics LIMIT 1");
  const subjectId = subjRes.rows[0]?.id;
  const topicId = topicRes.rows[0]?.id;

  if (!subjectId || !topicId) {
    console.error("No subjects/topics in database!");
    await client.end();
    process.exit(1);
  }

  // Create a brand new deletable question
  const qInsert = await client.query(
    "INSERT INTO questions (text, type, difficulty, subject_id, topic_id) VALUES ($1, $2, $3, $4, $5) RETURNING id",
    ["HTTP Deletion Test Question", "single_choice", "medium", subjectId, topicId]
  );
  const deletableId = qInsert.rows[0].id;
  console.log(`Created deletable question ID: ${deletableId}`);

  // Create options
  await client.query("INSERT INTO question_options (question_id, text, is_correct) VALUES ($1, $2, $3)", [deletableId, "Opt A", true]);
  
  // Create bookmark
  await client.query("INSERT INTO bookmarks (user_id, question_id) VALUES ($1, $2)", [admin.id, deletableId]);

  // Create a blocked question
  const qBlockedInsert = await client.query(
    "INSERT INTO questions (text, type, difficulty, subject_id, topic_id) VALUES ($1, $2, $3, $4, $5) RETURNING id",
    ["HTTP Blocked Test Question", "single_choice", "medium", subjectId, topicId]
  );
  const blockedId = qBlockedInsert.rows[0].id;
  console.log(`Created blocked question ID: ${blockedId}`);

  // Create mock practice session & attempt
  const sessionInsert = await client.query(
    "INSERT INTO practice_sessions (user_id, mode, status) VALUES ($1, $2, $3) RETURNING id",
    [admin.id, "timed", "in_progress"]
  );
  const sessionId = sessionInsert.rows[0].id;
  
  await client.query(
    "INSERT INTO practice_session_answers (session_id, question_id, is_correct, status) VALUES ($1, $2, $3, $4)",
    [sessionId, blockedId, true, "answered"]
  );
  console.log(`Linked student attempt to blocked question ${blockedId} under practice session ${sessionId}`);

  await client.end();

  // Make HTTP requests
  const fetch = globalThis.fetch || require('node-fetch');

  // Test Deletable Question
  console.log(`\nSending HTTP DELETE /api/v1/questions/${deletableId}...`);
  const resDel = await fetch(`http://localhost:8080/api/v1/questions/${deletableId}`, {
    method: 'DELETE',
    headers: {
      'Cookie': `token=${token}`
    }
  });
  console.log(`Response Status: ${resDel.status}`);
  console.log("Response Body:", await resDel.json());

  // Test Blocked Question
  console.log(`\nSending HTTP DELETE /api/v1/questions/${blockedId}...`);
  const resBlock = await fetch(`http://localhost:8080/api/v1/questions/${blockedId}`, {
    method: 'DELETE',
    headers: {
      'Cookie': `token=${token}`
    }
  });
  console.log(`Response Status: ${resBlock.status}`);
  console.log("Response Body:", await resBlock.json());

  // Clean up mock blocked question data
  console.log("\nCleaning up blocked mock question data...");
  const cleanupClient = new Client({
    connectionString: cleanConnectionString,
    ssl: { rejectUnauthorized: false }
  });
  await cleanupClient.connect();
  await cleanupClient.query("DELETE FROM practice_session_answers WHERE question_id = $1", [blockedId]);
  await cleanupClient.query("DELETE FROM practice_sessions WHERE id = $1", [sessionId]);
  await cleanupClient.query("DELETE FROM questions WHERE id = $1", [blockedId]);
  await cleanupClient.end();
  console.log("Cleanup complete.");
}

main().catch(console.error);
