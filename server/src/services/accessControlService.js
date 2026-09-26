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
async function resolveAccess(userId, content) {
  const user = await userRepository.findById(userId);
  const monetization = content.monetization;

  if (monetization === 'avod') {
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
    let premiumActive =
      user?.subscription_status === 'premium_active' &&
      (!user.premium_expires_at || new Date(user.premium_expires_at) > new Date());
    let premiumSource = 'self';

    if (!premiumActive) {
      try {
        const householdService = require('./householdService');
        const effective = await householdService.resolveEffectiveSubscription(userId);
        if (effective.status === 'premium_active') {
          premiumActive = true;
          premiumSource = effective.source || 'household';
        }
      } catch {
        /* household optional */
      }
    }

    if (premiumActive) {
      return {
        canWatch: true,
        monetization,
        action: 'watch',
        label: 'Assistir',
        message:
          premiumSource === 'household'
            ? 'Acesso Premium via agregado familiar.'
            : 'Acesso Premium activo.',
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
      message: 'Este conteúdo exige assinatura Premium activa.',
      denialCode: 'SUBSCRIPTION_REQUIRED',
      requiresAds: false,
    };
  }

  const rental = await rentalRepository.findActiveRental(userId, content.id);
  if (rental) {
    let message = 'Aluguer activo (48 horas após confirmação do pagamento).';
    let packId = null;
    try {
      const packHit = await require('../repositories/phase26Repository').hasActivePackForVideo(
        userId,
        content.id
      );
      if (packHit) {
        message = `Acesso via pack «${packHit.pack_title}».`;
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
        'O comprovativo foi recebido. O acesso será libertado após confirmação administrativa.',
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
      'Aluguer individual com validade de 48 horas após confirmação do pagamento.',
    denialCode: 'RENTAL_REQUIRED',
    requiresAds: false,
  };
}

module.exports = { resolveAccess };
