'use strict';

const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const contentRepository = require('../repositories/contentRepository');
const transactionRepository = require('../repositories/transactionRepository');
const auditRepository = require('../repositories/auditRepository');
const userRepository = require('../repositories/userRepository');
const notificationService = require('./notificationService');
const featureFlagService = require('./featureFlagService');
const { env } = require('../config/env');
const { createError } = require('../utils/errors');
const { assertPositiveKz } = require('../utils/money');
const { STATUS, toApiStatus } = require('../utils/transactionStatus');
const { mapContentInternal } = require('../utils/mappers');

const proofsDir = path.join(env.uploadsDir, 'proofs');
fs.mkdirSync(proofsDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, proofsDir),
    filename: (_req, file, cb) => {
      cb(null, `${uuidv4()}${path.extname(file.originalname).toLowerCase()}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext)) {
      return cb(createError(400, 'Formato inválido. Use JPG, PNG, WEBP ou PDF', 'INVALID_FILE'));
    }
    return cb(null, true);
  },
});

function getMethods() {
  const weframe = require('./emisWeframeService').publicStatus();
  const methods = [];
  if (weframe.enabled) {
    methods.push({
      id: 'weframe',
      label: 'Multicaixa Express',
      description: weframe.live
        ? 'Confirme no telemóvel ou com o QR, neste ecrã.'
        : 'Checkout embutido (WeFrame). Liga-se quando o banco entregar as tags da EMIS.',
      live: weframe.live,
    });
  }
  methods.push(
    {
      id: 'iban',
      label: 'Pagamento via IBAN',
      description: 'Transferência bancária nacional',
    },
    {
      id: 'multicaixa',
      label: 'Pagamento via Multicaixa',
      description: 'Referência Multicaixa / ATM (comprovativo)',
    }
  );
  return {
    methods,
    platform: {
      iban: env.payments.iban,
      bankName: env.payments.bankName,
      accountName: env.payments.accountName,
      multicaixaRef: env.payments.multicaixaRef,
    },
    premiumPriceKz: env.premiumPriceKz,
    instant: require('./paymentPspService').publicStatus(),
    weframe,
    ads: {
      minBudgetKz: 5000,
      weframeOnly: process.env.ADS_WEFRAME_ONLY === 'true',
      note:
        process.env.ADS_WEFRAME_ONLY === 'true'
          ? 'Publicidade só com Multicaixa Express (WeFrame).'
          : 'Publicidade: pague o orçamento por IBAN (comprovativo) ou Multicaixa Express. Quando a EMIS certificar, fica só WeFrame.',
    },
  };
}

async function resolveOwnedAdCampaign(userId, campaignId) {
  if (!campaignId) {
    throw createError(400, 'Campanha obrigatória', 'VALIDATION');
  }
  const adRepository = require('../repositories/adRepository');
  const advertiser = await adRepository.findAdvertiserByUser(userId);
  if (!advertiser) {
    throw createError(403, 'Conta de publicidade necessária', 'ADVERTISER_REQUIRED');
  }
  const campaign = await adRepository.getOwnedCampaign(advertiser.id, campaignId);
  if (!campaign) {
    throw createError(404, 'Campanha não encontrada', 'NOT_FOUND');
  }
  if (campaign.funded) {
    throw createError(409, 'Este orçamento já está pago', 'AD_ALREADY_FUNDED');
  }
  return campaign;
}

async function resolveCheckoutAmount({ type, videoId, packId, campaignId, userId }) {
  let amountKz = env.premiumPriceKz;
  let resolvedVideoId = null;
  let resolvedPackId = null;
  let resolvedCampaignId = null;

  if (type === 'ad_campaign') {
    const campaign = await resolveOwnedAdCampaign(userId, campaignId);
    amountKz = assertPositiveKz(campaign.budget_kz);
    resolvedCampaignId = campaign.id;
    return { amountKz, resolvedVideoId, resolvedPackId, resolvedCampaignId };
  }

  if (type === 'pack') {
    await featureFlagService.assertEnabled('tvod_packs_enabled', 'Lotes de filmes indisponíveis');
    if (!packId) {
      throw createError(400, 'packId obrigatório', 'VALIDATION');
    }
    const phase26Repository = require('../repositories/phase26Repository');
    const pack = await phase26Repository.findPackById(packId);
    if (!pack || !pack.is_active) {
      throw createError(404, 'Lote não encontrado', 'PACK_NOT_FOUND');
    }
    amountKz = assertPositiveKz(pack.price_kz);
    resolvedPackId = pack.id;
  } else if (type === 'rental') {
    if (!videoId) {
      throw createError(400, 'Vídeo obrigatório para aluguer', 'VALIDATION');
    }
    const row = await contentRepository.findPublishedById(videoId);
    if (!row) {
      throw createError(404, 'Vídeo não encontrado', 'CONTENT_NOT_FOUND');
    }
    const content = mapContentInternal(row);
    if (content.monetization !== 'tvod') {
      throw createError(400, 'Este conteúdo não está disponível para aluguer', 'NOT_TVOD');
    }
    amountKz = assertPositiveKz(content.rentalPriceKz || env.tvodDefaultPriceKz);
    resolvedVideoId = content.id;
  } else {
    amountKz = assertPositiveKz(amountKz);
  }

  return { amountKz, resolvedVideoId, resolvedPackId, resolvedCampaignId };
}

async function submitCheckout({
  userId,
  type,
  paymentMethod,
  videoId,
  packId,
  campaignId,
  file,
  idempotencyKey,
}) {
  await featureFlagService.assertNotMaintenance();
  await featureFlagService.assertEnabled(
    'checkout_enabled',
    'Checkout temporariamente indisponível'
  );

  if (!['subscription', 'rental', 'pack', 'ad_campaign'].includes(type)) {
    throw createError(400, 'Tipo de transação inválido', 'VALIDATION');
  }
  if (type === 'ad_campaign' && process.env.ADS_WEFRAME_ONLY === 'true') {
    throw createError(400, 'Publicidade só com Multicaixa Express', 'ADS_WEFRAME_ONLY');
  }
  if (!['iban', 'multicaixa'].includes(paymentMethod)) {
    throw createError(400, 'Método de pagamento inválido', 'VALIDATION');
  }
  if (!file) {
    throw createError(400, 'É obrigatório carregar o comprovativo', 'PROOF_REQUIRED');
  }

  const key = idempotencyKey ? String(idempotencyKey).slice(0, 80) : null;
  if (key) {
    const existing = await transactionRepository.findByIdempotency(userId, key);
    if (existing) {
      return {
        transaction: {
          id: existing.id,
          status: toApiStatus(existing.status),
          amountKz: existing.amount_kz,
          createdAt: existing.created_at,
          proofUrl: existing.proof_url,
        },
        idempotentReplay: true,
        message: 'Pedido já registado (idempotência).',
      };
    }
  }

  const { amountKz, resolvedVideoId, resolvedPackId, resolvedCampaignId } =
    await resolveCheckoutAmount({
      type,
      videoId,
      packId,
      campaignId,
      userId,
    });

  const proofUrl = `/uploads/proofs/${file.filename}`;
  let proofBytes = null;
  try {
    proofBytes = fs.readFileSync(file.path);
  } catch {
    proofBytes = null;
  }
  const proofSha = proofBytes
    ? require('crypto').createHash('sha256').update(proofBytes).digest('hex')
    : null;

  let tx;
  try {
    tx = await transactionRepository.create({
      userId,
      videoId: resolvedVideoId,
      packId: resolvedPackId,
      campaignId: resolvedCampaignId,
      type,
      paymentMethod,
      amountKz,
      proofUrl,
      idempotencyKey: key,
    });
  } catch (err) {
    if (err.code === '23505' && key) {
      const existing = await transactionRepository.findByIdempotency(userId, key);
      if (existing) {
        return {
          transaction: {
            id: existing.id,
            status: toApiStatus(existing.status),
            amountKz: existing.amount_kz,
            createdAt: existing.created_at,
            proofUrl: existing.proof_url,
          },
          idempotentReplay: true,
          message: 'Pedido já registado (idempotência).',
        };
      }
    }
    throw err;
  }

  if (proofBytes && tx?.id) {
    await transactionRepository
      .attachProofBlob(tx.id, {
        bytes: proofBytes,
        sha256: proofSha,
        mime: file.mimetype || null,
      })
      .catch(() => {});
  }

  let risk = { riskScore: 0, decision: 'allow' };
  try {
    const phase25Service = require('./phase25Service');
    risk = await phase25Service.attachPaymentRisk({
      transactionId: tx.id,
      userId,
      filePath: file.path,
      amountKz,
      paymentMethod,
      type,
    });
  } catch {
    /* scoring never blocks checkout */
  }

  if (resolvedCampaignId && tx?.id) {
    await require('../repositories/adRepository')
      .attachTransaction(resolvedCampaignId, tx.id)
      .catch(() => {});
  }

  await notificationService.notifyPaymentSubmitted(userId, {
    transactionId: tx.id,
    amountKz,
    type,
  });

  const adsCopy =
    'Comprovativo recebido. O anúncio só entra no ar depois de a MinhaTela confirmar o pagamento e a campanha.';

  return {
    transaction: {
      id: tx.id,
      status: toApiStatus(tx.status),
      amountKz: tx.amount_kz,
      createdAt: tx.created_at,
      proofUrl,
      packId: resolvedPackId,
      campaignId: resolvedCampaignId || null,
      riskScore: risk.riskScore,
      riskDecision: risk.decision,
    },
    message:
      type === 'ad_campaign'
        ? adsCopy
        : risk.decision === 'block_review' || risk.decision === 'review'
          ? 'Comprovativo recebido e sinalizado para revisão prioritária de risco.'
          : 'Comprovativo recebido. O conteúdo será libertado quando o administrador confirmar o pagamento.',
  };
}

async function listMyTransactions(userId) {
  const rows = await transactionRepository.listByUser(userId);
  return {
    transactions: rows.map((row) => ({
      id: row.id,
      type: row.type,
      paymentMethod: row.payment_method,
      amountKz: row.amount_kz,
      status: toApiStatus(row.status),
      videoId: row.video_id,
      videoTitle: row.video_title || null,
      proofUrl: row.proof_url,
      paidAt: row.paid_at,
      accessExpiresAt: row.access_expires_at,
      createdAt: row.created_at,
    })),
  };
}

async function listPendingAdmin() {
  const rows = await transactionRepository.listPending();
  return {
    transactions: rows.map((row) => ({
      id: row.id,
      type: row.type,
      paymentMethod: row.payment_method,
      amountKz: row.amount_kz,
      status: toApiStatus(row.status),
      email: row.email,
      fullName: row.full_name,
      videoTitle: row.video_title,
      proofUrl: row.proof_url,
      riskScore: row.risk_score || 0,
      riskDecision: row.risk_decision || 'allow',
      createdAt: row.created_at,
    })),
  };
}

async function reviewTransaction({
  adminId,
  transactionId,
  status,
  adminNotes,
  ip,
  userAgent,
}) {
  if (![STATUS.PAID, STATUS.REJECTED, STATUS.REFUNDED].includes(status)) {
    throw createError(400, 'Estado inválido. Use pago, rejeitado ou reembolsado', 'VALIDATION');
  }

  const existing = await transactionRepository.findById(transactionId);
  if (!existing) {
    throw createError(404, 'Transação não encontrada', 'NOT_FOUND');
  }
  const { opsUserSql } = require('../utils/tenantScope');
  const { query } = require('../config/database');
  const scoped = await query(
    `SELECT 1 FROM transactions t
     JOIN users u ON u.id = t.user_id
     WHERE t.id = $1 AND ${opsUserSql('u')}`,
    [transactionId]
  );
  if (!scoped.rowCount) {
    throw createError(404, 'Transação não encontrada', 'NOT_FOUND');
  }
  const isRefund = status === STATUS.REFUNDED;
  if (!isRefund && existing.status !== STATUS.PENDING) {
    throw createError(
      409,
      `Transação já está ${toApiStatus(existing.status)}`,
      'TRANSACTION_NOT_PENDING'
    );
  }
  if (isRefund && existing.status !== STATUS.PAID) {
    throw createError(409, 'Só transacções pagas podem ser reembolsadas', 'NOT_REFUNDABLE');
  }

  const tx = await transactionRepository.updateStatus(transactionId, status, adminNotes, {
    reviewerId: adminId,
    rejectionReason: status === STATUS.REJECTED ? adminNotes || null : null,
    fromStatus: isRefund ? STATUS.PAID : STATUS.PENDING,
  });
  if (!tx) {
    throw createError(409, 'Transação já processada (race)', 'TRANSACTION_RACE');
  }

  if (status === STATUS.REJECTED || isRefund) {
    try {
      await transactionRepository.revokeEntitlementsForTransaction(tx.id);
    } catch {
      /* best-effort */
    }
  }
  if (isRefund && tx.type === 'subscription') {
    await require('./subscriptionService').cancelForUser(tx.user_id, { reason: 'refund' }).catch(() => {});
  }

  await auditRepository.write({
    actorId: adminId,
    action:
      status === STATUS.PAID
        ? 'PAYMENT_APPROVED'
        : isRefund
          ? 'PAYMENT_REFUNDED'
          : 'PAYMENT_REJECTED',
    entity: 'transaction',
    entityId: tx.id,
    metadata: { status, adminNotes: adminNotes || null },
    ip,
    userAgent,
  });

  const user = await userRepository.findById(tx.user_id);
  if (user && !isRefund) {
    await notificationService.notifyPaymentReviewed(
      user,
      tx,
      status === STATUS.PAID
    );
  }

  if (status === STATUS.PAID) {
    try {
      await require('../repositories/phase23Repository').ensureInvoiceFromTransaction(tx);
    } catch {
      /* invoice optional */
    }
  }

  return {
    transaction: {
      id: tx.id,
      type: tx.type,
      paymentMethod: tx.payment_method,
      amountKz: tx.amount_kz,
      status: toApiStatus(tx.status),
      videoId: tx.video_id,
      packId: tx.pack_id || null,
      proofUrl: tx.proof_url,
      paidAt: tx.paid_at,
      accessExpiresAt: tx.access_expires_at,
      reviewedAt: tx.reviewed_at,
      reviewerId: tx.reviewer_id,
      createdAt: tx.created_at,
    },
  };
}

async function getReceipt(userId, transactionId) {
  const row = await transactionRepository.findOwnedById(userId, transactionId);
  if (!row) throw createError(404, 'Pagamento não encontrado', 'NOT_FOUND');

  const typeLabel =
    row.type === 'subscription'
      ? 'Premium'
      : row.type === 'rental'
        ? 'Aluguer'
        : row.type === 'pack'
          ? 'Lote de filmes'
          : row.type === 'ad_campaign'
            ? 'Publicidade'
            : row.type;

  const receipt = {
    receiptNumber: `MT-${String(row.id).slice(0, 8).toUpperCase()}`,
    title: 'Recibo MinhaTela',
    customerName: row.full_name,
    customerEmail: row.email,
    type: row.type,
    typeLabel,
    paymentMethod: row.payment_method,
    amountKz: row.amount_kz,
    status: toApiStatus(row.status),
    statusLabel: toApiStatus(row.status),
    contentTitle: row.video_title,
    contentId: row.video_id,
    paidAt: row.paid_at
      ? new Date(row.paid_at).toLocaleString('pt-AO')
      : null,
    createdAt: new Date(row.created_at).toLocaleString('pt-AO'),
    id: row.id,
  };

  return receipt;
}

async function createWeframeSession({ userId, type, videoId, packId, campaignId, idempotencyKey }) {
  await featureFlagService.assertNotMaintenance();
  await featureFlagService.assertEnabled(
    'checkout_enabled',
    'Checkout temporariamente indisponível'
  );
  const weframe = require('./emisWeframeService');
  if (!weframe.isEnabled()) {
    throw createError(503, 'WeFrame está desligado', 'WEFRAME_DISABLED');
  }
  if (!['subscription', 'rental', 'pack', 'ad_campaign'].includes(type)) {
    throw createError(400, 'Tipo de transação inválido', 'VALIDATION');
  }

  const key = idempotencyKey ? String(idempotencyKey).slice(0, 80) : null;
  if (key) {
    const existing = await transactionRepository.findByIdempotency(userId, key);
    if (existing) {
      const token = weframe.signSession({
        transactionId: existing.id,
        userId,
        amountKz: existing.amount_kz,
      });
      return {
        transaction: {
          id: existing.id,
          status: toApiStatus(existing.status),
          amountKz: existing.amount_kz,
        },
        embedUrl: `${weframe.apiPublicBase()}/pay/weframe?s=${encodeURIComponent(token)}`,
        live: weframe.hasTags(),
        idempotentReplay: true,
      };
    }
  }

  const { amountKz, resolvedVideoId, resolvedPackId, resolvedCampaignId } =
    await resolveCheckoutAmount({
      type,
      videoId,
      packId,
      campaignId,
      userId,
    });

  let tx;
  try {
    tx = await transactionRepository.create({
      userId,
      videoId: resolvedVideoId,
      packId: resolvedPackId,
      campaignId: resolvedCampaignId,
      type,
      paymentMethod: 'weframe',
      amountKz,
      proofUrl: null,
      idempotencyKey: key,
    });
  } catch (err) {
    if (String(err.message || '').includes('weframe') || err.code === '22P02') {
      throw createError(
        503,
        'A base ainda não tem o método WeFrame. Aplique a migração 035.',
        'WEFRAME_MIGRATION'
      );
    }
    throw err;
  }

  if (resolvedCampaignId && tx?.id) {
    await require('../repositories/adRepository')
      .attachTransaction(resolvedCampaignId, tx.id)
      .catch(() => {});
  }

  await notificationService.notifyPaymentSubmitted(userId, {
    transactionId: tx.id,
    amountKz,
    type,
  });

  const token = weframe.signSession({
    transactionId: tx.id,
    userId,
    amountKz,
  });
  const adsWait =
    'Confirme no Multicaixa Express. O anúncio só entra no ar depois do pagamento e da aprovação da MinhaTela.';
  return {
    transaction: {
      id: tx.id,
      status: toApiStatus(tx.status),
      amountKz: tx.amount_kz,
      campaignId: resolvedCampaignId || null,
    },
    embedUrl: `${weframe.apiPublicBase()}/pay/weframe?s=${encodeURIComponent(token)}`,
    live: weframe.hasTags(),
    message:
      type === 'ad_campaign'
        ? adsWait
        : weframe.hasTags()
          ? 'Confirme o pagamento no Multicaixa Express.'
          : 'Página de checkout criada. O terminal EMIS aparece aqui quando as tags WeFrame estiverem no Railway.',
  };
}

async function getWeframeSession(userId, transactionId) {
  const row = await transactionRepository.findOwnedById(userId, transactionId);
  if (!row) throw createError(404, 'Pagamento não encontrado', 'NOT_FOUND');
  return {
    transaction: {
      id: row.id,
      status: toApiStatus(row.status),
      amountKz: row.amount_kz,
      paymentMethod: row.payment_method,
      paidAt: row.paid_at,
    },
  };
}

module.exports = {
  upload,
  getMethods,
  submitCheckout,
  listMyTransactions,
  listPendingAdmin,
  reviewTransaction,
  getReceipt,
  createWeframeSession,
  getWeframeSession,
};
