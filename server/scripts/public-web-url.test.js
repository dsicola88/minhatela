'use strict';

const assert = require('assert');
const { normalizePublicWebUrl } = require('../src/utils/publicWebUrl');

function check(input, expected) {
  const result = normalizePublicWebUrl(input, { optional: true });
  assert.strictEqual(result.ok, true, `${input} -> ${result.message || result.url}`);
  assert.strictEqual(result.url, expected, input);
}

check('dhundotec.com', 'https://dhundotec.com/');
check('http://dhundotec.com/', 'https://dhundotec.com/');
check('https://dhundotec.com/oferta', 'https://dhundotec.com/oferta');
check('HTTPS://www.dhundotec.com', 'https://www.dhundotec.com/');
check('', '');

const local = normalizePublicWebUrl('http://127.0.0.1/ad');
assert.strictEqual(local.ok, false);
const script = normalizePublicWebUrl('javascript:alert(1)');
assert.strictEqual(script.ok, false);

console.log('public-web-url: ok');
