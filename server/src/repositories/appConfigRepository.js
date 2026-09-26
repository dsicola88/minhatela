'use strict';

const { query } = require('../config/database');

async function listAll() {
  const result = await query(
    `SELECT key, value, description, updated_by, updated_at
     FROM app_settings
     ORDER BY key`
  );
  return result.rows;
}

async function get(key) {
  const result = await query(
    `SELECT key, value, description, updated_by, updated_at
     FROM app_settings WHERE key = $1`,
    [key]
  );
  return result.rows[0] || null;
}

async function upsert(key, value, { description, updatedBy } = {}) {
  const result = await query(
    `INSERT INTO app_settings (key, value, description, updated_by, updated_at)
     VALUES ($1, $2::jsonb, $3, $4, NOW())
     ON CONFLICT (key) DO UPDATE SET
       value = EXCLUDED.value,
       description = COALESCE(EXCLUDED.description, app_settings.description),
       updated_by = EXCLUDED.updated_by,
       updated_at = NOW()
     RETURNING key, value, description, updated_by, updated_at`,
    [key, JSON.stringify(value ?? {}), description || null, updatedBy || null]
  );
  return result.rows[0];
}

module.exports = { listAll, get, upsert };
