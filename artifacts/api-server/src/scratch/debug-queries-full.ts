import {
  db,
  usersTable,
  learningRecommendationsTable,
  studyPlansTable,
  questionsTable,
  practiceSessionsTable,
  practiceSessionAnswersTable,
  resultsTable,
  bookmarksTable,
  wrongAnswersTable,
  subjectsTable,
  topicsTable,
  questionCollectionsTable,
  studyPlanTemplatesTable,
  userStudyPlanAssignmentsTable
} from "@workspace/db";
import { eq, and, desc, asc, inArray, sql, count } from "drizzle-orm";

async function runQueries() {
  try {
    console.log("Starting full debug queries execution...");

    console.log("\n1. Querying low accuracy students...");
    const lowAccuracyStudents = await db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        avgAccuracy: sql<number>`avg(${resultsTable.accuracy})::real`,
        avgScore: sql<number>`avg(${resultsTable.score})::real`,
        totalTests: count(resultsTable.id),
      })
      .from(resultsTable)
      .innerJoin(usersTable, eq(resultsTable.userId, usersTable.id))
      .groupBy(usersTable.id)
      .orderBy(asc(sql`avg(${resultsTable.accuracy})`))
      .limit(10);
    console.log("Low accuracy students count:", lowAccuracyStudents.length);

    console.log("\n2. Querying difficult topics...");
    const difficultTopics = await db
      .select({
        topicId: questionsTable.topicId,
        topicName: topicsTable.name,
        subjectName: subjectsTable.name,
        avgAccuracy: sql<number>`avg(case when ${practiceSessionAnswersTable.isCorrect} = true then 100.0 else 0.0 end)::real`,
        attempts: count(practiceSessionAnswersTable.id),
      })
      .from(practiceSessionAnswersTable)
      .innerJoin(questionsTable, eq(practiceSessionAnswersTable.questionId, questionsTable.id))
      .innerJoin(topicsTable, eq(questionsTable.topicId, topicsTable.id))
      .innerJoin(subjectsTable, eq(topicsTable.subjectId, subjectsTable.id))
      .where(eq(practiceSessionAnswersTable.status, "answered"))
      .groupBy(questionsTable.topicId, topicsTable.name, subjectsTable.name)
      .orderBy(asc(sql`avg(case when ${practiceSessionAnswersTable.isCorrect} = true then 100.0 else 0.0 end)`))
      .limit(10);
    console.log("Difficult topics count:", difficultTopics.length);

    console.log("\n3. Querying low completion collections...");
    const lowCompletionCollections = await db
      .select({
        id: questionCollectionsTable.id,
        name: questionCollectionsTable.name,
        completionRate: sql<number>`(count(case when ${practiceSessionsTable.status} = 'completed' then 1 end) * 100.0 / count(*))::real`,
        attemptsCount: count(practiceSessionsTable.id),
      })
      .from(practiceSessionsTable)
      .innerJoin(questionCollectionsTable, eq(practiceSessionsTable.collectionId, questionCollectionsTable.id))
      .groupBy(questionCollectionsTable.id)
      .orderBy(asc(sql`(count(case when ${practiceSessionsTable.status} = 'completed' then 1 end) * 100.0 / count(*))`))
      .limit(10);
    console.log("Low completion collections count:", lowCompletionCollections.length);

    console.log("\n4. Querying most improved...");
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const mostImproved = await db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        recentAccuracy: sql<number>`avg(case when ${resultsTable.createdAt} >= ${sevenDaysAgo} then ${resultsTable.accuracy} end)::real`,
        olderAccuracy: sql<number>`avg(case when ${resultsTable.createdAt} < ${sevenDaysAgo} then ${resultsTable.accuracy} end)::real`,
        testsCount: count(resultsTable.id),
      })
      .from(resultsTable)
      .innerJoin(usersTable, eq(resultsTable.userId, usersTable.id))
      .groupBy(usersTable.id)
      .having(sql`avg(case when ${resultsTable.createdAt} >= ${sevenDaysAgo} then ${resultsTable.accuracy} end) > avg(case when ${resultsTable.createdAt} < ${sevenDaysAgo} then ${resultsTable.accuracy} end)`)
      .orderBy(desc(sql`avg(case when ${resultsTable.createdAt} >= ${sevenDaysAgo} then ${resultsTable.accuracy} end) - avg(case when ${resultsTable.createdAt} < ${sevenDaysAgo} then ${resultsTable.accuracy} end)`))
      .limit(10);
    console.log("Most improved count:", mostImproved.length);

    console.log("\n5. Querying least active...");
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const leastActive = await db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        recentTests: sql<number>`count(case when ${resultsTable.createdAt} >= ${fourteenDaysAgo} then 1 end)::int`,
        totalTests: count(resultsTable.id),
      })
      .from(resultsTable)
      .innerJoin(usersTable, eq(resultsTable.userId, usersTable.id))
      .groupBy(usersTable.id)
      .orderBy(asc(sql`count(case when ${resultsTable.createdAt} >= ${fourteenDaysAgo} then 1 end)`), asc(count(resultsTable.id)))
      .limit(10);
    console.log("Least active count:", leastActive.length);

    console.log("\n6. Querying live recommendations...");
    const recommendationsRaw = await db
      .select({
        id: learningRecommendationsTable.id,
        userId: learningRecommendationsTable.userId,
        studentName: usersTable.name,
        type: learningRecommendationsTable.type,
        entityId: learningRecommendationsTable.entityId,
        score: learningRecommendationsTable.score,
        reason: learningRecommendationsTable.reason,
      })
      .from(learningRecommendationsTable)
      .innerJoin(usersTable, eq(learningRecommendationsTable.userId, usersTable.id))
      .orderBy(desc(learningRecommendationsTable.generatedAt))
      .limit(20);
    console.log("RecommendationsRaw count:", recommendationsRaw.length);

    console.log("\n7. Querying study plan templates...");
    const templates = await db.select().from(studyPlanTemplatesTable);
    console.log("Templates count:", templates.length);

    console.log("\n8. Querying revision queues...");
    const studentsList = await db
      .select({ id: usersTable.id, name: usersTable.name, avgAccuracy: sql<number>`avg(${resultsTable.accuracy})::real` })
      .from(usersTable)
      .leftJoin(resultsTable, eq(usersTable.id, resultsTable.userId))
      .where(eq(usersTable.role, "student"))
      .groupBy(usersTable.id);
    console.log("Students count for revision queues:", studentsList.length);

    console.log("\n9. Querying live mastery class avg...");
    const [avgAccuracyRes] = await db.select({ val: sql<number>`avg(${practiceSessionsTable.accuracy})::real` }).from(practiceSessionsTable).where(eq(practiceSessionsTable.status, "completed"));
    console.log("Class avg accuracy:", avgAccuracyRes?.val);

    console.log("\n10. Querying topic accuracy mastery...");
    const topicAccuracy = await db
      .select({
        topicId: questionsTable.topicId,
        avgAcc: sql<number>`avg(case when ${practiceSessionAnswersTable.isCorrect} = true then 100.0 else 0.0 end)::real`,
      })
      .from(practiceSessionAnswersTable)
      .innerJoin(questionsTable, eq(practiceSessionAnswersTable.questionId, questionsTable.id))
      .where(eq(practiceSessionAnswersTable.status, "answered"))
      .groupBy(questionsTable.topicId);
    console.log("Topic accuracy entries count:", topicAccuracy.length);

    console.log("\n11. Querying subject accuracy mastery...");
    const allSubjects = await db.select().from(subjectsTable);
    console.log("Subjects count:", allSubjects.length);

    console.log("\nAll debug queries executed successfully!");
  } catch (err) {
    console.error("Query failed during full debug run:", err);
  }
}

runQueries();
