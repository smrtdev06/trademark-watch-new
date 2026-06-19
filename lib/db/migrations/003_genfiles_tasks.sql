-- Genfiles PDF task tracking (phonetic assessment integration)
CREATE TABLE IF NOT EXISTS genfiles_tasks (
  id               SERIAL PRIMARY KEY,
  external_task_id TEXT NOT NULL UNIQUE,
  user_id          INTEGER NOT NULL REFERENCES users(id),
  keyword          TEXT,
  appnos           JSONB NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending',
  pdf_urls         JSONB,
  local_paths      JSONB,
  created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_genfiles_tasks_user_id ON genfiles_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_genfiles_tasks_external_id ON genfiles_tasks(external_task_id);
