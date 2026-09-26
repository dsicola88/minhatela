-- 004 · Creator Studio + Ad Platform foundation

DO $$ BEGIN
  CREATE TYPE creator_type AS ENUM ('creator', 'filmmaker', 'producer', 'production_company');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE creator_status AS ENUM ('pending', 'active', 'suspended', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE content_workflow AS ENUM (
    'draft', 'submitted', 'under_review', 'approved', 'published', 'rejected', 'archived'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE campaign_status AS ENUM (
    'draft', 'pending_review', 'active', 'paused', 'completed', 'rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS creators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  type creator_type NOT NULL DEFAULT 'creator',
  display_name VARCHAR(180) NOT NULL,
  bio TEXT,
  country VARCHAR(8) NOT NULL DEFAULT 'AO',
  avatar_url TEXT,
  bank_iban TEXT,
  bank_name VARCHAR(120),
  bank_account_name VARCHAR(180),
  status creator_status NOT NULL DEFAULT 'pending',
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS creators_status_idx ON creators(status);

CREATE TABLE IF NOT EXISTS production_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(180) NOT NULL,
  slug VARCHAR(180) NOT NULL UNIQUE,
  country VARCHAR(8) NOT NULL DEFAULT 'AO',
  owner_creator_id UUID REFERENCES creators(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS workflow_status content_workflow NOT NULL DEFAULT 'published',
  ADD COLUMN IF NOT EXISTS creator_id UUID REFERENCES creators(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS production_company_id UUID REFERENCES production_companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS age_rating VARCHAR(10) DEFAULT '12',
  ADD COLUMN IF NOT EXISTS language_code VARCHAR(8) DEFAULT 'pt',
  ADD COLUMN IF NOT EXISTS country_code VARCHAR(8) DEFAULT 'AO',
  ADD COLUMN IF NOT EXISTS genre VARCHAR(80),
  ADD COLUMN IF NOT EXISTS director_name VARCHAR(180),
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Conteúdo legado/publicado continua visível no catálogo
UPDATE videos
SET workflow_status = 'published', is_published = TRUE
WHERE is_published = TRUE AND workflow_status IS DISTINCT FROM 'published';

CREATE INDEX IF NOT EXISTS videos_workflow_idx ON videos(workflow_status);
CREATE INDEX IF NOT EXISTS videos_creator_idx ON videos(creator_id);

CREATE TABLE IF NOT EXISTS creator_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  content_id UUID REFERENCES videos(id) ON DELETE SET NULL,
  source VARCHAR(40) NOT NULL DEFAULT 'view',
  amount_kz INTEGER NOT NULL CHECK (amount_kz >= 0),
  currency VARCHAR(8) NOT NULL DEFAULT 'AOA',
  period_date DATE NOT NULL DEFAULT CURRENT_DATE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS creator_earnings_creator_idx ON creator_earnings(creator_id, period_date DESC);

CREATE TABLE IF NOT EXISTS creator_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  amount_kz INTEGER NOT NULL CHECK (amount_kz > 0),
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'rejected')),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS advertisers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  company_name VARCHAR(180) NOT NULL,
  contact_email VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('pending', 'active', 'suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser_id UUID NOT NULL REFERENCES advertisers(id) ON DELETE CASCADE,
  name VARCHAR(180) NOT NULL,
  placement VARCHAR(40) NOT NULL DEFAULT 'pre_roll'
    CHECK (placement IN ('pre_roll', 'mid_roll', 'post_roll', 'banner', 'sponsored')),
  budget_kz INTEGER NOT NULL CHECK (budget_kz > 0),
  spent_kz INTEGER NOT NULL DEFAULT 0 CHECK (spent_kz >= 0),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status campaign_status NOT NULL DEFAULT 'draft',
  targeting JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT campaign_window_valid CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS campaigns_active_idx ON campaigns(status, starts_at, ends_at);

CREATE TABLE IF NOT EXISTS ad_creatives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  title VARCHAR(180) NOT NULL,
  media_url TEXT NOT NULL,
  click_url TEXT,
  duration_seconds INTEGER NOT NULL DEFAULT 15,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ad_impressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  creative_id UUID REFERENCES ad_creatives(id) ON DELETE SET NULL,
  content_id UUID REFERENCES videos(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  placement VARCHAR(40) NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ad_impressions_campaign_idx ON ad_impressions(campaign_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ad_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  impression_id UUID NOT NULL REFERENCES ad_impressions(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name VARCHAR(60) NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  content_id UUID REFERENCES videos(id) ON DELETE SET NULL,
  session_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS analytics_events_name_idx ON analytics_events(event_name, created_at DESC);
CREATE INDEX IF NOT EXISTS analytics_events_content_idx ON analytics_events(content_id, event_name);
