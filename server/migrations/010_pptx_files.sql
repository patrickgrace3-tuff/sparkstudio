-- Original PowerPoint files of slides imported with "Keep original styling",
-- stored as-is in pieces (so no single upload or row gets too large). Shared
-- like shared_assets: a template made from an imported slide uses the same file.
CREATE TABLE IF NOT EXISTS pptx_file_chunks (
  file_key   TEXT    NOT NULL,
  idx        INTEGER NOT NULL,
  data       BYTEA   NOT NULL,
  created_by INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (file_key, idx)
);
