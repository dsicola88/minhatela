'use strict';

/**
 * Probe live do assinante: planos → checkout IBAN → pendente não liberta
 * → SuperAdmin confirma → Premium vê SVOD e AVOD sem anúncios → cancelar.
 * Títulos locais de laboratório (pending-bunny) — não inventa playback.
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const { SUPERADMIN } = require('../../database/seed/002_superadmin');
const mfaService = require('../src/services/mfaService');

const base = process.env.API_BASE_URL || process.env.API_BASE || 'http://localhost:4000';
const PROOF = path.join(__dirname, 'fixtures/comprovativo-ao.png');

async function req(method, pathName, { token, body, formData, headers } = {}) {
  const r = await fetch(base + pathName, {
    method,
    headers: {
      ...(formData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers || {}),
    },
    body: formData || (body ? JSON.stringify(body) : undefined),
  });
  const json = await r.json().catch(() => ({}));
  return { status: r.status, json };
}

async function adminLogin() {
  let r = await req('POST', '/api/auth/login', {
    body: {
      email: SUPERADMIN.email,
      password: SUPERADMIN.password,
      deviceName: 'Subscriber Probe',
      platform: 'web',
    },
  });
  if (r.json?.mfaRequired) {
    const sub = jwt.decode(r.json.mfaTicket)?.sub;
    r = await req('POST', '/api/auth/mfa/verify', {
      body: {
        mfaTicket: r.json.mfaTicket,
        code: await mfaService.totpNow(sub),
        deviceName: 'Subscriber Probe',
        platform: 'web',
      },
    });
  }
  const token = r.json.token || r.json.accessToken;
  if (!token) throw new Error(`admin login ${r.status} ${r.json?.code || ''}`);
  return token;
}

async function seedLabTitles() {
  const url = process.env.DATABASE_URL || '';
  if (!/localhost|127\.0\.0\.1/.test(url)) {
    throw new Error('seed lab só em Postgres local');
  }
  const pool = new Pool({ connectionString: url });
  const stamp = Date.now();
  const avod = await pool.query(
    `INSERT INTO videos (
       title, slug, synopsis_short, synopsis_full, poster_url, backdrop_url,
       bunny_video_id, monetization, duration_seconds, release_year, kind,
       is_published, workflow_status, maturity_rating, genre
     ) VALUES (
       $1, $2, 'Curta de laboratório AVOD', 'Título local para gate de anúncios.',
       'https://example.com/cartaz.jpg', 'https://example.com/fundo.jpg',
       'pending-lab-avod', 'avod', 720, 2026, 'movie',
       TRUE, 'published', 12, 'drama'
     ) RETURNING id`,
    [`Lab Grátis ${stamp}`, `lab-gratis-${stamp}`]
  );
  const svod = await pool.query(
    `INSERT INTO videos (
       title, slug, synopsis_short, synopsis_full, poster_url, backdrop_url,
       bunny_video_id, monetization, duration_seconds, release_year, kind,
       is_published, workflow_status, maturity_rating, genre
     ) VALUES (
       $1, $2, 'Curta de laboratório Premium', 'Título local para gate Premium.',
       'https://example.com/cartaz.jpg', 'https://example.com/fundo.jpg',
       'pending-lab-svod', 'svod', 900, 2026, 'movie',
       TRUE, 'published', 12, 'drama'
     ) RETURNING id`,
    [`Lab Premium ${stamp}`, `lab-premium-${stamp}`]
  );
  await pool.end();
  return { avodId: avod.rows[0].id, svodId: svod.rows[0].id };
}

async function checkoutSubscription(token) {
  const form = new FormData();
  form.append('type', 'subscription');
  form.append('paymentMethod', 'iban');
  const buf = fs.readFileSync(PROOF);
  form.append('proof', new Blob([buf], { type: 'image/png' }), 'comprovativo-ao.png');
  return req('POST', '/api/payments/checkout', {
    token,
    formData: form,
    headers: { 'Idempotency-Key': `subprobe_${Date.now()}` },
  });
}

(async () => {
  const ready = await req('GET', '/ready');
  if (!ready.json?.ready) throw new Error('API /ready não ok');

  const { avodId, svodId } = await seedLabTitles();
  const stamp = Date.now();
  const email = `assinante.probe_${stamp}@minhatela.ao`;
  const user = await req('POST', '/api/auth/register', {
    body: { email, password: 'ProbePass123!', fullName: 'Assinante Probe' },
  });
  const token = user.json.token || user.json.accessToken;
  if (!token) throw new Error(`registo ${user.status} ${user.json?.code || user.json?.message}`);

  const me0 = await req('GET', '/api/auth/me', { token });
  const plans = await req('GET', '/api/plans');
  const methods = await req('GET', '/api/payments/methods', { token });
  const home = await req('GET', '/api/catalog/home', { token });
  const flat = (home.json?.rows || []).flatMap((row) => row.videos || []);
  const homeHasLab = flat.some((v) => v.id === avodId || v.id === svodId);

  const avodFree = await req('GET', `/api/catalog/content/${avodId}`, { token });
  const svodFree = await req('GET', `/api/catalog/content/${svodId}`, { token });
  const watchAvodFree = await req('POST', `/api/watch/${avodId}/start`, {
    token,
    body: { platform: 'web' },
    headers: { 'x-device-key': `probe-${stamp}`, 'x-device-name': 'Probe' },
  });
  const watchSvodFree = await req('POST', `/api/watch/${svodId}/start`, {
    token,
    body: { platform: 'web' },
    headers: { 'x-device-key': `probe-${stamp}-s`, 'x-device-name': 'Probe' },
  });
  const adsFree = await req('POST', '/api/ads/decision', {
    token,
    body: { contentId: avodId, monetization: 'avod', placement: 'pre_roll' },
  });

  const checkout = await checkoutSubscription(token);
  const txId = checkout.json?.transaction?.id;
  const mePending = await req('GET', '/api/auth/me', { token });
  const svodPending = await req('GET', `/api/catalog/content/${svodId}`, { token });

  const adminToken = await adminLogin();
  const approve = txId
    ? await req('PATCH', `/api/admin/transactions/${txId}/status`, {
        token: adminToken,
        body: { status: 'pago', adminNotes: 'Probe assinante · IBAN' },
      })
    : { status: 'skip', json: {} };

  const mePaid = await req('GET', '/api/auth/me', { token });
  const avodPaid = await req('GET', `/api/catalog/content/${avodId}`, { token });
  const svodPaid = await req('GET', `/api/catalog/content/${svodId}`, { token });
  const adsPaid = await req('POST', '/api/ads/decision', {
    token,
    body: { contentId: avodId, monetization: 'avod', placement: 'pre_roll' },
  });
  const watchSvodPaid = await req('POST', `/api/watch/${svodId}/start`, {
    token,
    body: { platform: 'web' },
    headers: { 'x-device-key': `probe-${stamp}-p`, 'x-device-name': 'Probe' },
  });
  const receipt = txId
    ? await req('GET', `/api/payments/transactions/${txId}/receipt`, { token })
    : { status: 'skip' };

  const cancel = await req('POST', '/api/account/subscription/cancel', {
    token,
    body: { reason: 'probe' },
  });
  const meCancel = await req('GET', '/api/auth/me', { token });
  const svodCancel = await req('GET', `/api/catalog/content/${svodId}`, { token });
  const adsCancel = await req('POST', '/api/ads/decision', {
    token,
    body: { contentId: avodId, monetization: 'avod', placement: 'pre_roll' },
  });

  const premiumPlan = (plans.json?.plans || []).find((p) => p.id === 'premium' || p.priceKz > 0);
  const freePlan = (plans.json?.plans || []).find((p) => p.id === 'free' || p.priceKz === 0);

  const ok =
    me0.json?.subscriptionStatus !== 'premium_active' &&
    Boolean(premiumPlan?.cta) &&
    Boolean(freePlan) &&
    (methods.json?.methods || []).some((m) => m.id === 'iban') &&
    avodFree.json?.access?.canWatch === true &&
    avodFree.json?.access?.requiresAds === true &&
    svodFree.json?.access?.canWatch === false &&
    svodFree.json?.access?.denialCode === 'SUBSCRIPTION_REQUIRED' &&
    watchSvodFree.json?.code === 'SUBSCRIPTION_REQUIRED' &&
    ['NO_BUNNY_ASSET', 'TITLE_BLOCKED'].includes(watchAvodFree.json?.code) &&
    adsFree.json?.decision?.skipped !== 'premium' &&
    [200, 201].includes(checkout.status) &&
    mePending.json?.subscriptionStatus !== 'premium_active' &&
    svodPending.json?.access?.canWatch === false &&
    approve.status === 200 &&
    mePaid.json?.subscriptionStatus === 'premium_active' &&
    avodPaid.json?.access?.requiresAds === false &&
    svodPaid.json?.access?.canWatch === true &&
    adsPaid.json?.decision?.enabled === false &&
    adsPaid.json?.decision?.skipped === 'premium' &&
    watchSvodPaid.json?.code === 'NO_BUNNY_ASSET' &&
    receipt.status === 200 &&
    cancel.json?.cancelled === true &&
    meCancel.json?.subscriptionStatus !== 'premium_active' &&
    svodCancel.json?.access?.canWatch === false;

  const out = {
    ok,
    plans: {
      free: freePlan?.name,
      premium: premiumPlan?.name,
      premiumPriceKz: premiumPlan?.priceKz,
      jargonLeak: /\b(AVOD|SVOD|TVOD)\b/.test(JSON.stringify(plans.json || {})),
    },
    methods: (methods.json?.methods || []).map((m) => m.id),
    catalog: { homeRows: (home.json?.rows || []).length, homeHasLab, avodId: Boolean(avodId), svodId: Boolean(svodId) },
    free: {
      sub: me0.json?.subscriptionStatus,
      avod: avodFree.json?.access,
      svod: { canWatch: svodFree.json?.access?.canWatch, code: svodFree.json?.access?.denialCode },
      watchAvod: { status: watchAvodFree.status, code: watchAvodFree.json?.code },
      watchSvod: { status: watchSvodFree.status, code: watchSvodFree.json?.code },
      ads: { enabled: adsFree.json?.decision?.enabled, skipped: adsFree.json?.decision?.skipped },
    },
    pending: {
      checkout: checkout.status,
      tx: Boolean(txId),
      sub: mePending.json?.subscriptionStatus,
      svodCanWatch: svodPending.json?.access?.canWatch,
    },
    paid: {
      approve: approve.status,
      sub: mePaid.json?.subscriptionStatus,
      avodRequiresAds: avodPaid.json?.access?.requiresAds,
      svodCanWatch: svodPaid.json?.access?.canWatch,
      ads: { enabled: adsPaid.json?.decision?.enabled, skipped: adsPaid.json?.decision?.skipped },
      watchSvod: { status: watchSvodPaid.status, code: watchSvodPaid.json?.code },
      receipt: receipt.status,
    },
    cancelled: {
      cancelled: cancel.json?.cancelled,
      sub: meCancel.json?.subscriptionStatus,
      svodCanWatch: svodCancel.json?.access?.canWatch,
      adsEnabled: adsCancel.json?.decision?.enabled,
    },
  };
  console.log(JSON.stringify(out, null, 2));
  process.exit(ok ? 0 : 1);
})().catch((e) => {
  console.error(String(e && e.message ? e.message : e));
  process.exit(1);
});
