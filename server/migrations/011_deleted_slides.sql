-- Slides deleted from Submit Slides, kept for 5 days so an admin can restore
-- them (older rows are removed automatically).
CREATE TABLE IF NOT EXISTS deleted_slides (
  id          TEXT PRIMARY KEY,
  client_id   TEXT NOT NULL,
  dept_id     TEXT NOT NULL,
  slide       JSONB NOT NULL,
  deleted_by  INTEGER,
  deleted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS deleted_slides_deleted_at ON deleted_slides (deleted_at);
