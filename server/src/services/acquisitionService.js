'use strict';

const { query } = require('../config/database');
const auditRepository = require('../repositories/auditRepository');
const rbacService = require('./rbacService');
const { createError } = require('../utils/errors');

const STATUSES = [
  'prospect',
  'contacted',
  'negotiation',
  'contract_pending',
  'licensed',
  'ingesting',
  'qc',
  'approved',
  'published',
  'expiring',
  'expired',
  'rejected',
];

function mapRow(row) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    title: row.title,
    producerName: row.producer_name,
    companyId: row.company_id,
    contentId: row.content_id,
    territory: row.territory,
    monetization: row.monetization,
    status: row.status,
    contractRef: row.contract_ref,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function list({ status, tenantId, limit = 80 } = {}) {
  const result = await query(
    `SELECT * FROM content_acquisitions
     WHERE ($1::uuid IS NULL OR tenant_id = $1)
       AND ($2::text IS NULL OR status = $2)
     ORDER BY updated_at DESC
     LIMIT $3`,
    [tenantId || null, status || null, Math.min(200, Number(limit) || 80)]
  );
  return { items: result.rows.map(mapRow) };
}

async function create(actorId, body, meta = {}) {
  const title = String(body.title || '').trim();
  if (!title) throw createError(400, 'Título é obrigatório', 'VALIDATION');
  const tenantId = body.tenantId || (await rbacService.defaultTenantId());
  const status = STATUSES.includes(body.status) ? body.status : 'prospect';

  const result = await query(
    `INSERT INTO content_acquisitions (
       tenant_id, title, producer_name, company_id, content_id, territory,
       monetization, status, contract_ref, starts_at, ends_at, notes, created_by
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     RETURNING *`,
    [
      tenantId,
      title,
      body.producerName || null,
      body.companyId || null,
      body.contentId || null,
      body.territory || 'AO',
      body.monetization || 'svod',
      status,
      body.contractRef || null,
      body.startsAt || null,
      body.endsAt || null,
      body.notes || null,
      actorId,
    ]
  );

  await auditRepository.write({
    actorId,
    action: 'acquisition.created',
    entity: 'content_acquisition',
    entityId: result.rows[0].id,
    tenantId,
    reason: body.reason || null,
    ip: meta.ip,
  });

  return { item: mapRow(result.rows[0]) };
}

async function update(actorId, id, body, meta = {}) {
  if (body.status && !STATUSES.includes(body.status)) {
    throw createError(400, 'Estado inválido', 'VALIDATION');
  }
  const result = await query(
    `UPDATE content_acquisitions SET
       title = COALESCE($2, title),
       producer_name = COALESCE($3, producer_name),
       company_id = COALESCE($4, company_id),
       content_id = COALESCE($5, content_id),
       territory = COALESCE($6, territory),
       monetization = COALESCE($7, monetization),
       status = COALESCE($8, status),
       contract_ref = COALESCE($9, contract_ref),
       starts_at = COALESCE($10, starts_at),
       ends_at = COALESCE($11, ends_at),
       notes = COALESCE($12, notes),
       updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [
      id,
      body.title || null,
      body.producerName || null,
      body.companyId || null,
      body.contentId || null,
      body.territory || null,
      body.monetization || null,
      body.status || null,
      body.contractRef || null,
      body.startsAt || null,
      body.endsAt || null,
      body.notes || null,
    ]
  );
  if (!result.rowCount) throw createError(404, 'Aquisição não encontrada', 'NOT_FOUND');

  await auditRepository.write({
    actorId,
    action: 'acquisition.updated',
    entity: 'content_acquisition',
    entityId: id,
    tenantId: result.rows[0].tenant_id,
    reason: body.reason || null,
    metadata: { status: result.rows[0].status },
    ip: meta.ip,
  });

  return { item: mapRow(result.rows[0]) };
}

module.exports = { list, create, update, STATUSES };
