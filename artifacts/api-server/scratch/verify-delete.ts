import { 
  db, 
  questionsTable, 
  questionOptionsTable, 
  bookmarksTable, 
  questionCollectionItemsTable, 
  questionCollectionsTable,
  practiceSessionQuestionsTable, 
  practiceSessionAnswersTable,
  practiceSessionsTable,
  sessionAnswersTable,
  subjectsTable, 
  topicsTable, 
  usersTable 
} from "@workspace/db";
import { eq, count } from "drizzle-orm";
import { createHmac } from "crypto";

function signToken(payload: Record<string, unknown>): string {
  const secret = process.env.SESSION_SECRET || "default_secret";
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000) })).toString("base64url");
  const sig = createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${sig}`;
}

async function runVerification() {
  console.log("Starting Question Deletion HTTP verification tests against localhost:8080...\n");

  // Find a subject and topic
  const [subject] = await db.select().from(subjectsTable).limit(1);
  const [topic] = await db.select().from(topicsTable).limit(1);
  if (!subject || !topic) {
    console.error("Subject or Topic not found in DB. Seed the DB first.");
    process.exit(1);
  }

  // Find an admin user
  const [user] = await db.select().from(usersTable).where(eq(usersTable.role, 'admin')).limit(1);
  const adminUser = user || (await db.select().from(usersTable).where(eq(usersTable.role, 'super_admin')).limit(1))[0];
  if (!adminUser) {
    console.error("No admin or super_admin user found in DB.");
    process.exit(1);
  }

  console.log(`Using Admin User: ID ${adminUser.id}, Role ${adminUser.role}`);
  const token = signToken({ userId: adminUser.id, role: adminUser.role });
  
  const fetch = globalThis.fetch || (await import("node-fetch")).default;

  // ========================================================
  // SCENARIO 1: Brand new question (deletes successfully, HTTP 200)
  // ========================================================
  console.log("\n--- Scenario 1: Brand new question (NO children, NO attempts) ---");
  const [newQ1] = await db.insert(questionsTable).values({
    text: "Temp Verification Q1 - Brand New",
    type: "single_choice",
    difficulty: "medium",
    subjectId: subject.id,
    topicId: topic.id,
  }).returning();
  const qId1 = newQ1.id;
  console.log(`Created question ID: ${qId1}`);

  console.log(`Sending request: DELETE http://localhost:8080/api/v1/questions/${qId1}`);
  const res1 = await fetch(`http://localhost:8080/api/v1/questions/${qId1}`, {
    method: 'DELETE',
    headers: { 'Cookie': `token=${token}` }
  });
  console.log(`Response Status: ${res1.status}`);
  const body1 = await res1.json();
  console.log("Response Body:", body1);

  const scenario1Passed = res1.status === 200 && body1.success === true;
  console.log(scenario1Passed ? "✅ SCENARIO 1 PASSED" : "❌ SCENARIO 1 FAILED");

  // ========================================================
  // SCENARIO 2: Question with bookmarks only (deletes successfully, HTTP 200)
  // ========================================================
  console.log("\n--- Scenario 2: Question with bookmarks only ---");
  const [newQ2] = await db.insert(questionsTable).values({
    text: "Temp Verification Q2 - Bookmarked",
    type: "single_choice",
    difficulty: "medium",
    subjectId: subject.id,
    topicId: topic.id,
  }).returning();
  const qId2 = newQ2.id;
  console.log(`Created question ID: ${qId2}`);

  await db.insert(bookmarksTable).values({
    userId: adminUser.id,
    questionId: qId2,
  });
  console.log(`Created bookmark mapping for question ${qId2}`);

  console.log(`Sending request: DELETE http://localhost:8080/api/v1/questions/${qId2}`);
  const res2 = await fetch(`http://localhost:8080/api/v1/questions/${qId2}`, {
    method: 'DELETE',
    headers: { 'Cookie': `token=${token}` }
  });
  console.log(`Response Status: ${res2.status}`);
  const body2 = await res2.json();
  console.log("Response Body:", body2);

  const [bookmarksLeft] = await db.select({ count: count() }).from(bookmarksTable).where(eq(bookmarksTable.questionId, qId2));
  const scenario2Passed = res2.status === 200 && body2.success === true && Number(bookmarksLeft?.count ?? 0) === 0;
  console.log(scenario2Passed ? "✅ SCENARIO 2 PASSED" : "❌ SCENARIO 2 FAILED");

  // ========================================================
  // SCENARIO 3: Question with practice session mappings but NO answers (deletes successfully, HTTP 200)
  // ========================================================
  console.log("\n--- Scenario 3: Question with practice session mappings but NO answers ---");
  const [newQ3] = await db.insert(questionsTable).values({
    text: "Temp Verification Q3 - Mapped in Session",
    type: "single_choice",
    difficulty: "medium",
    subjectId: subject.id,
    topicId: topic.id,
  }).returning();
  const qId3 = newQ3.id;
  console.log(`Created question ID: ${qId3}`);

  const [practiceSession] = await db.select().from(practiceSessionsTable).limit(1);
  if (practiceSession) {
    await db.insert(practiceSessionQuestionsTable).values({
      sessionId: practiceSession.id,
      questionId: qId3,
      displayOrder: 1,
    });
    console.log(`Linked question ${qId3} to practice session ID ${practiceSession.id}`);
  }

  console.log(`Sending request: DELETE http://localhost:8080/api/v1/questions/${qId3}`);
  const res3 = await fetch(`http://localhost:8080/api/v1/questions/${qId3}`, {
    method: 'DELETE',
    headers: { 'Cookie': `token=${token}` }
  });
  console.log(`Response Status: ${res3.status}`);
  const body3 = await res3.json();
  console.log("Response Body:", body3);

  const [mappingsLeft] = await db.select({ count: count() }).from(practiceSessionQuestionsTable).where(eq(practiceSessionQuestionsTable.questionId, qId3));
  const scenario3Passed = res3.status === 200 && body3.success === true && Number(mappingsLeft?.count ?? 0) === 0;
  console.log(scenario3Passed ? "✅ SCENARIO 3 PASSED" : "❌ SCENARIO 3 FAILED");

  // ========================================================
  // SCENARIO 4: Question with real student answers (blocked with HTTP 409)
  // ========================================================
  console.log("\n--- Scenario 4: Question with real student answers ---");
  const [newQ4] = await db.insert(questionsTable).values({
    text: "Temp Verification Q4 - Blocked with Attempt",
    type: "single_choice",
    difficulty: "medium",
    subjectId: subject.id,
    topicId: topic.id,
  }).returning();
  const qId4 = newQ4.id;
  console.log(`Created question ID: ${qId4}`);

  const [mockPracticeSession] = await db.insert(practiceSessionsTable).values({
    userId: adminUser.id,
    mode: "timed",
    status: "in_progress",
  }).returning();
  
  await db.insert(practiceSessionAnswersTable).values({
    sessionId: mockPracticeSession.id,
    questionId: qId4,
    isCorrect: true,
    status: "answered",
  });
  console.log(`Created mock practice attempt for question ${qId4}`);

  console.log(`Sending request: DELETE http://localhost:8080/api/v1/questions/${qId4}`);
  const res4 = await fetch(`http://localhost:8080/api/v1/questions/${qId4}`, {
    method: 'DELETE',
    headers: { 'Cookie': `token=${token}` }
  });
  console.log(`Response Status: ${res4.status}`);
  const body4 = await res4.json();
  console.log("Response Body:", body4);

  const scenario4Passed = res4.status === 409 && body4.error === "This question has been used in student exam/practice history and cannot be deleted.";
  console.log(scenario4Passed ? "✅ SCENARIO 4 PASSED" : "❌ SCENARIO 4 FAILED");

  // Cleanup scenario 4 mock data
  console.log("\nCleaning up Scenario 4 mock data...");
  await db.delete(practiceSessionAnswersTable).where(eq(practiceSessionAnswersTable.questionId, qId4));
  await db.delete(practiceSessionsTable).where(eq(practiceSessionsTable.id, mockPracticeSession.id));
  await db.delete(questionsTable).where(eq(questionsTable.id, qId4));
  console.log("Cleanup complete.");

  if (scenario1Passed && scenario2Passed && scenario3Passed && scenario4Passed) {
    console.log("\n🎉 ALL 4 SCENARIOS PASSED SUCCESSFULLY!");
    process.exit(0);
  } else {
    console.error("\n❌ SOME SCENARIOS FAILED.");
    process.exit(1);
  }
}

runVerification().catch((err) => {
  console.error("Verification script error:", err);
  process.exit(1);
});
