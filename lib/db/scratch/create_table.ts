import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function run() {
  const { pool } = await import("../src/index");
  console.log("Running migration query...");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    
    // Create the exam_collections table
    await client.query(`
      CREATE TABLE IF NOT EXISTS exam_collections (
        id SERIAL PRIMARY KEY,
        exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
        collection_id INTEGER NOT NULL REFERENCES question_collections(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        CONSTRAINT exam_collections_unique UNIQUE (exam_id, collection_id)
      );
    `);
    
    // Create indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS exam_collections_exam_id_idx ON exam_collections(exam_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS exam_collections_collection_id_idx ON exam_collections(collection_id);
    `);
    
    await client.query("COMMIT");
    console.log("Migration completed successfully!");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
