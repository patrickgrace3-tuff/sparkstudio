-- Market Research decks: admins upload the latest market research PPTX; only the
-- extracted content (titles, bullets, tables) is stored so it can be rebuilt on
-- the standard Spark Studio PowerPoint template by any user.
CREATE TABLE IF NOT EXISTS market_research_decks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT    NOT NULL,
  file_name   TEXT    NOT NULL DEFAULT '',
  slides      JSONB   NOT NULL DEFAULT '[]',
  slide_count INTEGER NOT NULL DEFAULT 0,
  uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS market_research_decks_created ON market_research_decks(created_at DESC);
