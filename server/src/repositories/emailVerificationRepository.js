'use strict';

const crypto = require('crypto');
const { query } = require('../config/database');

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function create({ userId, ttlHours = 48, ip, userAgent }) {
  await query(
    `UPDATE email_verification_tokens
     SET used_at = COALESCE(used_at, NOW())
     WHERE user_id = $1 AND used_at IS NULL`,
    [userId]
  );

  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + ttlHours * 3600 * 1000);

  await query(
    `INSERT INTO email_verification_tokens
      (user_id, token_hash, expires_at, request_ip, user_agent)
     VALUES ($1,$2,$3,$4,$5)`,
    [userId, tokenHash, expiresAt.toISOString(), ip || null, userAgent || null]
  );

  return { token, expiresAt };
}

async function findValid(token) {
  const tokenHash = hashToken(token);
  const result = await query(
    `SELECT id, user_id, expires_at, used_at
     FROM email_verification_tokens
     WHERE token_hash = $1
     LIMIT 1`,
    [tokenHash]
  );
  const row = result.rows[0];
  if (!row || row.used_at || new Date(row.expires_at) <= new Date()) return null;
  return row;
}

async function markUsed(id) {
  await query(`UPDATE email_verification_tokens SET used_at = NOW() WHERE id = $1`, [id]);
}

async function markUserVerified(userId) {
  await query(
    `UPDATE users SET email_verified_at = COALESCE(email_verified_at, NOW()), updated_at = NOW()
     WHERE id = $1`,
    [userId]
  );
}

module.exports = {
  create,
  findValid,
  markUsed,
  markUserVerified,
};
