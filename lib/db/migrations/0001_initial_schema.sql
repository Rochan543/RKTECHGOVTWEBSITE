-- Migration: Initial Schema
-- Generated from Drizzle ORM schema definitions
-- Apply with: psql $DATABASE_URL -f lib/db/migrations/0001_initial_schema.sql

-- ─── Users ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "users" (
  "id"                      SERIAL PRIMARY KEY,
  "name"                    TEXT NOT NULL,
  "email"                   TEXT NOT NULL UNIQUE,
  "password_hash"           TEXT NOT NULL,
  "role"                    TEXT NOT NULL DEFAULT 'student'
                              CHECK (role IN ('student','admin','super_admin')),
  "status"                  TEXT NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active','suspended')),
  "phone"                   TEXT,
  "avatar_url"              TEXT,
  "rank"                    INTEGER,
  "total_score"             REAL DEFAULT 0,
  "reset_token"             TEXT,
  "reset_token_expires_at"  TIMESTAMPTZ,
  "created_at"              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Exam Categories ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "exam_categories" (
  "id"          SERIAL PRIMARY KEY,
  "name"        TEXT NOT NULL,
  "slug"        TEXT NOT NULL UNIQUE,
  "description" TEXT,
  "icon_url"    TEXT,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Subjects & Topics ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "subjects" (
  "id"          SERIAL PRIMARY KEY,
  "name"        TEXT NOT NULL UNIQUE,
  "description" TEXT,
  "icon_url"    TEXT,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "topics" (
  "id"         SERIAL PRIMARY KEY,
  "name"       TEXT NOT NULL,
  "subject_id" INTEGER NOT NULL REFERENCES "subjects"("id"),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Questions ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "questions" (
  "id"              SERIAL PRIMARY KEY,
  "text"            TEXT NOT NULL,
  "type"            TEXT NOT NULL DEFAULT 'single_choice'
                      CHECK (type IN ('single_choice','multiple_choice','true_false','integer','numerical')),
  "difficulty"      TEXT NOT NULL DEFAULT 'medium'
                      CHECK (difficulty IN ('easy','medium','hard')),
  "explanation"     TEXT,
  "hint"            TEXT,
  "image_url"       TEXT,
  "positive_marks"  REAL NOT NULL DEFAULT 1,
  "negative_marks"  REAL NOT NULL DEFAULT 0,
  "subject_id"      INTEGER NOT NULL REFERENCES "subjects"("id"),
  "topic_id"        INTEGER NOT NULL REFERENCES "topics"("id"),
  "created_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "question_options" (
  "id"          SERIAL PRIMARY KEY,
  "question_id" INTEGER NOT NULL REFERENCES "questions"("id") ON DELETE CASCADE,
  "text"        TEXT NOT NULL,
  "is_correct"  BOOLEAN NOT NULL DEFAULT FALSE,
  "order"       INTEGER DEFAULT 1
);

-- ─── Exams ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "exams" (
  "id"                     SERIAL PRIMARY KEY,
  "title"                  TEXT NOT NULL,
  "description"            TEXT,
  "type"                   TEXT NOT NULL DEFAULT 'full_mock'
                             CHECK (type IN ('full_mock','mini_mock','topic_test','chapter_test','daily_quiz','weekly_quiz','pyq','sectional')),
  "status"                 TEXT NOT NULL DEFAULT 'draft'
                             CHECK (status IN ('draft','published','archived')),
  "duration_minutes"       INTEGER NOT NULL DEFAULT 60,
  "total_marks"            REAL NOT NULL DEFAULT 100,
  "positive_marks"         REAL NOT NULL DEFAULT 2,
  "negative_marks"         REAL NOT NULL DEFAULT 0.5,
  "category_id"            INTEGER REFERENCES "exam_categories"("id"),
  "scheduled_at"           TIMESTAMPTZ,
  "ends_at"                TIMESTAMPTZ,
  "timezone"               TEXT DEFAULT 'UTC',
  "question_timer_seconds" INTEGER,
  "auto_submit"            BOOLEAN NOT NULL DEFAULT TRUE,
  "auto_save"              BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at"             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "exam_sections" (
  "id"               SERIAL PRIMARY KEY,
  "exam_id"          INTEGER NOT NULL REFERENCES "exams"("id") ON DELETE CASCADE,
  "name"             TEXT NOT NULL,
  "duration_minutes" INTEGER,
  "order"            INTEGER NOT NULL DEFAULT 1,
  "subject_id"       INTEGER REFERENCES "subjects"("id"),
  "is_mandatory"     BOOLEAN NOT NULL DEFAULT TRUE,
  "positive_marks"   REAL,
  "negative_marks"   REAL,
  "navigation_rule"  TEXT NOT NULL DEFAULT 'lock_previous'
                       CHECK (navigation_rule IN ('lock_previous','allow_previous')),
  "auto_move"        BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "exam_questions" (
  "id"          SERIAL PRIMARY KEY,
  "exam_id"     INTEGER NOT NULL REFERENCES "exams"("id") ON DELETE CASCADE,
  "section_id"  INTEGER REFERENCES "exam_sections"("id"),
  "question_id" INTEGER NOT NULL REFERENCES "questions"("id"),
  "order"       INTEGER NOT NULL DEFAULT 1
);

-- ─── Sessions ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "test_sessions" (
  "id"                     SERIAL PRIMARY KEY,
  "user_id"                INTEGER NOT NULL REFERENCES "users"("id"),
  "exam_id"                INTEGER NOT NULL REFERENCES "exams"("id"),
  "status"                 TEXT NOT NULL DEFAULT 'in_progress'
                             CHECK (status IN ('in_progress','submitted','auto_submitted','abandoned')),
  "current_question_index" INTEGER DEFAULT 0,
  "current_section_index"  INTEGER DEFAULT 0,
  "started_at"             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "submitted_at"           TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS "session_answers" (
  "id"                 SERIAL PRIMARY KEY,
  "session_id"         INTEGER NOT NULL REFERENCES "test_sessions"("id") ON DELETE CASCADE,
  "question_id"        INTEGER NOT NULL REFERENCES "questions"("id"),
  "selected_option_id" INTEGER REFERENCES "question_options"("id"),
  "status"             TEXT NOT NULL DEFAULT 'not_visited'
                         CHECK (status IN ('not_visited','visited','answered','marked','marked_answered')),
  "time_spent_seconds" INTEGER DEFAULT 0,
  "updated_at"         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "results" (
  "id"                 SERIAL PRIMARY KEY,
  "session_id"         INTEGER NOT NULL REFERENCES "test_sessions"("id"),
  "user_id"            INTEGER NOT NULL REFERENCES "users"("id"),
  "exam_id"            INTEGER NOT NULL REFERENCES "exams"("id"),
  "score"              REAL NOT NULL DEFAULT 0,
  "total_marks"        REAL NOT NULL,
  "correct"            INTEGER DEFAULT 0,
  "incorrect"          INTEGER DEFAULT 0,
  "skipped"            INTEGER DEFAULT 0,
  "time_taken_seconds" INTEGER DEFAULT 0,
  "accuracy"           REAL NOT NULL DEFAULT 0,
  "rank"               INTEGER,
  "percentile"         REAL,
  "created_at"         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "violations" (
  "id"         SERIAL PRIMARY KEY,
  "session_id" INTEGER NOT NULL REFERENCES "test_sessions"("id") ON DELETE CASCADE,
  "user_id"    INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "type"       TEXT NOT NULL
                 CHECK (type IN ('tab_switch','window_blur','fullscreen_exit','context_menu','copy_attempt')),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Content ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "notes" (
  "id"              SERIAL PRIMARY KEY,
  "title"           TEXT NOT NULL,
  "description"     TEXT,
  "type"            TEXT NOT NULL DEFAULT 'pdf'
                      CHECK (type IN ('pdf','docx','ppt','image','video')),
  "file_url"        TEXT NOT NULL,
  "thumbnail_url"   TEXT,
  "size"            INTEGER NOT NULL DEFAULT 0,
  "subject_id"      INTEGER REFERENCES "subjects"("id"),
  "category_id"     INTEGER REFERENCES "exam_categories"("id"),
  "download_count"  INTEGER DEFAULT 0,
  "created_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "notifications" (
  "id"         SERIAL PRIMARY KEY,
  "user_id"    INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "title"      TEXT NOT NULL,
  "body"       TEXT NOT NULL,
  "type"       TEXT NOT NULL DEFAULT 'system'
                 CHECK (type IN ('exam_result','new_exam','announcement','achievement','system')),
  "is_read"    BOOLEAN NOT NULL DEFAULT FALSE,
  "link"       TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "bookmarks" (
  "id"          SERIAL PRIMARY KEY,
  "user_id"     INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "question_id" INTEGER NOT NULL REFERENCES "questions"("id") ON DELETE CASCADE,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("user_id", "question_id")
);

CREATE TABLE IF NOT EXISTS "current_affairs" (
  "id"             SERIAL PRIMARY KEY,
  "title"          TEXT NOT NULL,
  "content"        TEXT NOT NULL,
  "category"       TEXT NOT NULL DEFAULT 'current_affairs'
                     CHECK (category IN ('gk','current_affairs','gs_news')),
  "image_url"      TEXT,
  "published_date" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "created_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "achievements" (
  "id"          SERIAL PRIMARY KEY,
  "user_id"     INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "type"        TEXT NOT NULL,
  "title"       TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "xp"          INTEGER NOT NULL DEFAULT 0,
  "unlocked_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("user_id", "type")
);

CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id"         SERIAL PRIMARY KEY,
  "user_id"    INTEGER REFERENCES "users"("id") ON DELETE SET NULL,
  "action"     TEXT NOT NULL,
  "entity"     TEXT NOT NULL,
  "entity_id"  INTEGER,
  "details"    TEXT,
  "ip_address" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── File Uploads ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "file_uploads" (
  "id"          SERIAL PRIMARY KEY,
  "file_url"    TEXT NOT NULL,
  "public_id"   TEXT NOT NULL,
  "file_name"   TEXT NOT NULL,
  "mime_type"   TEXT NOT NULL,
  "file_size"   INTEGER NOT NULL,
  "uploaded_by" INTEGER REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_questions_subject   ON questions(subject_id);
CREATE INDEX IF NOT EXISTS idx_questions_topic     ON questions(topic_id);
CREATE INDEX IF NOT EXISTS idx_exam_questions_exam ON exam_questions(exam_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user       ON test_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_exam       ON test_sessions(exam_id);
CREATE INDEX IF NOT EXISTS idx_answers_session     ON session_answers(session_id);
CREATE INDEX IF NOT EXISTS idx_results_user        ON results(user_id);
CREATE INDEX IF NOT EXISTS idx_results_exam        ON results(exam_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user  ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_ca_published        ON current_affairs(published_date DESC);
CREATE INDEX IF NOT EXISTS idx_file_uploads_user   ON file_uploads(uploaded_by);
