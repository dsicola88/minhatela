'use strict';

/**
 * Fase 27 · Security / isolation / payments hardening suite
 * Uso: E2E_DISABLE_RATE_LIMIT=true node server/scripts/phase27-security.js
 */
const fs = require('fs');
const path = require('path');
const { SUPERADMIN } = require('../../database/seed/002_superadmin');

const BASE = process.env.API_BASE_URL || 'http://localhost:4000';
const PROOF = path.join(__dirname, 'fixtures/comprovativo-ao.png');
const results = [];
let failed = 0;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function step(name, fn) {
  try {
    const d = await fn();
    results.push({ name, ok: true });
    console.log(`✓ ${name}${d ? ` · ${d}` : ''}`);
  } catch (err) {
    failed += 1;
    results.push({ name, ok: false, error: err.message });
    console.error(`✗ ${name}: ${err.message}`);
  }
}

async function req(method, urlPath, { body, token, headers, formData, retries = 0 } = {}) {
  const h = {
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...headers,
  };
  let bodyOut;
  if (formData) bodyOut = formData;
  else if (body !== undefined) {
    h['Content-Type'] = 'application/json';
    bodyOut = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${urlPath}`, { method, headers: h, body: bodyOut });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text?.slice(0, 200) };
  }
  if (res.status === 429 && retries < 3) {
    await new Promise((r) => setTimeout(r, 1200 * (retries + 1)));
    return req(method, urlPath, { body, token, headers, formData, retries: retries + 1 });
  }
  return { status: res.status, json, ok: res.ok };
}

function uid() {
  return `p27_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

async function register(label) {
  const email = `${label}.${uid()}@minhatela.ao`;
  const password = 'Angola2026!Segura';
  const r = await req('POST', '/api/auth/register', {
    body: {
      email,
      password,
      fullName: label,
      acceptTerms: true,
      deviceName: 'P27',
      platform: 'web',
    },
  });
  assert([200, 201].includes(r.status), `register ${r.status}`);
  const token = r.json.token || r.json.accessToken;
  const profiles = await req('GET', '/api/auth/profiles', { token });
  const profileId = profiles.json.profiles[0].id;
  return { email, password, token, profileId };
}

async function run() {
  console.log(`\n══ Phase 27 Security · ${BASE} ══\n`);

  await step('Public surfaces · /ops /metrics → 401', async () => {
    assert((await req('GET', '/ops')).status === 401, 'ops');
    assert((await req('GET', '/metrics')).status === 401, 'metrics');
  });

  await step('Ready · slim payload sem filas', async () => {
    const r = await req('GET', '/ready');
    assert([200, 503].includes(r.status), `status ${r.status}`);
    assert(r.json.ready !== undefined, 'ready');
    assert(!r.json.queues && !r.json.bunnyHealth, 'no sensitive ops fields');
  });

  await step('Bunny webhook · sem secret → 503', async () => {
    const r = await req('POST', '/webhooks/bunny', { body: { Status: 4 } });
    assert([401, 503].includes(r.status), `got ${r.status}`);
  });

  const a = await register('userA');
  const b = await register('userB');

  await step('IDOR · select perfil de outro user → 404', async () => {
    const r = await req('POST', `/api/account/profiles/${a.profileId}/select`, {
      token: b.token,
      body: {},
    });
    assert(r.status === 404, `got ${r.status}`);
  });

  await step('IDOR · survey com profileId alheio → 404', async () => {
    const r = await req('POST', '/api/surveys/respond', {
      token: b.token,
      body: { promptKey: 'app_nps_session', nps: 8, profileId: a.profileId },
    });
    assert(r.status === 404, `got ${r.status}`);
  });

  await step('Ratings · rejeitar valor fora 1–5', async () => {
    const home = await req('GET', '/api/catalog/home', {
      token: a.token,
      headers: { 'x-profile-id': a.profileId },
    });
    const content =
      home.json?.featured ||
      (home.json?.rows || []).flatMap((x) => x.videos || [])[0];
    assert(content?.id, 'need content');
    const bad = await req('POST', `/api/discovery/${content.id}/rate`, {
      token: a.token,
      headers: { 'x-profile-id': a.profileId },
      body: { stars: 9, profileId: a.profileId },
    });
    assert(bad.status === 400, `got ${bad.status}`);
    const okRate = await req('POST', `/api/discovery/${content.id}/rate`, {
      token: a.token,
      headers: { 'x-profile-id': a.profileId },
      body: { stars: 4, profileId: a.profileId },
    });
    assert(okRate.status === 200 && okRate.json.stars === 4, 'stars 4');
  });

  await step('CW · progresso não regride com device atrasado', async () => {
    const home = await req('GET', '/api/catalog/home', {
      token: a.token,
      headers: { 'x-profile-id': a.profileId },
    });
    const content =
      home.json?.featured ||
      (home.json?.rows || []).flatMap((x) => x.videos || [])[0];
    const id = content.id;
    await req('PUT', `/api/watch/${id}/progress`, {
      token: a.token,
      headers: { 'x-profile-id': a.profileId },
      body: { profileId: a.profileId, positionSeconds: 600, durationSeconds: 3600 },
    });
    const back = await req('PUT', `/api/watch/${id}/progress`, {
      token: a.token,
      headers: { 'x-profile-id': a.profileId },
      body: { profileId: a.profileId, positionSeconds: 120, durationSeconds: 3600 },
    });
    assert(back.status === 200, `status ${back.status}`);
    assert(back.json.positionSeconds >= 600, `got ${back.json.positionSeconds}`);
  });

  await step('Premiere list · sem hlsUrl', async () => {
    const r = await req('GET', '/api/premieres', { token: a.token });
    assert(r.status === 200, `status ${r.status}`);
    const events = r.json?.events || [];
    const leaked = events.some((e) => e.hlsUrl);
    assert(!leaked, 'hlsUrl leaked in list');
  });

  await step('Proofs · static path bloqueado sem ownership', async () => {
    const r = await req('GET', '/uploads/proofs/does-not-exist.png', { token: a.token });
    assert([401, 404].includes(r.status), `got ${r.status}`);
  });

  await step('Payments · approve claim atómico (não-pendente → 409)', async () => {
    const form = new FormData();
    form.append('type', 'subscription');
    form.append('paymentMethod', 'iban');
    form.append(
      'proof',
      new Blob([fs.readFileSync(PROOF)], { type: 'image/png' }),
      'comprovativo-ao.png'
    );
    const checkout = await req('POST', '/api/payments/checkout', {
      token: a.token,
      formData: form,
      headers: { 'Idempotency-Key': `p27_${uid()}` },
    });
    assert([200, 201].includes(checkout.status), `checkout ${checkout.status}`);
    const txId = checkout.json.transaction.id;

    const adminLogin = await req('POST', '/api/auth/login', {
      body: {
        email: SUPERADMIN.email,
        password: SUPERADMIN.password,
        deviceName: 'P27',
        platform: 'web',
      },
    });
    assert(adminLogin.status === 200, `admin ${adminLogin.status}`);
    const adminToken = adminLogin.json.token || adminLogin.json.accessToken;

    const first = await req('PATCH', `/api/admin/transactions/${txId}/status`, {
      token: adminToken,
      body: { status: 'paid', adminNotes: 'P27 first' },
    });
    assert(first.status === 200, `first ${first.status}`);

    const second = await req('PATCH', `/api/admin/transactions/${txId}/status`, {
      token: adminToken,
      body: { status: 'paid', adminNotes: 'P27 duplicate' },
    });
    assert(second.status === 409, `duplicate got ${second.status}`);
  });

  await step('Auth · cliente não acede /ops', async () => {
    const r = await req('GET', '/ops', { token: a.token });
    assert(r.status === 403, `got ${r.status}`);
  });

  console.log('\n══ PHASE 27 SECURITY ══');
  console.log(`PASS ${results.length - failed}/${results.length} · FAIL ${failed}`);
  if (failed) process.exit(1);
  console.log('SECURITY_OK · TENANT_ISOLATION_OK(account) · PAYMENTS_OK');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
