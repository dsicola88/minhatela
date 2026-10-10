-- MinhaTela · Fase Enterprise RBAC / tenants / company members / acquisition
-- Incremental: default tenant AO, backfill, sem apagar dados.

CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(60) NOT NULL UNIQUE,
  name VARCHAR(180) NOT NULL,
  market VARCHAR(8) NOT NULL DEFAULT 'AO',
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'pending')),
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO tenants (slug, name, market, status)
VALUES ('minhatela', 'MinhaTela Angola', 'AO', 'active')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO roles (code, name) VALUES
  ('content_manager', 'Gestor de catálogo'),
  ('finance_manager', 'Gestor financeiro'),
  ('support_agent', 'Agente de suporte'),
  ('production_owner', 'Owner de produtora'),
  ('production_manager', 'Manager de produtora'),
  ('production_editor', 'Editor de produtora'),
  ('production_finance', 'Finance de produtora')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS permissions (
  code VARCHAR(80) PRIMARY KEY,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO permissions (code, description) VALUES
  ('platform.tenants.manage', 'Criar/suspender tenants'),
  ('platform.admins.manage', 'Gerir administradores'),
  ('platform.roles.manage', 'Gerir roles e permissions'),
  ('platform.settings.manage', 'Configurações globais e flags críticas'),
  ('platform.secrets.manage', 'Secrets Bunny/CDN/pagamentos'),
  ('catalog.read', 'Ler catálogo operacional'),
  ('catalog.publish', 'Publicar / despublicar conteúdo'),
  ('catalog.moderate', 'Aprovar / rejeitar submissões'),
  ('rights.manage', 'Gerir licenças e territórios'),
  ('acquisition.manage', 'Content acquisition'),
  ('creators.manage', 'Aprovar criadores e produtoras'),
  ('finance.review', 'Rever pagamentos e payouts'),
  ('finance.read', 'Consultar receitas autorizadas'),
  ('support.tickets', 'Atendimento e tickets'),
  ('subscribers.read', 'Consultar assinantes'),
  ('ads.manage', 'Moderar campanhas'),
  ('audit.read', 'Ler audit logs'),
  ('studio.create', 'Criar rascunhos e uploads'),
  ('studio.submit', 'Submeter conteúdo'),
  ('studio.analytics', 'Analytics próprios'),
  ('company.members.manage', 'Gerir equipa da produtora'),
  ('company.finance.read', 'Financeiro da produtora')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS role_permissions (
  role_code VARCHAR(40) NOT NULL REFERENCES roles(code) ON DELETE CASCADE,
  permission_code VARCHAR(80) NOT NULL REFERENCES permissions(code) ON DELETE CASCADE,
  PRIMARY KEY (role_code, permission_code)
);

-- SuperAdmin: tudo
INSERT INTO role_permissions (role_code, permission_code)
SELECT 'super_admin', p.code FROM permissions p
ON CONFLICT DO NOTHING;

-- Admin operador (sem tenants/secrets/roles/promote SuperAdmin)
INSERT INTO role_permissions (role_code, permission_code)
SELECT 'admin', p.code FROM permissions p
WHERE p.code NOT IN (
  'platform.tenants.manage',
  'platform.secrets.manage',
  'platform.roles.manage',
  'platform.admins.manage'
)
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_code, permission_code) VALUES
  ('moderator', 'catalog.read'),
  ('moderator', 'catalog.moderate'),
  ('moderator', 'support.tickets'),
  ('moderator', 'audit.read'),
  ('content_manager', 'catalog.read'),
  ('content_manager', 'catalog.publish'),
  ('content_manager', 'catalog.moderate'),
  ('content_manager', 'rights.manage'),
  ('content_manager', 'acquisition.manage'),
  ('finance_manager', 'finance.review'),
  ('finance_manager', 'finance.read'),
  ('support_agent', 'support.tickets'),
  ('support_agent', 'subscribers.read'),
  ('creator', 'studio.create'),
  ('creator', 'studio.submit'),
  ('creator', 'studio.analytics'),
  ('producer', 'studio.create'),
  ('producer', 'studio.submit'),
  ('producer', 'studio.analytics'),
  ('producer', 'company.members.manage'),
  ('producer', 'company.finance.read'),
  ('production_owner', 'studio.create'),
  ('production_owner', 'studio.submit'),
  ('production_owner', 'studio.analytics'),
  ('production_owner', 'company.members.manage'),
  ('production_owner', 'company.finance.read'),
  ('production_manager', 'studio.create'),
  ('production_manager', 'studio.submit'),
  ('production_manager', 'studio.analytics'),
  ('production_editor', 'studio.create'),
  ('production_editor', 'studio.submit'),
  ('production_finance', 'company.finance.read'),
  ('production_finance', 'studio.analytics')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS tenant_memberships (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role_code VARCHAR(40) NOT NULL REFERENCES roles(code),
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'invited', 'suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, tenant_id, role_code)
);

