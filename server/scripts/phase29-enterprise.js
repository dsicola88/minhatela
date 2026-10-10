'use strict';

/**
 * Fase Enterprise · RBAC / tenant / company / rights
 * Uso: E2E_DISABLE_RATE_LIMIT=true node server/scripts/phase29-enterprise.js
 */
const { SUPERADMIN } = require('../../database/seed/002_superadmin');

const BASE = process.env.API_BASE_URL || 'http://localhost:4000';
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

async function req(method, urlPath, { body, token } = {}) {
  const h = {
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  let bodyOut;
  if (body !== undefined) {
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
  return { status: res.status, json, ok: res.ok };
}

function uid() {
  return `p29_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
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
      deviceName: 'P29',
      platform: 'web',
    },
  });
  assert([200, 201].includes(r.status), `register ${r.status} ${r.json?.message || ''}`);
  const token = r.json.token || r.json.accessToken;
  return { email, password, token, user: r.json.user };
}

async function run() {
  console.log(`\n══ Phase 29 Enterprise RBAC · ${BASE} ══\n`);

  await step('Health', async () => {
    const r = await req('GET', '/health');
    assert(r.ok, `health ${r.status}`);
  });

  const sub = await register('sub');
  const creator = await register('creator');

  await step('Subscriber · /api/admin → 403', async () => {
    const r = await req('GET', '/api/admin/command-center', { token: sub.token });
    assert(r.status === 403, `got ${r.status}`);
  });

  await step('Subscriber · capabilities sem admin/studio', async () => {
    const me = await req('GET', '/api/auth/me', { token: sub.token });
    assert(me.ok, 'me');
    assert(me.json.capabilities?.adminConsole !== true, 'adminConsole');
    assert(me.json.roles?.includes('customer'), 'customer role');
  });

  await step('Subscriber · tenants SuperAdmin → 403', async () => {
    const r = await req('GET', '/api/admin/tenants', { token: sub.token });
    assert(r.status === 403, `got ${r.status}`);
  });

  await step('Creator register studio', async () => {
    const r = await req('POST', '/api/creator-studio/register', {
      token: creator.token,
      body: { displayName: 'Criador P29', type: 'filmmaker' },
    });
    assert([200, 201].includes(r.status), `got ${r.status} ${r.json?.message || ''}`);
  });

  await step('Creator inactivo · não cria conteúdo', async () => {
    const r = await req('POST', '/api/creator-studio/contents', {
      token: creator.token,
      body: {
        title: 'Draft P29',
        synopsisShort: 'Teste',
        posterUrl: 'https://example.com/p.jpg',
        monetization: 'avod',
      },
    });
    assert(r.status === 403, `got ${r.status}`);
  });

  await step('Company portal sem produtora', async () => {
    const r = await req('GET', '/api/company', { token: sub.token });
    assert(r.ok, `got ${r.status}`);
    assert(r.json.company === null, 'company null');
  });

  await step('Company register exige criador activo', async () => {
    const r = await req('POST', '/api/company/register', {
      token: creator.token,
      body: { name: 'Produtora P29' },
    });
    assert(r.status === 403, `got ${r.status}`);
  });

  let adminToken = null;
  await step('SuperAdmin login seed', async () => {
    const r = await req('POST', '/api/auth/login', {
      body: {
        email: SUPERADMIN.email,
        password: SUPERADMIN.password,
        deviceName: 'P29',
        platform: 'web',
      },
    });
    assert(r.ok, `login ${r.status} ${r.json?.message || ''}`);
    adminToken = r.json.token || r.json.accessToken;
    assert(r.json.user?.roles?.includes('super_admin'), 'role super_admin');
  });

  if (adminToken) {
    await step('SuperAdmin · lista tenants', async () => {
      const r = await req('GET', '/api/admin/tenants', { token: adminToken });
      assert(r.ok, `got ${r.status} ${r.json?.message || ''}`);
      assert(Array.isArray(r.json.tenants), 'tenants array');
      assert(r.json.tenants.some((t) => t.slug === 'minhatela'), 'default tenant');
    });

    await step('SuperAdmin · criar tenant sem reason → 400', async () => {
      const r = await req('POST', '/api/admin/tenants', {
        token: adminToken,
        body: { slug: `t${uid()}`, name: 'Tenant X' },
      });
      assert(r.status === 400, `got ${r.status}`);
    });

    await step('Admin · acquisitions list', async () => {
      const r = await req('GET', '/api/admin/acquisitions', { token: adminToken });
      assert(r.ok, `got ${r.status} ${JSON.stringify(r.json).slice(0, 120)}`);
    });

    await step('Admin · rights list', async () => {
      const r = await req('GET', '/api/admin/rights', { token: adminToken });
      assert(r.ok, `got ${r.status}`);
    });

    await step('Subscriber não cria acquisition', async () => {
      const r = await req('POST', '/api/admin/acquisitions', {
        token: sub.token,
        body: { title: 'Leak', reason: 'x' },
      });
      assert(r.status === 403, `got ${r.status}`);
    });
  }

  console.log(`\nResult: ${results.filter((x) => x.ok).length}/${results.length} · failed=${failed}\n`);
  process.exit(failed ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
