-- MinhaTela · Fase 22: Não tenho interesse · Marcar visto · Saltar recap · Qualidade · Login alerts · Originais · Para si

ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS recap_end_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS is_original BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS preferred_quality VARCHAR(10) NOT NULL DEFAULT 'auto'
    CHECK (preferred_quality IN ('auto', '480p', '720p', '1080p')),
  ADD COLUMN IF NOT EXISTS wifi_only_downloads BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS login_alerts BOOLEAN NOT NULL DEFAULT TRUE;

-- Preferências por título (não tenho interesse / visto forçado)
CREATE TABLE IF NOT EXISTS title_preferences (
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  not_interested BOOLEAN NOT NULL DEFAULT FALSE,
  marked_watched BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (profile_id, content_id)
);

CREATE INDEX IF NOT EXISTS title_prefs_not_interested_idx
  ON title_preferences(profile_id)
  WHERE not_interested = TRUE;

-- Alertas de novo login / dispositivo
CREATE TABLE IF NOT EXISTS login_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id UUID,
  device_name VARCHAR(120),
  platform VARCHAR(40),
  ip VARCHAR(64),
  user_agent TEXT,
  notified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS login_alerts_user_idx
  ON login_alerts(user_id, created_at DESC);

INSERT INTO feature_flags (key, enabled, description, payload) VALUES
  ('not_interested_enabled', TRUE, 'Não tenho interesse / filtrar recs', '{}'),
  ('skip_recap_enabled', TRUE, 'Saltar recap em episódios', '{}'),
  ('originals_row_enabled', TRUE, 'Fila Originais MinhaTela', '{}'),
  ('login_alerts_enabled', TRUE, 'Alertas de novo login', '{}'),
  ('for_you_hub_enabled', TRUE, 'Hub Para si', '{}')
ON CONFLICT (key) DO NOTHING;

-- Seed: marcar alguns títulos AO como Originais MinhaTela
UPDATE videos
SET is_original = TRUE
WHERE country_code = 'AO'
  AND kind IN ('movie', 'series')
  AND is_published = TRUE
  AND is_original = FALSE;

-- Seed recap em episódios com intro (recap termina um pouco depois da intro)
UPDATE videos
SET recap_end_seconds = GREATEST(COALESCE(intro_end_seconds, 0) + 25, 45)
WHERE kind = 'episode'
  AND COALESCE(intro_end_seconds, 0) > 0
  AND recap_end_seconds IS NULL
  AND COALESCE(duration_seconds, 0) > 180;
