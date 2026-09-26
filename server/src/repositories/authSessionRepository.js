'use strict';

const crypto = require('crypto');
const { query } = require('../config/database');

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function generateRefreshToken() {
  return crypto.randomBytes(48).toString('base64url');
}

async function create({
  userId,
  deviceName,
  platform,
  ip,
  userAgent,
  ttlDays = 30,
}) {
  const refreshToken = generateRefreshToken();
  const refreshTokenHash = hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

  const result = await query(
    `INSERT INTO auth_sessions
      (user_id, refresh_token_hash, device_name, platform, ip, user_agent, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING id, device_name, platform, ip, last_seen_at, expires_at, created_at`,
    [
      userId,
      refreshTokenHash,
      deviceName || 'Dispositivo',
      platform || 'unknown',
      ip || null,
      userAgent || null,
      expiresAt.toISOString(),
    ]
  );

  return {
    session: result.rows[0],
    refreshToken,
  };
}

async function findActiveByRefreshToken(refreshToken) {
  const hash = hashToken(refreshToken);
  const result = await query(
    `SELECT *
     FROM auth_sessions
     WHERE refresh_token_hash = $1
       AND revoked_at IS NULL
       AND expires_at > NOW()`,
    [hash]
  );
  return result.rows[0] || null;
}

async function findActiveById(sessionId, userId) {
  const result = await query(
    `SELECT id, user_id, device_name, platform, ip, last_seen_at, expires_at, created_at, revoked_at
     FROM auth_sessions
     WHERE id = $1
       AND user_id = $2
       AND revoked_at IS NULL
       AND expires_at > NOW()`,
    [sessionId, userId]
  );
  return result.rows[0] || null;
}

async function touch(sessionId) {
  await query(
    `UPDATE auth_sessions SET last_seen_at = NOW() WHERE id = $1 AND revoked_at IS NULL`,
    [sessionId]
  );
}

async function rotateRefreshToken(sessionId) {
  const refreshToken = generateRefreshToken();
  const hash = hashToken(refreshToken);
  await query(
    `UPDATE auth_sessions
     SET refresh_token_hash = $2, last_seen_at = NOW()
     WHERE id = $1 AND revoked_at IS NULL`,
    [sessionId, hash]
  );
  return refreshToken;
}

async function listByUser(userId) {
  const result = await query(
    `SELECT id, device_name, platform, ip, last_seen_at, expires_at, created_at, revoked_at
     FROM auth_sessions
     WHERE user_id = $1
       AND revoked_at IS NULL
       AND expires_at > NOW()
     ORDER BY last_seen_at DESC
     LIMIT 20`,
    [userId]
  );
  return result.rows;
}

async function revoke(sessionId, userId) {
  const result = await query(
    `UPDATE auth_sessions
     SET revoked_at = NOW()
     WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL
     RETURNING id`,
    [sessionId, userId]
  );
  return result.rows[0] || null;
}

async function revokeAllExcept(userId, keepSessionId) {
  const result = await query(
    `UPDATE auth_sessions
     SET revoked_at = NOW()
     WHERE user_id = $1
       AND revoked_at IS NULL
       AND ($2::uuid IS NULL OR id <> $2)
     RETURNING id`,
    [userId, keepSessionId || null]
  );
  return result.rowCount;
}

async function revokeById(sessionId) {
  await query(
    `UPDATE auth_sessions SET revoked_at = NOW() WHERE id = $1 AND revoked_at IS NULL`,
    [sessionId]
  );
}

module.exports = {
  create,
  findActiveByRefreshToken,
  findActiveById,
  touch,
  rotateRefreshToken,
  listByUser,
  revoke,
  revokeAllExcept,
  revokeById,
  hashToken,
};
