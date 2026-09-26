'use strict';

const { env } = require('../config/env');

function listPlans() {
  return {
    currency: 'AOA',
    market: 'AO',
    plans: [
      {
        id: 'free',
        name: 'Gratuito',
        priceKz: 0,
        period: null,
        streams: env.maxConcurrentStreamsFree,
        downloads: Number(process.env.DOWNLOAD_MAX_FREE || 3),
        ads: true,
        quality: '480p / Auto',
        highlights: [
          'Catálogo AVOD com anúncios',
          `${env.maxConcurrentStreamsFree} ecrã em simultâneo`,
          'Poupança de dados (Unitel/Movicel)',
        ],
        cta: null,
        currentDefault: true,
      },
      {
        id: 'premium',
        name: 'Premium',
        priceKz: env.premiumPriceKz,
        period: 'month',
        streams: env.maxConcurrentStreamsPremium,
        downloads: Number(process.env.DOWNLOAD_MAX_PREMIUM || 10),
        ads: false,
        quality: '720p / Auto',
        highlights: [
          'Sem anúncios',
          'Catálogo SVOD completo',
          `${env.maxConcurrentStreamsPremium} ecrãs em simultâneo`,
          'Downloads offline (até 30 dias)',
          'Prioridade em estreias',
        ],
        cta: {
          type: 'subscription',
          label: `Assinar · ${env.premiumPriceKz.toLocaleString('pt-AO')} Kz/mês`,
        },
        badge: 'Recomendado',
      },
    ],
    paymentMethods: ['iban', 'multicaixa'],
    note: 'Pagamento por transferência IBAN ou Multicaixa. Acesso após confirmação admin (padrão Angola).',
  };
}

module.exports = { listPlans };
