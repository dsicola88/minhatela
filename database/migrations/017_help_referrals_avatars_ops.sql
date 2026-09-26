-- MinhaTela · Fase 19: help center · tickets · avatares · advisories · referrals · ops

ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS advisories TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS languages TEXT[] NOT NULL DEFAULT ARRAY['pt']::text[],
  ADD COLUMN IF NOT EXISTS subtitle_languages TEXT[] NOT NULL DEFAULT ARRAY['pt']::text[];

CREATE TABLE IF NOT EXISTS profile_avatars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(60) NOT NULL UNIQUE,
  label VARCHAR(80) NOT NULL,
  image_url TEXT NOT NULL,
  is_kids BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS help_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(80) NOT NULL UNIQUE,
  category VARCHAR(60) NOT NULL DEFAULT 'geral',
  title VARCHAR(200) NOT NULL,
  body_md TEXT NOT NULL,
  locale VARCHAR(10) NOT NULL DEFAULT 'pt-AO',
  sort_order INT NOT NULL DEFAULT 100,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS help_articles_cat_idx
  ON help_articles(category, sort_order)
  WHERE is_published = TRUE;

CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject VARCHAR(160) NOT NULL,
  category VARCHAR(40) NOT NULL DEFAULT 'geral'
    CHECK (category IN ('geral', 'pagamento', 'playback', 'conta', 'conteudo', 'outro')),
  body TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority VARCHAR(20) NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high')),
  admin_notes TEXT,
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS support_tickets_user_idx
  ON support_tickets(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS support_tickets_open_idx
  ON support_tickets(status, created_at ASC)
  WHERE status IN ('open', 'in_progress');

CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code VARCHAR(20) NOT NULL UNIQUE,
  invitee_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  invitee_email VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'redeemed', 'expired', 'revoked')),
  reward_days INT NOT NULL DEFAULT 7,
  redeemed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '90 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS referrals_referrer_idx
  ON referrals(referrer_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ops_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  postgres_ok BOOLEAN NOT NULL,
  bunny_configured BOOLEAN NOT NULL,
  maintenance_mode BOOLEAN NOT NULL DEFAULT FALSE,
  open_tickets INT NOT NULL DEFAULT 0,
  pending_payments INT NOT NULL DEFAULT 0,
  live_streams INT NOT NULL DEFAULT 0,
  qoe_errors_1h INT NOT NULL DEFAULT 0,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO feature_flags (key, enabled, description, payload) VALUES
  ('help_center_enabled', TRUE, 'Centro de ajuda e tickets', '{}'),
  ('referrals_enabled', TRUE, 'Códigos de indicação Premium', '{}')
ON CONFLICT (key) DO NOTHING;

-- Avatares Angola
INSERT INTO profile_avatars (slug, label, image_url, is_kids, sort_order) VALUES
  ('luanda-red', 'Luanda Vermelho', 'https://api.dicebear.com/9.x/shapes/png?seed=luanda&backgroundColor=ce1126', FALSE, 1),
  ('kissama-gold', 'Kissama Ouro', 'https://api.dicebear.com/9.x/shapes/png?seed=kissama&backgroundColor=f7d417', FALSE, 2),
  ('benguela-dark', 'Benguela', 'https://api.dicebear.com/9.x/shapes/png?seed=benguela&backgroundColor=9b0c1c', FALSE, 3),
  ('huambo-sun', 'Huambo', 'https://api.dicebear.com/9.x/shapes/png?seed=huambo&backgroundColor=c9a912', FALSE, 4),
  ('kids-kite', 'Kids Papagaio', 'https://api.dicebear.com/9.x/shapes/png?seed=kids1&backgroundColor=22c55e', TRUE, 10),
  ('kids-star', 'Kids Estrela', 'https://api.dicebear.com/9.x/shapes/png?seed=kids2&backgroundColor=3b82f6', TRUE, 11)
ON CONFLICT (slug) DO NOTHING;

-- Help articles seed
INSERT INTO help_articles (slug, category, title, body_md, sort_order) VALUES
(
  'como-assinar-premium',
  'pagamento',
  'Como assinar o Premium',
  E'# Como assinar o Premium\n\n1. Abra **Planos** no menu Conta.\n2. Escolha Premium e faça transferência IBAN ou Multicaixa.\n3. Carregue o comprovativo.\n4. Após confirmação da equipa MinhaTela, o Premium activa-se automaticamente.\n\nPreço em Kwanzas (Kz). Sem cartão internacional obrigatório.',
  10
),
(
  'poupar-dados-unitel',
  'playback',
  'Poupar dados (Unitel / Movicel)',
  E'# Poupança de dados\n\nActive **Poupança de dados** em Conta. O player arranca em 480p — ideal para redes móveis angolanas.\n\nTambém pode descarregar títulos Premium/TVOD para ver offline.',
  20
),
(
  'perfis-e-pin',
  'conta',
  'Perfis, Kids e PIN',
  E'# Perfis\n\nAté 4 perfis por conta. Perfis Kids têm maturidade limitada.\nPode definir um PIN de 4 dígitos e bloquear títulos individuais.',
  30
),
(
  'alugar-filme',
  'pagamento',
  'Alugar um filme (TVOD)',
  E'# Aluguer TVOD\n\nNa ficha do título, escolha Alugar e envie o comprovativo.\nApós aprovação, tem **48 horas** a partir de `paid_at` para assistir.',
  40
),
(
  'eliminar-conta',
  'conta',
  'Eliminar a minha conta',
  E'# Eliminar conta\n\nEm Conta → Privacidade pode solicitar eliminação. Há um período de graça de 30 dias para cancelar.',
  50
)
ON CONFLICT (slug) DO NOTHING;

-- Sample advisories on published titles
UPDATE videos
SET advisories = ARRAY['linguagem', 'temas_adultos']
WHERE kind IN ('movie', 'series')
  AND is_published = TRUE
  AND maturity_rating >= 16
  AND (advisories IS NULL OR advisories = '{}');

UPDATE videos
SET advisories = ARRAY['violencia']
WHERE kind IN ('movie', 'series')
  AND is_published = TRUE
  AND maturity_rating BETWEEN 12 AND 15
  AND (advisories IS NULL OR advisories = '{}');
