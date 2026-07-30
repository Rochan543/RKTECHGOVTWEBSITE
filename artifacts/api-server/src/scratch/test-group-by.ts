import {
  db,
  wrongAnswersTable,
  bookmarksTable
} from "@workspace/db";
import { count, sql } from "drizzle-orm";

async function main() {
  try {
    console.log("Testing group-by queries...");
    
    console.log("\n1. Querying wrongAnswersTable grouped by user_id...");
    const wrongCounts = await db
      .select({ userId: wrongAnswersTable.userId, val: count() })
      .from(wrongAnswersTable)
      .groupBy(wrongAnswersTable.userId);
    console.log("Result wrongCounts:", wrongCounts);

    console.log("\n2. Querying bookmarksTable grouped by user_id...");
    const bookmarkCounts = await db
      .select({ userId: bookmarksTable.userId, val: count() })
      .from(bookmarksTable)
      .groupBy(bookmarksTable.userId);
    console.log("Result bookmarkCounts:", bookmarkCounts);

    console.log("\n3. Querying overdue wrongAnswersTable grouped by user_id...");
    const threeDaysAgoForOverdue = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const overdueCounts = await db
      .select({ userId: wrongAnswersTable.userId, val: count() })
      .from(wrongAnswersTable)
      .where(sql`${wrongAnswersTable.lastAttemptAt} < ${threeDaysAgoForOverdue}`)
      .groupBy(wrongAnswersTable.userId);
    console.log("Result overdueCounts:", overdueCounts);

    console.log("All test group-by queries passed successfully!");
  } catch (error) {
    console.error("Test group-by query failed:", error);
  }
}

main();
