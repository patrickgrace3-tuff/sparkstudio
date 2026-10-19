-- Large shared data that isn't tied to one client, e.g. the original
-- PowerPoint parts of imported slides saved to a template (usable by every
-- client the template is applied to).
CREATE TABLE IF NOT EXISTS shared_assets (
  asset_key  TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  created_by INTEGER,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
