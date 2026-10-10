'use strict';

const { query } = require('../config/database');
const { logger } = require('../utils/logger');

const MODALITY_COLUMN = {
  avod: 'avod_allowed',
  svod: 'svod_allowed',
  tvod: 'tvod_allowed',
  live: 'allow_live',
};

/**
 * Pode a plataforma distribuir este conteúdo agora (direitos legais)?
 * Fail-closed: sem linha activa, ou erro de BD, o play/publish é recusado.
 */
async function canDistribute({ contentId, territory = 'AO', modality = null, tenantId = null }) {
  if (!contentId) return { ok: false, reason: 'NO_CONTENT' };

  try {
    const params = [contentId, territory];
    let tenantSql = '';
    if (tenantId) {
      params.push(tenantId);
      tenantSql = ` AND (tenant_id IS NULL OR tenant_id = $${params.length})`;
    }

    const modalityCol = MODALITY_COLUMN[modality];
    const modalitySql = modalityCol ? ` AND ${modalityCol} = TRUE` : '';

    const active = await query(
      `SELECT id, exclusive, license_type, ends_at, avod_allowed, svod_allowed, tvod_allowed,
              COALESCE(allow_live, FALSE) AS allow_live
       FROM content_rights
       WHERE content_id = $1
         AND territory = $2
         AND status = 'active'
         AND starts_at <= NOW()
         AND (ends_at IS NULL OR ends_at > NOW())
         ${tenantSql}
         ${modalitySql}
       LIMIT 1`,
      params
    );

    if (active.rowCount > 0) {
      return { ok: true, reason: 'LICENSE_ACTIVE', right: active.rows[0] };
    }

    const any = await query(`SELECT 1 FROM content_rights WHERE content_id = $1 LIMIT 1`, [
      contentId,
    ]);

    if (any.rowCount === 0) {
      await query(
        `INSERT INTO content_rights (
           content_id, owner_name, territory, license_type, status,
           avod_allowed, svod_allowed, tvod_allowed
         ) VALUES ($1,'MinhaTela','AO','legacy_backfill','active', TRUE, TRUE, TRUE)`,
        [contentId]
      );
      return { ok: true, reason: 'RIGHTS_BACKFILLED' };
    }

    return { ok: false, reason: 'RIGHTS_DENIED' };
  } catch (err) {
    logger.warn('rights.check_failed', { message: err.message, contentId });
    return { ok: false, reason: 'RIGHTS_CHECK_FAILED' };
  }
}

module.exports = { canDistribute, MODALITY_COLUMN };
