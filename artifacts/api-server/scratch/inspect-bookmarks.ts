import 'dotenv/config';
import { db, bookmarksTable, questionsTable } from '@workspace/db';
import { eq } from 'drizzle-orm';

async function main() {
  console.log("Fetching bookmarks from database...");
  try {
    const bookmarks = await db.select().from(bookmarksTable);
    console.log(`Found ${bookmarks.length} bookmarks raw:`);
    console.table(bookmarks);

    if (bookmarks.length > 0) {
      const joined = await db.select({
        bookmarkId: bookmarksTable.id,
        userId: bookmarksTable.userId,
        questionId: bookmarksTable.questionId,
        questionText: questionsTable.text,
      })
        .from(bookmarksTable)
        .innerJoin(questionsTable, eq(bookmarksTable.questionId, questionsTable.id));
      
      console.log(`Found ${joined.length} joined bookmarks:`);
      console.table(joined);
    }
  } catch (error) {
    console.error("Error fetching bookmarks:", error);
  }
}

main().catch(console.error);

