'use strict';

const { query } = require('../config/database');

async function upsert({ userId, token, platform, deviceKey }) {
  const result = await query(
    `INSERT INTO push_tokens (user_id, token, platform, device_key, last_seen_at, revoked_at)
     VALUES ($1,$2,$3,$4,NOW(),NULL)
     ON CONFLICT (user_id, token) DO UPDATE SET
       platform = EXCLUDED.platform,
       device_key = EXCLUDED.device_key,
       last_seen_at = NOW(),
       revoked_at = NULL
     RETURNING id, token, platform, last_seen_at`,
    [userId, token, platform || 'unknown', deviceKey || null]
  );
  return result.rows[0];
}

async function revoke(userId, token) {
  await query(
    `UPDATE push_tokens SET revoked_at = NOW()
     WHERE user_id = $1 AND token = $2 AND revoked_at IS NULL`,
    [userId, token]
  );
}

async function listActiveByUser(userId) {
  const result = await query(
    `SELECT token, platform FROM push_tokens
     WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId]
  );
  return result.rows;
}

async function listActiveByUsers(userIds) {
  if (!userIds?.length) return [];
  const result = await query(
    `SELECT user_id, token, platform FROM push_tokens
     WHERE user_id = ANY($1::uuid[]) AND revoked_at IS NULL`,
    [userIds]
  );
  return result.rows;
}

module.exports = {
  upsert,
  revoke,
  listActiveByUser,
  listActiveByUsers,
};
