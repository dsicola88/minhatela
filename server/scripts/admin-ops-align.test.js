'use strict';

/**
 * Alinhamento SuperAdmin · estados PT/EN e portes de aprovação.
 * Uso: node server/scripts/admin-ops-align.test.js
 */

const assert = require('assert');
const {
  paymentStatusLabel,
  normalizePaymentReviewStatus,
  toApiStatus,
  STATUS,
} = require('../src/utils/transactionStatus');
const { campaignLifecycle } = require('../src/utils/adsLifecycle');

assert.strictEqual(paymentStatusLabel('pending'), 'Pendente');
assert.strictEqual(paymentStatusLabel('pendente'), 'Pendente');
assert.strictEqual(paymentStatusLabel('paid'), 'Pago');
assert.strictEqual(paymentStatusLabel('pago'), 'Pago');
assert.strictEqual(paymentStatusLabel('rejected'), 'Recusado');
assert.strictEqual(paymentStatusLabel('rejeitado'), 'Recusado');
assert.strictEqual(toApiStatus('pendente'), 'pending');
assert.strictEqual(normalizePaymentReviewStatus('pago'), STATUS.PAID);
assert.strictEqual(normalizePaymentReviewStatus('paid'), STATUS.PAID);
assert.strictEqual(normalizePaymentReviewStatus('rejeitado'), STATUS.REJECTED);
assert.strictEqual(normalizePaymentReviewStatus('rejected'), STATUS.REJECTED);

const unpaid = campaignLifecycle({
  status: 'pending_review',
  funded: false,
  paymentStatus: null,
  transactionId: null,
});
assert.strictEqual(unpaid.id, 'awaiting_payment');
assert.strictEqual(unpaid.canPay, true);

const fundedReview = campaignLifecycle({
  status: 'pending_review',
  funded: true,
  paymentStatus: 'pago',
  transactionId: 'x',
});
assert.strictEqual(fundedReview.id, 'creative_review');
assert.strictEqual(fundedReview.onAir, false);

const live = campaignLifecycle({
  status: 'active',
  funded: true,
  paymentStatus: 'pago',
  transactionId: 'x',
});
assert.strictEqual(live.id, 'live');
assert.strictEqual(live.onAir, true);

console.log('admin-ops-align: ok');
