import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

// APP_DATABASE_URL allows using an external DB (e.g. Neon) without conflicting
// with Replit's runtime-managed DATABASE_URL.
const connectionString = process.env.APP_DATABASE_URL || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "APP_DATABASE_URL (or DATABASE_URL) must be set. Did you forget to configure a database?",
  );
}

const hasSsl = connectionString.includes("sslmode=require") || connectionString.includes("sslmode=verify-full");
const cleanConnectionString = connectionString
  .replace(/sslmode=[^&]*/g, "")
  .replace(/channel_binding=[^&]*/g, "")
  .replace(/\?&/g, "?")
  .replace(/&&/g, "&")
  .replace(/[&?]$/g, "");

export const pool = new Pool({
  connectionString: cleanConnectionString,
  ssl: hasSsl ? { rejectUnauthorized: false } : undefined,
});
export const db = drizzle(pool, { schema });

export * from "./schema";
