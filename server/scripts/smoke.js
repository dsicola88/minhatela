'use strict';

/**
 * Smoke suite enterprise — valida contratos críticos sem DB seed pesado.
 * Uso: API_BASE_URL=http://localhost:4000 node scripts/smoke.js
 */
const BASE = process.env.API_BASE_URL || process.env.SMOKE_BASE_URL || 'http://localhost:4000';

async function req(method, path, { body, token, headers } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text?.slice(0, 200) };
  }
  return { status: res.status, json, ok: res.ok };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function run() {
  const results = [];
  const step = async (name, fn) => {
    try {
      await fn();
      results.push({ name, ok: true });
      console.log(`✓ ${name}`);
    } catch (err) {
      results.push({ name, ok: false, error: err.message });
      console.error(`✗ ${name}: ${err.message}`);
    }
  };

  await step('GET /health', async () => {
    const r = await req('GET', '/health');
    assert(r.status === 200 && r.json?.status === 'ok', `status=${r.status}`);
  });

  await step('GET /ready', async () => {
    const r = await req('GET', '/ready');
    assert(r.status === 200 || r.status === 503, `unexpected ${r.status}`);
  });

  await step('GET /api/legal', async () => {
    const r = await req('GET', '/api/legal');
    assert(r.status === 200 && Array.isArray(r.json?.documents), 'legal list');
    assert(r.json.documents.length >= 2, 'need terms+privacy');
  });

  await step('GET /api/legal/terms', async () => {
    const r = await req('GET', '/api/legal/terms');
    assert(r.status === 200 && r.json?.bodyMd, 'terms body');
  });

  await step('GET /api/legal/privacy', async () => {
    const r = await req('GET', '/api/legal/privacy');
    assert(r.status === 200 && r.json?.type === 'privacy', 'privacy type');
  });

  await step('GET /api/plans', async () => {
    const r = await req('GET', '/api/plans');
    assert(r.status === 200 && Array.isArray(r.json?.plans || r.json), 'plans');
  });

  await step('GET /api/search/suggest sem auth → 401', async () => {
    const r = await req('GET', '/api/search/suggest?q=an');
    assert(r.status === 401, `got ${r.status}`);
  });

  await step('POST /api/watch/qoe sem auth → 401', async () => {
    const r = await req('POST', '/api/watch/qoe', { body: { events: [] } });
    assert(r.status === 401, `got ${r.status}`);
  });

  await step('GET /ops sem auth → 401', async () => {
    const r = await req('GET', '/ops');
    assert(r.status === 401, `ops ${r.status}`);
  });

  await step('GET /api/support/help sem auth → 401', async () => {
    const r = await req('GET', '/api/support/help');
    assert(r.status === 401, `got ${r.status}`);
  });

  await step('POST /api/watch-together/rooms sem auth → 401', async () => {
    const r = await req('POST', '/api/watch-together/rooms', { body: {} });
    assert(r.status === 401, `got ${r.status}`);
  });

  await step('GET /api/gifts sem auth → 401', async () => {
    const r = await req('GET', '/api/gifts');
    assert(r.status === 401, `got ${r.status}`);
  });

  await step('GET /api/household sem auth → 401', async () => {
    const r = await req('GET', '/api/household');
    assert(r.status === 401, `got ${r.status}`);
  });

  await step('GET /api/premieres sem auth → 401', async () => {
    const r = await req('GET', '/api/premieres');
    assert(r.status === 401, `got ${r.status}`);
  });

  await step('GET /api/me/for-you sem auth → 401', async () => {
    const r = await req('GET', '/api/me/for-you');
    assert(r.status === 401, `got ${r.status}`);
  });

  await step('POST /api/me/titles/:id/not-interested sem auth → 401', async () => {
    const r = await req('POST', '/api/me/titles/00000000-0000-0000-0000-000000000001/not-interested', {
      body: {},
    });
    assert(r.status === 401, `got ${r.status}`);
  });

  await step('POST /api/network/diagnostics sem auth → 401', async () => {
    const r = await req('POST', '/api/network/diagnostics', { body: {} });
    assert(r.status === 401, `got ${r.status}`);
  });

  await step('GET /api/browse/languages sem auth → 401', async () => {
    const r = await req('GET', '/api/browse/languages');
    assert(r.status === 401, `got ${r.status}`);
  });

  await step('GET /api/me/invoices sem auth → 401', async () => {
    const r = await req('GET', '/api/me/invoices');
    assert(r.status === 401, `got ${r.status}`);
  });

  await step('GET /api/search/trending sem auth → 401', async () => {
    const r = await req('GET', '/api/search/trending');
    assert(r.status === 401, `got ${r.status}`);
  });

  await step('GET /api/account/experiments sem auth → 401', async () => {
    const r = await req('GET', '/api/account/experiments');
    assert(r.status === 401, `got ${r.status}`);
  });

  await step('POST /api/auth/oauth/google sem body → 400|401|429', async () => {
    const r = await req('POST', '/api/auth/oauth/google', {});
    assert([400, 401, 429].includes(r.status), `got ${r.status}`);
  });

  await step('GET /api/admin/encoding sem auth → 401', async () => {
    const r = await req('GET', '/api/admin/encoding');
    assert(r.status === 401, `got ${r.status}`);
  });

  await step('GET /api/admin/payments/risk sem auth → 401', async () => {
    const r = await req('GET', '/api/admin/payments/risk');
    assert(r.status === 401, `got ${r.status}`);
  });

  await step('GET /api/payments/packs sem auth → 401', async () => {
    const r = await req('GET', '/api/payments/packs');
    assert(r.status === 401, `got ${r.status}`);
  });

  await step('GET /api/surveys/pending sem auth → 401', async () => {
    const r = await req('GET', '/api/surveys/pending');
    assert(r.status === 401, `got ${r.status}`);
  });

  await step('POST /api/admin/cdn/probe sem auth → 401', async () => {
    const r = await req('POST', '/api/admin/cdn/probe');
    assert(r.status === 401, `got ${r.status}`);
  });

  await step('POST /api/auth/login sem body → 400|401|429', async () => {
    const r = await req('POST', '/api/auth/login', { body: {} });
    assert([400, 401, 429].includes(r.status), `got ${r.status}`);
  });

  await step('POST /api/watch/:id/start sem auth → 401', async () => {
    const r = await req('POST', '/api/watch/00000000-0000-0000-0000-000000000001/start');
    assert(r.status === 401, `got ${r.status}`);
  });

  await step('GET /metrics sem auth → 401', async () => {
    const r = await req('GET', '/metrics');
    assert(r.status === 401, `got ${r.status}`);
  });

  const failed = results.filter((r) => !r.ok);
  console.log('\n---');
  console.log(`SMOKE ${failed.length ? 'FAIL' : 'OK'} · ${results.length - failed.length}/${results.length}`);
  if (failed.length) process.exit(1);
}

run().catch((err) => {
  console.error('SMOKE FATAL', err);
  process.exit(1);
});
