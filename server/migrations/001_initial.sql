-- SparkStudio database schema

-- ── Users (auth) ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id         SERIAL PRIMARY KEY,
  email      TEXT UNIQUE NOT NULL,
  name       TEXT NOT NULL,
  password   TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'user', -- 'admin' | 'user'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Clients ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clients (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Working slides (live editable per dept) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS slides (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id  UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  dept_id    TEXT NOT NULL,
  title      TEXT NOT NULL DEFAULT '',
  body       TEXT NOT NULL DEFAULT '',
  bullets    JSONB NOT NULL DEFAULT '[]',
  style      JSONB NOT NULL DEFAULT '{}',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS slides_client_dept ON slides(client_id, dept_id);

-- ── Presentation versions (generated decks) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS presentations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id      UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  version_label  TEXT NOT NULL DEFAULT '',
  title          TEXT NOT NULL DEFAULT '',
  deck           JSONB NOT NULL DEFAULT '{}',  -- full generated deck JSON
  created_by     INTEGER REFERENCES users(id),
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, version_number)
);
CREATE INDEX IF NOT EXISTS presentations_client ON presentations(client_id, version_number DESC);

-- ── Templates ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  departments JSONB NOT NULL DEFAULT '{}',
  created_by  INTEGER REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Files metadata ────────────────────────────────────────────────────────────
-- Stores file content as JSONB (base64 for uploads). For large deployments
-- migrate to object storage (S3/R2) and store only the URL here.
CREATE TABLE IF NOT EXISTS files (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id  UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  dept_id    TEXT,  -- NULL means global file
  name       TEXT NOT NULL,
  type       TEXT NOT NULL,  -- 'word' | 'excel' | 'upload' | 'link'
  content    JSONB NOT NULL DEFAULT '{}',
  folder_id  UUID,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS files_client_dept ON files(client_id, dept_id);
