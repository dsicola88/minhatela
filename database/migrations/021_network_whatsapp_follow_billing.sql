-- MinhaTela · Fase 23: diagnóstico de rede · WhatsApp · seguir série · idiomas · facturação

CREATE TABLE IF NOT EXISTS series_follows (
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  series_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notify_new_episodes BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (profile_id, series_id)
);

CREATE INDEX IF NOT EXISTS series_follows_series_idx
  ON series_follows(series_id, created_at DESC);

CREATE TABLE IF NOT EXISTS network_diagnostics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  latency_ms INT,
  downlink_kbps INT,
  recommended_quality VARCHAR(10) NOT NULL DEFAULT 'auto',
  carrier_hint VARCHAR(40),
  platform VARCHAR(40),
  client_meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS network_diagnostics_user_idx
  ON network_diagnostics(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS billing_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  invoice_number VARCHAR(40) NOT NULL UNIQUE,
  title VARCHAR(200) NOT NULL,
  amount_kz INT NOT NULL CHECK (amount_kz >= 0),
  currency VARCHAR(8) NOT NULL DEFAULT 'AOA',
  status VARCHAR(20) NOT NULL DEFAULT 'paid'
    CHECK (status IN ('paid', 'pending', 'void', 'refunded')),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS billing_invoices_user_idx
  ON billing_invoices(user_id, issued_at DESC);

-- Episode publish tracking for follow notifications
ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS episode_notified_at TIMESTAMPTZ;

INSERT INTO feature_flags (key, enabled, description, payload) VALUES
  ('network_diagnostics_enabled', TRUE, 'Diagnóstico de rede pré-play', '{}'),
  ('whatsapp_share_enabled', TRUE, 'Partilha WhatsApp one-tap', '{}'),
  ('series_follow_enabled', TRUE, 'Seguir série / novos episódios', '{}'),
  ('languages_hub_enabled', TRUE, 'Hub por idiomas', '{}'),
  ('billing_invoices_enabled', TRUE, 'Arquivo de facturas', '{}')
ON CONFLICT (key) DO NOTHING;

-- Backfill facturas a partir de transacções
INSERT INTO billing_invoices (user_id, transaction_id, invoice_number, title, amount_kz, status, issued_at, metadata)
SELECT
  t.user_id,
  t.id,
  'MT-' || to_char(COALESCE(t.paid_at, t.updated_at, t.created_at), 'YYYYMMDD') || '-' || upper(left(replace(t.id::text, '-', ''), 8)),
  CASE
    WHEN t.type::text = 'subscription' THEN 'Assinatura Premium MinhaTela'
    WHEN t.type::text = 'rental' THEN 'Aluguer TVOD'
    ELSE 'Pagamento MinhaTela'
  END,
  COALESCE(t.amount_kz, 0),
  CASE WHEN t.status::text = 'pago' THEN 'paid'
       WHEN t.status::text = 'rejeitado' THEN 'void'
       ELSE 'pending' END,
  COALESCE(t.paid_at, t.updated_at, t.created_at),
  jsonb_build_object('type', t.type::text, 'method', t.payment_method::text)
FROM transactions t
WHERE NOT EXISTS (
  SELECT 1 FROM billing_invoices b WHERE b.transaction_id = t.id
)
ON CONFLICT (invoice_number) DO NOTHING;
