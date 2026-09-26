-- MinhaTela · Fase 24: dispositivos de confiança · PIN no play · A/B · pesquisas em alta · pós-créditos

ALTER TABLE device_sessions
  ADD COLUMN IF NOT EXISTS is_trusted BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS trusted_at TIMESTAMPTZ;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS require_pin_on_play BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS post_credits_start_seconds INTEGER;

-- Experiências A/B
CREATE TABLE IF NOT EXISTS experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(80) NOT NULL UNIQUE,
  name VARCHAR(160) NOT NULL,
  description TEXT,
  variants JSONB NOT NULL DEFAULT '["control","treatment"]'::jsonb,
  traffic_percent INT NOT NULL DEFAULT 100 CHECK (traffic_percent BETWEEN 0 AND 100),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS experiment_assignments (
  experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  variant VARCHAR(40) NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (experiment_id, user_id)
);

CREATE INDEX IF NOT EXISTS experiment_assignments_user_idx
  ON experiment_assignments(user_id);

-- Pesquisas em alta (Angola)
CREATE TABLE IF NOT EXISTS search_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  query VARCHAR(200) NOT NULL,
  results_count INT NOT NULL DEFAULT 0,
  market VARCHAR(10) NOT NULL DEFAULT 'AO',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS search_events_created_idx
  ON search_events(created_at DESC);
CREATE INDEX IF NOT EXISTS search_events_query_idx
  ON search_events(lower(query), created_at DESC);

INSERT INTO feature_flags (key, enabled, description, payload) VALUES
  ('trusted_devices_enabled', TRUE, 'Dispositivos de confiança', '{}'),
  ('pin_on_play_enabled', TRUE, 'PIN obrigatório no play', '{}'),
  ('experiments_enabled', TRUE, 'Experiências A/B', '{}'),
  ('trending_search_enabled', TRUE, 'Pesquisas em alta AO', '{}'),
  ('post_credits_enabled', TRUE, 'Cenas pós-créditos', '{}')
ON CONFLICT (key) DO NOTHING;

INSERT INTO experiments (key, name, description, variants, traffic_percent)
SELECT 'home_billboard_cta', 'CTA Billboard Home', 'Teste de copy no botão principal',
       '["control","watch_now","angola_first"]'::jsonb, 100
WHERE NOT EXISTS (SELECT 1 FROM experiments WHERE key = 'home_billboard_cta');

INSERT INTO experiments (key, name, description, variants, traffic_percent)
SELECT 'plans_layout', 'Layout Planos', 'Variante de pricing cards',
       '["control","compact","highlight_premium"]'::jsonb, 100
WHERE NOT EXISTS (SELECT 1 FROM experiments WHERE key = 'plans_layout');

-- Seed pós-créditos em filmes longos com credits_start
UPDATE videos
SET post_credits_start_seconds = LEAST(
  COALESCE(duration_seconds, 0) - 15,
  GREATEST(COALESCE(credits_start_seconds, 0) + 90, COALESCE(duration_seconds, 0) - 120)
)
WHERE kind IN ('movie', 'episode')
  AND COALESCE(credits_start_seconds, 0) > 0
  AND COALESCE(duration_seconds, 0) > 600
  AND post_credits_start_seconds IS NULL;
