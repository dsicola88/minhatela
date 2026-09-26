'use strict';

const { withTransaction } = require('../config/database');
const promoRepository = require('../repositories/promoRepository');
const userRepository = require('../repositories/userRepository');
const auditRepository = require('../repositories/auditRepository');
const notificationService = require('./notificationService');
const { createError } = require('../utils/errors');
const { logger } = require('../utils/logger');

function normalizeCode(code) {
  return String(code || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

async function grantPremiumDays(client, userId, days) {
  const userRes = await client.query(
    `SELECT id, subscription_status, premium_expires_at FROM users WHERE id = $1 FOR UPDATE`,
    [userId]
  );
  const user = userRes.rows[0];
  if (!user) throw createError(404, 'Utilizador não encontrado', 'USER_NOT_FOUND');

  const now = new Date();
  const base =
    user.premium_expires_at && new Date(user.premium_expires_at) > now
      ? new Date(user.premium_expires_at)
      : now;
  const expires = new Date(base.getTime() + Number(days) * 24 * 3600 * 1000);

  await client.query(
    `UPDATE users
     SET subscription_status = 'premium_active',
         premium_expires_at = $2,
         updated_at = NOW()
     WHERE id = $1`,
    [userId, expires.toISOString()]
  );

  return expires;
}

async function redeem({ userId, code, profileId, ip, userAgent }) {
  const featureFlagService = require('./featureFlagService');
  await featureFlagService.assertNotMaintenance();
  await featureFlagService.assertEnabled('promos_enabled', 'Promoções temporariamente indisponíveis');

  const normalized = normalizeCode(code);
  if (!normalized || normalized.length < 3) {
    throw createError(400, 'Código inválido', 'VALIDATION');
  }

  const promo = await promoRepository.findByCode(normalized);
  if (!promo) {
    throw createError(404, 'Código promocional não encontrado', 'PROMO_NOT_FOUND');
  }
  if (promo.kind !== 'premium_days') {
    throw createError(400, 'Tipo de código ainda não suportado', 'PROMO_KIND');
  }

  const days = Number(promo.value_int) || 7;

  const result = await withTransaction(async (client) => {
    const outcome = await promoRepository.redeemInTransaction(client, {
      promoId: promo.id,
      userId,
      profileId,
      grantedDays: days,
      premiumExpiresAt: null,
      ip,
    });

    if (outcome.error === 'ALREADY_USED') {
      throw createError(409, 'Já utilizou este código', 'PROMO_ALREADY_USED');
    }
    if (outcome.error === 'SOLD_OUT') {
      throw createError(410, 'Código esgotado', 'PROMO_SOLD_OUT');
    }
    if (outcome.error === 'EXPIRED' || outcome.error === 'INACTIVE' || outcome.error === 'NOT_STARTED') {
      throw createError(410, 'Código indisponível', 'PROMO_UNAVAILABLE');
    }
    if (outcome.error) {
      throw createError(400, 'Não foi possível resgatar o código', 'PROMO_FAILED');
    }

    const expires = await grantPremiumDays(client, userId, days);
    await client.query(
      `UPDATE promo_redemptions SET premium_expires_at = $2 WHERE id = $1`,
      [outcome.redemption.id, expires.toISOString()]
    );

    return { expires, days, promo: outcome.promo };
  });

  await auditRepository.write({
    actorId: userId,
    action: 'promo.redeemed',
    entity: 'promo_code',
    entityId: promo.id,
    metadata: { code: promo.code, days: result.days },
    ip,
    userAgent,
  });

  await notificationService.notify({
    userId,
    type: 'promo_redeemed',
    title: 'Premium activado',
    body: `Código ${promo.code}: +${result.days} dias Premium até ${new Date(result.expires).toLocaleDateString('pt-AO')}`,
    data: { code: promo.code, days: result.days },
  }).catch(() => {});

  logger.info('promo.redeemed', { userId, code: promo.code, days: result.days });

  const user = await userRepository.findById(userId);
  return {
    success: true,
    code: promo.code,
    grantedDays: result.days,
    premiumExpiresAt: result.expires.toISOString(),
    subscriptionStatus: user?.subscription_status,
    message: `Premium activado por ${result.days} dias`,
  };
}

async function adminList() {
  return { promos: await promoRepository.listAll() };
}

async function adminCreate(actorId, body) {
  if (!body?.code) throw createError(400, 'Código obrigatório', 'VALIDATION');
  try {
    const promo = await promoRepository.create({
      code: body.code,
      description: body.description,
      kind: body.kind || 'premium_days',
      valueInt: body.valueInt ?? body.days ?? 7,
      maxRedemptions: body.maxRedemptions,
      perUserLimit: body.perUserLimit || 1,
      startsAt: body.startsAt,
      endsAt: body.endsAt,
      createdBy: actorId,
    });
    await auditRepository.write({
      actorId,
      action: 'promo.created',
      entity: 'promo_code',
      entityId: promo.id,
      metadata: { code: promo.code },
    });
    return promo;
  } catch (err) {
    if (err.code === '23505') {
      throw createError(409, 'Código já existe', 'PROMO_EXISTS');
    }
    throw err;
  }
}

async function adminSetActive(actorId, promoId, isActive) {
  const promo = await promoRepository.setActive(promoId, isActive);
  if (!promo) throw createError(404, 'Código não encontrado', 'PROMO_NOT_FOUND');
  await auditRepository.write({
    actorId,
    action: isActive ? 'promo.activated' : 'promo.deactivated',
    entity: 'promo_code',
    entityId: promoId,
  });
  return promo;
}

module.exports = {
  redeem,
  adminList,
  adminCreate,
  adminSetActive,
};
