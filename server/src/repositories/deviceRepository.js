'use strict';

const { query } = require('../config/database');

async function upsertDevice({
  userId,
  deviceKey,
  deviceName,
  platform,
  userAgent,
  ip,
}) {
  const result = await query(
    `INSERT INTO device_sessions
      (user_id, device_key, device_name, platform, user_agent, ip, last_seen_at, revoked_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW(), NULL)
     ON CONFLICT (user_id, device_key) DO UPDATE SET
       device_name = COALESCE(EXCLUDED.device_name, device_sessions.device_name),
       platform = COALESCE(EXCLUDED.platform, device_sessions.platform),
       user_agent = EXCLUDED.user_agent,
       ip = EXCLUDED.ip,
       last_seen_at = NOW(),
       revoked_at = NULL
     RETURNING id, user_id, device_key, device_name, platform, last_seen_at, created_at, revoked_at`,
    [
      userId,
      deviceKey,
      deviceName || 'Dispositivo',
      platform || 'unknown',
      userAgent || null,
      ip || null,
    ]
  );
  return result.rows[0];
}

async function listByUser(userId) {
  const result = await query(
    `SELECT id, device_key, device_name, platform, ip, last_seen_at, created_at, revoked_at
     FROM device_sessions
     WHERE user_id = $1 AND revoked_at IS NULL
     ORDER BY last_seen_at DESC`,
    [userId]
  );
  return result.rows;
}

async function revoke(deviceId, userId) {
  const result = await query(
    `UPDATE device_sessions
     SET revoked_at = NOW()
     WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL
     RETURNING id`,
    [deviceId, userId]
  );
  return result.rows[0] || null;
}

async function touch(deviceId) {
  await query(
    `UPDATE device_sessions SET last_seen_at = NOW() WHERE id = $1 AND revoked_at IS NULL`,
    [deviceId]
  );
}

module.exports = {
  upsertDevice,
  listByUser,
  revoke,
  touch,
};
