'use strict';

const { query } = require('../config/database');
const crypto = require('crypto');

function genCode(prefix = 'MT') {
  const raw = crypto.randomBytes(5).toString('hex').toUpperCase();
  return `${prefix}${raw}`.slice(0, 16);
}

async function create({ purchaserUserId, days, recipientEmail, message, code }) {
  const c = code || genCode('GIFT');
  const result = await query(
    `INSERT INTO gift_codes (code, days, purchaser_user_id, recipient_email, message)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      String(c).toUpperCase().replace(/\s+/g, ''),
      Number(days) || 30,
      purchaserUserId || null,
      recipientEmail || null,
      message || null,
    ]
  );
  return result.rows[0];
}

async function findByCode(code) {
  const result = await query(
    `SELECT * FROM gift_codes WHERE code = $1`,
    [String(code || '').toUpperCase().trim()]
  );
  return result.rows[0] || null;
}

async function listByPurchaser(userId, limit = 20) {
  const result = await query(
    `SELECT * FROM gift_codes
     WHERE purchaser_user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit]
  );
  return result.rows;
}

async function redeemInTransaction(client, { giftId, userId }) {
  const lock = await client.query(
    `SELECT * FROM gift_codes WHERE id = $1 FOR UPDATE`,
    [giftId]
  );
  const gift = lock.rows[0];
  if (!gift) return { error: 'NOT_FOUND' };
  if (gift.status !== 'active') return { error: 'UNAVAILABLE' };
  if (gift.expires_at && new Date(gift.expires_at) < new Date()) {
    await client.query(`UPDATE gift_codes SET status = 'expired' WHERE id = $1`, [giftId]);
    return { error: 'EXPIRED' };
  }
  if (gift.purchaser_user_id && gift.purchaser_user_id === userId) {
    return { error: 'SELF' };
  }

  await client.query(
    `UPDATE gift_codes
     SET status = 'redeemed', redeemed_by = $2, redeemed_at = NOW()
     WHERE id = $1`,
    [giftId, userId]
  );
  return { gift };
}

async function adminList(limit = 50) {
  const result = await query(
    `SELECT g.*, u.email AS purchaser_email, r.email AS redeemed_email
     FROM gift_codes g
     LEFT JOIN users u ON u.id = g.purchaser_user_id
     LEFT JOIN users r ON r.id = g.redeemed_by
     ORDER BY g.created_at DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}

async function revoke(giftId) {
  const result = await query(
    `UPDATE gift_codes SET status = 'revoked'
     WHERE id = $1 AND status = 'active'
     RETURNING *`,
    [giftId]
  );
  return result.rows[0] || null;
}

module.exports = {
  genCode,
  create,
  findByCode,
  listByPurchaser,
  redeemInTransaction,
  adminList,
  revoke,
};
