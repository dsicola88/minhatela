'use strict';

const { withTransaction } = require('../config/database');
const giftRepository = require('../repositories/giftRepository');
const userRepository = require('../repositories/userRepository');
const featureFlagService = require('./featureFlagService');
const auditRepository = require('../repositories/auditRepository');
const { createError } = require('../utils/errors');
const { env } = require('../config/env');

async function grantPremiumDays(client, userId, days) {
  const userRes = await client.query(
    `SELECT id, premium_expires_at FROM users WHERE id = $1 FOR UPDATE`,
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

function mapGift(row) {
  return {
    id: row.id,
    code: row.code,
    days: row.days,
    status: row.status,
    recipientEmail: row.recipient_email,
    message: row.message,
    redeemedAt: row.redeemed_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    premiumExpiresAt: row.premium_expires_at,
    shareUrl: `${env.appPublicUrl || 'https://minhatela.ao'}/gifts?code=${row.code}`,
    shareMessage: `Recebeu um presente MinhaTela! Código ${row.code} · ${row.days} dias Premium.`,
  };
}

async function purchase(userId, body, meta = {}) {
  await featureFlagService.assertNotMaintenance();
  await featureFlagService.assertEnabled('gifts_enabled', 'Presentes temporariamente indisponíveis');

  const days = Math.min(365, Math.max(1, Number(body.days) || 30));
  const allowed = [7, 30, 90, 365];
  if (!allowed.includes(days)) {
    throw createError(400, 'Duração inválida (7, 30, 90 ou 365 dias)', 'VALIDATION');
  }

  const user = await userRepository.findById(userId);
  const isPremium =
    user?.subscription_status === 'premium_active' &&
    (!user.premium_expires_at || new Date(user.premium_expires_at) > new Date());

  // Em produção: checkout IBAN. Localmente: Premium activo pode gerar presentes.
  if (!isPremium && !user?.is_admin) {
    throw createError(
      403,
      'Apenas assinantes Premium podem criar presentes (ou via admin)',
      'GIFT_PREMIUM_REQUIRED'
    );
  }

  const gift = await giftRepository.create({
    purchaserUserId: userId,
    days,
    recipientEmail: body.recipientEmail || null,
    message: body.message || `Presente MinhaTela · ${days} dias Premium`,
  });

  await auditRepository.write({
    actorId: userId,
    action: 'gift.created',
    entity: 'gift_code',
    entityId: gift.id,
    metadata: { days, code: gift.code },
    ip: meta.ip,
  });

  return { gift: mapGift(gift) };
}

async function redeem(userId, code, meta = {}) {
  await featureFlagService.assertNotMaintenance();
  await featureFlagService.assertEnabled('gifts_enabled', 'Presentes temporariamente indisponíveis');

  const normalized = String(code || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
  if (normalized.length < 4) {
    throw createError(400, 'Código inválido', 'VALIDATION');
  }

  const gift = await giftRepository.findByCode(normalized);
  if (!gift) throw createError(404, 'Presente não encontrado', 'GIFT_NOT_FOUND');

  const result = await withTransaction(async (client) => {
    const outcome = await giftRepository.redeemInTransaction(client, {
      giftId: gift.id,
      userId,
    });
    if (outcome.error === 'SELF') {
      throw createError(400, 'Não pode resgatar o seu próprio presente', 'GIFT_SELF');
    }
    if (outcome.error === 'EXPIRED') {
      throw createError(410, 'Presente expirado', 'GIFT_EXPIRED');
    }
    if (outcome.error === 'UNAVAILABLE' || outcome.error === 'NOT_FOUND') {
      throw createError(410, 'Presente indisponível', 'GIFT_UNAVAILABLE');
    }

    const expires = await grantPremiumDays(client, userId, gift.days);
    await client.query(
      `UPDATE gift_codes SET premium_expires_at = $2 WHERE id = $1`,
      [gift.id, expires.toISOString()]
    );
    return { expires, days: gift.days, code: gift.code };
  });

  await auditRepository.write({
    actorId: userId,
    action: 'gift.redeemed',
    entity: 'gift_code',
    entityId: gift.id,
    metadata: { code: gift.code, days: result.days },
    ip: meta.ip,
  });

  try {
    const notificationService = require('./notificationService');
    await notificationService.notify({
      userId,
      type: 'promo',
      title: 'Presente resgatado',
      body: `${result.days} dias de Premium MinhaTela activados.`,
    });
    if (gift.purchaser_user_id) {
      await notificationService.notify({
        userId: gift.purchaser_user_id,
        type: 'promo',
        title: 'O seu presente foi aberto',
        body: `Código ${gift.code} resgatado.`,
      });
    }
  } catch {
    /* optional */
  }

  return {
    redeemed: true,
    code: result.code,
    days: result.days,
    premiumExpiresAt: result.expires,
    message: `Presente aplicado. ${result.days} dias Premium.`,
  };
}

async function myGifts(userId) {
  const rows = await giftRepository.listByPurchaser(userId);
  return { gifts: rows.map(mapGift) };
}

async function adminList() {
  const rows = await giftRepository.adminList();
  return {
    gifts: rows.map((r) => ({
      ...mapGift(r),
      purchaserEmail: r.purchaser_email,
      redeemedEmail: r.redeemed_email,
    })),
  };
}

async function adminCreate(actorId, body, meta = {}) {
  const gift = await giftRepository.create({
    purchaserUserId: actorId,
    days: body.days || 30,
    recipientEmail: body.recipientEmail,
    message: body.message,
    code: body.code,
  });
  await auditRepository.write({
    actorId,
    action: 'gift.admin_created',
    entity: 'gift_code',
    entityId: gift.id,
    metadata: { code: gift.code, days: gift.days },
    ip: meta.ip,
  });
  return { gift: mapGift(gift) };
}

async function adminRevoke(actorId, giftId, meta = {}) {
  const gift = await giftRepository.revoke(giftId);
  if (!gift) throw createError(404, 'Presente não encontrado ou já usado', 'GIFT_NOT_FOUND');
  await auditRepository.write({
    actorId,
    action: 'gift.revoked',
    entity: 'gift_code',
    entityId: giftId,
    ip: meta.ip,
  });
  return { gift: mapGift(gift) };
}

module.exports = {
  purchase,
  redeem,
  myGifts,
  adminList,
  adminCreate,
  adminRevoke,
  mapGift,
};
