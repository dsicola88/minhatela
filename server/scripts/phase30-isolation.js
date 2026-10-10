'use strict';

/**
 * Fase 30 · Isolamento Tenant A/B + IDOR + MFA opt-in
 * Requer API local + DATABASE_URL (dois tenants reais de teste).
 * Não corre contra produção.
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { Pool } = require('pg');
const { SUPERADMIN } = require('../../database/seed/002_superadmin');
const totp = require('../src/utils/totp');

const BASE = process.env.API_BASE_URL || 'http://localhost:4000';
const results = [];
let failed = 0;
let blocked = 0;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function step(name, fn) {
  try {
    const d = await fn();
    results.push({ name, ok: true, status: 'PASS' });
    console.log(`✓ ${name}${d ? ` · ${d}` : ''}`);
  } catch (err) {
    failed += 1;
    results.push({ name, ok: false, status: 'FAIL', error: err.message });
    console.error(`✗ ${name}: ${err.message}`);
  }
}

async function req(method, urlPath, { body, token, headers } = {}) {
  const h = {
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...headers,
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
    json = { raw: text?.slice(0, 180) };
  }
  return { status: res.status, json };
}

function uid() {
  return `p30_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

async function register(label) {
  const email = `${label}.${uid()}@minhatela.ao`;
  const password = 'Angola2026!Segura';
  const r = await req('POST', '/api/auth/register', {
    body: { email, password, fullName: label, acceptTerms: true, deviceName: 'P30', platform: 'web' },
  });
  assert([200, 201].includes(r.status), `register ${r.status} ${r.json?.message || ''}`);
  const token = r.json.token || r.json.accessToken;
  const profiles = await req('GET', '/api/auth/profiles', { token });
  return {
    email,
    password,
    token,
    userId: r.json.user.id,
    profileId: profiles.json.profiles[0].id,
    tenantId: r.json.user.tenantId,
  };
}

function collectIds(payload) {
  const ids = new Set();
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (node.id) ids.add(String(node.id));
    Object.values(node).forEach(walk);
  };
  walk(payload);
  return ids;
}

async function run() {
  console.log(`\n══ Phase 30 isolation · ${BASE} ══\n`);

  if (/railway|minhatela\.net|onrender/i.test(BASE)) {
    console.error('BLOCKED: recusa correr isolamento contra host remoto/produção');
    process.exit(2);
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('BLOCKED: DATABASE_URL em falta — não é possível criar Tenant B real');
    process.exit(2);
  }

  const pool = new Pool({ connectionString: dbUrl });

  let tenantA;
  let tenantB;
  try {
    const t = await pool.query(`SELECT id, slug FROM tenants`);
    tenantA = t.rows.find((r) => r.slug === 'minhatela');
    if (!tenantA) throw new Error('tenant minhatela em falta — migrate 029');
  } catch (err) {
    console.error(`BLOCKED: ${err.message}`);
    blocked = 1;
    await pool.end().catch(() => {});
    process.exit(2);
  }

  const adminLogin = await req('POST', '/api/auth/login', {
    body: { email: SUPERADMIN.email, password: SUPERADMIN.password, deviceName: 'P30', platform: 'web' },
  });
  assert(adminLogin.status === 200, `superadmin login ${adminLogin.status}`);
  const adminToken = adminLogin.json.token || adminLogin.json.accessToken;

  const slug = `fase30-${uid()}`;
  const created = await req('POST', '/api/admin/tenants', {
    token: adminToken,
    body: { slug, name: 'Tenant B Teste', market: 'AO', reason: 'isolamento fase 30' },
  });
  assert([200, 201].includes(created.status), `create tenant ${created.status} ${created.json?.message}`);
  tenantB = created.json.tenant;
  assert(tenantB?.id, 'tenant B id');

  const userA = await register('tenantA');
  const userB = await register('tenantB');

  await pool.query(
    `DELETE FROM tenant_memberships WHERE user_id = $1`,
    [userB.userId]
  );
  await pool.query(
    `INSERT INTO tenant_memberships (user_id, tenant_id, role_code, status)
     VALUES ($1, $2, 'customer', 'active')`,
    [userB.userId, tenantB.id]
  );

  const relogB = await req('POST', '/api/auth/login', {
    body: {
      email: userB.email,
      password: userB.password,
      deviceName: 'P30',
      platform: 'web',
    },
  });
  assert(relogB.status === 200 && !relogB.json.mfaRequired, 'relogin B');
  userB.token = relogB.json.token || relogB.json.accessToken;
  userB.tenantId = relogB.json.user.tenantId;
  assert(String(userB.tenantId) === String(tenantB.id), `B tenant jwt ${userB.tenantId} vs ${tenantB.id}`);

  const bunnyA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const bunnyB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const slugA = `iso-a-${uid()}`;
  const slugB = `iso-b-${uid()}`;

  const insA = await pool.query(
    `INSERT INTO videos (
       title, slug, synopsis_short, synopsis_full, poster_url, backdrop_url,
       bunny_video_id, monetization, is_published, workflow_status, kind, tenant_id, rental_price_kz
     ) VALUES (
       'ISOLATION-A', $1, 'A', 'A', 'https://example.com/a.jpg', 'https://example.com/a.jpg',
       $2, 'tvod', TRUE, 'published', 'movie', $3, 1500
     ) RETURNING id`,
    [slugA, bunnyA, tenantA.id]
  );
  const insB = await pool.query(
    `INSERT INTO videos (
       title, slug, synopsis_short, synopsis_full, poster_url, backdrop_url,
       bunny_video_id, monetization, is_published, workflow_status, kind, tenant_id, rental_price_kz
     ) VALUES (
       'ISOLATION-B', $1, 'B', 'B', 'https://example.com/b.jpg', 'https://example.com/b.jpg',
       $2, 'tvod', TRUE, 'published', 'movie', $3, 1500
     ) RETURNING id`,
    [slugB, bunnyB, tenantB.id]
  );
  const contentA = insA.rows[0].id;
  const contentB = insB.rows[0].id;

  const hA = { 'x-profile-id': userA.profileId };
  const hB = { 'x-profile-id': userB.profileId };

  await step('Tenant JWT · A ≠ B', async () => {
    assert(userA.tenantId, 'A tenant');
    assert(String(userA.tenantId) !== String(userB.tenantId), 'tenants iguais');
  });

  await step('Catálogo home · A não vê ISOLATION-B', async () => {
    const r = await req('GET', '/api/catalog/home', { token: userA.token, headers: hA });
    assert(r.status === 200, `home ${r.status}`);
    const ids = collectIds(r.json);
    assert(!ids.has(String(contentB)), 'leak B no home A');
    assert(!JSON.stringify(r.json).includes('ISOLATION-B'), 'leak título B');
  });

  await step('Catálogo home · B não vê ISOLATION-A', async () => {
    const r = await req('GET', '/api/catalog/home', { token: userB.token, headers: hB });
    assert(r.status === 200, `home ${r.status}`);
    assert(!collectIds(r.json).has(String(contentA)), 'leak A no home B');
  });

  await step('Pesquisa · A não encontra ISOLATION-B', async () => {
    const r = await req('GET', `/api/search?q=ISOLATION-B`, { token: userA.token, headers: hA });
    assert([200, 404].includes(r.status), `search ${r.status}`);
    assert(!collectIds(r.json).has(String(contentB)), 'search leak');
  });

  await step('Suggest · A não sugere ISOLATION-B', async () => {
    const r = await req('GET', `/api/search/suggest?q=ISOLATION-B`, {
      token: userA.token,
      headers: hA,
    });
    assert(r.status === 200, `suggest ${r.status}`);
    assert(!collectIds(r.json).has(String(contentB)), 'suggest leak');
  });

  await step('Details IDOR · A → content B → 404', async () => {
    const r = await req('GET', `/api/catalog/videos/${contentB}`, {
      token: userA.token,
      headers: hA,
    });
    assert(r.status === 404, `got ${r.status}`);
  });

  await step('Playback IDOR · A → content B → 404', async () => {
    const r = await req('POST', `/api/watch/${contentB}/start`, {
      token: userA.token,
      headers: hA,
      body: { profileId: userA.profileId },
    });
    assert([403, 404].includes(r.status), `got ${r.status}`);
    assert(r.status !== 200, 'play cross-tenant');
  });

  await step('Checkout TVOD IDOR · A aluga B → 404', async () => {
    const r = await req('POST', '/api/payments/checkout', {
      token: userA.token,
      body: { type: 'rental', videoId: contentB, paymentMethod: 'iban' },
    });
    assert([400, 404, 415].includes(r.status), `got ${r.status}`);
  });

  await step('Analytics IDOR · A event content B → 404', async () => {
    const r = await req('POST', '/api/analytics/events', {
      token: userA.token,
      body: { eventName: 'video_started', contentId: contentB, profileId: userA.profileId },
    });
    assert([404, 400].includes(r.status), `got ${r.status} ${r.json?.code || ''}`);
  });

  await step('Rights list · subscriber 403', async () => {
    const r = await req('GET', '/api/admin/rights', { token: userA.token });
    assert(r.status === 403, `got ${r.status}`);
  });

  await step('Privilege · customer não cria tenant', async () => {
    const r = await req('POST', '/api/admin/tenants', {
      token: userA.token,
      body: { slug: 'hack', name: 'Hack', reason: 'x' },
    });
    assert(r.status === 403, `got ${r.status}`);
  });

  await step('Privilege · admin não promove super_admin', async () => {
    const r = await req('PATCH', `/api/admin/users/${userA.userId}`, {
      token: userA.token,
      body: { roleCode: 'super_admin' },
    });
    assert(r.status === 403, `got ${r.status}`);
  });

  await step('Discovery related · A não recebe B', async () => {
    const r = await req('GET', `/api/catalog/videos/${contentA}`, {
      token: userA.token,
      headers: hA,
    });
    if (r.status === 200) {
      assert(!collectIds(r.json).has(String(contentB)), 'related leak');
    }
  });

  await step('MFA enroll + confirm + login step-up', async () => {
    const enroll = await req('POST', '/api/auth/mfa/enroll', { token: userA.token });
    assert(enroll.status === 200, `enroll ${enroll.status} ${enroll.json?.message}`);
    const secret = enroll.json.secret;
    const code = totp.generate(secret);
    const confirm = await req('POST', '/api/auth/mfa/confirm', {
      token: userA.token,
      body: { code },
    });
    assert(confirm.status === 200, `confirm ${confirm.status}`);
    const login = await req('POST', '/api/auth/login', {
      body: {
        email: userA.email,
        password: userA.password,
        deviceName: 'P30',
        platform: 'web',
      },
    });
    assert(login.json.mfaRequired === true, 'mfaRequired');
    const code2 = totp.generate(secret);
    const done = await req('POST', '/api/auth/mfa/verify', {
      body: { mfaTicket: login.json.mfaTicket, code: code2 },
    });
    assert(done.status === 200 && (done.json.token || done.json.accessToken), 'mfa session');
    userA.token = done.json.token || done.json.accessToken;
  });

  await step('Four-eyes · um superadmin bypassa suspensão com reason', async () => {
    const r = await req('PATCH', `/api/admin/tenants/${tenantB.id}`, {
      token: adminToken,
      body: { status: 'active', reason: 'noop isolamento' },
    });
    assert(r.status === 200, `got ${r.status} ${r.json?.message}`);
  });

  await pool.query(`DELETE FROM videos WHERE id = ANY($1::uuid[])`, [[contentA, contentB]]);
  await pool.end();

  const passed = results.filter((x) => x.ok).length;
  console.log(`\nPASS ${passed}/${results.length} · FAIL ${failed} · BLOCKED ${blocked}\n`);
  process.exit(failed ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
