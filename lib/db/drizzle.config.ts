import { defineConfig } from "drizzle-kit";
import path from "path";

const dbUrl = process.env.DATABASE_URL || process.env.APP_DATABASE_URL;

if (!dbUrl) {
  throw new Error("DATABASE_URL or APP_DATABASE_URL must be set, ensure the database is provisioned");
}

export default defineConfig({
  schema: "./src/schema/index.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: dbUrl,
  },
});
