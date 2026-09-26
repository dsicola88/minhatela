'use strict';

const { env } = require('../config/env');
const { query } = require('../config/database');
const enterpriseConsoleService = require('./enterpriseConsoleService');

async function listPlansFromDb() {
  try {
    const result = await query(
      `SELECT * FROM subscription_plans
       WHERE is_active = TRUE AND market = 'AO'
       ORDER BY sort_order ASC`
    );
    if (!result.rowCount) return null;
    return result.rows.map(enterpriseConsoleService.mapPlan);
  } catch {
    return null;
  }
}

async function listPlans() {
  const dbPlans = await listPlansFromDb();
  let payments = {
    ibanEnabled: true,
    multicaixaEnabled: true,
    manualReviewRequired: true,
  };
  try {
    const pay = await query(`SELECT value FROM app_settings WHERE key = 'payments'`);
    if (pay.rows[0]?.value) payments = { ...payments, ...pay.rows[0].value };
  } catch {
    /* defaults */
  }

  const methods = [];
  if (payments.ibanEnabled !== false) methods.push('iban');
  if (payments.multicaixaEnabled !== false) methods.push('multicaixa');

  if (dbPlans?.length) {
    return {
      currency: payments.currency || 'AOA',
      market: require('../config/env').env.market.country || 'AO',
      plans: dbPlans.map((p) => ({
        ...p,
        currentDefault: p.isDefault || p.id === 'free',
        cta:
          p.cta ||
          (p.priceKz > 0
            ? {
                type: 'subscription',
                label: `Assinar · ${Number(p.priceKz).toLocaleString('pt-AO')} Kz/mês`,
              }
            : null),
      })),
      paymentMethods: methods,
      payments,
      note:
        payments.ibanInstructions ||
        'Pagamento por transferência IBAN ou Multicaixa. Acesso após confirmação admin (padrão Angola).',
    };
  }

  // Fallback estático se migração ainda não aplicada
  return {
    currency: 'AOA',
    market: require('../config/env').env.market.country || 'AO',
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
    paymentMethods: methods,
    payments,
    note: 'Pagamento por transferência IBAN ou Multicaixa. Acesso após confirmação admin (padrão Angola).',
  };
}

module.exports = { listPlans };
