-- Slide limit requests: users ask admins for permission to exceed the 5-slide default

CREATE TABLE IF NOT EXISTS slide_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id       UUID    NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  requested_limit INTEGER NOT NULL DEFAULT 10,
  note            TEXT    NOT NULL DEFAULT '',
  status          TEXT    NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected'
  approved_limit  INTEGER,                            -- set by admin on approval
  reviewed_by     INTEGER REFERENCES users(id),
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS slide_requests_user_client ON slide_requests(user_id, client_id);
CREATE INDEX IF NOT EXISTS slide_requests_status      ON slide_requests(status);
