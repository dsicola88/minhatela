'use strict';

const { query } = require('../config/database');
const auditRepository = require('../repositories/auditRepository');
const rbacService = require('./rbacService');
const { createError } = require('../utils/errors');

function mapRight(row) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    contentId: row.content_id,
    rightsOwnerId: row.rights_owner_id,
    ownerName: row.owner_name,
    territory: row.territory,
    licenseType: row.license_type,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    exclusive: row.exclusive,
    allowAvod: row.avod_allowed,
    allowSvod: row.svod_allowed,
    allowTvod: row.tvod_allowed,
    allowLive: row.allow_live,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function list({ contentId, tenantId, limit = 80 } = {}) {
  const result = await query(
    `SELECT * FROM content_rights
     WHERE ($1::uuid IS NULL OR content_id = $1)
       AND ($2::uuid IS NULL OR tenant_id = $2 OR tenant_id IS NULL)
     ORDER BY updated_at DESC NULLS LAST, created_at DESC
     LIMIT $3`,
    [contentId || null, tenantId || null, Math.min(200, Number(limit) || 80)]
  );
  return { items: result.rows.map(mapRight) };
}

async function create(actorId, body, meta = {}) {
  if (!body.contentId) throw createError(400, 'contentId obrigatório', 'VALIDATION');
  const tenantId = body.tenantId || (await rbacService.defaultTenantId());
  const result = await query(
    `INSERT INTO content_rights (
       content_id, owner_name, territory, license_type, starts_at, ends_at,
       exclusive, avod_allowed, svod_allowed, tvod_allowed, status,
       tenant_id, rights_owner_id, allow_live
     ) VALUES (
       $1,$2,$3,$4,COALESCE($5, NOW()),$6,
       COALESCE($7, FALSE), COALESCE($8, TRUE), COALESCE($9, TRUE), COALESCE($10, TRUE),
       COALESCE($11, 'active'), $12, $13, COALESCE($14, FALSE)
     ) RETURNING *`,
    [
      body.contentId,
      body.ownerName || null,
      body.territory || 'AO',
      body.licenseType || 'distribution',
      body.startsAt || null,
      body.endsAt || null,
      body.exclusive,
      body.allowAvod,
      body.allowSvod,
      body.allowTvod,
      body.status || 'active',
      tenantId,
      body.rightsOwnerId || null,
      body.allowLive,
    ]
  );

  await auditRepository.write({
    actorId,
    action: 'rights.created',
    entity: 'content_right',
    entityId: result.rows[0].id,
    tenantId,
    reason: body.reason || null,
    metadata: { contentId: body.contentId, territory: body.territory || 'AO' },
    ip: meta.ip,
  });

  return { item: mapRight(result.rows[0]) };
}

async function update(actorId, id, body, meta = {}) {
  const result = await query(
    `UPDATE content_rights SET
       owner_name = COALESCE($2, owner_name),
       territory = COALESCE($3, territory),
       license_type = COALESCE($4, license_type),
       ends_at = COALESCE($5, ends_at),
       exclusive = COALESCE($6, exclusive),
       avod_allowed = COALESCE($7, avod_allowed),
       svod_allowed = COALESCE($8, svod_allowed),
       tvod_allowed = COALESCE($9, tvod_allowed),
       allow_live = COALESCE($10, allow_live),
       status = COALESCE($11, status),
       rights_owner_id = COALESCE($12, rights_owner_id),
       updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [
      id,
      body.ownerName || null,
      body.territory || null,
      body.licenseType || null,
      body.endsAt || null,
      body.exclusive,
      body.allowAvod,
      body.allowSvod,
      body.allowTvod,
      body.allowLive,
      body.status || null,
      body.rightsOwnerId || null,
    ]
  );
  if (!result.rowCount) throw createError(404, 'Direito não encontrado', 'NOT_FOUND');

  await auditRepository.write({
    actorId,
    action: 'rights.updated',
    entity: 'content_right',
    entityId: id,
    tenantId: result.rows[0].tenant_id,
    reason: body.reason || null,
    metadata: { status: result.rows[0].status },
    ip: meta.ip,
  });

  return { item: mapRight(result.rows[0]) };
}

module.exports = { list, create, update };
