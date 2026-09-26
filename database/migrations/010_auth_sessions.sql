-- MinhaTela · Auth sessions + refresh tokens (enterprise)

CREATE TABLE IF NOT EXISTS auth_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL,
  device_name VARCHAR(120) NOT NULL DEFAULT 'Dispositivo',
  platform VARCHAR(40) NOT NULL DEFAULT 'unknown',
  ip VARCHAR(64),
  user_agent TEXT,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS auth_sessions_user_idx
  ON auth_sessions(user_id, last_seen_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS auth_sessions_refresh_uidx
  ON auth_sessions(refresh_token_hash)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS auth_sessions_active_idx
  ON auth_sessions(user_id)
  WHERE revoked_at IS NULL;
