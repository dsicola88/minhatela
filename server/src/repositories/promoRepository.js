'use strict';

const { query } = require('../config/database');

function mapPromo(row) {
  return {
    id: row.id,
    code: row.code,
    description: row.description,
    kind: row.kind,
    valueInt: row.value_int,
    maxRedemptions: row.max_redemptions,
    redemptionCount: row.redemption_count,
    perUserLimit: row.per_user_limit,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

async function findByCode(normalized) {
  const result = await query(
    `SELECT * FROM promo_codes WHERE code_normalized = $1 LIMIT 1`,
    [normalized]
  );
  return result.rows[0] || null;
}

async function listAll({ limit = 50 } = {}) {
  const result = await query(
    `SELECT * FROM promo_codes
     ORDER BY created_at DESC
     LIMIT $1`,
    [Math.min(200, Number(limit) || 50)]
  );
  return result.rows.map(mapPromo);
}

async function create({
  code,
  description,
  kind,
  valueInt,
  maxRedemptions,
  perUserLimit,
  startsAt,
  endsAt,
  createdBy,
}) {
  const normalized = String(code || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
  const result = await query(
    `INSERT INTO promo_codes
      (code, code_normalized, description, kind, value_int, max_redemptions,
       per_user_limit, starts_at, ends_at, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8, NOW()),$9,$10)
     RETURNING *`,
    [
      code.trim().toUpperCase(),
      normalized,
      description || null,
      kind || 'premium_days',
      Number(valueInt) || 7,
      maxRedemptions != null ? Number(maxRedemptions) : null,
      Number(perUserLimit) || 1,
      startsAt || null,
      endsAt || null,
      createdBy || null,
    ]
  );
  return mapPromo(result.rows[0]);
}

async function setActive(promoId, isActive) {
  const result = await query(
    `UPDATE promo_codes
     SET is_active = $2, updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [promoId, Boolean(isActive)]
  );
  return result.rows[0] ? mapPromo(result.rows[0]) : null;
}

async function countUserRedemptions(promoId, userId) {
  const result = await query(
    `SELECT COUNT(*)::int AS c FROM promo_redemptions
     WHERE promo_id = $1 AND user_id = $2`,
    [promoId, userId]
  );
  return result.rows[0].c;
}

async function redeemInTransaction(client, {
  promoId,
  userId,
  profileId,
  grantedDays,
  premiumExpiresAt,
  ip,
}) {
  const locked = await client.query(
    `SELECT * FROM promo_codes WHERE id = $1 FOR UPDATE`,
    [promoId]
  );
  const promo = locked.rows[0];
  if (!promo) return { error: 'NOT_FOUND' };

  if (!promo.is_active) return { error: 'INACTIVE' };
  if (promo.starts_at && new Date(promo.starts_at) > new Date()) return { error: 'NOT_STARTED' };
  if (promo.ends_at && new Date(promo.ends_at) < new Date()) return { error: 'EXPIRED' };
  if (promo.max_redemptions != null && promo.redemption_count >= promo.max_redemptions) {
    return { error: 'SOLD_OUT' };
  }

  const existing = await client.query(
    `SELECT id FROM promo_redemptions WHERE promo_id = $1 AND user_id = $2`,
    [promoId, userId]
  );
  if (existing.rowCount > 0) return { error: 'ALREADY_USED' };

  await client.query(
    `UPDATE promo_codes SET redemption_count = redemption_count + 1, updated_at = NOW()
     WHERE id = $1`,
    [promoId]
  );

  const red = await client.query(
    `INSERT INTO promo_redemptions
      (promo_id, user_id, profile_id, granted_days, premium_expires_at, ip)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING *`,
    [promoId, userId, profileId || null, grantedDays, premiumExpiresAt, ip || null]
  );

  return { promo, redemption: red.rows[0] };
}

module.exports = {
  mapPromo,
  findByCode,
  listAll,
  create,
  setActive,
  countUserRedemptions,
  redeemInTransaction,
};
