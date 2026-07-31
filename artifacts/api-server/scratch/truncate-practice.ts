import "dotenv/config";
import { db, practiceSessionsTable, practiceSessionQuestionsTable, practiceSessionAnswersTable, wrongAnswersTable, studyPlansTable, learningRecommendationsTable, assignedTasksTable } from "@workspace/db";

async function main() {
  console.log("Truncating all transactional/attempt and plan tables...");
  
  await db.delete(practiceSessionAnswersTable);
  console.log("- Truncated practice_session_answers");
  
  await db.delete(practiceSessionQuestionsTable);
  console.log("- Truncated practice_session_questions");
  
  await db.delete(practiceSessionsTable);
  console.log("- Truncated practice_sessions");
  
  await db.delete(wrongAnswersTable);
  console.log("- Truncated wrong_answers");
  
  await db.delete(studyPlansTable);
  console.log("- Truncated study_plans");
  
  await db.delete(learningRecommendationsTable);
  console.log("- Truncated learning_recommendations");
  
  await db.delete(assignedTasksTable);
  console.log("- Truncated assigned_tasks");

  console.log("All requested tables truncated. Exiting...");
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
