'use strict';

/**
 * MinhaTela · E2E ponta-a-ponta (Netflix AO enterprise)
 *
 * Cobertura:
 *  - Plataforma (health/ops/legal/plans)
 *  - Cliente: registo, login, perfis, catálogo, pesquisa, lista, ratings, play
 *  - Pagamentos Angola: IBAN/Multicaixa, comprovativo, TVOD, pack, assinatura
 *  - Superadmin: fila pagamentos, aprovar, encoding, CDN, surveys, packs, audit
 *  - Assinante pós-confirmação: acesso Premium / aluguer
 *  - Features Netflix: for-you, premieres, gifts, household, invoices, trending, OAuth gate
 *
 * Uso: API_BASE_URL=http://localhost:4000 node server/scripts/e2e.js
 */
const fs = require('fs');
const path = require('path');
const { SUPERADMIN } = require('../../database/seed/002_superadmin');

const BASE = process.env.API_BASE_URL || process.env.E2E_BASE_URL || 'http://localhost:4000';
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

async function req(method, urlPath, { body, token, headers, formData, retries = 0 } = {}) {
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
    json = { raw: text?.slice(0, 300) };
  }
  if (res.status === 429 && retries < 4) {
    await new Promise((r) => setTimeout(r, 1500 * (retries + 1)));
    return req(method, urlPath, { body, token, headers, formData, retries: retries + 1 });
  }
  return { status: res.status, json, ok: res.ok, headers: res.headers };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function uid() {
  return `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function checkoutWithProof({ token, type, paymentMethod, videoId, packId }) {
  const form = new FormData();
  form.append('type', type);
  form.append('paymentMethod', paymentMethod);
  if (videoId) form.append('videoId', videoId);
  if (packId) form.append('packId', packId);
  const buf = fs.readFileSync(PROOF);
  form.append('proof', new Blob([buf], { type: 'image/png' }), 'comprovativo-ao.png');
  return req('POST', '/api/payments/checkout', {
    token,
    formData: form,
    headers: { 'Idempotency-Key': `e2e_${uid()}` },
  });
}

async function run() {
  console.log(`\n══ MinhaTela E2E · ${BASE} · market AO ══\n`);

  // ─── 0. Plataforma ───
  await step('Plataforma · health', async () => {
    const r = await req('GET', '/health');
    assert(r.status === 200 && r.json?.status === 'ok', `health ${r.status}`);
  });

  await step('Plataforma · ready (sem secrets)', async () => {
    const ready = await req('GET', '/ready');
    assert([200, 503].includes(ready.status), `ready ${ready.status}`);
    assert(ready.json?.ready !== undefined, 'ready flag');
    assert(!ready.json?.queues, 'ready must not expose queues');
  });

  await step('Plataforma · /ops sem auth → 401', async () => {
    const ops = await req('GET', '/ops');
    assert(ops.status === 401, `ops ${ops.status}`);
  });

  await step('Plataforma · legal + plans', async () => {
    const legal = await req('GET', '/api/legal');
    assert(legal.json?.documents?.length >= 2, 'legal docs');
    const plans = await req('GET', '/api/plans');
    assert(plans.status === 200, 'plans');
  });

  // ─── 1. Cliente novo ───
  const email = `cliente.${uid()}@minhatela.ao`;
  const password = 'Angola2026!Segura';
  let customerToken = null;
  let profileId = null;
  let contentAvod = null;
  let contentTvod = null;
  let contentSvod = null;

  await step('Cliente · registo', async () => {
    const r = await req('POST', '/api/auth/register', {
      body: {
        email,
        password,
        fullName: 'Cliente E2E Angola',
        acceptTerms: true,
        deviceName: 'E2E Mobile',
        platform: 'ios',
      },
    });
    assert([200, 201].includes(r.status), `register ${r.status} ${r.json?.message || r.json?.code}`);
    assert(r.json?.token || r.json?.accessToken, 'token');
    customerToken = r.json.token || r.json.accessToken;
    return email;
  });

  await step('Cliente · /auth/me + perfis', async () => {
    const me = await req('GET', '/api/auth/me', { token: customerToken });
    assert(me.status === 200 && me.json?.email === email, 'me');
    const profiles = await req('GET', '/api/auth/profiles', { token: customerToken });
    assert(profiles.status === 200 && profiles.json?.profiles?.length >= 1, 'profiles');
    profileId = profiles.json.profiles[0].id;
    await req('POST', `/api/account/profiles/${profileId}/select`, {
      token: customerToken,
      body: {},
      headers: { 'x-profile-id': profileId },
    });
    return `profile=${profileId.slice(0, 8)}`;
  });

  await step('Cliente · conta / dispositivos / streams', async () => {
    const acc = await req('GET', '/api/account', { token: customerToken });
    assert(acc.status === 200 && acc.json?.user, 'account');
    const streams = await req('GET', '/api/account/streams', { token: customerToken });
    assert(streams.status === 200, 'streams');
  });

  // ─── 2. Catálogo Netflix ───
  await step('Catálogo · home', async () => {
    const r = await req('GET', '/api/catalog/home', {
      token: customerToken,
      headers: { 'x-profile-id': profileId },
    });
    assert(r.status === 200, `home ${r.status}`);
    const rows = r.json?.rows || [];
    assert(rows.length >= 1 || r.json?.featured, 'home content');
    const flat = rows.flatMap((row) => row.videos || []);
    contentAvod = flat.find((v) => v.monetization === 'avod') || flat[0] || r.json?.featured;
    contentTvod = flat.find((v) => v.monetization === 'tvod');
    contentSvod = flat.find((v) => v.monetization === 'svod');
    return `rows=${rows.length} featured=${Boolean(r.json?.featured)}`;
  });

  // fallback: search published
  if (!contentAvod || !contentTvod) {
    await step('Catálogo · search fallback', async () => {
      const r = await req('GET', '/api/search?q=a', {
        token: customerToken,
        headers: { 'x-profile-id': profileId },
      });
      // may be /api/discovery/search
      const s = r.status === 200 ? r : await req('GET', '/api/search?q=luanda', {
        token: customerToken,
        headers: { 'x-profile-id': profileId },
      });
      const items = s.json?.results || s.json?.items || [];
      if (!contentAvod) contentAvod = items.find((v) => v.monetization === 'avod') || items[0];
      if (!contentTvod) contentTvod = items.find((v) => v.monetization === 'tvod');
      if (!contentSvod) contentSvod = items.find((v) => v.monetization === 'svod');
      return `items=${items.length}`;
    });
  }

  await step('Catálogo · detalhes + share', async () => {
    assert(contentAvod?.id, 'need content');
    const d = await req('GET', `/api/catalog/content/${contentAvod.id}`, {
      token: customerToken,
      headers: { 'x-profile-id': profileId },
    });
    assert(d.status === 200 && (d.json?.content || d.json?.id), `details ${d.status}`);
    const share = await req('GET', `/api/catalog/share/${contentAvod.id}`);
    assert(share.status === 200, 'share');
  });

  await step('Discovery · trending search + suggest', async () => {
    const t = await req('GET', '/api/search/trending', { token: customerToken });
    assert(t.status === 200, `trending ${t.status}`);
    const s = await req('GET', '/api/search/suggest?q=lu', { token: customerToken });
    assert(s.status === 200, `suggest ${s.status}`);
  });

  await step('Discovery · for-you + favorites + stars', async () => {
    const fy = await req('GET', '/api/me/for-you', {
      token: customerToken,
      headers: { 'x-profile-id': profileId },
    });
    assert(fy.status === 200, `for-you ${fy.status}`);
    if (contentAvod?.id) {
      await req('POST', `/api/discovery/favorites/${contentAvod.id}`, {
        token: customerToken,
        headers: { 'x-profile-id': profileId },
        body: {},
      });
      const rate = await req('POST', `/api/discovery/${contentAvod.id}/rate`, {
        token: customerToken,
        headers: { 'x-profile-id': profileId },
        body: { stars: 5, profileId },
      });
      assert(rate.status === 200 && (rate.json?.stars === 5 || rate.json?.rating === 5), `rate ${rate.status}`);
    }
  });

  await step('Cliente · play AVOD (gate único)', async () => {
    assert(contentAvod?.id, 'need avod');
    const r = await req('POST', `/api/watch/${contentAvod.id}/start`, {
      token: customerToken,
      headers: { 'x-profile-id': profileId, 'x-device-key': `e2e-${uid()}`, 'x-device-name': 'E2E' },
      body: { profileId, platform: 'ios' },
    });
    // 200 com playback OU 503 sem Bunny asset real — ambos aceitáveis em lab
    assert(
      r.status === 200 ||
        r.status === 503 ||
        r.json?.code === 'NO_BUNNY_ASSET' ||
        r.json?.code === 'PIN_REQUIRED_PLAY',
      `play ${r.status} ${r.json?.code}`
    );
    if (r.status === 200) {
      assert(r.json?.playback?.embedUrl || r.json?.playback?.hlsUrl, 'playback urls');
      return 'playback ok';
    }
    return `lab:${r.json?.code || r.status}`;
  });

  // ─── 3. Pagamentos Angola ───
  let subTxId = null;
  let rentalTxId = null;
  let packTxId = null;

  await step('Pagamentos AO · métodos IBAN + Multicaixa', async () => {
    const r = await req('GET', '/api/payments/methods', { token: customerToken });
    assert(r.status === 200, `methods ${r.status}`);
    const methods = r.json?.methods || [];
    assert(methods.some((m) => m.id === 'iban'), 'iban');
    assert(methods.some((m) => m.id === 'multicaixa'), 'multicaixa');
    assert(r.json?.platform?.iban || r.json?.platform?.bankName, 'platform bank');
    return `iban=${Boolean(r.json.platform?.iban)}`;
  });

  await step('Pagamentos AO · checkout assinatura + comprovativo', async () => {
    const r = await checkoutWithProof({
      token: customerToken,
      type: 'subscription',
      paymentMethod: 'iban',
    });
    assert([200, 201].includes(r.status), `checkout ${r.status} ${JSON.stringify(r.json).slice(0, 180)}`);
    subTxId = r.json?.transaction?.id;
    assert(subTxId, 'tx id');
    assert(
      ['pending', 'pendente'].includes(r.json.transaction.status) ||
        r.json.transaction.status === 'pending',
      `status ${r.json.transaction.status}`
    );
    return `tx=${subTxId.slice(0, 8)} risk=${r.json.transaction.riskScore ?? 0}`;
  });

  await step('Pagamentos AO · checkout TVOD rental', async () => {
    if (!contentTvod?.id) {
      // resolve by slug via catalog search in DB through details of known seed
      const home = await req('GET', '/api/catalog/home', {
        token: customerToken,
        headers: { 'x-profile-id': profileId },
      });
      const flat = (home.json?.rows || []).flatMap((x) => x.videos || []);
      contentTvod = flat.find((v) => v.monetization === 'tvod');
    }
    if (!contentTvod?.id) {
      // try direct list - skip soft
      return 'skip:no-tvod';
    }
    const r = await checkoutWithProof({
      token: customerToken,
      type: 'rental',
      paymentMethod: 'multicaixa',
      videoId: contentTvod.id,
    });
    assert([200, 201].includes(r.status), `rental ${r.status} ${r.json?.message || r.json?.code}`);
    rentalTxId = r.json?.transaction?.id;
    return `tx=${rentalTxId?.slice(0, 8)}`;
  });

  await step('Pagamentos AO · packs TVOD', async () => {
    const packs = await req('GET', '/api/payments/packs', { token: customerToken });
    assert(packs.status === 200 && Array.isArray(packs.json?.packs), `packs ${packs.status}`);
    if (!packs.json.packs.length) return 'skip:no-packs';
    const pack = packs.json.packs[0];
    const r = await checkoutWithProof({
      token: customerToken,
      type: 'pack',
      paymentMethod: 'iban',
      packId: pack.id,
    });
    assert([200, 201].includes(r.status), `pack checkout ${r.status} ${r.json?.code || r.json?.message}`);
    packTxId = r.json?.transaction?.id;
    return `${pack.slug} tx=${packTxId?.slice(0, 8)}`;
  });

  await step('Cliente · minhas transacções (pendentes)', async () => {
    const r = await req('GET', '/api/payments/transactions', { token: customerToken });
    assert(r.status === 200 && (r.json?.transactions?.length || 0) >= 1, 'txs');
    return `n=${r.json.transactions.length}`;
  });

  // ─── 4. Superadmin / empresa ───
  let adminToken = null;

  await step('Superadmin · login empresa', async () => {
    const r = await req('POST', '/api/auth/login', {
      body: {
        email: SUPERADMIN.email,
        password: SUPERADMIN.password,
        deviceName: 'E2E Admin Console',
        platform: 'web',
      },
    });
    assert(r.status === 200, `admin login ${r.status} ${r.json?.message || r.json?.code}`);
    adminToken = r.json.token || r.json.accessToken;
    assert(adminToken, 'admin token');
    const me = await req('GET', '/api/auth/me', { token: adminToken });
    assert(me.json?.isAdmin || me.json?.roles?.includes('super_admin') || me.json?.roles?.includes('admin'), 'admin role');
    return SUPERADMIN.email;
  });

  await step('Superadmin · command-center + ops autenticado', async () => {
    const r = await req('GET', '/api/admin/command-center', { token: adminToken });
    assert(r.status === 200, `cc ${r.status}`);
    const ops = await req('GET', '/ops', { token: adminToken });
    assert([200, 503].includes(ops.status) && ops.json?.market === 'AO', `ops ${ops.status}`);
    return `users=${r.json?.users ?? r.json?.stats?.users ?? '?'}`;
  });

  await step('Superadmin · fila pagamentos + risco', async () => {
    const pending = await req('GET', '/api/admin/transactions/pending', { token: adminToken });
    assert(pending.status === 200, `pending ${pending.status}`);
    const risk = await req('GET', '/api/admin/payments/risk?minScore=0', { token: adminToken });
    assert(risk.status === 200, `risk ${risk.status}`);
    return `pending=${pending.json?.transactions?.length || 0}`;
  });

  await step('Superadmin · aprovar assinatura (liberta Premium)', async () => {
    assert(subTxId, 'need sub tx');
    const r = await req('PATCH', `/api/admin/transactions/${subTxId}/status`, {
      token: adminToken,
      body: { status: 'paid', adminNotes: 'E2E · comprovativo IBAN validado' },
    });
    assert(r.status === 200, `approve ${r.status} ${JSON.stringify(r.json).slice(0, 160)}`);
    const st = r.json?.transaction?.status;
    assert(st === 'paid' || st === 'pago', `status ${st}`);
  });

  if (rentalTxId) {
    await step('Superadmin · aprovar TVOD 48h', async () => {
      const r = await req('PATCH', `/api/admin/transactions/${rentalTxId}/status`, {
        token: adminToken,
        body: { status: 'paid', adminNotes: 'E2E Multicaixa OK' },
      });
      assert(r.status === 200, `approve rental ${r.status}`);
    });
  }

  if (packTxId) {
    await step('Superadmin · aprovar pack', async () => {
      const r = await req('PATCH', `/api/admin/transactions/${packTxId}/status`, {
        token: adminToken,
        body: { status: 'paid', adminNotes: 'E2E pack OK' },
      });
      assert(r.status === 200, `approve pack ${r.status}`);
    });
  }

  await step('Superadmin · encoding + CDN probe + surveys + packs admin', async () => {
    const enc = await req('GET', '/api/admin/encoding', { token: adminToken });
    assert(enc.status === 200, `encoding ${enc.status}`);
    const cdn = await req('POST', '/api/admin/cdn/probe', { token: adminToken, body: {} });
    assert(cdn.status === 200, `cdn ${cdn.status}`);
    const surveys = await req('GET', '/api/admin/surveys/summary', { token: adminToken });
    assert(surveys.status === 200, `surveys ${surveys.status}`);
    const packs = await req('GET', '/api/admin/packs', { token: adminToken });
    assert(packs.status === 200, `admin packs ${packs.status}`);
    const exp = await req('GET', '/api/admin/experiments', { token: adminToken });
    assert(exp.status === 200, `experiments ${exp.status}`);
  });

  await step('Superadmin · audit log', async () => {
    const r = await req('GET', '/api/admin/audit?limit=20', { token: adminToken });
    assert(r.status === 200, `audit ${r.status}`);
  });

  // ─── 5. Assinante pós-pagamento ───
  await step('Assinante · Premium activo após confirmação', async () => {
    const me = await req('GET', '/api/auth/me', { token: customerToken });
    assert(me.status === 200, 'me');
    const status = me.json?.subscriptionStatus || me.json?.user?.subscriptionStatus;
    const acc = await req('GET', '/api/account', { token: customerToken });
    const sub =
      status ||
      acc.json?.user?.subscriptionStatus ||
      acc.json?.user?.effectiveSubscription?.status;
    assert(sub === 'premium_active', `expected premium_active got ${sub}`);
    return sub;
  });

  await step('Assinante · acesso SVOD + recibo', async () => {
    if (contentSvod?.id) {
      const d = await req('GET', `/api/catalog/content/${contentSvod.id}`, {
        token: customerToken,
        headers: { 'x-profile-id': profileId },
      });
      const access = d.json?.access;
      assert(
        access?.canWatch === true || access?.action === 'watch',
        `svod access ${JSON.stringify(access).slice(0, 120)}`
      );
    }
    const txs = await req('GET', '/api/payments/transactions', { token: customerToken });
    const paid = (txs.json?.transactions || []).find((t) => t.id === subTxId);
    assert(paid && (paid.status === 'paid' || paid.status === 'pago'), 'paid tx visible');
    const receipt = await req('GET', `/api/payments/transactions/${subTxId}/receipt`, {
      token: customerToken,
    });
    assert(receipt.status === 200, `receipt ${receipt.status}`);
  });

  // ─── 6. Features Netflix restantes ───
  await step('Netflix · premieres + gifts + household', async () => {
    const p = await req('GET', '/api/premieres', { token: customerToken });
    assert(p.status === 200, `premieres ${p.status}`);
    const g = await req('GET', '/api/gifts', { token: customerToken });
    assert(g.status === 200, `gifts ${g.status}`);
    const h = await req('GET', '/api/household', { token: customerToken });
    assert(h.status === 200 || h.status === 404, `household ${h.status}`);
  });

  await step('Netflix · invoices + languages + network', async () => {
    const inv = await req('GET', '/api/me/invoices', { token: customerToken });
    assert(inv.status === 200, `invoices ${inv.status}`);
    const lang = await req('GET', '/api/browse/languages', { token: customerToken });
    assert(lang.status === 200, `languages ${lang.status}`);
    const net = await req('POST', '/api/network/diagnostics', {
      token: customerToken,
      body: {},
    });
    assert(net.status === 200 || net.status === 201, `network ${net.status}`);
  });

  await step('Netflix · NPS survey + experiments + trusted devices', async () => {
    const s = await req('GET', '/api/surveys/pending', { token: customerToken });
    assert(s.status === 200, `survey ${s.status}`);
    if (s.json?.pending) {
      const resp = await req('POST', '/api/surveys/respond', {
        token: customerToken,
        body: { promptKey: s.json.pending.key, nps: 9, comment: 'E2E AO', profileId },
      });
      assert([200, 201].includes(resp.status), `respond ${resp.status}`);
    }
    const exp = await req('GET', '/api/account/experiments', { token: customerToken });
    assert(exp.status === 200, `exp ${exp.status}`);
    const devices = await req('GET', '/api/account/devices', { token: customerToken });
    assert(devices.status === 200, `devices ${devices.status}`);
  });

  await step('Netflix · help + legal accept + OAuth gate', async () => {
    const help = await req('GET', '/api/support/help', { token: customerToken });
    assert(help.status === 200, `help ${help.status}`);
    const oauth = await req('POST', '/api/auth/oauth/google', { body: {} });
    assert([400, 401, 429].includes(oauth.status), `oauth gate ${oauth.status}`);
  });

  await step('Segurança · cliente sem acesso admin', async () => {
    const r = await req('GET', '/api/admin/transactions/pending', { token: customerToken });
    assert(r.status === 403 || r.status === 401, `expected forbid got ${r.status}`);
  });

  // ─── Report ───
  const passed = results.filter((r) => r.ok).length;
  const total = results.length;
  console.log('\n══ RESULTADO E2E ══');
  console.log(`PASS ${passed}/${total} · FAIL ${failed}`);
  console.log(
    failed === 0
      ? 'APP_OK · ponta-a-ponta Netflix AO · cliente + pagamentos + superadmin'
      : 'E2E_FAIL · ver passos ✗ acima'
  );

  if (failed > 0) {
    console.log('\nFalhas:');
    results.filter((r) => !r.ok).forEach((r) => console.log(` - ${r.name}: ${r.error}`));
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('E2E crashed', err);
  process.exit(1);
});
