-- MinhaTela · Fase 28b: Console Netflix-AO · landing · leads · planos · uploads · ads ops

CREATE TABLE IF NOT EXISTS subscription_plans (
  id VARCHAR(40) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  price_kz INTEGER NOT NULL DEFAULT 0 CHECK (price_kz >= 0),
  period VARCHAR(20),
  streams INT NOT NULL DEFAULT 1,
  downloads INT NOT NULL DEFAULT 0,
  ads_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  quality VARCHAR(60) NOT NULL DEFAULT 'Auto',
  highlights JSONB NOT NULL DEFAULT '[]'::jsonb,
  cta JSONB,
  badge VARCHAR(60),
  sort_order INT NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  market VARCHAR(8) NOT NULL DEFAULT 'AO',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO subscription_plans (
  id, name, price_kz, period, streams, downloads, ads_enabled, quality,
  highlights, cta, badge, sort_order, is_default
) VALUES
(
  'free', 'Gratuito', 0, NULL, 1, 3, TRUE, '480p / Auto',
  '["Catálogo AVOD com anúncios","1 ecrã em simultâneo","Poupança de dados (Unitel/Movicel)"]'::jsonb,
  NULL, NULL, 10, TRUE
),
(
  'premium', 'Premium', 4990, 'month', 2, 10, FALSE, '720p / Auto',
  '["Sem anúncios","Catálogo SVOD completo","2 ecrãs em simultâneo","Downloads offline","Prioridade em estreias"]'::jsonb,
  '{"type":"subscription","label":"Assinar · Premium"}'::jsonb,
  'Recomendado', 20, FALSE
)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  full_name VARCHAR(180),
  phone VARCHAR(40),
  source VARCHAR(60) NOT NULL DEFAULT 'landing',
  interest VARCHAR(60) NOT NULL DEFAULT 'premium'
    CHECK (interest IN ('premium', 'creator', 'advertiser', 'partnership', 'other')),
  status VARCHAR(20) NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'contacted', 'qualified', 'converted', 'discarded')),
  notes TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS leads_email_source_uidx ON leads (email, source);
CREATE INDEX IF NOT EXISTS leads_status_idx ON leads (status, created_at DESC);

CREATE TABLE IF NOT EXISTS media_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_scope VARCHAR(40) NOT NULL DEFAULT 'minhatela',
  kind VARCHAR(40) NOT NULL DEFAULT 'asset'
    CHECK (kind IN ('asset', 'poster', 'backdrop', 'banner', 'landing', 'ad_creative', 'other')),
  original_name VARCHAR(255),
  stored_name VARCHAR(255) NOT NULL,
  path TEXT NOT NULL,
  mime_type VARCHAR(120),
  size_bytes BIGINT,
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS media_uploads_kind_idx ON media_uploads (kind, created_at DESC);

INSERT INTO app_settings (key, value, description) VALUES
(
  'landing',
  '{
    "enabled": true,
    "heroTitle": "Cinema angolano. A tua tela.",
    "heroSubtitle": "Filmes, séries e estreias ao vivo — com IBAN e Multicaixa.",
    "heroCtaPrimary": "Começar grátis",
    "heroCtaSecondary": "Ver planos",
    "heroImageUrl": null,
    "sections": [
      {"id":"avod","title":"Assista grátis","body":"Catálogo AVOD com anúncios locais."},
      {"id":"premium","title":"Premium sem anúncios","body":"Downloads, multi-ecrã e estreias prioritárias."},
      {"id":"pay","title":"Pagamento Angola","body":"IBAN ou Multicaixa. Acesso após confirmação."}
    ],
    "showLeadForm": true,
    "leadHeadline": "Seja dos primeiros — deixa o teu contacto"
  }'::jsonb,
  'Landing page marketing (web/app welcome)'
),
(
  'payments',
  '{
    "ibanEnabled": true,
    "multicaixaEnabled": true,
    "ibanLabel": "Transferência IBAN",
    "multicaixaLabel": "Multicaixa / Express",
    "ibanInstructions": "Envie o comprovativo após a transferência. Confirmação manual pela equipa MinhaTela.",
    "multicaixaInstructions": "Pague via Multicaixa Express e anexe o comprovativo.",
    "manualReviewRequired": true,
    "currency": "AOA",
    "market": "AO"
  }'::jsonb,
  'Métodos de pagamento Angola (IBAN/Multicaixa)'
)
ON CONFLICT (key) DO NOTHING;

INSERT INTO feature_flags (key, enabled, description, payload) VALUES
(
  'enterprise_console_full_enabled',
  TRUE,
  'Console completo: landing, leads, users, plans, uploads, ads',
  '{}'::jsonb
)
ON CONFLICT (key) DO NOTHING;
