'use strict';

const paymentService = require('../services/paymentService');
const { STATUS } = require('../utils/transactionStatus');

async function methods(_req, res) {
  res.json(paymentService.getMethods());
}

async function checkout(req, res) {
  const result = await paymentService.submitCheckout({
    userId: req.user.id,
    type: req.body.type,
    paymentMethod: req.body.paymentMethod,
    videoId: req.body.videoId,
    packId: req.body.packId,
    campaignId: req.body.campaignId,
    file: req.file,
    idempotencyKey:
      req.headers['idempotency-key'] ||
      req.headers['x-idempotency-key'] ||
      req.body.idempotencyKey ||
      require('uuid').v4(),
  });
  res.status(result.idempotentReplay ? 200 : 201).json(result);
}

async function myTransactions(req, res) {
  const result = await paymentService.listMyTransactions(req.user.id);
  res.json(result);
}

async function receipt(req, res) {
  const receiptData = await paymentService.getReceipt(req.user.id, req.params.id);
  const wantsHtml =
    String(req.query.format || '').toLowerCase() === 'html' ||
    (req.headers.accept || '').includes('text/html');
  if (wantsHtml) {
    const { renderReceiptHtml } = require('../utils/receiptHtml');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(renderReceiptHtml(receiptData));
  }
  res.json(receiptData);
}

async function pending(req, res) {
  const result = await paymentService.listPendingAdmin();
  res.json(result);
}

async function weframeSession(req, res) {
  const result = await paymentService.createWeframeSession({
    userId: req.user.id,
    type: req.body.type,
    videoId: req.body.videoId,
    packId: req.body.packId,
    campaignId: req.body.campaignId,
    idempotencyKey:
      req.headers['idempotency-key'] ||
      req.headers['x-idempotency-key'] ||
      req.body.idempotencyKey,
  });
  res.status(result.idempotentReplay ? 200 : 201).json(result);
}

async function weframeStatus(req, res) {
  const result = await paymentService.getWeframeSession(req.user.id, req.params.id);
  res.json(result);
}

async function review(req, res) {
  const statusMap = {
    paid: STATUS.PAID,
    pending: STATUS.PENDING,
    rejected: STATUS.REJECTED,
    refunded: STATUS.REFUNDED,
    pago: STATUS.PAID,
    pendente: STATUS.PENDING,
    rejeitado: STATUS.REJECTED,
    reembolsado: STATUS.REFUNDED,
  };

  const result = await paymentService.reviewTransaction({
    adminId: req.user.id,
    transactionId: req.params.id,
    status: statusMap[req.body.status] || req.body.status,
    adminNotes: req.body.adminNotes,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  res.json(result);
}

module.exports = {
  methods,
  checkout,
  myTransactions,
  receipt,
  pending,
  review,
  weframeSession,
  weframeStatus,
};
