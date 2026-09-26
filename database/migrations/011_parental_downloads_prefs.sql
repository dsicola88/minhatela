-- MinhaTela · Fase 13: parental blocks · offline downloads · playback prefs

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS autoplay_next BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS autoplay_previews BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS data_saver_default BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS profile_blocked_titles (
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  blocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  blocked_by UUID REFERENCES users(id) ON DELETE SET NULL,
  PRIMARY KEY (profile_id, content_id)
);

CREATE INDEX IF NOT EXISTS profile_blocked_titles_content_idx
  ON profile_blocked_titles(content_id);

CREATE TABLE IF NOT EXISTS download_licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  device_key VARCHAR(80) NOT NULL,
  device_name VARCHAR(120) NOT NULL DEFAULT 'Dispositivo',
  platform VARCHAR(40) NOT NULL DEFAULT 'unknown',
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'revoked', 'expired', 'consumed')),
  quality VARCHAR(20) NOT NULL DEFAULT '720p',
  expires_at TIMESTAMPTZ NOT NULL,
  downloaded_at TIMESTAMPTZ,
  last_played_at TIMESTAMPTZ,
  play_count INT NOT NULL DEFAULT 0,
  max_plays INT NOT NULL DEFAULT 50,
  bunny_video_id VARCHAR(80),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (profile_id, content_id, device_key)
);

CREATE INDEX IF NOT EXISTS download_licenses_user_active_idx
  ON download_licenses(user_id, status, expires_at)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS download_licenses_profile_idx
  ON download_licenses(profile_id, created_at DESC);

COMMENT ON TABLE download_licenses IS
  'Licenças offline MinhaTela — URL assinada só via API; cliente nunca vê Bunny API key';
