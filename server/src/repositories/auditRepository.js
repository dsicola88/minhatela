'use strict';

const { query } = require('../config/database');

async function write({ actorId, action, entity, entityId, metadata, ip, userAgent }) {
  await query(
    `INSERT INTO audit_logs (actor_id, action, entity, entity_id, metadata, ip, user_agent)
     VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7)`,
    [
      actorId || null,
      action,
      entity,
      entityId || null,
      JSON.stringify(metadata || {}),
      ip || null,
      userAgent || null,
    ]
  );
}

async function listRecent({ limit = 50, action, entity } = {}) {
  const result = await query(
    `SELECT a.id, a.action, a.entity, a.entity_id, a.metadata, a.ip, a.created_at,
            u.email AS actor_email, u.full_name AS actor_name
     FROM audit_logs a
     LEFT JOIN users u ON u.id = a.actor_id
     WHERE ($1::text IS NULL OR a.action = $1)
       AND ($2::text IS NULL OR a.entity = $2)
     ORDER BY a.created_at DESC
     LIMIT $3`,
    [action || null, entity || null, Math.min(200, Number(limit) || 50)]
  );
  return result.rows;
}

module.exports = { write, listRecent };
