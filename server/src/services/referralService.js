'use strict';

const referralRepository = require('../repositories/referralRepository');
const userRepository = require('../repositories/userRepository');
const featureFlagService = require('./featureFlagService');
const auditRepository = require('../repositories/auditRepository');
const { env } = require('../config/env');
const { createError } = require('../utils/errors');

async function getMyReferral(userId) {
  await featureFlagService.assertEnabled('referrals_enabled', 'Indicações temporariamente indisponíveis');
  const row = await referralRepository.getOrCreateCode(userId);
  const stats = await referralRepository.stats(userId);
  const shareUrl = `${env.appPublicUrl}/plans?ref=${row.code}`;
  return {
    code: row.code,
    rewardDays: row.reward_days,
    expiresAt: row.expires_at,
    shareUrl,
    shareMessage: `Vê cinema angolano na MinhaTela! Usa o código ${row.code} e ambos ganhamos ${row.reward_days} dias Premium. ${shareUrl}`,
    stats: {
      redeemed: stats.redeemed,
      active: stats.active,
    },
  };
}

async function redeemReferral(userId, code, meta = {}) {
  await featureFlagService.assertEnabled('referrals_enabled', 'Indicações temporariamente indisponíveis');
  if (!code || String(code).trim().length < 4) {
    throw createError(400, 'Código inválido', 'VALIDATION');
  }

  const user = await userRepository.findById(userId);
  const result = await referralRepository.redeem({
    code: String(code).trim().toUpperCase(),
    inviteeUserId: userId,
    inviteeEmail: user?.email,
  });

  if (result.error === 'INVALID') {
    throw createError(404, 'Código inválido ou já usado', 'REFERRAL_INVALID');
  }
  if (result.error === 'SELF') {
    throw createError(400, 'Não pode usar o seu próprio código', 'REFERRAL_SELF');
  }

  const referral = result.referral;
  if (!referral) {
    throw createError(409, 'Código já utilizado', 'REFERRAL_INVALID');
  }
  const days = referral.reward_days || 7;

  await auditRepository.write({
    actorId: userId,
    action: 'referral.redeemed',
    entity: 'referral',
    entityId: referral.id,
    metadata: { code: referral.code, days },
    ip: meta.ip,
  });

  try {
    const notificationService = require('./notificationService');
    await notificationService.notify({
      userId: referral.referrer_user_id,
      type: 'promo',
      title: 'Indicação resgatada',
      body: `Alguém usou o seu código ${referral.code}. +${days} dias Premium!`,
    });
    await notificationService.notify({
      userId,
      type: 'promo',
      title: 'Bem-vindo via indicação',
      body: `Recebeu ${days} dias de Premium MinhaTela.`,
    });
  } catch {
    /* optional */
  }

  return {
    redeemed: true,
    code: referral.code,
    rewardDays: days,
    message: `Código aplicado. ${days} dias Premium activados.`,
  };
}

module.exports = { getMyReferral, redeemReferral };
