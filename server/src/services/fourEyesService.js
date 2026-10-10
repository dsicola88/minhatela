'use strict';

const { query } = require('../config/database');
const auditRepository = require('../repositories/auditRepository');
const { createError } = require('../utils/errors');

async function countSuperAdmins() {
  try {
    const result = await query(
      `SELECT COUNT(DISTINCT ur.user_id)::int AS c
       FROM user_roles ur
       JOIN roles r ON r.id = ur.role_id
       WHERE r.code = 'super_admin'`
    );
    return result.rows[0]?.c || 0;
  } catch {
    return 1;
  }
}

async function request({ actorId, action, resourceType, resourceId, payload, reason, tenantId }) {
  if (!reason) throw createError(400, 'Motivo obrigatório', 'REASON_REQUIRED');
  const supers = await countSuperAdmins();
  if (supers < 2) {
    await auditRepository.write({
      actorId,
      action: `${action}.four_eyes_bypassed`,
      entity: resourceType,
      entityId: resourceId,
      tenantId,
      reason,
      metadata: { payload: payload || {}, superAdminCount: supers },
    });
    return { status: 'bypassed', executeNow: true };
  }

  const row = await query(
    `INSERT INTO four_eyes_requests (
       tenant_id, action, resource_type, resource_id, payload, reason, requested_by, status
     ) VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,'pending')
     RETURNING *`,
    [
      tenantId || null,
      action,
      resourceType,
      resourceId || null,
      JSON.stringify(payload || {}),
      reason,
      actorId,
    ]
  );

  await auditRepository.write({
    actorId,
    action: `${action}.four_eyes_requested`,
    entity: resourceType,
    entityId: resourceId,
    tenantId,
    reason,
  });

  return { status: 'pending', executeNow: false, request: map(row.rows[0]) };
}

async function decide(actorId, requestId, { approve, reason }, meta = {}) {
  const found = await query(`SELECT * FROM four_eyes_requests WHERE id = $1`, [requestId]);
  const row = found.rows[0];
  if (!row || row.status !== 'pending') {
    throw createError(404, 'Pedido four-eyes não encontrado', 'NOT_FOUND');
  }
  if (row.requested_by === actorId) {
    throw createError(403, 'O segundo par de olhos não pode ser o mesmo actor', 'FOUR_EYES_SAME_ACTOR');
  }
  const status = approve ? 'approved' : 'rejected';
  await query(
    `UPDATE four_eyes_requests
     SET status = $2, approved_by = $3, decided_at = NOW()
     WHERE id = $1`,
    [requestId, status, actorId]
  );
  await auditRepository.write({
    actorId,
    action: `four_eyes.${status}`,
    entity: row.resource_type,
    entityId: row.resource_id,
    reason: reason || row.reason,
    ip: meta.ip,
  });

  if (approve && row.action === 'tenant.suspend' && row.resource_id) {
    await query(
      `UPDATE tenants SET status = 'suspended', updated_at = NOW() WHERE id = $1`,
      [row.resource_id]
    );
    await query(
      `UPDATE four_eyes_requests SET status = 'executed' WHERE id = $1`,
      [requestId]
    );
    await auditRepository.write({
      actorId,
      action: 'tenant.suspended',
      entity: 'tenant',
      entityId: row.resource_id,
      tenantId: row.resource_id,
      reason: reason || row.reason,
      metadata: { fourEyesRequestId: requestId },
      ip: meta.ip,
    });
    return {
      status: 'executed',
      request: map({ ...row, status: 'executed', approved_by: actorId }),
    };
  }

  if (approve && row.action === 'role.grant_super_admin' && row.resource_id) {
    await query(
      `INSERT INTO user_roles (user_id, role_id)
       SELECT $1, id FROM roles WHERE code = 'super_admin'
       ON CONFLICT DO NOTHING`,
      [row.resource_id]
    );
    await query(
      `UPDATE four_eyes_requests SET status = 'executed' WHERE id = $1`,
      [requestId]
    );
    await auditRepository.write({
      actorId,
      action: 'role.super_admin_granted',
      entity: 'user',
      entityId: row.resource_id,
      reason: reason || row.reason,
      metadata: { fourEyesRequestId: requestId },
      ip: meta.ip,
    });
    return {
      status: 'executed',
      request: map({ ...row, status: 'executed', approved_by: actorId }),
    };
  }

  return { status, request: map({ ...row, status, approved_by: actorId }) };
}

async function listPending() {
  const result = await query(
    `SELECT * FROM four_eyes_requests WHERE status = 'pending' ORDER BY created_at DESC LIMIT 50`
  );
  return { items: result.rows.map(map) };
}

function map(row) {
  if (!row) return null;
  return {
    id: row.id,
    action: row.action,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    status: row.status,
    reason: row.reason,
    requestedBy: row.requested_by,
    approvedBy: row.approved_by,
    createdAt: row.created_at,
    payload: row.payload,
  };
}

module.exports = { countSuperAdmins, request, decide, listPending };
