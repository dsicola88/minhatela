'use strict';

const assert = require('assert');
const {
  MIN_PAYOUT_KZ,
  canEditContent,
  payoutRefusal,
  rightsConfirmed,
  encodingBlocksPublish,
  periodDays,
} = require('../src/utils/studioRules');

assert.strictEqual(MIN_PAYOUT_KZ, 5000);
assert.strictEqual(canEditContent('draft'), true);
assert.strictEqual(canEditContent('rejected'), true);
assert.strictEqual(canEditContent('published'), false);
assert.strictEqual(canEditContent('submitted'), false);

assert.strictEqual(payoutRefusal(1000, 9000), 'MIN_PAYOUT');
assert.strictEqual(payoutRefusal(5000, 4999), 'INSUFFICIENT_BALANCE');
assert.strictEqual(payoutRefusal(5000, 5000), null);
assert.strictEqual(payoutRefusal(1.5, 9000), 'VALIDATION');

assert.strictEqual(rightsConfirmed({}), false);
assert.strictEqual(rightsConfirmed({ rightsConfirmed: 'true' }), false);
assert.strictEqual(rightsConfirmed({ rightsConfirmed: true }), true);

assert.strictEqual(encodingBlocksPublish('processing'), true);
assert.strictEqual(encodingBlocksPublish('failed'), true);
assert.strictEqual(encodingBlocksPublish('ready'), false);
assert.strictEqual(encodingBlocksPublish(''), false);

assert.strictEqual(periodDays('7d'), 7);
assert.strictEqual(periodDays('30d'), 30);
assert.strictEqual(periodDays('all'), null);
assert.strictEqual(periodDays('999d'), null);

console.log('studio-rules: ok');
