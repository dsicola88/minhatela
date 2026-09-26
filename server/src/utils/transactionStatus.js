'use strict';

const STATUS = Object.freeze({
  PENDING: 'pendente',
  PAID: 'pago',
  REJECTED: 'rejeitado',
  CANCELLED: 'cancelled',
  EXPIRED: 'expirado',
});

const STATUS_API = Object.freeze({
  pendente: 'pending',
  pago: 'paid',
  rejeitado: 'rejected',
  cancelled: 'cancelled',
  expirado: 'expired',
});

function toApiStatus(dbStatus) {
  return STATUS_API[dbStatus] || dbStatus;
}

module.exports = { STATUS, STATUS_API, toApiStatus };
