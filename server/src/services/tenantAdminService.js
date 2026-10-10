'use strict';

const { query } = require('../config/database');
const auditRepository = require('../repositories/auditRepository');
const { createError } = require('../utils/errors');

function mapTenant(row) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    market: row.market,
    status: row.status,
    settings: row.settings || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function list() {
  const result = await query(`SELECT * FROM tenants ORDER BY created_at ASC`);
  return { tenants: result.rows.map(mapTenant) };
}

async function create(actorId, body, meta = {}) {
  const slug = String(body.slug || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, '');
  const name = String(body.name || '').trim();
  if (!slug || !name) throw createError(400, 'slug e name são obrigatórios', 'VALIDATION');
  if (!body.reason) {
    throw createError(400, 'Motivo (reason) obrigatório para criar tenant', 'REASON_REQUIRED');
  }

  const result = await query(
    `INSERT INTO tenants (slug, name, market, status, settings)
     VALUES ($1, $2, $3, 'active', $4::jsonb)
     RETURNING *`,
    [slug, name, body.market || 'AO', JSON.stringify(body.settings || {})]
  );

  await auditRepository.write({
    actorId,
    action: 'tenant.created',
    entity: 'tenant',
    entityId: result.rows[0].id,
    tenantId: result.rows[0].id,
    reason: body.reason,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return { tenant: mapTenant(result.rows[0]) };
}

async function update(actorId, id, body, meta = {}) {
  if (!body.reason) {
    throw createError(400, 'Motivo (reason) obrigatório para alterar tenant', 'REASON_REQUIRED');
  }
  if (body.status && !['active', 'suspended', 'pending'].includes(body.status)) {
    throw createError(400, 'Estado inválido', 'VALIDATION');
  }

  if (meta.user) {
    await require('./mfaService').assertStepUp(meta.user, body.mfaCode || meta.mfaCode);
  }

  if (body.status === 'suspended') {
    const gate = await require('./fourEyesService').request({
      actorId,
      action: 'tenant.suspend',
      resourceType: 'tenant',
      resourceId: id,
      payload: { status: body.status, name: body.name },
      reason: body.reason,
      tenantId: id,
    });
    if (!gate.executeNow) {
      return { pendingFourEyes: true, request: gate.request };
    }
  }

  const before = await query(`SELECT * FROM tenants WHERE id = $1`, [id]);
  if (!before.rowCount) throw createError(404, 'Tenant não encontrado', 'NOT_FOUND');

  const result = await query(
    `UPDATE tenants SET
       name = COALESCE($2, name),
       market = COALESCE($3, market),
       status = COALESCE($4, status),
       updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, body.name || null, body.market || null, body.status || null]
  );

  await auditRepository.write({
    actorId,
    action: body.status === 'suspended' ? 'tenant.suspended' : 'tenant.updated',
    entity: 'tenant',
    entityId: id,
    tenantId: id,
    reason: body.reason,
    metadata: {
      before: { status: before.rows[0].status, name: before.rows[0].name },
      after: { status: result.rows[0].status, name: result.rows[0].name },
    },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return { tenant: mapTenant(result.rows[0]) };
}

module.exports = { list, create, update };
