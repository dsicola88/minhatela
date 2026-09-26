'use strict';

const { query } = require('../config/database');

async function isEnabled(key, defaultValue = false) {
  const result = await query(
    `SELECT enabled FROM feature_flags WHERE key = $1`,
    [key]
  );
  if (!result.rowCount) return defaultValue;
  return Boolean(result.rows[0].enabled);
}

async function assertEnabled(key, message) {
  const ok = await isEnabled(key, true);
  if (!ok) {
    const { createError } = require('../utils/errors');
    throw createError(503, message || 'Funcionalidade temporariamente indisponível', 'FEATURE_DISABLED');
  }
}

async function assertNotMaintenance() {
  const maintenance = await isEnabled('maintenance_mode', false);
  if (maintenance) {
    const { createError } = require('../utils/errors');
    throw createError(503, 'MinhaTela em manutenção. Tente mais tarde.', 'MAINTENANCE');
  }
}

async function listAll() {
  const result = await query(
    `SELECT key, enabled, description, payload, updated_at
     FROM feature_flags ORDER BY key`
  );
  return result.rows.map((row) => ({
    key: row.key,
    enabled: row.enabled,
    description: row.description,
    payload: row.payload,
    updatedAt: row.updated_at,
  }));
}

async function setFlag(key, enabled) {
  const result = await query(
    `UPDATE feature_flags
     SET enabled = $2, updated_at = NOW()
     WHERE key = $1
     RETURNING key, enabled, description, payload, updated_at`,
    [key, Boolean(enabled)]
  );
  return result.rows[0]
    ? {
        key: result.rows[0].key,
        enabled: result.rows[0].enabled,
        description: result.rows[0].description,
        payload: result.rows[0].payload,
        updatedAt: result.rows[0].updated_at,
      }
    : null;
}

module.exports = {
  isEnabled,
  assertEnabled,
  assertNotMaintenance,
  listAll,
  setFlag,
};
