-- Add missing fields to slides that were being dropped on push/pull
ALTER TABLE slides
  ADD COLUMN IF NOT EXISTS "table"           JSONB    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS source            TEXT     NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS notes             TEXT     NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS extra_bullet_boxes JSONB   DEFAULT NULL;
