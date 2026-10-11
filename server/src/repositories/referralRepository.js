'use strict';

const { query, withTransaction } = require('../config/database');
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
  return withTransaction(async (client) => {
    const found = await client.query(
      `SELECT * FROM referrals
       WHERE upper(code) = upper($1)
         AND status = 'active'
         AND expires_at > NOW()
         AND invitee_user_id IS NULL
       FOR UPDATE`,
      [code]
    );
    const row = found.rows[0];
    if (!row) return { error: 'INVALID' };
    if (row.referrer_user_id === inviteeUserId) return { error: 'SELF' };

    const updated = await client.query(
      `UPDATE referrals SET
         invitee_user_id = $2,
         invitee_email = $3,
         status = 'redeemed',
         redeemed_at = NOW()
       WHERE id = $1 AND status = 'active' AND invitee_user_id IS NULL
       RETURNING *`,
      [row.id, inviteeUserId, inviteeEmail || null]
    );
    const referral = updated.rows[0];
    if (!referral) return { error: 'INVALID' };

    const days = String(referral.reward_days || 7);
    const ids = [inviteeUserId, referral.referrer_user_id];
    const locked = await client.query(
      `SELECT id FROM users WHERE id = ANY($1::uuid[]) FOR UPDATE`,
      [ids]
    );
    if (locked.rowCount < 2) return { error: 'INVALID' };

    await client.query(
      `UPDATE users SET
         subscription_status = 'premium_active',
         premium_expires_at = GREATEST(COALESCE(premium_expires_at, NOW()), NOW())
           + ($2 || ' days')::interval,
         updated_at = NOW()
       WHERE id = ANY($1::uuid[])`,
      [ids, days]
    );

    return { referral };
  });
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
