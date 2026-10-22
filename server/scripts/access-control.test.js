'use strict';

/**
 * Matriz resolveAccess (AVOD / SVOD / TVOD) sem Postgres.
 * Substitui repositórios em require.cache. Não escreve dados.
 */
const assert = require('assert');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ACCESS = require.resolve(path.join(ROOT, 'src/services/accessControlService.js'));
const USER = require.resolve(path.join(ROOT, 'src/repositories/userRepository.js'));
const RENTAL = require.resolve(path.join(ROOT, 'src/repositories/rentalRepository.js'));
const TX = require.resolve(path.join(ROOT, 'src/repositories/transactionRepository.js'));
const HOUSE = require.resolve(path.join(ROOT, 'src/services/householdService.js'));

function stub(absPath, exports) {
  require.cache[absPath] = {
    id: absPath,
    filename: absPath,
    loaded: true,
    exports,
    children: [],
    paths: [],
  };
}

function loadAccess({ user, rental = null, pending = null, household = { status: 'none' } }) {
  stub(USER, { findById: async () => user });
  stub(RENTAL, { findActiveRental: async () => rental });
  stub(TX, { findPendingRental: async () => pending });
  stub(HOUSE, {
    resolveEffectiveSubscription: async () => household,
  });
  delete require.cache[ACCESS];
  return require(ACCESS);
}

const future = new Date(Date.now() + 86400000).toISOString();
const past = new Date(Date.now() - 86400000).toISOString();
const FREE = { id: 'user-free', subscription_status: 'none' };
const PREMIUM = {
  id: 'user-prem',
  subscription_status: 'premium_active',
  premium_expires_at: future,
};
const EXPIRED = {
  id: 'user-exp',
  subscription_status: 'premium_active',
  premium_expires_at: past,
};

async function run() {
  let access = loadAccess({ user: FREE });
  let r = await access.resolveAccess('user-free', { id: 'v1', monetization: 'avod' });
  assert.strictEqual(r.canWatch, true);
  assert.strictEqual(r.requiresAds, true);
  assert.strictEqual(r.denialCode, null);

  r = await access.resolveAccess('user-free', { id: 'v2', monetization: 'svod' });
  assert.strictEqual(r.canWatch, false);
  assert.strictEqual(r.denialCode, 'SUBSCRIPTION_REQUIRED');
  assert.strictEqual(r.requiresAds, false);

  access = loadAccess({ user: PREMIUM });
  r = await access.resolveAccess('user-prem', { id: 'v1', monetization: 'avod' });
  assert.strictEqual(r.canWatch, true);
  assert.strictEqual(r.requiresAds, false);
  assert.strictEqual(r.premiumSource, 'self');

  r = await access.resolveAccess('user-prem', { id: 'v2', monetization: 'svod' });
  assert.strictEqual(r.canWatch, true);
  assert.strictEqual(r.requiresAds, false);
  assert.strictEqual(r.premiumSource, 'self');

  access = loadAccess({ user: EXPIRED });
  r = await access.resolveAccess('user-exp', { id: 'v2', monetization: 'svod' });
  assert.strictEqual(r.canWatch, false);
  assert.strictEqual(r.denialCode, 'SUBSCRIPTION_REQUIRED');

  access = loadAccess({
    user: FREE,
    household: { status: 'premium_active', source: 'household' },
  });
  r = await access.resolveAccess('user-free', { id: 'v2', monetization: 'svod' });
  assert.strictEqual(r.canWatch, true);
  assert.strictEqual(r.premiumSource, 'household');
  assert.strictEqual(r.requiresAds, false);

  r = await access.resolveAccess('user-free', { id: 'v1', monetization: 'avod' });
  assert.strictEqual(r.canWatch, true);
  assert.strictEqual(r.requiresAds, false);
  assert.strictEqual(r.premiumSource, 'household');

  access = loadAccess({
    user: FREE,
    rental: { id: 'rent-1', expires_at: future },
  });
  r = await access.resolveAccess('user-free', {
    id: 'v3',
    monetization: 'tvod',
    rentalPriceKz: 1500,
  });
  assert.strictEqual(r.canWatch, true);
  assert.ok(r.expiresAt);

  access = loadAccess({
    user: FREE,
    pending: { id: 'tx-pending' },
  });
  r = await access.resolveAccess('user-free', { id: 'v3', monetization: 'tvod' });
  assert.strictEqual(r.canWatch, false);
  assert.strictEqual(r.denialCode, 'PAYMENT_PENDING');

  access = loadAccess({ user: FREE });
  r = await access.resolveAccess('user-free', { id: 'v3', monetization: 'tvod' });
  assert.strictEqual(r.canWatch, false);
  assert.strictEqual(r.denialCode, 'RENTAL_REQUIRED');

  const { requiredWatchSeconds } = require('../src/services/adPlatformService');
  assert.strictEqual(requiredWatchSeconds(0), Math.max(1, Number(process.env.AD_COMPLETE_MIN_SECONDS || 2)));
  assert.ok(requiredWatchSeconds(15) >= 12);

  console.log('access-control: ok');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
