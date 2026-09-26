-- MinhaTela · Fase 15: idempotency · Bunny webhooks · feature flags · browse

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(80);

CREATE UNIQUE INDEX IF NOT EXISTS transactions_idempotency_uidx
  ON transactions(user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS encoding_status VARCHAR(30) NOT NULL DEFAULT 'ready'
    CHECK (encoding_status IN ('pending', 'processing', 'ready', 'failed', 'unknown')),
  ADD COLUMN IF NOT EXISTS encoding_updated_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(40) NOT NULL,
  event_type VARCHAR(80) NOT NULL,
  external_id VARCHAR(160),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(20) NOT NULL DEFAULT 'received'
    CHECK (status IN ('received', 'processed', 'ignored', 'failed')),
  error_message TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS webhook_events_dedupe_uidx
  ON webhook_events(provider, external_id)
  WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS webhook_events_created_idx
  ON webhook_events(created_at DESC);

CREATE TABLE IF NOT EXISTS feature_flags (
  key VARCHAR(80) PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  description TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO feature_flags (key, enabled, description, payload) VALUES
  ('checkout_enabled', TRUE, 'Permite checkout IBAN/Multicaixa', '{}'),
  ('downloads_enabled', TRUE, 'Permite downloads offline', '{}'),
  ('promos_enabled', TRUE, 'Permite resgate de códigos promo', '{}'),
  ('new_and_hot_enabled', TRUE, 'Hub Novidades & Em Alta', '{}'),
  ('maintenance_mode', FALSE, 'Modo manutenção (bloqueia play/checkout)', '{}')
ON CONFLICT (key) DO NOTHING;
