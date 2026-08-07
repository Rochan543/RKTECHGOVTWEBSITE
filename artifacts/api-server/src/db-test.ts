import { db, examQuestionsTable, examsTable, questionsTable } from "@workspace/db";
import { count, eq } from "drizzle-orm";

async function main() {
  try {
    console.log("Fetching first question from DB...");
    const [q] = await db.select({ id: questionsTable.id }).from(questionsTable).limit(1);
    if (!q) {
      console.log("No questions found in database! Creating a dummy question...");
      // Let's not write a new question if not needed, but check if we have any.
      return;
    }
    console.log("Found question ID:", q.id);

    console.log("Querying examQuestions counts via Drizzle...");
    const qCounts = await db.select({ examId: examQuestionsTable.examId, count: count() })
      .from(examQuestionsTable)
      .groupBy(examQuestionsTable.examId);
    console.log("qCounts result raw:", qCounts);

    if (qCounts.length > 0) {
      console.log("Keys on first result item:", Object.keys(qCounts[0]));
      console.log("Types on first result item:", {
        examId: typeof qCounts[0].examId,
        count: typeof qCounts[0].count,
        countVal: qCounts[0].count
      });
    }

    const qCountMap = new Map(qCounts.map(item => [item.examId, Number(item.count)]));
    console.log("qCountMap mapping:", Array.from(qCountMap.entries()));

  } catch (error) {
    console.error("Drizzle query failed:", error);
  }
}

main().catch(console.error);
