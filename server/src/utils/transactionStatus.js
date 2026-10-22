'use strict';

const STATUS = Object.freeze({
  PENDING: 'pendente',
  PAID: 'pago',
  REJECTED: 'rejeitado',
  CANCELLED: 'cancelled',
  EXPIRED: 'expirado',
  REFUNDED: 'reembolsado',
});

const STATUS_API = Object.freeze({
  pendente: 'pending',
  pago: 'paid',
  rejeitado: 'rejected',
  cancelled: 'cancelled',
  expirado: 'expired',
  reembolsado: 'refunded',
});

const STATUS_LABEL_PT = Object.freeze({
  pendente: 'Pendente',
  pending: 'Pendente',
  pago: 'Pago',
  paid: 'Pago',
  rejeitado: 'Recusado',
  rejected: 'Recusado',
  cancelled: 'Cancelado',
  expirado: 'Expirado',
  expired: 'Expirado',
  reembolsado: 'Reembolsado',
  refunded: 'Reembolsado',
});

function toApiStatus(dbStatus) {
  return STATUS_API[dbStatus] || dbStatus;
}

function paymentStatusLabel(status) {
  const raw = String(status || '').toLowerCase();
  return STATUS_LABEL_PT[raw] || STATUS_LABEL_PT[STATUS_API[raw]] || status || '—';
}

function normalizePaymentReviewStatus(status) {
  const raw = String(status || '').toLowerCase().trim();
  if (['paid', 'pago'].includes(raw)) return STATUS.PAID;
  if (['rejected', 'rejeitado', 'recusado'].includes(raw)) return STATUS.REJECTED;
  if (['pending', 'pendente'].includes(raw)) return STATUS.PENDING;
  return null;
}

module.exports = {
  STATUS,
  STATUS_API,
  STATUS_LABEL_PT,
  toApiStatus,
  paymentStatusLabel,
  normalizePaymentReviewStatus,
};
