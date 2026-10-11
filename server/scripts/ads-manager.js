'use strict';

/**
 * Ads Manager · testes de entrega, faturação e isolamento
 * Uso: E2E_DISABLE_RATE_LIMIT=true API_BASE_URL=http://127.0.0.1:4000 node scripts/ads-manager.js
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { SUPERADMIN } = require('../../database/seed/002_superadmin');

const BASE = process.env.API_BASE_URL || 'http://localhost:4000';
const PROOF = path.join(__dirname, 'fixtures/comprovativo-ao.png');
const results = [];
let failed = 0;

function ok(name, detail) {
  results.push({ name, ok: true, detail });
  console.log(`✓ ${name}${detail ? ` · ${detail}` : ''}`);
}
function fail(name, err) {
  failed += 1;
  results.push({ name, ok: false, error: String(err.message || err) });
  console.error(`✗ ${name}: ${err.message || err}`);
}
async function step(name, fn) {
  try {
    const detail = await fn();
    ok(name, typeof detail === 'string' ? detail : detail?.detail);
    return detail;
  } catch (err) {
    fail(name, err);
    return null;
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
function uid() {
  return `ads_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function creative(url) {
  return {
    mediaUrl: url,
    clickUrl: 'https://example.com',
    durationSeconds: 2,
  };
}

async function req(method, urlPath, { body, token, formData, headers, retries = 0 } = {}) {
  const h = {
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...headers,
  };
  let bodyOut;
  if (formData) {
    bodyOut = formData;
  } else if (body !== undefined) {
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
  if (res.status === 429 && retries < 4) {
    await new Promise((r) => setTimeout(r, 1200 * (retries + 1)));
    return req(method, urlPath, { body, token, formData, headers, retries: retries + 1 });
  }
  return { status: res.status, json, ok: res.ok };
}

async function checkoutAdBudget(token, campaignId) {
  const form = new FormData();
  form.append('type', 'ad_campaign');
  form.append('paymentMethod', 'iban');
  form.append('campaignId', campaignId);
  const buf = fs.readFileSync(PROOF);
  form.append('proof', new Blob([buf], { type: 'image/png' }), 'comprovativo-ao.png');
  return req('POST', '/api/payments/checkout', {
    token,
    formData: form,
    headers: { 'Idempotency-Key': `ads_pay_${uid()}` },
  });
}

async function fundCampaign({ advertiserToken, adminToken, campaignId }) {
  assert(campaignId, 'campaign id');
  const unpaid = await req('PATCH', `/api/admin/campaigns/${campaignId}/status`, {
    token: adminToken,
    body: { status: 'active' },
  });
  assert(unpaid.status === 409, `unpaid activate ${unpaid.status}`);
  const pay = await checkoutAdBudget(advertiserToken, campaignId);
  assert([200, 201].includes(pay.status), `pay ${pay.status} ${pay.json?.message || pay.json?.code}`);
  const txId = pay.json?.transaction?.id;
  assert(txId, 'ad tx');
  const st = pay.json.transaction.status;
  assert(st === 'pending' || st === 'pendente', `pay status ${st}`);
  const ap = await req('PATCH', `/api/admin/transactions/${txId}/status`, {
    token: adminToken,
    body: { status: 'paid', adminNotes: 'E2E publicidade IBAN' },
  });
  assert(ap.status === 200, `fund ${ap.status}`);
  return txId;
}

async function registerUser(label) {
  const email = `${label}.${uid()}@minhatela.ao`;
  const r = await req('POST', '/api/auth/register', {
    body: {
      email,
      password: 'Angola2026!Segura',
      fullName: label,
      acceptTerms: true,
      deviceName: 'Ads Test',
      platform: 'web',
    },
  });
  assert([200, 201].includes(r.status) && (r.json?.token || r.json?.accessToken), `reg ${label}`);
  return { email, token: r.json.token || r.json.accessToken };
}

async function adminLogin() {
  const totp = require('../src/utils/totp');
  let secret = process.env.E2E_MFA_SECRET || null;
  let r = await req('POST', '/api/auth/login', {
    body: {
      email: SUPERADMIN.email,
      password: SUPERADMIN.password,
      deviceName: 'Ads Admin',
      platform: 'web',
    },
  });
  if (r.json?.mfaSetupRequired) {
    const setup = await req('POST', '/api/auth/mfa/setup', { body: { mfaTicket: r.json.mfaTicket } });
    secret = setup.json?.secret;
    await req('POST', '/api/auth/mfa/setup/confirm', {
      body: { mfaTicket: r.json.mfaTicket, code: totp.generate(secret) },
    });
    r = await req('POST', '/api/auth/login', {
      body: {
        email: SUPERADMIN.email,
        password: SUPERADMIN.password,
        deviceName: 'Ads Admin',
        platform: 'web',
      },
    });
  }
  if (r.json?.mfaRequired) {
    let code = secret ? totp.generate(secret) : null;
    if (!code) {
      const jwt = require('jsonwebtoken');
      const sub = jwt.decode(r.json.mfaTicket)?.sub;
      code = sub ? await require('../src/services/mfaService').totpNow(sub) : null;
    }
    r = await req('POST', '/api/auth/mfa/verify', {
      body: { mfaTicket: r.json.mfaTicket, code, deviceName: 'Ads Admin', platform: 'web' },
    });
  }
  const token = r.json?.token || r.json?.accessToken;
  assert(token, `admin token ${r.status} ${r.json?.code || ''}`);
  return token;
}

async function run() {
  console.log(`\n══ MinhaTela Ads Manager · ${BASE} ══\n`);
  const a = await registerUser('AnuncianteA');
  const b = await registerUser('AnuncianteB');
  let adminToken = null;
  let campaignId = null;
  let contentId = null;
  let unit = 5;

  await step('Anunciante A · registo empresa', async () => {
    const r = await req('POST', '/api/ads/advertisers/register', {
      token: a.token,
      body: { companyName: 'Casa A Publicidade', contactEmail: a.email },
    });
    assert([200, 201].includes(r.status), `reg ${r.status}`);
  });
  await step('SuperAdmin · login', async () => {
    adminToken = await adminLogin();
  });

  await step('Isolar o laboratório · pausar campanhas já no ar', async () => {
    const list = await req('GET', '/api/admin/ads/campaigns?status=active&limit=100', {
      token: adminToken,
    });
    const rows = list.json?.campaigns || [];
    for (const c of rows) {
      await req('PATCH', `/api/admin/campaigns/${c.id}/status`, {
        token: adminToken,
        body: { status: 'paused' },
      });
    }
    return `paused=${rows.length}`;
  });

  await step('Anunciante B · registo empresa', async () => {
    const r = await req('POST', '/api/ads/advertisers/register', {
      token: b.token,
      body: { companyName: 'Casa B Publicidade', contactEmail: b.email },
    });
    assert([200, 201].includes(r.status), `reg ${r.status}`);
  });

  await step('URL interna recusada (SSRF)', async () => {
    const r = await req('POST', '/api/ads/campaigns', {
      token: a.token,
      body: {
        name: 'SSRF',
        budgetKz: 5000,
        startsAt: new Date().toISOString(),
        endsAt: new Date(Date.now() + 86400000).toISOString(),
        creative: { mediaUrl: 'https://127.0.0.1/ad.mp4' },
      },
    });
    assert(r.status === 400, `got ${r.status}`);
  });

  await step('Campanha nova fica à espera', async () => {
    const r = await req('POST', '/api/ads/campaigns', {
      token: a.token,
      body: {
        name: 'Lançamento Casa A',
        objective: 'brand',
        budgetKz: 5000,
        startsAt: new Date().toISOString(),
        endsAt: new Date(Date.now() + 7 * 86400000).toISOString(),
        creative: creative('https://example.com/ad.mp4'),
      },
    });
    assert(r.status === 201 && r.json?.campaign?.status === 'pending_review', `st ${r.json?.campaign?.status}`);
    campaignId = r.json.campaign.id;
  });

  await step('Pendente nunca é entregue', async () => {
    const home = await req('GET', '/api/catalog/home', { token: a.token });
    const rows = home.json?.rows || [];
    contentId = rows.flatMap((row) => row.items || []).find((it) => it.id)?.id;
    const r = await req('POST', '/api/ads/decision', {
      token: a.token,
      body: { contentId, monetization: 'avod', placement: 'pre_roll' },
    });
    assert(r.status === 200, `dec ${r.status}`);
    const d = r.json?.decision;
    assert(!d?.enabled, 'pending must not enable');
  });

  await step('B não vê a campanha de A (IDOR)', async () => {
    const r = await req('GET', `/api/ads/campaigns/${campaignId}`, { token: b.token });
    assert(r.status === 404, `got ${r.status}`);
  });

  await step('Cliente sem ads.manage · admin 403', async () => {
    const r = await req('GET', '/api/admin/campaigns/pending', { token: a.token });
    assert(r.status === 403 || r.status === 401, `got ${r.status}`);
  });

  await step('Recusa sem motivo → 400', async () => {
    const r = await req('PATCH', `/api/admin/campaigns/${campaignId}/status`, {
      token: adminToken,
      body: { status: 'rejected' },
    });
    assert(r.status === 400, `got ${r.status}`);
  });

  await step('Recusada não volta a ser entregue', async () => {
    const r = await req('POST', '/api/ads/campaigns', {
      token: a.token,
      body: {
        name: 'Campanha recusada',
        budgetKz: 8000,
        startsAt: new Date().toISOString(),
        endsAt: new Date(Date.now() + 7 * 86400000).toISOString(),
        creative: creative('https://example.com/rejected.mp4'),
      },
    });
    const id = r.json?.campaign?.id;
    assert(id, 'rejected campaign id');
    const rej = await req('PATCH', `/api/admin/campaigns/${id}/status`, {
      token: adminToken,
      body: { status: 'rejected', reason: 'Não cumpre as regras MinhaTela' },
    });
    assert(rej.status === 200 && rej.json?.campaign?.status === 'rejected', `rej ${rej.status}`);
    const cheat = await req('PATCH', `/api/admin/campaigns/${id}/status`, {
      token: a.token,
      body: { status: 'active' },
    });
    assert([401, 403].includes(cheat.status), `advertiser activate ${cheat.status}`);
    const d = await req('POST', '/api/ads/decision', {
      token: a.token,
      body: { contentId, monetization: 'avod', placement: 'pre_roll' },
    });
    assert(d.json?.decision?.campaignId !== id, 'rejected served');
  });

  await step('Pôr no ar', async () => {
    await fundCampaign({ advertiserToken: a.token, adminToken, campaignId });
    const r = await req('PATCH', `/api/admin/campaigns/${campaignId}/status`, {
      token: adminToken,
      body: { status: 'active' },
    });
    assert(
      r.status === 200 && r.json?.campaign?.status === 'active',
      `st ${r.status} ${r.json?.campaign?.status || r.json?.code || r.json?.message}`
    );
  });

  await step('Activa é entregue e completa fatura uma vez', async () => {
    const d1 = await req('POST', '/api/ads/decision', {
      token: a.token,
      body: { contentId, monetization: 'avod', placement: 'pre_roll' },
    });
    assert(d1.json?.decision?.enabled && d1.json.decision.decisionId, 'enabled');
    const id = d1.json.decision.decisionId;
    const tooSoon = await req('POST', `/api/ads/impressions/${id}/complete`, { token: a.token });
    assert(tooSoon.json?.reason === 'not_started' && !tooSoon.json?.billed, 'complete before start');
    const start = await req('POST', `/api/ads/impressions/${id}/start`, { token: a.token });
    assert(start.status === 200 && start.json?.started, 'start');
    const early = await req('POST', `/api/ads/impressions/${id}/complete`, { token: a.token });
    assert(early.json?.reason === 'too_early' && !early.json?.billed, 'complete too early');
    await sleep(2200);
    const c1 = await req('POST', `/api/ads/impressions/${id}/complete`, { token: a.token });
    assert(c1.status === 200 && c1.json?.billedKz > 0, `bill ${c1.json?.billedKz} ${c1.json?.reason || ''}`);
    unit = c1.json.billedKz;
    const c2 = await req('POST', `/api/ads/impressions/${id}/complete`, { token: a.token });
    assert(c2.json?.alreadyCompleted || c2.json?.billedKz === 0, 'no double bill');
    const click1 = await req('POST', `/api/ads/impressions/${id}/click`, { token: a.token });
    assert(click1.json?.clickId, 'click');
    const click2 = await req('POST', `/api/ads/impressions/${id}/click`, { token: a.token });
    assert(click2.json?.alreadyRecorded, 'dup click');
    const foreign = await req('POST', `/api/ads/impressions/${id}/complete`, { token: b.token });
    assert(foreign.status === 404, `foreign ${foreign.status}`);
    return `unit=${unit}`;
  });

  await step('Pausada não é entregue de novo', async () => {
    const p = await req('POST', `/api/ads/campaigns/${campaignId}/pause`, { token: a.token });
    assert(p.status === 200 && p.json?.campaign?.status === 'paused', 'paused');
    const d = await req('POST', '/api/ads/decision', {
      token: a.token,
      body: { contentId, monetization: 'avod', placement: 'pre_roll' },
    });
    assert(!d.json?.decision?.enabled, 'paused served');
  });

  await step('Fora das datas não entrega', async () => {
    const r = await req('POST', '/api/ads/campaigns', {
      token: a.token,
      body: {
        name: 'Expirada',
        budgetKz: 8000,
        startsAt: new Date(Date.now() - 10 * 86400000).toISOString(),
        endsAt: new Date(Date.now() - 5 * 86400000).toISOString(),
        creative: creative('https://example.com/old.mp4'),
      },
    });
    const id = r.json?.campaign?.id;
    await fundCampaign({ advertiserToken: a.token, adminToken, campaignId: id });
    const ap = await req('PATCH', `/api/admin/campaigns/${id}/status`, {
      token: adminToken,
      body: { status: 'active' },
    });
    assert(ap.status === 200, `approve expired ${ap.status} ${ap.json?.code || ''}`);
    const d = await req('POST', '/api/ads/decision', {
      token: a.token,
      body: { contentId, monetization: 'avod', placement: 'pre_roll' },
    });
    assert(!d.json?.decision?.enabled, 'expired served');
  });

  await step('Corrida de orçamento não fica negativa', async () => {
    const r = await req('POST', '/api/ads/campaigns', {
      token: a.token,
      body: {
        name: 'Saldo curto',
        budgetKz: 5000,
        startsAt: new Date().toISOString(),
        endsAt: new Date(Date.now() + 86400000).toISOString(),
        creative: creative('https://example.com/short.mp4'),
      },
    });
    const id = r.json?.campaign?.id;
    await fundCampaign({ advertiserToken: a.token, adminToken, campaignId: id });
    const ap = await req('PATCH', `/api/admin/campaigns/${id}/status`, {
      token: adminToken,
      body: { status: 'active' },
    });
    assert(ap.status === 200 && ap.json?.campaign?.status === 'active', `short ${ap.status}`);
    const d1 = await req('POST', '/api/ads/decision', {
      token: a.token,
      body: { contentId, monetization: 'avod' },
    });
    const d2 = await req('POST', '/api/ads/decision', {
      token: a.token,
      body: { contentId, monetization: 'avod' },
    });
    const i1 = d1.json?.decision?.decisionId;
    const i2 = d2.json?.decision?.decisionId;
    assert(i1 && i2, 'two impressions');
    const s1 = await req('POST', `/api/ads/impressions/${i1}/start`, { token: a.token });
    const s2 = await req('POST', `/api/ads/impressions/${i2}/start`, { token: a.token });
    assert(s1.status === 200 && s2.status === 200, 'start both');
    await sleep(2200);
    const [c1, c2] = await Promise.all([
      req('POST', `/api/ads/impressions/${i1}/complete`, { token: a.token }),
      req('POST', `/api/ads/impressions/${i2}/complete`, { token: a.token }),
    ]);
    const billed = [c1.json?.billedKz || 0, c2.json?.billedKz || 0];
    const sum = billed[0] + billed[1];
    assert(sum === unit * 2, `sum ${sum} billed=${billed} unit=${unit}`);
    const portal = await req('GET', '/api/ads/portal', { token: a.token });
    const camp = (portal.json?.campaigns || []).find((c) => c.id === id);
    assert(camp && camp.spentKz <= camp.budgetKz, 'no negative');
    assert(camp.spentKz === unit * 2, `spent ${camp.spentKz}`);
  });

  await step('Relatório com métricas separadas', async () => {
    const r = await req('GET', '/api/ads/reports', { token: a.token });
    assert(r.status === 200 && r.json?.measurement?.billableEvent === 'completed_view', 'rule');
    assert(typeof r.json.measurement.impressions === 'number', 'impressions');
    assert(typeof r.json.measurement.starts === 'number', 'starts');
    assert(typeof r.json.measurement.completions === 'number', 'completions');
    assert(typeof r.json.measurement.clicks === 'number', 'clicks');
  });

  await step('Espectador B vê o anúncio pago de A', async () => {
    const r = await req('POST', '/api/ads/decision', {
      token: b.token,
      body: { contentId, monetization: 'avod' },
    });
    assert(r.status === 200);
    assert(r.json?.decision?.enabled === true, 'funded ad must reach other viewers');
  });

  await step('Premium/SVOD não leva anúncio — o filme segue', async () => {
    const r = await req('POST', '/api/ads/decision', {
      token: b.token,
      body: { contentId, monetization: 'svod' },
    });
    assert(r.status === 200);
    assert(!r.json?.decision || r.json.decision.enabled !== true, 'svod blocked ads');
  });

  console.log(`\n══ RESULTADO ADS ══\nPASS ${results.length - failed}/${results.length} · FAIL ${failed}`);
  if (failed) process.exit(1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
