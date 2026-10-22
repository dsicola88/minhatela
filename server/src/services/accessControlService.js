'use strict';

const userRepository = require('../repositories/userRepository');
const rentalRepository = require('../repositories/rentalRepository');
const transactionRepository = require('../repositories/transactionRepository');
const { env } = require('../config/env');
const { formatKz } = require('../utils/money');

/**
 * Fonte de verdade do paywall AVOD / SVOD / TVOD.
 * Usado pela API de detalhes e pela API de play.
 */
async function resolvePremium(user, userId) {
  if (require('./subscriptionService').isPremiumActive(user)) {
    return { active: true, source: 'self' };
  }
  try {
    const householdService = require('./householdService');
    const effective = await householdService.resolveEffectiveSubscription(userId);
    if (effective.status === 'premium_active') {
      return { active: true, source: effective.source || 'household' };
    }
  } catch {
    /* household optional */
  }
  return { active: false, source: null };
}

async function resolveAccess(userId, content) {
  const user = await userRepository.findById(userId);
  const monetization = content.monetization;

  const premium = await resolvePremium(user, userId);

  if (monetization === 'avod') {
    if (premium.active) {
      return {
        canWatch: true,
        monetization,
        action: 'watch',
        label: 'Assistir',
        message:
          premium.source === 'household'
            ? 'Premium da sua casa — sem anúncios.'
            : 'Incluído no seu Premium — sem anúncios.',
        denialCode: null,
        requiresAds: false,
        premiumSource: premium.source,
      };
    }
    return {
      canWatch: true,
      monetization,
      action: 'watch',
      label: 'Assistir grátis',
      message: 'Conteúdo gratuito. Pode incluir publicidade.',
      denialCode: null,
      requiresAds: true,
    };
  }

  if (monetization === 'svod') {
    const premiumActive = premium.active;
    const premiumSource = premium.source;

    if (premiumActive) {
      return {
        canWatch: true,
        monetization,
        action: 'watch',
        label: 'Assistir',
        message:
          premiumSource === 'household'
            ? 'Premium da sua casa.'
            : 'Incluído no seu Premium.',
        denialCode: null,
        requiresAds: false,
        premiumSource,
      };
    }

    return {
      canWatch: false,
      monetization,
      action: 'subscribe',
      label: `Seja Premium por ${formatKz(env.premiumPriceKz)}`,
      priceKz: env.premiumPriceKz,
      message: 'Este título faz parte do Premium. Assine para ver sem anúncios.',
      denialCode: 'SUBSCRIPTION_REQUIRED',
      requiresAds: false,
    };
  }

  const rental = await rentalRepository.findActiveRental(userId, content.id);
  if (rental) {
    let message = 'Aluguer activo — 48 horas a contar da confirmação.';
    let packId = null;
    try {
      const packHit = await require('../repositories/phase26Repository').hasActivePackForVideo(
        userId,
        content.id
      );
      if (packHit) {
        message = `Incluído no lote «${packHit.pack_title}».`;
        packId = packHit.pack_id;
      }
    } catch {
      /* optional */
    }
    return {
      canWatch: true,
      monetization,
      action: 'watch',
      label: 'Assistir',
      expiresAt: rental.expires_at,
      message,
      denialCode: null,
      requiresAds: false,
      packId,
    };
  }

  // Pack entitlement also creates rentals — covered above.

  const pending = await transactionRepository.findPendingRental(userId, content.id);
  if (pending) {
    return {
      canWatch: false,
      monetization,
      action: 'pending',
      label: 'Pagamento em análise',
      message:
        'Recebemos o pagamento. O aluguer abre quando a MinhaTela confirmar.',
      transactionId: pending.id,
      denialCode: 'PAYMENT_PENDING',
      requiresAds: false,
    };
  }

  const price = content.rentalPriceKz || env.tvodDefaultPriceKz;

  return {
    canWatch: false,
    monetization,
    action: 'rent',
    label: `Alugar por ${formatKz(price)}`,
    priceKz: price,
    message:
      'Aluguer deste título. Tem 48 horas depois da MinhaTela confirmar o pagamento.',
    denialCode: 'RENTAL_REQUIRED',
    requiresAds: false,
  };
}

module.exports = { resolveAccess };
