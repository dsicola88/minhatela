-- MinhaTela · Fase 14: promo codes · top10 · history controls

ALTER TABLE watch_progress
  ADD COLUMN IF NOT EXISTS hidden_from_row BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS watch_progress_continue_idx
  ON watch_progress(profile_id, updated_at DESC)
  WHERE completed = FALSE AND hidden_from_row = FALSE AND position_seconds > 15;

CREATE TABLE IF NOT EXISTS promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(40) NOT NULL,
  code_normalized VARCHAR(40) NOT NULL UNIQUE,
  description TEXT,
  kind VARCHAR(30) NOT NULL DEFAULT 'premium_days'
    CHECK (kind IN ('premium_days', 'percent_off', 'fixed_credit_kz')),
  value_int INT NOT NULL DEFAULT 7,
  max_redemptions INT,
  redemption_count INT NOT NULL DEFAULT 0,
  per_user_limit INT NOT NULL DEFAULT 1,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS promo_codes_active_idx
  ON promo_codes(is_active, ends_at)
  WHERE is_active = TRUE;

CREATE TABLE IF NOT EXISTS promo_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_id UUID NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  granted_days INT,
  premium_expires_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (promo_id, user_id)
);

CREATE INDEX IF NOT EXISTS promo_redemptions_user_idx
  ON promo_redemptions(user_id, created_at DESC);

-- Seed campanha lançamento Angola
INSERT INTO promo_codes (code, code_normalized, description, kind, value_int, max_redemptions, ends_at)
VALUES (
  'ANGOLA7',
  'ANGOLA7',
  '7 dias Premium — lançamento MinhaTela Angola',
  'premium_days',
  7,
  10000,
  NOW() + INTERVAL '180 days'
)
ON CONFLICT (code_normalized) DO NOTHING;
