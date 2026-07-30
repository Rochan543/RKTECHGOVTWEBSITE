import {
  db,
  studyPlanTemplatesTable,
  userStudyPlanAssignmentsTable,
  studyPlansTable,
  learningRecommendationsTable,
  wrongAnswersTable
} from "../lib/db/src/index";
import { count } from "drizzle-orm";

async function main() {
  try {
    console.log("Testing database connection and fetching stats...");
    
    const [templatesCount] = await db.select({ val: count() }).from(studyPlanTemplatesTable);
    console.log("- Study Plan Templates:", templatesCount?.val);

    const [assignmentsCount] = await db.select({ val: count() }).from(userStudyPlanAssignmentsTable);
    console.log("- User Study Plan Assignments:", assignmentsCount?.val);

    const [plansCount] = await db.select({ val: count() }).from(studyPlansTable);
    console.log("- Study Plans:", plansCount?.val);

    const [recsCount] = await db.select({ val: count() }).from(learningRecommendationsTable);
    console.log("- Learning Recommendations:", recsCount?.val);

    const [wrongCount] = await db.select({ val: count() }).from(wrongAnswersTable);
    console.log("- Wrong Answers (Revision Queue):", wrongCount?.val);

    console.log("All queries executed successfully!");
  } catch (error) {
    console.error("DB check failed:", error);
  }
}

main();
