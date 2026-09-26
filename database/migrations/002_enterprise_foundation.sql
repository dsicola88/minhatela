-- 002 · Enterprise foundation (roles, audit, rights, migration tracking)
-- Incremental · safe on databases that already ran 001

CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(80) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, role_id)
);

INSERT INTO roles (code, name) VALUES
  ('customer', 'Cliente'),
  ('creator', 'Criador'),
  ('producer', 'Produtor'),
  ('advertiser', 'Anunciante'),
  ('moderator', 'Moderador'),
  ('admin', 'Administrador'),
  ('super_admin', 'Super Administrador')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS content_rights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  owner_name VARCHAR(180),
  territory VARCHAR(8) NOT NULL DEFAULT 'AO',
  license_type VARCHAR(40) NOT NULL DEFAULT 'distribution',
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMPTZ,
  exclusive BOOLEAN NOT NULL DEFAULT FALSE,
  avod_allowed BOOLEAN NOT NULL DEFAULT TRUE,
  svod_allowed BOOLEAN NOT NULL DEFAULT TRUE,
  tvod_allowed BOOLEAN NOT NULL DEFAULT TRUE,
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'expired', 'revoked', 'pending')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS content_rights_content_idx ON content_rights(content_id);
CREATE INDEX IF NOT EXISTS content_rights_active_idx
  ON content_rights(content_id, territory, status);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(80) NOT NULL,
  entity VARCHAR(80) NOT NULL,
  entity_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip VARCHAR(64),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_logs_actor_idx ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON audit_logs(action);
CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON audit_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS playback_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  content_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  monetization monetization_model NOT NULL,
  allowed BOOLEAN NOT NULL,
  denial_code VARCHAR(40),
  bunny_video_id VARCHAR(120),
  expires_at TIMESTAMPTZ,
  ip VARCHAR(64),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS playback_sessions_user_idx ON playback_sessions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS playback_sessions_content_idx ON playback_sessions(content_id, created_at DESC);

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
CROSS JOIN roles r
WHERE r.code = 'customer'
ON CONFLICT DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
CROSS JOIN roles r
WHERE u.is_admin = TRUE AND r.code IN ('admin', 'super_admin')
ON CONFLICT DO NOTHING;
