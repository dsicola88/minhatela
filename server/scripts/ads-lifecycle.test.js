'use strict';

const assert = require('assert');
const { campaignLifecycle, portalStage } = require('../src/utils/adsLifecycle');

assert.strictEqual(campaignLifecycle({ status: 'pending_review', funded: false }).id, 'awaiting_payment');
assert.strictEqual(
  campaignLifecycle({ status: 'pending_review', funded: false, paymentStatus: 'pendente' }).id,
  'payment_review'
);
assert.strictEqual(campaignLifecycle({ status: 'pending_review', funded: true }).id, 'creative_review');
assert.strictEqual(campaignLifecycle({ status: 'active', funded: true }).id, 'live');
assert.strictEqual(campaignLifecycle({ status: 'active', funded: true }).onAir, true);
assert.strictEqual(campaignLifecycle({ status: 'rejected', funded: true }).onAir, false);

const pay = campaignLifecycle({ status: 'pending_review', funded: false });
const mapped = [{ lifecycle: pay, status: 'pending_review' }];
assert.strictEqual(portalStage({ id: 'a' }, mapped).title, 'Pagar orçamento');
assert.strictEqual(portalStage(null, []).title, 'Conta aberta');

console.log('ads-lifecycle: ok');
