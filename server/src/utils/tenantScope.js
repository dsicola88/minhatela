'use strict';

const { AsyncLocalStorage } = require('async_hooks');

const als = new AsyncLocalStorage();
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value) {
  return Boolean(value && UUID.test(String(value)));
}

function runWithTenant(tenantId, fn, extras = {}) {
  const prev = als.getStore() || {};
  return als.run(
    {
      tenantId: isUuid(tenantId) ? tenantId : null,
      platformScope:
        extras.platformScope === undefined ? prev.platformScope : Boolean(extras.platformScope),
    },
    fn
  );
}

function currentTenantId() {
  const id = als.getStore()?.tenantId;
  return isUuid(id) ? id : null;
}

/** SuperAdmin em rotas de staff: vê a plataforma. O catálogo consumidor continua filtrado. */
function isPlatformScope() {
  return Boolean(als.getStore()?.platformScope);
}

/**
 * Visibilidade de catálogo:
 * - tenant actual: só linhas com esse tenant_id
 * - tenant default minhatela: também legado tenant_id NULL
 * - sem contexto: fallback minhatela (não misturar tenants novos)
 */
function videoTenantSql(alias = 'v') {
  const col = alias ? `${alias}.tenant_id` : 'tenant_id';
  const id = currentTenantId();
  if (!id) {
    return `(${col} IS NULL OR ${col} = (SELECT t.id FROM tenants t WHERE t.slug = 'minhatela' LIMIT 1))`;
  }
  return `(
    ${col} = '${id}'::uuid
    OR (
      ${col} IS NULL
      AND EXISTS (SELECT 1 FROM tenants t WHERE t.id = '${id}'::uuid AND t.slug = 'minhatela')
    )
  )`;
}

function opsVideoSql(alias = 'v') {
  if (isPlatformScope()) return 'TRUE';
  return videoTenantSql(alias);
}

function opsUserSql(userAlias = 'u') {
  if (isPlatformScope()) return 'TRUE';
  const col = `${userAlias}.id`;
  const id = currentTenantId();
  if (!id) {
    return `EXISTS (
      SELECT 1 FROM tenant_memberships tm
      JOIN tenants t ON t.id = tm.tenant_id
      WHERE tm.user_id = ${col}
        AND tm.status = 'active'
        AND t.slug = 'minhatela'
    )`;
  }
  return `EXISTS (
    SELECT 1 FROM tenant_memberships tm
    WHERE tm.user_id = ${col}
      AND tm.tenant_id = '${id}'::uuid
      AND tm.status = 'active'
  )`;
}

function tenantWriteSql() {
  const id = currentTenantId();
  if (id) return `'${id}'::uuid`;
  return `(SELECT t.id FROM tenants t WHERE t.slug = 'minhatela' LIMIT 1)`;
}

module.exports = {
  isUuid,
  runWithTenant,
  currentTenantId,
  isPlatformScope,
  videoTenantSql,
  opsVideoSql,
  opsUserSql,
  tenantWriteSql,
};
