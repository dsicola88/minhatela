'use strict';

/**
 * Fase 31 · Superfícies restantes + four-eyes a 2 SuperAdmins
 * Só API+DB local. Recusa hosts remotos. Não apaga dados de produção.
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { Pool } = require('pg');
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
    json = { raw: String(text).slice(0, 180) };
  }
  return { status: res.status, json };
}

function uid() {
  return `p31_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
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

async function register(label) {
  const email = `${label}.${uid()}@minhatela.ao`;
  const password = 'Angola2026!Segura';
  const r = await req('POST', '/api/auth/register', {
    body: { email, password, fullName: label, acceptTerms: true, deviceName: 'P31', platform: 'web' },
  });
  assert([200, 201].includes(r.status), `register ${r.status}`);
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

async function run() {
  console.log(`\n══ Phase 31 readiness · ${BASE} ══\n`);
  if (/railway|minhatela\.net|onrender/i.test(BASE)) {
    console.error('BLOCKED: host remoto');
    process.exit(2);
  }
  if (!process.env.DATABASE_URL) {
    console.error('BLOCKED: DATABASE_URL em falta');
    process.exit(2);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const tenants = await pool.query(`SELECT id, slug FROM tenants`);
  const tenantA = tenants.rows.find((r) => r.slug === 'minhatela');
  assert(tenantA, 'tenant minhatela');

  const adminLogin = await req('POST', '/api/auth/login', {
    body: {
      email: SUPERADMIN.email,
      password: SUPERADMIN.password,
      deviceName: 'P31',
      platform: 'web',
    },
  });
  assert(adminLogin.status === 200, 'superadmin login');
  const adminToken = adminLogin.json.token || adminLogin.json.accessToken;

  const createdB = await req('POST', '/api/admin/tenants', {
    token: adminToken,
    body: { slug: `p31b-${uid()}`, name: 'P31 Tenant B', reason: 'fase 31 isolamento' },
  });
  assert([200, 201].includes(createdB.status), `tenant B ${createdB.status}`);
  const tenantB = createdB.json.tenant;

  const userA = await register('p31a');
  const userB = await register('p31b');
  await pool.query(`DELETE FROM tenant_memberships WHERE user_id = $1`, [userB.userId]);
  await pool.query(
    `INSERT INTO tenant_memberships (user_id, tenant_id, role_code, status)
     VALUES ($1,$2,'customer','active')`,
    [userB.userId, tenantB.id]
  );
  const relog = await req('POST', '/api/auth/login', {
    body: {
      email: userB.email,
      password: userB.password,
      deviceName: 'P31',
      platform: 'web',
    },
  });
  userB.token = relog.json.token || relog.json.accessToken;

  const bunnyA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
  const bunnyB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
  const insA = await pool.query(
    `INSERT INTO videos (
       title, slug, synopsis_short, synopsis_full, poster_url, backdrop_url,
       bunny_video_id, monetization, is_published, workflow_status, kind, tenant_id, languages
     ) VALUES (
       'P31-A', $1, 'A', 'A', 'https://example.com/a.jpg', 'https://example.com/a.jpg',
       $2, 'avod', TRUE, 'published', 'movie', $3, ARRAY['pt']
     ) RETURNING id`,
    [`p31-a-${uid()}`, bunnyA, tenantA.id]
  );
  const insB = await pool.query(
    `INSERT INTO videos (
       title, slug, synopsis_short, synopsis_full, poster_url, backdrop_url,
       bunny_video_id, monetization, is_published, workflow_status, kind, tenant_id, languages
     ) VALUES (
       'P31-B', $1, 'B', 'B', 'https://example.com/b.jpg', 'https://example.com/b.jpg',
       $2, 'avod', TRUE, 'published', 'movie', $3, ARRAY['umbundu']
     ) RETURNING id`,
    [`p31-b-${uid()}`, bunnyB, tenantB.id]
  );
  const contentA = insA.rows[0].id;
  const contentB = insB.rows[0].id;

  const colSlug = `p31-col-${uid()}`;
  const col = await pool.query(
    `INSERT INTO editorial_collections (slug, title, is_published, placement, tenant_id)
     VALUES ($1, 'P31 mix', TRUE, 'home', $2) RETURNING id`,
    [colSlug, tenantA.id]
  );
  await pool.query(
    `INSERT INTO editorial_collection_items (collection_id, content_id, sort_order)
     VALUES ($1,$2,0), ($1,$3,1)`,
    [col.rows[0].id, contentA, contentB]
  );
  const colBSlug = `p31-colb-${uid()}`;
  const colB = await pool.query(
    `INSERT INTO editorial_collections (slug, title, is_published, placement, tenant_id)
     VALUES ($1, 'P31 só B', TRUE, 'home', $2) RETURNING id`,
    [colBSlug, tenantB.id]
  );
  await pool.query(
    `INSERT INTO editorial_collection_items (collection_id, content_id, sort_order)
     VALUES ($1,$2,0)`,
    [colB.rows[0].id, contentB]
  );

  const packSlug = `p31-pack-${uid()}`;
  const pack = await pool.query(
    `INSERT INTO tvod_packs (slug, title, price_kz, is_active, tenant_id)
     VALUES ($1, 'P31 Pack B', 2500, TRUE, $2) RETURNING id`,
    [packSlug, tenantB.id]
  );
  await pool.query(
    `INSERT INTO tvod_pack_items (pack_id, video_id, sort_order) VALUES ($1,$2,0)`,
    [pack.rows[0].id, contentB]
  );

  const person = await pool.query(
    `INSERT INTO people (slug, full_name, tenant_id) VALUES ($1, 'Actor P31', $2) RETURNING id, slug`,
    [`actor-p31-${uid()}`, tenantB.id]
  );

  const adv = await pool.query(
    `INSERT INTO advertisers (user_id, company_name, contact_email, status, tenant_id)
     VALUES ($1, 'P31 Ads B', $2, 'active', $3)
     ON CONFLICT (user_id) DO UPDATE SET tenant_id = EXCLUDED.tenant_id
     RETURNING id`,
    [userB.userId, userB.email, tenantB.id]
  );
  const campaign = await pool.query(
    `INSERT INTO campaigns (
       advertiser_id, name, placement, budget_kz, starts_at, ends_at, status, tenant_id
     ) VALUES (
       $1, 'P31 Camp B', 'pre_roll', 5000, NOW(), NOW() + INTERVAL '7 days', 'pending_review', $2
     ) RETURNING id`,
    [adv.rows[0].id, tenantB.id]
  );
  await pool.query(
    `INSERT INTO content_people (content_id, person_id, role, sort_order)
     VALUES ($1,$2,'actor',0)`,
    [contentB, person.rows[0].id]
  );

  const hA = { 'x-profile-id': userA.profileId };

  await step('Editorial · A não vê P31-B na colecção mista', async () => {
    const r = await req('GET', `/api/browse/collections/${colSlug}`, {
      token: userA.token,
      headers: hA,
    });
    assert(r.status === 200, `got ${r.status}`);
    assert(!collectIds(r.json).has(String(contentB)), 'editorial leak B');
    assert(!JSON.stringify(r.json).includes('P31-B'), 'título B');
  });

  await step('Languages · A não lista umbundu só de B', async () => {
    const r = await req('GET', '/api/browse/languages', { token: userA.token, headers: hA });
    assert(r.status === 200, `got ${r.status}`);
    const blob = JSON.stringify(r.json).toLowerCase();
    assert(!blob.includes('umbundu'), 'language leak');
  });

  await step('People/cast · pessoa só de B → 404 para A', async () => {
    const r = await req('GET', `/api/catalog/people/${person.rows[0].slug}`, {
      token: userA.token,
      headers: hA,
    });
    assert(r.status === 404, `got ${r.status}`);
  });

  await step('Editorial · colecção só de B → 404 para A', async () => {
    const r = await req('GET', `/api/browse/collections/${colBSlug}`, {
      token: userA.token,
      headers: hA,
    });
    assert(r.status === 404, `got ${r.status}`);
  });

  await step('More-like-this · A → content B → 404', async () => {
    const r = await req('GET', `/api/catalog/content/${contentB}/more-like-this`, {
      token: userA.token,
      headers: hA,
    });
    assert(r.status === 404, `got ${r.status}`);
  });

  await step('Scrub · A → content B sem metadados de B', async () => {
    const r = await req('GET', `/api/catalog/content/${contentB}/scrub`, {
      token: userA.token,
      headers: hA,
    });
    if (r.status === 200) {
      const blob = JSON.stringify(r.json);
      assert(!blob.includes('P31-B'), 'scrub title');
      assert(!blob.includes(String(contentB)), 'scrub id');
      return 'flag off ou scrub null';
    }
    assert([403, 404].includes(r.status), `got ${r.status}`);
  });

  await step('Share público · content B → 404', async () => {
    const catalog = await req('GET', `/api/catalog/share/${contentB}`, {});
    assert(catalog.status === 404, `catalog share ${catalog.status}`);
    const og = await req('GET', `/share/${contentB}`, {});
    assert(og.status === 404, `og share ${og.status}`);
  });

  await step('Packs · A não vê pack do Tenant B', async () => {
    const r = await req('GET', '/api/payments/packs', { token: userA.token, headers: hA });
    assert(r.status === 200, `got ${r.status}`);
    assert(!collectIds(r.json).has(String(contentB)), 'pack item leak');
    assert(!JSON.stringify(r.json).includes('P31 Pack B'), 'pack título B');
    const one = await req('GET', `/api/payments/packs/${packSlug}`, { token: userA.token, headers: hA });
    assert(one.status === 404, `pack by slug ${one.status}`);
  });

  await step('Watch-together · A não cria sala com content B', async () => {
    const r = await req('POST', '/api/watch-together/rooms', {
      token: userA.token,
      headers: hA,
      body: { contentId: contentB, profileId: userA.profileId },
    });
    assert([403, 404].includes(r.status), `got ${r.status}`);
  });

  await step('Parental block · A não bloqueia content B', async () => {
    const r = await req('POST', `/api/parental/profiles/${userA.profileId}/blocked/${contentB}`, {
      token: userA.token,
    });
    assert(r.status === 404, `got ${r.status}`);
  });

  const staff = await register('p31staff');
  await pool.query(
    `INSERT INTO user_roles (user_id, role_id)
     SELECT $1, id FROM roles WHERE code = 'admin'
     ON CONFLICT DO NOTHING`,
    [staff.userId]
  );
  const staffLogin = await req('POST', '/api/auth/login', {
    body: {
      email: staff.email,
      password: staff.password,
      deviceName: 'P31',
      platform: 'web',
    },
  });
  const staffToken = staffLogin.json.token || staffLogin.json.accessToken;
  assert((staffLogin.json.user?.roles || []).includes('admin'), 'staff admin');

  await step('Admin (não Super) · users não lista Tenant B', async () => {
    const r = await req('GET', `/api/admin/users?q=${encodeURIComponent(userB.email)}`, {
      token: staffToken,
    });
    assert(r.status === 200, `got ${r.status}`);
    const emails = (r.json.users || []).map((u) => u.email);
    assert(!emails.includes(userB.email), `leak ${emails.join(',')}`);
    assert((r.json.total || 0) === 0, `total ${r.json.total}`);
  });

  await step('SuperAdmin · users lista Tenant B', async () => {
    const r = await req('GET', `/api/admin/users?q=${encodeURIComponent(userB.email)}`, {
      token: adminToken,
    });
    assert(r.status === 200, `got ${r.status}`);
    assert((r.json.users || []).some((u) => u.email === userB.email), 'super não vê B');
  });

  await step('Admin (não Super) · catalog CMS sem P31-B', async () => {
    const r = await req('GET', '/api/admin/catalog?q=P31-B', { token: staffToken });
    assert(r.status === 200, `got ${r.status}`);
    assert(!collectIds(r.json).has(String(contentB)), 'cms leak');
    assert(!JSON.stringify(r.json).includes('P31-B'), 'título cms');
  });

  await step('SuperAdmin · catalog CMS vê P31-B', async () => {
    const r = await req('GET', '/api/admin/catalog?q=P31-B', { token: adminToken });
    assert(r.status === 200, `got ${r.status}`);
    assert(collectIds(r.json).has(String(contentB)), 'super cms');
  });

  await step('Admin (não Super) · campanha B oculta', async () => {
    const r = await req('GET', '/api/admin/ads/campaigns?status=pending_review', {
      token: staffToken,
    });
    assert(r.status === 200, `got ${r.status}`);
    const names = JSON.stringify(r.json);
    assert(!names.includes('P31 Camp B'), 'campaign leak');
    assert(!collectIds(r.json).has(String(campaign.rows[0].id)), 'campaign id');
  });

  await step('SuperAdmin · campanha B visível', async () => {
    const r = await req('GET', '/api/admin/ads/campaigns?status=pending_review', {
      token: adminToken,
    });
    assert(r.status === 200, `got ${r.status}`);
    assert(collectIds(r.json).has(String(campaign.rows[0].id)), 'super campaign');
  });

  await step('Admin · PATCH user B → 404', async () => {
    const r = await req('PATCH', `/api/admin/users/${userB.userId}`, {
      token: staffToken,
      body: { fullName: 'p31-hack' },
    });
    assert(r.status === 404, `got ${r.status}`);
  });

  const eyes = await register('p31eyes');
  await pool.query(
    `INSERT INTO user_roles (user_id, role_id)
     SELECT $1, id FROM roles WHERE code = 'super_admin'
     ON CONFLICT DO NOTHING`,
    [eyes.userId]
  );
  const eyesLogin = await req('POST', '/api/auth/login', {
    body: {
      email: eyes.email,
      password: eyes.password,
      deviceName: 'P31',
      platform: 'web',
    },
  });
  const eyesToken = eyesLogin.json.token || eyesLogin.json.accessToken;
  const eyesRoles = eyesLogin.json.user?.roles || eyesLogin.json.roles || [];
  assert(eyesRoles.includes('super_admin'), `eyes roles ${JSON.stringify(eyesRoles)}`);

  const target = await req('POST', '/api/admin/tenants', {
    token: adminToken,
    body: { slug: `p31fe-${uid()}`, name: 'P31 four-eyes', reason: 'alvo four-eyes' },
  });
  assert([200, 201].includes(target.status), 'target tenant');
  const targetId = target.json.tenant.id;
  let feId = null;

  await step('Four-eyes · 2 SuperAdmins → pending', async () => {
    const r = await req('PATCH', `/api/admin/tenants/${targetId}`, {
      token: adminToken,
      body: { status: 'suspended', reason: 'prova four-eyes fase 31' },
    });
    assert(r.status === 200, `got ${r.status} ${r.json?.message}`);
    assert(r.json.pendingFourEyes === true, `not pending ${JSON.stringify(r.json).slice(0, 160)}`);
    assert(r.json.request?.id, 'request id');
    feId = r.json.request.id;
  });

  await step('Four-eyes · mesmo actor não aprova', async () => {
    assert(feId, 'request id em falta');
    const r = await req('POST', `/api/admin/approvals/${feId}/decide`, {
      token: adminToken,
      body: { approve: true, reason: 'auto' },
    });
    assert(r.status === 403, `got ${r.status}`);
  });

  await step('Four-eyes · segundo SuperAdmin executa suspensão', async () => {
    assert(feId, 'request id em falta');
    const r = await req('POST', `/api/admin/approvals/${feId}/decide`, {
      token: eyesToken,
      body: { approve: true, reason: 'confirmação segundo par' },
    });
    assert(r.status === 200, `got ${r.status} ${r.json?.message}`);
    assert(r.json.status === 'executed', `status ${r.json.status}`);
    const check = await pool.query(`SELECT status FROM tenants WHERE id = $1`, [targetId]);
    assert(check.rows[0].status === 'suspended', `db ${check.rows[0].status}`);
  });

  const promo = await register('p31promo');
  let promoFe = null;
  await step('Four-eyes · promover SuperAdmin → pending', async () => {
    const r = await req('PATCH', `/api/admin/users/${promo.userId}`, {
      token: adminToken,
      body: { roleCode: 'super_admin', reason: 'prova four-eyes promoção' },
    });
    assert(r.status === 200, `got ${r.status} ${r.json?.message}`);
    assert(r.json.pendingFourEyes === true, `not pending ${JSON.stringify(r.json).slice(0, 160)}`);
    promoFe = r.json.request.id;
  });

  await step('Four-eyes · segundo par executa promoção SuperAdmin', async () => {
    assert(promoFe, 'promo request');
    const r = await req('POST', `/api/admin/approvals/${promoFe}/decide`, {
      token: eyesToken,
      body: { approve: true, reason: 'confirma promoção' },
    });
    assert(r.status === 200, `got ${r.status}`);
    assert(r.json.status === 'executed', `status ${r.json.status}`);
    const roles = await pool.query(
      `SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
       WHERE ur.user_id = $1 AND r.code = 'super_admin'`,
      [promo.userId]
    );
    assert(roles.rowCount === 1, 'role não aplicada');
  });

  await pool.query(
    `DELETE FROM user_roles ur USING roles r
     WHERE ur.role_id = r.id AND r.code = 'super_admin' AND ur.user_id = $1`,
    [promo.userId]
  );

  await step('Admin command-center + metrics sem 5xx', async () => {
    const cc = await req('GET', '/api/admin/command-center', { token: staffToken });
    assert(cc.status === 200, `cc ${cc.status}`);
    const m = await req('GET', '/metrics', { token: staffToken });
    assert(m.status === 200, `metrics ${m.status}`);
  });

  await pool.query(`UPDATE tenants SET status = 'active' WHERE id = $1`, [targetId]);
  await pool.query(`DELETE FROM tvod_pack_items WHERE pack_id = $1`, [pack.rows[0].id]);
  await pool.query(`DELETE FROM tvod_packs WHERE id = $1`, [pack.rows[0].id]);
  await pool.query(`DELETE FROM editorial_collection_items WHERE collection_id = ANY($1::uuid[])`, [
    [col.rows[0].id, colB.rows[0].id],
  ]);
  await pool.query(`DELETE FROM editorial_collections WHERE id = ANY($1::uuid[])`, [
    [col.rows[0].id, colB.rows[0].id],
  ]);
  await pool.query(`DELETE FROM campaigns WHERE id = $1`, [campaign.rows[0].id]);
  await pool.query(`DELETE FROM content_people WHERE content_id = ANY($1::uuid[])`, [
    [contentA, contentB],
  ]);
  await pool.query(`DELETE FROM people WHERE id = $1`, [person.rows[0].id]);
  await pool.query(`DELETE FROM videos WHERE id = ANY($1::uuid[])`, [[contentA, contentB]]);
  await pool.end();

  const passed = results.filter((x) => x.ok).length;
  console.log(`\nPASS ${passed}/${results.length} · FAIL ${failed}\n`);
  process.exit(failed ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
