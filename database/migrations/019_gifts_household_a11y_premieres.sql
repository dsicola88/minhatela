-- MinhaTela · Fase 21: Presentes Premium · Agregado familiar · Acessibilidade · Estreias · Mais como isto

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS a11y_reduced_motion BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS a11y_high_contrast BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS a11y_audio_description BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS a11y_large_text BOOLEAN NOT NULL DEFAULT FALSE;

-- Presentes Premium (gift cards / códigos)
CREATE TABLE IF NOT EXISTS gift_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(24) NOT NULL UNIQUE,
  days INT NOT NULL CHECK (days BETWEEN 1 AND 365),
  purchaser_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  recipient_email VARCHAR(255),
  message TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'redeemed', 'revoked', 'expired')),
  redeemed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  redeemed_at TIMESTAMPTZ,
  premium_expires_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '365 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS gift_codes_purchaser_idx
  ON gift_codes(purchaser_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS gift_codes_status_idx
  ON gift_codes(status) WHERE status = 'active';

-- Agregado familiar (Netflix-style household — 1 titular + até 1 membro extra)
CREATE TABLE IF NOT EXISTS households (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  max_members INT NOT NULL DEFAULT 2 CHECK (max_members BETWEEN 2 AND 4),
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS household_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'member'
    CHECK (role IN ('owner', 'member')),
  invite_email VARCHAR(255),
  invite_code VARCHAR(16),
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'left', 'removed')),
  invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  joined_at TIMESTAMPTZ,
  CONSTRAINT household_member_identity CHECK (
    user_id IS NOT NULL OR (invite_email IS NOT NULL AND status = 'pending')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS household_members_user_active_idx
  ON household_members(user_id)
  WHERE status = 'active' AND user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS household_invite_code_idx
  ON household_members(invite_code)
  WHERE invite_code IS NOT NULL AND status = 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS household_pending_email_idx
  ON household_members(household_id, lower(invite_email))
  WHERE status = 'pending' AND invite_email IS NOT NULL;

-- Estreias / eventos ao vivo (countdown hub)
CREATE TABLE IF NOT EXISTS premiere_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(100) NOT NULL UNIQUE,
  title VARCHAR(200) NOT NULL,
  synopsis TEXT,
  content_id UUID REFERENCES videos(id) ON DELETE SET NULL,
  poster_url TEXT,
  backdrop_url TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  is_live BOOLEAN NOT NULL DEFAULT FALSE,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  market VARCHAR(10) NOT NULL DEFAULT 'AO',
  sort_order INT NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS premiere_events_upcoming_idx
  ON premiere_events(starts_at ASC)
  WHERE is_published = TRUE;

CREATE TABLE IF NOT EXISTS premiere_reminders (
  event_id UUID NOT NULL REFERENCES premiere_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (event_id, user_id)
);

INSERT INTO feature_flags (key, enabled, description, payload) VALUES
  ('gifts_enabled', TRUE, 'Presentes Premium', '{}'),
  ('household_enabled', TRUE, 'Agregado familiar', '{}'),
  ('premieres_enabled', TRUE, 'Hub de estreias / eventos', '{}'),
  ('more_like_this_enabled', TRUE, 'Mais como isto no player', '{}')
ON CONFLICT (key) DO NOTHING;

-- Seed: presentes demo (admin pode criar mais)
INSERT INTO gift_codes (code, days, message, expires_at)
SELECT 'PRESENTAO30', 30, 'Presente MinhaTela · 30 dias Premium', NOW() + INTERVAL '180 days'
WHERE NOT EXISTS (SELECT 1 FROM gift_codes WHERE code = 'PRESENTAO30');

INSERT INTO gift_codes (code, days, message, expires_at)
SELECT 'AO7GIFT', 7, 'Presente rápido · 7 dias Premium', NOW() + INTERVAL '90 days'
WHERE NOT EXISTS (SELECT 1 FROM gift_codes WHERE code = 'AO7GIFT');

-- Seed: estreias demo a partir de coming_soon / recentes AO
INSERT INTO premiere_events (slug, title, synopsis, content_id, poster_url, backdrop_url, starts_at, is_published, sort_order)
SELECT
  'estreia-' || left(replace(v.id::text, '-', ''), 8),
  'Estreia: ' || v.title,
  COALESCE(v.synopsis_short, ''),
  v.id,
  v.poster_url,
  v.backdrop_url,
  COALESCE(v.coming_soon_at, NOW() + (INTERVAL '3 days' * (row_number() OVER (ORDER BY v.updated_at DESC)))),
  TRUE,
  10 + (row_number() OVER (ORDER BY v.updated_at DESC))::int
FROM videos v
WHERE v.kind IN ('movie', 'series')
  AND (
    (v.coming_soon_at IS NOT NULL AND v.coming_soon_at > NOW())
    OR (v.country_code = 'AO' AND v.is_published = TRUE)
  )
ORDER BY COALESCE(v.coming_soon_at, v.updated_at) ASC
LIMIT 5
ON CONFLICT (slug) DO NOTHING;
