import { execSync } from "child_process";
import dotenv from "dotenv";

dotenv.config();

const dbUrl = process.env.DATABASE_URL || process.env.APP_DATABASE_URL;

if (!dbUrl) {
  console.log("No DATABASE_URL or APP_DATABASE_URL found in environment, skipping schema sync.");
  process.exit(0);
}

console.log("Database connection detected. Syncing schema...");
try {
  execSync("pnpm --filter @workspace/db run push-force", { stdio: "inherit" });
} catch (error) {
  console.error("Schema sync failed:", error);
  process.exit(1);
}
