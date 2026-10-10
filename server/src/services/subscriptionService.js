'use strict';

const { query } = require('../config/database');

function isPremiumActive(user) {
  if (!user || user.subscription_status !== 'premium_active') return false;
  if (!user.premium_expires_at) return true;
  return new Date(user.premium_expires_at) > new Date();
}

function publicStatus(user) {
  if (isPremiumActive(user)) return 'premium_active';
  if (user?.premium_expires_at && new Date(user.premium_expires_at) <= new Date()) {
    return 'premium_expired';
  }
  return user?.subscription_status || 'none';
}

async function syncExpired(user) {
  if (!user) return user;
  if (
    user.subscription_status === 'premium_active' &&
    user.premium_expires_at &&
    new Date(user.premium_expires_at) <= new Date()
  ) {
    await query(
      `UPDATE users
       SET subscription_status = 'premium_expired', updated_at = NOW()
       WHERE id = $1
         AND subscription_status = 'premium_active'
         AND premium_expires_at IS NOT NULL
         AND premium_expires_at <= NOW()`,
      [user.id]
    ).catch(() => {});
    return { ...user, subscription_status: 'premium_expired' };
  }
  return user;
}

async function cancelForUser(userId, { reason } = {}) {
  const { createError } = require('../utils/errors');
  const result = await query(
    `UPDATE users
     SET subscription_status = 'premium_expired',
         premium_expires_at = NOW(),
         updated_at = NOW()
     WHERE id = $1
       AND subscription_status = 'premium_active'
     RETURNING id, subscription_status, premium_expires_at`,
    [userId]
  );
  if (!result.rowCount) {
    throw createError(409, 'Não há assinatura Premium activa para cancelar', 'NO_ACTIVE_SUBSCRIPTION');
  }
  return {
    cancelled: true,
    reason: reason || 'user_requested',
    subscriptionStatus: 'premium_expired',
    premiumExpiresAt: result.rows[0].premium_expires_at,
    message: 'Assinatura cancelada. O catálogo gratuito (AVOD) continua disponível.',
  };
}

async function expireOverdue({ limit = 500 } = {}) {
  const result = await query(
    `UPDATE users
     SET subscription_status = 'premium_expired', updated_at = NOW()
     WHERE id IN (
       SELECT id FROM users
       WHERE subscription_status = 'premium_active'
         AND premium_expires_at IS NOT NULL
         AND premium_expires_at <= NOW()
         AND deleted_at IS NULL
       LIMIT $1
     )
     RETURNING id`,
    [Math.min(2000, Number(limit) || 500)]
  );
  return { expired: result.rowCount };
}

module.exports = {
  isPremiumActive,
  publicStatus,
  syncExpired,
  expireOverdue,
  cancelForUser,
};
