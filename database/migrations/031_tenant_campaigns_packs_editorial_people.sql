-- Fase 31 · tenant_id em campanhas, packs, editorial e people
-- Incremental. Não apaga dados. Aplicar só em ambientes com 029.

ALTER TABLE advertisers
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL;

ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL;

ALTER TABLE tvod_packs
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL;

ALTER TABLE editorial_collections
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL;

ALTER TABLE people
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL;

UPDATE advertisers a
SET tenant_id = t.id
FROM tenants t
WHERE t.slug = 'minhatela' AND a.tenant_id IS NULL;

UPDATE campaigns c
SET tenant_id = t.id
FROM tenants t
WHERE t.slug = 'minhatela' AND c.tenant_id IS NULL;

UPDATE tvod_packs p
SET tenant_id = t.id
FROM tenants t
WHERE t.slug = 'minhatela' AND p.tenant_id IS NULL;

UPDATE editorial_collections e
SET tenant_id = t.id
FROM tenants t
WHERE t.slug = 'minhatela' AND e.tenant_id IS NULL;

UPDATE people p
SET tenant_id = t.id
FROM tenants t
WHERE t.slug = 'minhatela' AND p.tenant_id IS NULL;

CREATE INDEX IF NOT EXISTS advertisers_tenant_idx ON advertisers(tenant_id);
CREATE INDEX IF NOT EXISTS campaigns_tenant_idx ON campaigns(tenant_id, status);
CREATE INDEX IF NOT EXISTS tvod_packs_tenant_idx ON tvod_packs(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS editorial_collections_tenant_idx ON editorial_collections(tenant_id, is_published);
CREATE INDEX IF NOT EXISTS people_tenant_idx ON people(tenant_id);
