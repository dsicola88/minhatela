'use strict';

const assert = require('assert');
const { settleLedger, claimTrace, forCreator } = require('../src/utils/ledger');
const {
  payoutRefusal,
  rightsConfirmed,
  encodingBlocksPublish,
  canEditContent,
} = require('../src/utils/studioRules');

const studioA = '11111111-1111-4111-8111-111111111111';
const studioB = '22222222-2222-4222-8222-222222222222';
const lines = [
  { creatorId: studioA, source: 'view', amountKz: 4000 },
  { creatorId: studioA, source: 'ad_share', amountKz: 2000 },
  { creatorId: studioA, source: 'reversal', amountKz: 500 },
  { creatorId: studioB, source: 'view', amountKz: 9000 },
];

const onlyA = forCreator(lines, studioA);
assert.strictEqual(onlyA.length, 3);
assert.ok(onlyA.every((line) => line.creatorId === studioA));

const open = settleLedger(onlyA, []);
assert.strictEqual(open.netKz, 5500);
assert.strictEqual(open.availableKz, 5500);
assert.strictEqual(open.deficitKz, 0);

const first = settleLedger(onlyA, [{ status: 'pending', amountKz: 5000 }]);
assert.strictEqual(first.availableKz, 500);
assert.strictEqual(payoutRefusal(5000, first.availableKz), 'INSUFFICIENT_BALANCE');

const both = settleLedger(onlyA, [
  { status: 'pending', amountKz: 5000 },
  { status: 'pending', amountKz: 5000 },
]);
assert.strictEqual(both.availableKz, 0);
assert.strictEqual(both.deficitKz, 4500);

const rejected = settleLedger(onlyA, [{ status: 'rejected', amountKz: 5000 }]);
assert.strictEqual(rejected.availableKz, 5500);

const keys = new Set();
assert.strictEqual(claimTrace(keys, 'view:film:2026-10-11:user'), true);
assert.strictEqual(claimTrace(keys, 'view:film:2026-10-11:user'), false);
assert.strictEqual(claimTrace(keys, 'ad:impression-1'), true);

assert.strictEqual(rightsConfirmed({ rightsConfirmed: true }), true);
assert.strictEqual(rightsConfirmed({ rightsConfirmed: false }), false);
assert.strictEqual(canEditContent('published'), false);
assert.strictEqual(encodingBlocksPublish('processing'), true);
assert.strictEqual(encodingBlocksPublish('ready'), false);
assert.strictEqual(settleLedger([{ source: 'view', amountKz: -1 }], []).error, 'NEGATIVE_LINE');

console.log('studio-ledger: ok');
