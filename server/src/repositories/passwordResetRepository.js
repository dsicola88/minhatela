'use strict';

const crypto = require('crypto');
const { query } = require('../config/database');

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function create({ userId, ttlMinutes = 30, ip, userAgent }) {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

  await query(
    `INSERT INTO password_reset_tokens
      (user_id, token_hash, expires_at, request_ip, user_agent)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, tokenHash, expiresAt.toISOString(), ip || null, userAgent || null]
  );

  return { token, expiresAt };
}

async function findValid(token) {
  const tokenHash = hashToken(token);
  const result = await query(
    `SELECT id, user_id, expires_at, used_at
     FROM password_reset_tokens
     WHERE token_hash = $1
     LIMIT 1`,
    [tokenHash]
  );
  const row = result.rows[0];
  if (!row) return null;
  if (row.used_at) return null;
  if (new Date(row.expires_at) <= new Date()) return null;
  return row;
}

async function markUsed(id) {
  await query(
    `UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1`,
    [id]
  );
}

async function invalidateUserTokens(userId) {
  await query(
    `UPDATE password_reset_tokens
     SET used_at = COALESCE(used_at, NOW())
     WHERE user_id = $1 AND used_at IS NULL`,
    [userId]
  );
}

module.exports = {
  create,
  findValid,
  markUsed,
  invalidateUserTokens,
};
