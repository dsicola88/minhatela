'use strict';

const { query } = require('../config/database');
const crypto = require('crypto');

async function setTrusted(deviceId, userId, trusted) {
  const result = await query(
    `UPDATE device_sessions
     SET is_trusted = $3,
         trusted_at = CASE WHEN $3 THEN NOW() ELSE NULL END
     WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL
     RETURNING *`,
    [deviceId, userId, Boolean(trusted)]
  );
  return result.rows[0] || null;
}

async function renameDevice(deviceId, userId, name) {
  const result = await query(
    `UPDATE device_sessions
     SET device_name = $3
     WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL
     RETURNING *`,
    [deviceId, userId, String(name).trim().slice(0, 120)]
  );
  return result.rows[0] || null;
}

async function listTrusted(userId) {
  const result = await query(
    `SELECT id, device_key, device_name, platform, ip, last_seen_at, is_trusted, trusted_at, created_at
     FROM device_sessions
     WHERE user_id = $1 AND revoked_at IS NULL
     ORDER BY is_trusted DESC, last_seen_at DESC`,
    [userId]
  );
  return result.rows;
}

async function getActiveExperiments() {
  const result = await query(
    `SELECT * FROM experiments
     WHERE is_active = TRUE
       AND starts_at <= NOW()
       AND (ends_at IS NULL OR ends_at > NOW())
     ORDER BY key`
  );
  return result.rows;
}

async function getAssignment(experimentId, userId) {
  const result = await query(
    `SELECT * FROM experiment_assignments
     WHERE experiment_id = $1 AND user_id = $2`,
    [experimentId, userId]
  );
  return result.rows[0] || null;
}

async function assignVariant(experimentId, userId, variant) {
  const result = await query(
    `INSERT INTO experiment_assignments (experiment_id, user_id, variant)
     VALUES ($1, $2, $3)
     ON CONFLICT (experiment_id, user_id) DO UPDATE SET variant = EXCLUDED.variant
     RETURNING *`,
    [experimentId, userId, variant]
  );
  return result.rows[0];
}

function stableVariant(userId, experimentKey, variants) {
  const hash = crypto.createHash('sha256').update(`${userId}:${experimentKey}`).digest('hex');
  const n = parseInt(hash.slice(0, 8), 16);
  const list = Array.isArray(variants) && variants.length ? variants : ['control'];
  return list[n % list.length];
}

async function trackSearch({ userId, profileId, query, resultsCount }) {
  const q = String(query || '').trim().slice(0, 200);
  if (q.length < 2) return;
  await query(
    `INSERT INTO search_events (user_id, profile_id, query, results_count)
     VALUES ($1, $2, $3, $4)`,
    [userId || null, profileId || null, q, Number(resultsCount) || 0]
  );
}

async function trendingSearches({ days = 7, limit = 12 } = {}) {
  const result = await query(
    `SELECT lower(trim(query)) AS query, COUNT(*)::int AS count
     FROM search_events
     WHERE created_at > NOW() - ($1 || ' days')::interval
       AND length(trim(query)) >= 2
       AND market = 'AO'
     GROUP BY lower(trim(query))
     ORDER BY count DESC, query ASC
     LIMIT $2`,
    [String(days), limit]
  );
  return result.rows;
}

async function adminListExperiments() {
  const result = await query(
    `SELECT e.*,
            (SELECT COUNT(*)::int FROM experiment_assignments a WHERE a.experiment_id = e.id) AS assignments
     FROM experiments e
     ORDER BY e.created_at DESC`
  );
  return result.rows;
}

module.exports = {
  setTrusted,
  renameDevice,
  listTrusted,
  getActiveExperiments,
  getAssignment,
  assignVariant,
  stableVariant,
  trackSearch,
  trendingSearches,
  adminListExperiments,
};
