-- MinhaTela · Fase 26 mega: TVOD packs · last-used · NPS app · live HLS · CDN health · stars · CW sync · spoiler stills

-- 1) TVOD packs
CREATE TABLE IF NOT EXISTS tvod_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(120) NOT NULL UNIQUE,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  poster_url TEXT,
  price_kz INTEGER NOT NULL CHECK (price_kz > 0),
  rental_hours INTEGER NOT NULL DEFAULT 48 CHECK (rental_hours BETWEEN 1 AND 720),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tvod_pack_items (
  pack_id UUID NOT NULL REFERENCES tvod_packs(id) ON DELETE CASCADE,
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (pack_id, video_id)
);

CREATE TABLE IF NOT EXISTS pack_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pack_id UUID NOT NULL REFERENCES tvod_packs(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pack_entitlement_window CHECK (expires_at > starts_at)
);

CREATE INDEX IF NOT EXISTS pack_entitlements_user_idx
  ON pack_entitlements(user_id, expires_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS pack_entitlements_active_uidx
  ON pack_entitlements(user_id, pack_id);

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS pack_id UUID REFERENCES tvod_packs(id) ON DELETE SET NULL;

DO $$ BEGIN
  ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'pack';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Trigger: activar pack entitlements + rentals por item
CREATE OR REPLACE FUNCTION activate_paid_transaction()
RETURNS TRIGGER AS $$
DECLARE
  pack_hours INT;
  item RECORD;
BEGIN
  IF NEW.status = 'pago' AND (OLD.status IS DISTINCT FROM 'pago') THEN
    NEW.paid_at = COALESCE(NEW.paid_at, NOW());

    IF NEW.type = 'subscription' THEN
      UPDATE users
      SET subscription_status = 'premium_active',
          premium_expires_at = NOW() + INTERVAL '30 days'
      WHERE id = NEW.user_id;
    END IF;

    IF NEW.type = 'rental' AND NEW.video_id IS NOT NULL THEN
      NEW.access_expires_at = NEW.paid_at + INTERVAL '48 hours';
      INSERT INTO rentals (user_id, video_id, transaction_id, starts_at, expires_at)
      VALUES (NEW.user_id, NEW.video_id, NEW.id, NEW.paid_at, NEW.paid_at + INTERVAL '48 hours')
      ON CONFLICT (user_id, video_id)
      DO UPDATE SET
        transaction_id = EXCLUDED.transaction_id,
        starts_at = EXCLUDED.starts_at,
        expires_at = EXCLUDED.expires_at;
    END IF;

    IF NEW.type = 'pack' AND NEW.pack_id IS NOT NULL THEN
      SELECT rental_hours INTO pack_hours FROM tvod_packs WHERE id = NEW.pack_id;
      pack_hours := COALESCE(pack_hours, 48);
      NEW.access_expires_at = NEW.paid_at + (pack_hours || ' hours')::interval;

      INSERT INTO pack_entitlements (user_id, pack_id, transaction_id, starts_at, expires_at)
      VALUES (NEW.user_id, NEW.pack_id, NEW.id, NEW.paid_at, NEW.access_expires_at)
      ON CONFLICT (user_id, pack_id)
      DO UPDATE SET
        transaction_id = EXCLUDED.transaction_id,
        starts_at = EXCLUDED.starts_at,
        expires_at = EXCLUDED.expires_at;

      FOR item IN
        SELECT video_id FROM tvod_pack_items WHERE pack_id = NEW.pack_id
      LOOP
        INSERT INTO rentals (user_id, video_id, transaction_id, starts_at, expires_at)
        VALUES (NEW.user_id, item.video_id, NEW.id, NEW.paid_at, NEW.access_expires_at)
        ON CONFLICT (user_id, video_id)
        DO UPDATE SET
          transaction_id = EXCLUDED.transaction_id,
          starts_at = EXCLUDED.starts_at,
          expires_at = GREATEST(rentals.expires_at, EXCLUDED.expires_at);
      END LOOP;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2) Who's Watching last-used
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_used_device_id UUID REFERENCES device_sessions(id) ON DELETE SET NULL;

-- 3) App NPS / session survey
CREATE TABLE IF NOT EXISTS app_survey_prompts (
  key VARCHAR(80) PRIMARY KEY,
  trigger VARCHAR(40) NOT NULL DEFAULT 'session_open',
  cooldown_days INT NOT NULL DEFAULT 30,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_survey_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  prompt_key VARCHAR(80) NOT NULL REFERENCES app_survey_prompts(key),
  nps SMALLINT CHECK (nps BETWEEN 0 AND 10),
  score SMALLINT CHECK (score BETWEEN 1 AND 5),
  comment TEXT,
  app_session_id VARCHAR(80),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS app_survey_responses_user_idx
  ON app_survey_responses(user_id, created_at DESC);

INSERT INTO app_survey_prompts (key, trigger, cooldown_days, payload)
VALUES (
  'app_nps_session',
  'session_open',
  21,
  '{"title":"Como está a MinhaTela?","subtitle":"A sua opinião ajuda a melhorar a experiência em Angola."}'::jsonb
)
ON CONFLICT (key) DO NOTHING;

-- 4) Live premiere HLS
ALTER TABLE premiere_events
  ADD COLUMN IF NOT EXISTS hls_url TEXT,
  ADD COLUMN IF NOT EXISTS bunny_video_id VARCHAR(120),
  ADD COLUMN IF NOT EXISTS stream_status VARCHAR(20) NOT NULL DEFAULT 'scheduled'
    CHECK (stream_status IN ('scheduled', 'live', 'ended')),
  ADD COLUMN IF NOT EXISTS join_opens_at TIMESTAMPTZ;

