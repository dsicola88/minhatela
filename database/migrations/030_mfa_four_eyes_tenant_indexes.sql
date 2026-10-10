-- Fase 30 · MFA TOTP + four-eyes + índices de isolamento
-- Staff: MFA obrigatório no login (MFA_STAFF_REQUIRED, default true).

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS mfa_enabled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS mfa_secret_enc TEXT,
  ADD COLUMN IF NOT EXISTS mfa_pending_secret_enc TEXT;

CREATE INDEX IF NOT EXISTS tenant_memberships_user_idx
  ON tenant_memberships(user_id, status);

CREATE INDEX IF NOT EXISTS videos_tenant_id_idx ON videos(tenant_id);
CREATE INDEX IF NOT EXISTS transactions_user_idx ON transactions(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS four_eyes_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  action VARCHAR(80) NOT NULL,
  resource_type VARCHAR(80) NOT NULL,
  resource_id UUID,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  reason TEXT NOT NULL,
  requested_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'executed', 'bypassed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS four_eyes_pending_idx
  ON four_eyes_requests(status, created_at DESC);

INSERT INTO feature_flags (key, enabled, description, payload) VALUES
(
  'mfa_optional_v1_enabled',
  TRUE,
  'TOTP; staff obrigatório no login excepto MFA_STAFF_REQUIRED=false',
  '{}'::jsonb
),
(
  'four_eyes_critical_ops_enabled',
  TRUE,
  'Four-eyes quando existem 2+ super_admins; senão bypass auditado',
  '{}'::jsonb
)
ON CONFLICT (key) DO NOTHING;
