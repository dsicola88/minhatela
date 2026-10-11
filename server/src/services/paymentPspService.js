'use strict';

const crypto = require('crypto');
const { env } = require('../config/env');
const { logger } = require('../utils/logger');
const { createError } = require('../utils/errors');
const webhookRepository = require('../repositories/webhookRepository');

const KNOWN = ['appy', 'emis', 'proxy', 'multicaixa_express', 'unitel_money'];

function isConfigured() {
  const p = env.payments.pspProvider;
  return Boolean(p && KNOWN.includes(p) && env.payments.pspApiKey && env.payments.pspWebhookSecret);
}

function publicStatus() {
  return {
    provider: env.payments.pspProvider || null,
    ready: isConfigured(),
    liveCheckout: false,
  };
}

/**
 * Referência instantânea — preenche-se quando o PSP entregar a spec.
 * Até lá o checkout continua IBAN + comprovativo.
 */
async function createReference(/* payload */) {
  if (!isConfigured()) {
    throw createError(
      503,
      'Pagamento instantâneo ainda não está ligado. Use IBAN ou a referência Multicaixa da plataforma.',
      'PSP_NOT_LIVE'
    );
  }
  throw createError(
    503,
    'O prestador está configurado mas o adaptador ainda não está activo. Continuamos com comprovativo.',
    'PSP_ADAPTER_PENDING'
  );
}

function verifyWebhook(req) {
  const secret = env.payments.pspWebhookSecret;
  if (!secret) {
    throw createError(503, 'Webhook de pagamentos não configurado', 'PSP_WEBHOOK_UNCONFIGURED');
  }
  const header =
    req.headers['x-webhook-token'] ||
    req.headers['x-psp-signature'] ||
    req.headers['authorization'];
  const token = String(header || '').replace(/^Bearer\s+/i, '');
  const expected = Buffer.from(String(secret));
  const got = Buffer.from(token);
  if (expected.length !== got.length || !crypto.timingSafeEqual(expected, got)) {
    throw createError(401, 'Webhook de pagamento não autorizado', 'PSP_WEBHOOK_UNAUTHORIZED');
  }
}

async function handleWebhook(req) {
  verifyWebhook(req);
  const provider = String(req.params.provider || env.payments.pspProvider || 'psp').toLowerCase();
  const body = req.body || {};
  const inserted = await webhookRepository.insertEvent({
    provider: `psp:${provider}`,
    eventType: body.event || body.type || 'payment',
    externalId: body.id || body.reference || body.transactionId || null,
    payload: body,
  });

  if (inserted.duplicate) {
    return { accepted: true, duplicate: true, applied: false };
  }

  logger.info('webhook.psp.received', {
    provider,
    eventId: inserted.id,
    type: body.event || body.type,
  });

  await webhookRepository.markProcessed(
    inserted.id,
    'accepted',
    'Aguardando mapeamento do prestador para libertar Premium'
  );

  return {
    accepted: true,
    applied: false,
    code: 'PSP_ADAPTER_PENDING',
    message: 'Evento guardado. Quando o contrato do prestador chegar, este webhook liberta o acesso.',
  };
}

module.exports = {
  isConfigured,
  publicStatus,
  createReference,
  handleWebhook,
};
