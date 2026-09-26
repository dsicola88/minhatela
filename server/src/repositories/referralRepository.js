'use strict';

const { query } = require('../config/database');
const crypto = require('crypto');

function generateCode() {
  return `AO${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

async function getOrCreateCode(userId) {
  const existing = await query(
    `SELECT * FROM referrals
     WHERE referrer_user_id = $1 AND status = 'active' AND expires_at > NOW()
     ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );
  if (existing.rows[0]) return existing.rows[0];

  for (let i = 0; i < 5; i += 1) {
    const code = generateCode();
    try {
      const result = await query(
        `INSERT INTO referrals (referrer_user_id, code, reward_days)
         VALUES ($1,$2,7)
         RETURNING *`,
        [userId, code]
      );
      return result.rows[0];
    } catch {
      /* retry on unique collision */
    }
  }
  throw new Error('REFERRAL_CODE_FAILED');
}

async function findByCode(code) {
  const result = await query(
    `SELECT * FROM referrals
     WHERE upper(code) = upper($1)
       AND status = 'active'
       AND expires_at > NOW()
       AND invitee_user_id IS NULL`,
    [code]
  );
  return result.rows[0] || null;
}

async function redeem({ code, inviteeUserId, inviteeEmail }) {
  const row = await findByCode(code);
  if (!row) return { error: 'INVALID' };
  if (row.referrer_user_id === inviteeUserId) return { error: 'SELF' };

  const updated = await query(
    `UPDATE referrals SET
       invitee_user_id = $2,
       invitee_email = $3,
       status = 'redeemed',
       redeemed_at = NOW()
     WHERE id = $1 AND status = 'active'
     RETURNING *`,
    [row.id, inviteeUserId, inviteeEmail || null]
  );
  return { referral: updated.rows[0] };
}

async function stats(userId) {
  const result = await query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'redeemed')::int AS redeemed,
       COUNT(*) FILTER (WHERE status = 'active')::int AS active
     FROM referrals WHERE referrer_user_id = $1`,
    [userId]
  );
  return result.rows[0];
}

module.exports = { getOrCreateCode, findByCode, redeem, stats, generateCode };