-- 5) CDN health
CREATE TABLE IF NOT EXISTS cdn_health_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  probe_type VARCHAR(40) NOT NULL,
  ok BOOLEAN NOT NULL DEFAULT FALSE,
  latency_ms INT,
  http_status INT,
  error TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cdn_health_checks_checked_idx
  ON cdn_health_checks(checked_at DESC);

-- 6) Community star ratings 1–5
ALTER TABLE content_ratings DROP CONSTRAINT IF EXISTS content_ratings_rating_check;
UPDATE content_ratings
SET rating = CASE WHEN rating = 1 THEN 5 WHEN rating = -1 THEN 1 ELSE rating END
WHERE rating IN (-1, 1);
ALTER TABLE content_ratings
  ADD CONSTRAINT content_ratings_rating_check CHECK (rating BETWEEN 1 AND 5);

ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS community_rating_avg NUMERIC(3,2),
  ADD COLUMN IF NOT EXISTS community_rating_count INT NOT NULL DEFAULT 0;

UPDATE videos v
SET community_rating_avg = s.avg_r,
    community_rating_count = s.cnt
FROM (
  SELECT content_id, ROUND(AVG(rating)::numeric, 2) AS avg_r, COUNT(*)::int AS cnt
  FROM content_ratings
  GROUP BY content_id
) s
WHERE v.id = s.content_id;

-- 7) Continue Watching sync
ALTER TABLE watch_progress
  ADD COLUMN IF NOT EXISTS last_device_id UUID REFERENCES device_sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

-- 8) Spoiler-safe stills
ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS spoiler_safe_still_url TEXT,
  ADD COLUMN IF NOT EXISTS spoiler_safe_poster_url TEXT;

UPDATE videos
SET spoiler_safe_poster_url = COALESCE(spoiler_safe_poster_url, poster_url),
    spoiler_safe_still_url = COALESCE(spoiler_safe_still_url, backdrop_url, poster_url)
WHERE kind = 'episode'
  AND spoiler_safe_poster_url IS NULL;

INSERT INTO feature_flags (key, enabled, description, payload) VALUES
  ('tvod_packs_enabled', TRUE, 'Packs / bundles TVOD', '{}'),
  ('profile_last_used_enabled', TRUE, 'Who''s Watching last-used', '{}'),
  ('app_nps_survey_enabled', TRUE, 'NPS de sessão da app', '{}'),
  ('premiere_live_join_enabled', TRUE, 'Join HLS de estreias ao vivo', '{}'),
  ('cdn_health_enabled', TRUE, 'Probes CDN / Bunny health', '{}'),
  ('star_ratings_enabled', TRUE, 'Classificação 1–5 estrelas', '{}'),
  ('cw_sync_badge_enabled', TRUE, 'Badge sync Continuar a assistir', '{}'),
  ('spoiler_stills_enabled', TRUE, 'Stills anti-spoiler em episódios', '{}')
ON CONFLICT (key) DO NOTHING;

-- Seed packs demo
INSERT INTO tvod_packs (slug, title, description, price_kz, rental_hours, sort_order)
SELECT 'noite-luanda', 'Noite em Luanda · Pack', '2 filmes · 72h de acesso', 2500, 72, 1
WHERE NOT EXISTS (SELECT 1 FROM tvod_packs WHERE slug = 'noite-luanda');

INSERT INTO tvod_packs (slug, title, description, price_kz, rental_hours, sort_order)
SELECT 'cinema-ao-essentials', 'Cinema AO Essentials', 'Curadoria MinhaTela · 48h', 3500, 48, 2
WHERE NOT EXISTS (SELECT 1 FROM tvod_packs WHERE slug = 'cinema-ao-essentials');

INSERT INTO tvod_pack_items (pack_id, video_id, sort_order)
SELECT p.id, v.id, 0
FROM tvod_packs p
CROSS JOIN LATERAL (
  SELECT id FROM videos
  WHERE kind = 'movie' AND is_published = TRUE AND monetization = 'tvod'
  ORDER BY created_at DESC
  LIMIT 2
) v
WHERE p.slug = 'noite-luanda'
ON CONFLICT DO NOTHING;

INSERT INTO tvod_pack_items (pack_id, video_id, sort_order)
SELECT p.id, v.id, row_number() OVER () - 1
FROM tvod_packs p
CROSS JOIN LATERAL (
  SELECT id FROM videos
  WHERE kind IN ('movie', 'series') AND is_published = TRUE
  ORDER BY is_featured DESC NULLS LAST, created_at DESC
  LIMIT 3
) v
WHERE p.slug = 'cinema-ao-essentials'
ON CONFLICT DO NOTHING;

-- Live premiere seed (demo HLS public sample)
UPDATE premiere_events
SET stream_status = CASE WHEN is_live THEN 'live' ELSE stream_status END,
    hls_url = COALESCE(
      hls_url,
      'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'
    ),
    join_opens_at = COALESCE(join_opens_at, starts_at - INTERVAL '15 minutes')
WHERE is_published = TRUE;
