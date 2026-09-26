-- 003 · Password recovery + watch progress indexes

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  request_ip VARCHAR(64),
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS password_reset_user_idx
  ON password_reset_tokens(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS password_reset_expires_idx
  ON password_reset_tokens(expires_at);

CREATE INDEX IF NOT EXISTS watch_progress_updated_idx
  ON watch_progress(profile_id, updated_at DESC);

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