CREATE INDEX IF NOT EXISTS tenant_memberships_tenant_idx
  ON tenant_memberships(tenant_id, status);

INSERT INTO tenant_memberships (user_id, tenant_id, role_code, status)
SELECT ur.user_id, t.id, r.code, 'active'
FROM user_roles ur
JOIN roles r ON r.id = ur.role_id
CROSS JOIN tenants t
WHERE t.slug = 'minhatela'
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS company_members (
  company_id UUID NOT NULL REFERENCES production_companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(40) NOT NULL DEFAULT 'editor'
    CHECK (role IN ('owner', 'manager', 'editor', 'finance')),
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'invited', 'removed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (company_id, user_id)
);

CREATE INDEX IF NOT EXISTS company_members_user_idx ON company_members(user_id, status);

INSERT INTO company_members (company_id, user_id, role, status)
SELECT pc.id, c.user_id, 'owner', 'active'
FROM production_companies pc
JOIN creators c ON c.id = pc.owner_creator_id
WHERE c.user_id IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS content_acquisitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  producer_name VARCHAR(180),
  company_id UUID REFERENCES production_companies(id) ON DELETE SET NULL,
  content_id UUID REFERENCES videos(id) ON DELETE SET NULL,
  territory VARCHAR(8) NOT NULL DEFAULT 'AO',
  monetization VARCHAR(20) NOT NULL DEFAULT 'svod',
  status VARCHAR(40) NOT NULL DEFAULT 'prospect'
    CHECK (status IN (
      'prospect', 'contacted', 'negotiation', 'contract_pending',
      'licensed', 'ingesting', 'qc', 'approved', 'published',
      'expiring', 'expired', 'rejected'
    )),
  contract_ref VARCHAR(120),
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS content_acquisitions_status_idx
  ON content_acquisitions(tenant_id, status, updated_at DESC);

ALTER TABLE content_rights
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rights_owner_id UUID REFERENCES production_companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS allow_live BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE content_rights cr
SET tenant_id = t.id
FROM tenants t
WHERE t.slug = 'minhatela' AND cr.tenant_id IS NULL;

ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reason TEXT;

ALTER TABLE creators
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS production_company_id UUID REFERENCES production_companies(id) ON DELETE SET NULL;

UPDATE creators c
SET tenant_id = t.id
FROM tenants t
WHERE t.slug = 'minhatela' AND c.tenant_id IS NULL;

ALTER TABLE production_companies
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active';

UPDATE production_companies pc
SET tenant_id = t.id
FROM tenants t
WHERE t.slug = 'minhatela' AND pc.tenant_id IS NULL;

ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS content_format VARCHAR(40) NOT NULL DEFAULT 'movie',
  ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS licensed_by_company_id UUID REFERENCES production_companies(id) ON DELETE SET NULL;

UPDATE videos v
SET tenant_id = t.id
FROM tenants t
WHERE t.slug = 'minhatela' AND v.tenant_id IS NULL;

UPDATE videos SET content_format = kind::text WHERE content_format = 'movie' AND kind::text <> 'movie';

CREATE INDEX IF NOT EXISTS videos_tenant_idx ON videos(tenant_id, is_published);
CREATE INDEX IF NOT EXISTS creators_tenant_idx ON creators(tenant_id, status);
CREATE INDEX IF NOT EXISTS content_rights_tenant_idx ON content_rights(tenant_id, territory, status);

INSERT INTO feature_flags (key, enabled, description, payload) VALUES
(
  'enterprise_rbac_v1_enabled',
  TRUE,
  'RBAC permissions + tenant memberships + company portal',
  '{}'::jsonb
)
ON CONFLICT (key) DO NOTHING;
