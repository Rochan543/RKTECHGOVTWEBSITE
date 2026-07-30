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
    console.log("Starting debug queries execution...");

    console.log("\n1. Seeding templates...");
    // Let's copy the seeding count check
    const countRes = await db.select({ val: count() }).from(studyPlanTemplatesTable);
    console.log("Template count:", countRes[0]?.val);

    console.log("\n2. Querying low accuracy students...");
    const lowAccuracyStudents = await db
      .select({
        id: usersTable.id,
        avgAccuracy: sql<number>`avg(${resultsTable.accuracy})::real`,
      })
      .from(resultsTable)
      .innerJoin(usersTable, eq(resultsTable.userId, usersTable.id))
      .groupBy(usersTable.id)
      .limit(10);
    console.log("Low accuracy students count:", lowAccuracyStudents.length);

    console.log("\n3. Querying difficult topics...");
    const difficultTopics = await db
      .select({
        topicId: questionsTable.topicId,
      })
      .from(practiceSessionAnswersTable)
      .innerJoin(questionsTable, eq(practiceSessionAnswersTable.questionId, questionsTable.id))
      .where(eq(practiceSessionAnswersTable.status, "answered"))
      .groupBy(questionsTable.topicId)
      .limit(10);
    console.log("Difficult topics count:", difficultTopics.length);

    console.log("\n4. Querying low completion collections...");
    const lowCompletionCollections = await db
      .select({
        id: questionCollectionsTable.id,
      })
      .from(practiceSessionsTable)
      .innerJoin(questionCollectionsTable, eq(practiceSessionsTable.collectionId, questionCollectionsTable.id))
      .groupBy(questionCollectionsTable.id)
      .limit(10);
    console.log("Low completion collections count:", lowCompletionCollections.length);

    console.log("\n5. Querying templates list...");
    const templates = await db.select().from(studyPlanTemplatesTable);
    console.log(`Fetched ${templates.length} templates. Running template loops...`);
    for (const t of templates) {
      console.log(`- Template ID ${t.id} ("${t.title}"):`);
      const assignedUsers = await db
        .select({ userId: userStudyPlanAssignmentsTable.userId })
        .from(userStudyPlanAssignmentsTable)
        .where(eq(userStudyPlanAssignmentsTable.templateId, t.id));
      
      const studentsCount = assignedUsers.length;
      console.log(`  Assigned students: ${studentsCount}`);
      let completionRate = 0;

      if (studentsCount > 0) {
        const userIds = assignedUsers.map(u => u.userId);
        console.log(`  Querying plans for userIds:`, userIds);
        const plans = await db
          .select()
          .from(studyPlansTable)
          .where(inArray(studyPlansTable.userId, userIds));

        console.log(`  Plans count: ${plans.length}`);
        let totalTasks = 0;
        let completedTasks = 0;

        for (const plan of plans) {
          const tasks = (plan.tasks || []) as any[];
          for (const task of tasks) {
            if (task && typeof task.id === "string" && task.id.startsWith(`template_${t.id}`)) {
              totalTasks++;
              if (task.status === "completed") {
                completedTasks++;
              }
            }
          }
        }
        console.log(`  Tasks total: ${totalTasks}, completed: ${completedTasks}`);
        if (totalTasks > 0) {
          completionRate = Math.round((completedTasks * 100) / totalTasks);
        }
      }
      console.log(`  Completion rate: ${completionRate}%`);
    }

    console.log("\nQueries run completed successfully!");
  } catch (err) {
    console.error("Query failed during run:", err);
  }
}

runQueries();
