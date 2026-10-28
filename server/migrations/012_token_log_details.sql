-- More detail per AI call, so cost estimates can match the Anthropic bill:
-- prompt-cache tokens (billed at different rates) and which API key was used.
ALTER TABLE token_logs ADD COLUMN IF NOT EXISTS cache_write_tokens INTEGER NOT NULL DEFAULT 0;
ALTER TABLE token_logs ADD COLUMN IF NOT EXISTS cache_read_tokens  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE token_logs ADD COLUMN IF NOT EXISTS key_slot           SMALLINT;
CREATE INDEX IF NOT EXISTS token_logs_user ON token_logs(user_id);
