'use strict';

const { query } = require('../config/database');

async function track({
  eventName,
  userId,
  profileId,
  contentId,
  sessionId,
  metadata,
}) {
  if (contentId) {
    const { videoTenantSql } = require('../utils/tenantScope');
    const allowed = await query(
      `SELECT 1 FROM videos v WHERE v.id = $1 AND ${videoTenantSql('v')} LIMIT 1`,
      [contentId]
    );
    if (!allowed.rowCount) {
      const { createError } = require('../utils/errors');
      throw createError(404, 'Conteúdo não encontrado', 'CONTENT_NOT_FOUND');
    }
  }
  await query(
    `INSERT INTO analytics_events
      (event_name, user_id, profile_id, content_id, session_id, metadata)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
    [
      eventName,
      userId || null,
      profileId || null,
      contentId || null,
      sessionId || null,
      JSON.stringify(metadata || {}),
    ]
  );
}

module.exports = { track };
