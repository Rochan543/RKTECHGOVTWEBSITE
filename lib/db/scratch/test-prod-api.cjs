const { createHmac } = require('crypto');
const fs = require('fs');

// Read secret from .env
const envPath = 'c:/Users/premr/Downloads/RKTECHGOVTWEBSITEV2zip/RKTECHGOVTWEBSITEV2zip/artifacts/api-server/.env';
const envContent = fs.readFileSync(envPath, 'utf8');
const sessionSecretMatch = envContent.match(/SESSION_SECRET=([^\r\n]+)/);
if (!sessionSecretMatch) {
  console.error("No SESSION_SECRET found in .env");
  process.exit(1);
}
const JWT_SECRET = sessionSecretMatch[1].trim();

function signToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000) })).toString("base64url");
  const sig = createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${sig}`;
}

const token = signToken({ userId: 2, role: "student" });
console.log("Generated production JWT token for userId 2:", token.substring(0, 30) + "...");

async function main() {
  // We'll use dynamic import for node-fetch or native fetch if available
  const fetch = globalThis.fetch || require('node-fetch');

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  // 1. POST Bookmark
  console.log("\n1. Testing POST /api/v1/bookmarks for Question 23...");
  const postRes = await fetch("https://rktechgovtwebsite.onrender.com/api/v1/bookmarks", {
    method: 'POST',
    headers,
    body: JSON.stringify({ questionId: 23 })
  });
  console.log("POST Status:", postRes.status);
  const postData = await postRes.json();
  console.log("POST Response:", postData);

  // 2. GET Bookmarks
  console.log("\n2. Testing GET /api/v1/bookmarks...");
  const getRes = await fetch("https://rktechgovtwebsite.onrender.com/api/v1/bookmarks", {
    method: 'GET',
    headers
  });
  console.log("GET Status:", getRes.status);
  const getData = await getRes.json();
  console.log("GET Response:", JSON.stringify(getData, null, 2));

  // 3. DELETE Bookmark
  console.log("\n3. Testing DELETE /api/v1/bookmarks/23...");
  const deleteRes = await fetch("https://rktechgovtwebsite.onrender.com/api/v1/bookmarks/23", {
    method: 'DELETE',
    headers
  });
  console.log("DELETE Status:", deleteRes.status);
  const deleteData = await deleteRes.json();
  console.log("DELETE Response:", deleteData);
}

main().catch(console.error);
