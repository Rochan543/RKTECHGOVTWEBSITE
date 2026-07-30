import { db } from "../src/index.ts";
import { sql } from "drizzle-orm";

async function main() {
  try {
    console.log("Creating tables using raw SQL...");

    // 1. learning_recommendations table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "learning_recommendations" (
        "id" serial PRIMARY KEY,
        "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "type" text NOT NULL,
        "entity_id" integer NOT NULL,
        "score" real NOT NULL DEFAULT 0,
        "reason" text NOT NULL,
        "generated_at" timestamp with time zone NOT NULL DEFAULT now()
      );
    `);
    console.log("Table learning_recommendations created.");

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "learning_recs_user_id_idx" ON "learning_recommendations" ("user_id");
    `);
    console.log("Index learning_recs_user_id_idx created.");

    // 2. study_plans table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "study_plans" (
        "id" serial PRIMARY KEY,
        "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "date" text NOT NULL,
        "status" text NOT NULL DEFAULT 'pending',
        "tasks" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "generated_at" timestamp with time zone NOT NULL DEFAULT now()
      );
    `);
    console.log("Table study_plans created.");

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "study_plans_user_id_idx" ON "study_plans" ("user_id");
    `);
    console.log("Index study_plans_user_id_idx created.");

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "study_plans_date_idx" ON "study_plans" ("date");
    `);
    console.log("Index study_plans_date_idx created.");

    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS "study_plans_user_date_unique" ON "study_plans" ("user_id", "date");
    `);
    console.log("Unique index study_plans_user_date_unique created.");

    console.log("All tables created successfully!");

  } catch (err: any) {
    console.error("Failed to run SQL migrations:", err.message || err);
  }
  process.exit(0);
}

main();
