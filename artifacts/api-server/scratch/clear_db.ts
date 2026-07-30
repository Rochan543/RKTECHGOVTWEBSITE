import 'dotenv/config';
import { db } from '@workspace/db';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('Truncating wrong_answers table to allow unique constraint push...');
  try {
    await db.execute(sql`TRUNCATE TABLE wrong_answers CASCADE;`);
    await db.execute(sql`TRUNCATE TABLE study_plans CASCADE;`);
    await db.execute(sql`TRUNCATE TABLE current_affair_quiz_questions CASCADE;`);
    await db.execute(sql`TRUNCATE TABLE current_affair_quiz_attempts CASCADE;`);
    await db.execute(sql`TRUNCATE TABLE current_affair_quizzes CASCADE;`);
    await db.execute(sql`TRUNCATE TABLE results CASCADE;`);
    await db.execute(sql`TRUNCATE TABLE test_sessions CASCADE;`);
    await db.execute(sql`TRUNCATE TABLE practice_sessions CASCADE;`);
    console.log('Truncation complete!');
  } catch (err) {
    console.error('Error during truncation:', err);
  }
  process.exit(0);
}

main();
