'use strict';

/**
 * Probe live SuperAdmin gates (local API). Não imprime secrets.
 * Uso: node server/scripts/superadmin-live-probe.js
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { SUPERADMIN } = require('../../database/seed/002_superadmin');
const mfaService = require('../src/services/mfaService');
const jwt = require('jsonwebtoken');

const base = process.env.API_BASE || 'http://localhost:4000';

async function req(method, pathName, { token, body } = {}) {
  const r = await fetch(base + pathName, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await r.json().catch(() => ({}));
  return { status: r.status, json };
}

async function adminLogin() {
  let r = await req('POST', '/api/auth/login', {
    body: {
      email: SUPERADMIN.email,
      password: SUPERADMIN.password,
      deviceName: 'SuperAdmin Live Probe',
      platform: 'web',
    },
  });
  if (r.json?.mfaSetupRequired) {
    throw new Error('mfaSetupRequired — corra e2e ou enrol MFA primeiro');
  }
  if (r.json?.mfaRequired) {
    const sub = jwt.decode(r.json.mfaTicket)?.sub;
    const code = await mfaService.totpNow(sub);
    if (!code) throw new Error('sem código MFA');
    r = await req('POST', '/api/auth/mfa/verify', {
      body: {
        mfaTicket: r.json.mfaTicket,
        code,
        deviceName: 'SuperAdmin Live Probe',
        platform: 'web',
      },
    });
  }
  const token = r.json.token || r.json.accessToken;
  if (!token) throw new Error(`login falhou ${r.status} ${r.json?.code || r.json?.message || ''}`);
  return token;
}

(async () => {
  const ready = await req('GET', '/ready');
  if (!ready.json?.ready) throw new Error('API /ready não ok');

  const token = await adminLogin();

  const pendingPay = await req('GET', '/api/admin/transactions/pending', { token });
  const payLabels = (pendingPay.json.transactions || []).map((t) => ({
    status: t.status,
    statusLabel: t.statusLabel,
  }));

  const proofs = await req('GET', '/api/admin/uploads/proofs', { token });
  const proofSample = (proofs.json.proofs || []).slice(0, 5).map((p) => ({
    status: p.status,
    statusLabel: p.statusLabel,
  }));

  const ads = await req('GET', '/api/admin/ads/campaigns', { token });
  const campaigns = ads.json?.campaigns || [];
  const adsShapeOk =
    campaigns.length === 0 ||
    campaigns.every((c) => typeof c.funded === 'boolean' && c.lifecycle && c.lifecycle.id);

  await req('POST', '/api/ads/advertisers/register', {
    token,
    body: { companyName: 'MinhaTela Ops Probe', contactEmail: SUPERADMIN.email },
  });

  const camp = await req('POST', '/api/ads/campaigns', {
    token,
    body: {
      name: `Probe Align ${Date.now()}`,
      objective: 'brand',
      budgetKz: 5000,
      startsAt: new Date().toISOString(),
      endsAt: new Date(Date.now() + 86400000).toISOString(),
      creative: {
        title: 'Probe',
        mediaKind: 'image',
        mediaUrl: 'https://example.com/ad-probe.jpg',
        durationSeconds: 6,
        ctaLabel: 'Saber mais',
      },
    },
  });
  const campaignId = camp.json?.campaign?.id;
  const approveUnfunded = campaignId
    ? await req('PATCH', `/api/admin/campaigns/${campaignId}/status`, {
        token,
        body: { status: 'active' },
      })
    : { status: 'skip', json: { code: 'NO_CAMPAIGN' } };

  const stamp = Date.now();
  const user = await req('POST', '/api/auth/register', {
    body: {
      email: `cineasta.probe_${stamp}@minhatela.ao`,
      password: 'ProbePass123!',
      fullName: 'Cineasta Probe',
    },
  });
  const uToken = user.json.token || user.json.accessToken;
  let cand = { status: user.status, json: { code: 'NO_USER_TOKEN', register: user.json?.code } };
  if (uToken) {
    cand = await req('POST', '/api/creator-studio/register', {
      token: uToken,
      body: { displayName: `Probe Studio ${stamp}`, type: 'filmmaker', bio: 'teste' },
    });
  }
  const creatorId = cand.json?.creator?.id;
  // Se o registo falhar (rate limit), usar um pendente da fila admin
  let targetCreatorId = creatorId;
  if (!targetCreatorId) {
    const pendingCreators = await req('GET', '/api/admin/creators/pending', { token });
    const pending = (pendingCreators.json?.creators || []).find((c) => c.status === 'pending');
    targetCreatorId = pending?.id || null;
  }
  const rejectBare = targetCreatorId
    ? await req('PATCH', `/api/admin/creators/${targetCreatorId}/status`, {
        token,
        body: { status: 'rejected' },
      })
    : { status: 'skip', json: { hint: 'sem creator', candStatus: cand.status, candCode: cand.json?.code } };
  const rejectOk =
    targetCreatorId && rejectBare.status === 400
      ? await req('PATCH', `/api/admin/creators/${targetCreatorId}/status`, {
          token,
          body: { status: 'rejected', reason: 'Documentação incompleta' },
        })
      : rejectBare.status === 'skip'
        ? rejectBare
        : { status: 'skip', json: { afterBare: rejectBare.status, code: rejectBare.json?.code } };

  const payoutBare = await req(
    'PATCH',
    '/api/admin/payouts/00000000-0000-4000-8000-000000000001/status',
    { token, body: { status: 'rejected' } }
  );

  const firstTx = (pendingPay.json.transactions || [])[0]?.id;
  const dialect = firstTx
    ? await req('PATCH', `/api/admin/transactions/${firstTx}/status`, {
        token,
        body: { status: 'pago', adminNotes: 'probe dialect (sem efeito se já processado)' },
      })
    : { status: 'skip', json: { note: 'sem pendentes' } };

  const creators = await req('GET', '/api/admin/creators/pending', { token });
  const content = await req('GET', '/api/admin/content/pending', { token });
  const payouts = await req('GET', '/api/admin/payouts/pending', { token });
  const cc = await req('GET', '/api/admin/command-center', { token });
  const users = await req('GET', '/api/admin/users?limit=5', { token });

  const out = {
    ok:
      approveUnfunded.status === 409 &&
      approveUnfunded.json?.code === 'AD_NOT_FUNDED' &&
      rejectBare.status === 400 &&
      rejectOk.status === 200 &&
      payoutBare.status === 400 &&
      adsShapeOk &&
      pendingPay.status === 200 &&
      creators.status === 200 &&
      content.status === 200 &&
      payouts.status === 200 &&
      cc.status === 200,
    payLabels,
    proofSample,
    adsShapeOk,
    adsCount: campaigns.length,
    createCampaign: {
      status: camp.status,
      code: camp.json?.code,
      funded: camp.json?.campaign?.funded,
      id: Boolean(campaignId),
    },
    approveUnfunded: {
      status: approveUnfunded.status,
      code: approveUnfunded.json?.code,
    },
    creatorReg: {
      userStatus: user.status,
      candStatus: cand.status,
      candCode: cand.json?.code,
      hadCreatorId: Boolean(creatorId),
      usedPendingFallback: Boolean(targetCreatorId && !creatorId),
    },
    creatorRejectBare: { status: rejectBare.status, code: rejectBare.json?.code },
    creatorRejectOk: {
      status: rejectOk.status,
      creatorStatus: rejectOk.json?.creator?.status,
    },
    payoutRejectBare: { status: payoutBare.status, code: payoutBare.json?.code },
    dialectPago: {
      status: dialect.status,
      code: dialect.json?.code,
      txStatus: dialect.json?.transaction?.status,
    },
    queues: {
      creators: creators.status,
      content: content.status,
      payouts: payouts.status,
      users: users.status,
      commandCenter: cc.status,
    },
  };

  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
})().catch((e) => {
  console.error(String(e && e.message ? e.message : e));
  process.exit(1);
});
