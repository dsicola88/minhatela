-- 037 · Ads Manager: eventos de medição, recusa com motivo, histórico
-- Incremental. Não apaga dados. Não é leilão nem CPM optimizado.

ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS objective VARCHAR(40) NOT NULL DEFAULT 'brand',
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_objective_check;
ALTER TABLE campaigns
  ADD CONSTRAINT campaigns_objective_check
  CHECK (objective IN ('brand', 'traffic', 'awareness'));

ALTER TABLE ad_creatives
  ADD COLUMN IF NOT EXISTS cta_label VARCHAR(40) NOT NULL DEFAULT 'Saber mais';

ALTER TABLE ad_impressions
  ADD COLUMN IF NOT EXISTS started BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS billed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS billed_kz INTEGER NOT NULL DEFAULT 0 CHECK (billed_kz >= 0),
  ADD COLUMN IF NOT EXISTS device VARCHAR(40),
  ADD COLUMN IF NOT EXISTS invalid_reason TEXT,
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS ad_clicks_impression_unique ON ad_clicks(impression_id);

CREATE TABLE IF NOT EXISTS campaign_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(60) NOT NULL,
  from_status campaign_status,
  to_status campaign_status,
  reason TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS campaign_history_campaign_idx
  ON campaign_history(campaign_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ad_impressions_user_day_idx
  ON ad_impressions(campaign_id, user_id, created_at DESC);
