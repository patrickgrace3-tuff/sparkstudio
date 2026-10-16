-- Slides created from a template for a client with divisions are tagged with
-- the division they belong to, so generation uses that division's files.
ALTER TABLE slides
  ADD COLUMN IF NOT EXISTS division_id TEXT DEFAULT NULL;
