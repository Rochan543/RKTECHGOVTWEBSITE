import "dotenv/config";
import { db, wrongAnswersTable } from "@workspace/db";

async function main() {
  console.log("Truncating wrong_answers table...");
  await db.delete(wrongAnswersTable);
  console.log("Done truncating. Exiting...");
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
