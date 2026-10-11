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

function humanizeHighlight(line) {
  return String(line || '')
    .replace(/Catálogo AVOD com anúncios/gi, 'Filmes e séries com anúncios curtos')
    .replace(/Catálogo SVOD completo/gi, 'Todo o catálogo, sem anúncios')
    .replace(/Catálogo AVOD/gi, 'Filmes e séries com anúncios curtos')
    .replace(/\bAVOD\b/g, 'com anúncios')
    .replace(/\bSVOD\b/g, 'Premium')
    .replace(/\bTVOD\b/g, 'aluguer')
    .replace(/(\d+)\s*streams?\b/gi, '$1 ecrãs');
}

function presentPlan(plan) {
  return {
    ...plan,
    highlights: (plan.highlights || []).map(humanizeHighlight),
  };
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
      plans: dbPlans.map((p) =>
        presentPlan({
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
        })
      ),
      paymentMethods: methods,
      payments,
      note:
        payments.ibanInstructions ||
        'Paga por IBAN ou Multicaixa Express. A MinhaTela confirma e o Premium abre na app. No fim do período volta ao plano gratuito — a conta não fecha.',
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
          'Filmes e séries com anúncios curtos',
          `${env.maxConcurrentStreamsFree} ecrã de cada vez`,
          `${Number(process.env.DOWNLOAD_MAX_FREE || 3)} títulos para ver sem rede`,
          'Poupança de dados (Unitel / Movicel)',
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
          'Todo o catálogo',
          `${env.maxConcurrentStreamsPremium} ecrãs ao mesmo tempo`,
          `Até ${Number(process.env.DOWNLOAD_MAX_PREMIUM || 10)} títulos no telemóvel (30 dias)`,
          'Casa: partilhar Premium com a família',
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
    note: 'Paga por IBAN ou Multicaixa Express. A MinhaTela confirma e o Premium abre na app. No fim do período volta ao plano gratuito — a conta não fecha.',
  };
}

module.exports = { listPlans };
