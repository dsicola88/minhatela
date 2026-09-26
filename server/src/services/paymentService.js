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
  return {
    methods: [
      {
        id: 'iban',
        label: 'Pagamento via IBAN',
        description: 'Transferência bancária nacional',
      },
      {
        id: 'multicaixa',
        label: 'Pagamento via Multicaixa',
        description: 'Referência Multicaixa Express / ATM',
      },
    ],
    platform: {
      iban: env.payments.iban,
      bankName: env.payments.bankName,
      accountName: env.payments.accountName,
      multicaixaRef: env.payments.multicaixaRef,
    },
    premiumPriceKz: env.premiumPriceKz,
  };
}

async function submitCheckout({
  userId,
  type,
  paymentMethod,
  videoId,
  packId,
  file,
  idempotencyKey,
}) {
  await featureFlagService.assertNotMaintenance();
  await featureFlagService.assertEnabled(
    'checkout_enabled',
    'Checkout temporariamente indisponível'
  );

  if (!['subscription', 'rental', 'pack'].includes(type)) {
    throw createError(400, 'Tipo de transação inválido', 'VALIDATION');
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

  let amountKz = env.premiumPriceKz;
  let resolvedVideoId = null;
  let resolvedPackId = null;

  if (type === 'pack') {
    await featureFlagService.assertEnabled('tvod_packs_enabled', 'Packs TVOD indisponíveis');
    if (!packId) {
      throw createError(400, 'packId obrigatório', 'VALIDATION');
    }
    const phase26Repository = require('../repositories/phase26Repository');
    const pack = await phase26Repository.findPackById(packId);
    if (!pack || !pack.is_active) {
      throw createError(404, 'Pack não encontrado', 'PACK_NOT_FOUND');
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

  const proofUrl = `/uploads/proofs/${file.filename}`;
  let tx;
  try {
    tx = await transactionRepository.create({
      userId,
      videoId: resolvedVideoId,
      packId: resolvedPackId,
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

  await notificationService.notifyPaymentSubmitted(userId, {
    transactionId: tx.id,
    amountKz,
    type,
  });

  return {
    transaction: {
      id: tx.id,
      status: toApiStatus(tx.status),
      amountKz: tx.amount_kz,
      createdAt: tx.created_at,
      proofUrl,
      packId: resolvedPackId,
      riskScore: risk.riskScore,
      riskDecision: risk.decision,
    },
    message:
      risk.decision === 'block_review' || risk.decision === 'review'
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
  if (![STATUS.PAID, STATUS.REJECTED].includes(status)) {
    throw createError(400, 'Estado inválido. Use pago ou rejeitado', 'VALIDATION');
  }

  const existing = await transactionRepository.findById(transactionId);
  if (!existing) {
    throw createError(404, 'Transação não encontrada', 'NOT_FOUND');
  }
  if (existing.status !== STATUS.PENDING) {
    throw createError(
      409,
      `Transação já está ${toApiStatus(existing.status)}`,
      'TRANSACTION_NOT_PENDING'
    );
  }

  const tx = await transactionRepository.updateStatus(transactionId, status, adminNotes, {
    reviewerId: adminId,
    rejectionReason: status === STATUS.REJECTED ? adminNotes || null : null,
    fromStatus: STATUS.PENDING,
  });
  if (!tx) {
    throw createError(409, 'Transação já processada (race)', 'TRANSACTION_RACE');
  }

  if (status === STATUS.REJECTED) {
    try {
      await transactionRepository.revokeEntitlementsForTransaction(tx.id);
    } catch {
      /* best-effort */
    }
  }

  await auditRepository.write({
    actorId: adminId,
    action: status === STATUS.PAID ? 'PAYMENT_APPROVED' : 'PAYMENT_REJECTED',
    entity: 'transaction',
    entityId: tx.id,
    metadata: { status, adminNotes: adminNotes || null },
    ip,
    userAgent,
  });

  const user = await userRepository.findById(tx.user_id);
  if (user) {
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
      ? 'Assinatura Premium'
      : row.type === 'rental'
        ? 'Aluguer TVOD'
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

module.exports = {
  upload,
  getMethods,
  submitCheckout,
  listMyTransactions,
  listPendingAdmin,
  reviewTransaction,
  getReceipt,
};
