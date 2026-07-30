import 'dotenv/config';
import { db } from '@workspace/db';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('Running raw SQL migrations...');

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS study_plan_templates (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
      duration_days INTEGER NOT NULL,
      tasks JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
    );
  `);
  console.log('Created study_plan_templates table.');

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS user_study_plan_assignments (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      template_id INTEGER NOT NULL REFERENCES study_plan_templates(id) ON DELETE CASCADE,
      assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
    );
  `);
  console.log('Created user_study_plan_assignments table.');

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS assigned_tasks (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK (type IN ('collection', 'topic', 'practice_set')),
      entity_id INTEGER NOT NULL,
      assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed'))
    );
  `);
  console.log('Created assigned_tasks table.');

  await db.execute(sql`CREATE INDEX IF NOT EXISTS user_study_plan_assignments_user_idx ON user_study_plan_assignments(user_id);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS user_study_plan_assignments_template_idx ON user_study_plan_assignments(template_id);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS assigned_tasks_user_id_idx ON assigned_tasks(user_id);`);
  console.log('Created indexes.');

  console.log('Migrations completed successfully!');
}

main().catch(console.error);
