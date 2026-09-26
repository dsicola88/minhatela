-- MinhaTela · Conta enterprise: dispositivos, streams, maturidade, PIN

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS pin_hash TEXT,
  ADD COLUMN IF NOT EXISTS maturity_max SMALLINT NOT NULL DEFAULT 18,
  ADD COLUMN IF NOT EXISTS has_pin BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_maturity_check;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_maturity_check
  CHECK (maturity_max IN (7, 12, 16, 18));

ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS maturity_rating SMALLINT NOT NULL DEFAULT 12;

ALTER TABLE videos
  DROP CONSTRAINT IF EXISTS videos_maturity_check;

ALTER TABLE videos
  ADD CONSTRAINT videos_maturity_check
  CHECK (maturity_rating IN (0, 7, 12, 16, 18));

CREATE TABLE IF NOT EXISTS device_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_key VARCHAR(80) NOT NULL,
  device_name VARCHAR(120) NOT NULL DEFAULT 'Dispositivo',
  platform VARCHAR(40) NOT NULL DEFAULT 'unknown',
  user_agent TEXT,
  ip VARCHAR(64),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, device_key)
);

CREATE INDEX IF NOT EXISTS device_sessions_user_idx
  ON device_sessions(user_id, last_seen_at DESC);

ALTER TABLE playback_sessions
  ADD COLUMN IF NOT EXISTS device_id UUID REFERENCES device_sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_heartbeat_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS playback_sessions_active_user_idx
  ON playback_sessions(user_id, is_active, last_heartbeat_at DESC)
  WHERE is_active = TRUE AND allowed = TRUE;

-- Seed maturidade demo (kids-safe vs adulto)
UPDATE videos SET maturity_rating = 7
WHERE slug IN ('kazukuta-beats', 'sabores-de-luanda')
  AND maturity_rating = 12;

UPDATE videos SET maturity_rating = 16
WHERE slug IN ('o-ultimo-cineasta')
  AND maturity_rating = 12;

UPDATE profiles SET maturity_max = 7
WHERE is_kids = TRUE AND maturity_max = 18;
