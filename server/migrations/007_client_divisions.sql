-- Client divisions: some clients have several divisions; selected departments
-- produce their slide set once per division when a deck is generated.
--   divisions      — [{ "id": "...", "name": "..." }]
--   division_depts — department ids that repeat per division
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS divisions      JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS division_depts JSONB NOT NULL DEFAULT '[]';
