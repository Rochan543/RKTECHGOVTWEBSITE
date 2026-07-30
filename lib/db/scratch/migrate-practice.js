import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();
const { Pool } = pg;

const connectionString = process.env.APP_DATABASE_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const hasSsl = connectionString.includes("sslmode=require") || connectionString.includes("sslmode=verify-full");
const cleanConnectionString = connectionString
  .replace(/sslmode=[^&]*/g, "")
  .replace(/channel_binding=[^&]*/g, "")
  .replace(/\?&/g, "?")
  .replace(/&&/g, "&")
  .replace(/[&?]$/g, "");

const pool = new Pool({
  connectionString: cleanConnectionString,
  ssl: hasSsl ? { rejectUnauthorized: false } : undefined,
});

const ddl = `
-- Drop existing tables if any (safe rebuild)
DROP TABLE IF EXISTS practice_collections CASCADE;
DROP TABLE IF EXISTS wrong_answers CASCADE;
DROP TABLE IF EXISTS practice_session_answers CASCADE;
DROP TABLE IF EXISTS practice_session_questions CASCADE;
DROP TABLE IF EXISTS practice_sessions CASCADE;

-- Recreate practice_sessions
CREATE TABLE practice_sessions (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('timed', 'untimed', 'random', 'difficulty', 'pyq', 'bookmarks', 'wrong_answers', 'collection', 'topic', 'subject')),
  subject_id INT REFERENCES subjects(id) ON DELETE SET NULL,
  topic_id INT REFERENCES topics(id) ON DELETE SET NULL,
  collection_id INT REFERENCES question_collections(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'paused', 'completed', 'abandoned')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  score REAL NOT NULL DEFAULT 0,
  accuracy REAL NOT NULL DEFAULT 0,
  time_taken_seconds INT NOT NULL DEFAULT 0,
  total_questions INT NOT NULL DEFAULT 0,
  current_question_index INT NOT NULL DEFAULT 0
);

CREATE INDEX practice_sessions_user_id_idx ON practice_sessions(user_id);
CREATE INDEX practice_sessions_status_idx ON practice_sessions(status);

-- Create practice_session_questions
CREATE TABLE practice_session_questions (
  id SERIAL PRIMARY KEY,
  session_id INT NOT NULL REFERENCES practice_sessions(id) ON DELETE CASCADE,
  question_id INT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  display_order INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT practice_session_questions_unique UNIQUE (session_id, question_id)
);

CREATE INDEX practice_session_questions_session_id_idx ON practice_session_questions(session_id);
CREATE INDEX practice_session_questions_question_id_idx ON practice_session_questions(question_id);

-- Create practice_session_answers
CREATE TABLE practice_session_answers (
  id SERIAL PRIMARY KEY,
  session_id INT NOT NULL REFERENCES practice_sessions(id) ON DELETE CASCADE,
  question_id INT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  selected_option_id INT REFERENCES question_options(id) ON DELETE SET NULL,
  is_correct BOOLEAN NOT NULL DEFAULT FALSE,
  time_taken_seconds INT NOT NULL DEFAULT 0,
  flagged BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'unvisited' CHECK (status IN ('unvisited', 'visited', 'answered', 'skipped')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT practice_session_answers_unique UNIQUE (session_id, question_id)
);

CREATE INDEX practice_session_answers_session_id_idx ON practice_session_answers(session_id);
CREATE INDEX practice_session_answers_question_id_idx ON practice_session_answers(question_id);

-- Create wrong_answers (with sourceType and sourceId)
CREATE TABLE wrong_answers (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id INT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  attempt_count INT NOT NULL DEFAULT 1,
  last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_type TEXT NOT NULL DEFAULT 'practice' CHECK (source_type IN ('practice', 'mock_test', 'exam')),
  source_id INT,
  CONSTRAINT wrong_answers_unique UNIQUE (user_id, question_id)
);

CREATE INDEX wrong_answers_user_id_idx ON wrong_answers(user_id);
CREATE INDEX wrong_answers_question_id_idx ON wrong_answers(question_id);

-- Create practice_collections
CREATE TABLE practice_collections (
  id SERIAL PRIMARY KEY,
  collection_id INT NOT NULL REFERENCES question_collections(id) ON DELETE CASCADE,
  available_for_practice BOOLEAN NOT NULL DEFAULT FALSE,
  is_visible BOOLEAN NOT NULL DEFAULT TRUE,
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  difficulty TEXT NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  estimated_time_minutes INT NOT NULL DEFAULT 15,
  CONSTRAINT practice_collections_unique_col UNIQUE (collection_id)
);

CREATE INDEX practice_collections_collection_id_idx ON practice_collections(collection_id);
`;

async function main() {
  console.log("Starting DB rebuild migration for Practice Hub...");
  const client = await pool.connect();
  try {
    await client.query(ddl);
    console.log("Migration executed successfully. Normalized tables created.");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
