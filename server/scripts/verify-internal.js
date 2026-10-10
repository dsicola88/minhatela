'use strict';

const assert = require('assert');
const { STATUS, toApiStatus } = require('../src/utils/transactionStatus');

assert.strictEqual(STATUS.REFUNDED, 'reembolsado');
assert.strictEqual(toApiStatus('reembolsado'), 'refunded');
assert.strictEqual(toApiStatus('pago'), 'paid');
assert.strictEqual(toApiStatus('pendente'), 'pending');

console.log('verify-internal ok');
