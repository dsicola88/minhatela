'use strict';

const assert = require('assert');
const {
  looksPaid,
  extractReference,
  extractAmountKz,
  extractCurrency,
  matchPaidEvent,
} = require('../src/services/emisWeframeService');

const TX = {
  id: '11111111-1111-4111-8111-111111111111',
  user_id: '22222222-2222-4222-8222-222222222222',
  payment_method: 'weframe',
  status: 'pendente',
  amount_kz: 5000,
};

function paidBody(extra = {}) {
  return {
    status: 'paid',
    reference: TX.id,
    amount: 5000,
    currency: 'AOA',
    ...extra,
  };
}

assert.strictEqual(looksPaid({ status: 'pago' }), true);
assert.strictEqual(looksPaid({ status: 'pending' }), false);
assert.strictEqual(extractReference({ reference: TX.id }), TX.id);
assert.strictEqual(extractAmountKz({ amount: 5000 }), 5000);
assert.strictEqual(extractAmountKz({ data: { valor: '5000' } }), 5000);
assert.strictEqual(extractCurrency({ currency: 'AOA' }), 'aoa');

assert.strictEqual(matchPaidEvent(TX, paidBody()).ok, true);
assert.strictEqual(matchPaidEvent(TX, { status: 'paid', reference: TX.id }).reason, 'amount_missing');
assert.strictEqual(matchPaidEvent(TX, paidBody({ amount: 1 })).reason, 'amount_mismatch');
assert.strictEqual(matchPaidEvent(TX, paidBody({ currency: 'USD' })).reason, 'currency_mismatch');
assert.strictEqual(
  matchPaidEvent(TX, paidBody({ userId: '33333333-3333-4333-8333-333333333333' })).reason,
  'user_mismatch'
);
assert.strictEqual(
  matchPaidEvent({ ...TX, payment_method: 'iban' }, paidBody()).reason,
  'not_weframe'
);
assert.strictEqual(matchPaidEvent({ ...TX, status: 'pago' }, paidBody()).reason, 'already_paid');
assert.strictEqual(matchPaidEvent(null, paidBody()).reason, 'tx_missing');

console.log('weframe-apply: ok');
