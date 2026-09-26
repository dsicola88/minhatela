-- MinhaTela · Fase 25: autoplay countdown · spoilers · fraude pagamentos · encode admin · scrub · OAuth

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS hide_spoilers BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS autoplay_countdown_seconds INTEGER NOT NULL DEFAULT 10
    CHECK (autoplay_countdown_seconds BETWEEN 0 AND 30);

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS risk_score INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS proof_sha256 VARCHAR(64),
  ADD COLUMN IF NOT EXISTS risk_decision VARCHAR(20) NOT NULL DEFAULT 'allow';

CREATE TABLE IF NOT EXISTS payment_risk_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  risk_score INTEGER NOT NULL DEFAULT 0,
  signals JSONB NOT NULL DEFAULT '{}'::jsonb,
  decision VARCHAR(20) NOT NULL DEFAULT 'allow',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS payment_risk_signals_tx_idx
  ON payment_risk_signals(transaction_id);
CREATE INDEX IF NOT EXISTS payment_risk_signals_score_idx
  ON payment_risk_signals(risk_score DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS transactions_risk_pending_idx
  ON transactions(status, risk_score DESC) WHERE status = 'pendente';

ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS sprite_vtt_url TEXT,
  ADD COLUMN IF NOT EXISTS sprite_image_url TEXT,
  ADD COLUMN IF NOT EXISTS encoding_error TEXT,
  ADD COLUMN IF NOT EXISTS encoding_updated_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS oauth_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(20) NOT NULL CHECK (provider IN ('google', 'apple')),
  provider_sub VARCHAR(191) NOT NULL,
  email VARCHAR(255),
  raw_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, provider_sub)
);

CREATE INDEX IF NOT EXISTS oauth_identities_user_idx
  ON oauth_identities(user_id);

INSERT INTO feature_flags (key, enabled, description, payload) VALUES
  ('autoplay_countdown_enabled', TRUE, 'Countdown Netflix do episódio seguinte', '{"defaultSeconds":10}'),
  ('spoilers_enabled', TRUE, 'Modo anti-spoilers na ficha de séries', '{}'),
  ('payment_fraud_enabled', TRUE, 'Scoring de risco IBAN/Multicaixa', '{"reviewThreshold":60}'),
  ('encoding_admin_enabled', TRUE, 'Fila admin de encoding Bunny', '{}'),
  ('scrub_thumbs_enabled', TRUE, 'Thumbnails de scrub (sprite/VTT)', '{}'),
  ('oauth_enabled', TRUE, 'Login Google / Apple', '{}')
ON CONFLICT (key) DO NOTHING;

-- Seed sprites em conteúdos longos (demo enterprise)
UPDATE videos
SET sprite_vtt_url = COALESCE(sprite_vtt_url, '/static/scrub/demo.vtt'),
    sprite_image_url = COALESCE(sprite_image_url, '/static/scrub/demo-sprite.jpg')
WHERE kind IN ('movie', 'episode')
  AND COALESCE(duration_seconds, 0) > 300
  AND sprite_vtt_url IS NULL;
