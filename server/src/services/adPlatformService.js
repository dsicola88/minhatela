'use strict';

const net = require('net');
const adRepository = require('../repositories/adRepository');
const userRepository = require('../repositories/userRepository');
const auditRepository = require('../repositories/auditRepository');
const { createError } = require('../utils/errors');
const { assertPositiveKz } = require('../utils/money');
const { campaignStatusLabel, placementLabel } = require('../utils/opsCopy');
const { env } = require('../config/env');

const OBJECTIVES = {
  brand: 'Notoriedade — o anúncio é visto até ao fim',
  traffic: 'Tráfego — o espectador pode abrir a sua página',
  awareness: 'Presença de marca — o anúncio é visto até ao fim',
};

const BILLING = {
  currency: 'AOA',
  billableEvent: 'completed_view',
  billableEventLabel: 'Visualização completa',
  note:
    'Cobra-se um valor fixo por anúncio visto até ao fim. Não há leilão, nem CPM optimizado, nem estimativa de alcance.',
  definitions: {
    impressions: 'Anúncio enviado ao leitor (ainda não cobrado).',
    starts: 'A reprodução do anúncio começou.',
    completions: 'A reprodução chegou ao fim.',
    billedViews: 'Conclusões faturadas (orçamento desceu).',
    clicks: 'No máximo um clique válido por impressão.',
    ctr: 'Cliques ÷ impressões × 100.',
  },
};

function unitKz() {
  return Math.max(1, Math.round(Number(env.adCpmKz || 5000) / 1000));
}

function mapCampaign(row) {
  const budget = Number(row.budget_kz || 0);
  const spent = Number(row.spent_kz || 0);
  return {
    id: row.id,
    name: row.name,
    objective: row.objective || 'brand',
    objectiveLabel: OBJECTIVES[row.objective] || OBJECTIVES.brand,
    placement: row.placement,
    placementLabel: placementLabel(row.placement),
    budgetKz: budget,
    spentKz: spent,
    remainingKz: Math.max(0, budget - spent),
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
    statusLabel: campaignStatusLabel(row.status),
    targeting: row.targeting || { territory: 'AO' },
    rejectionReason: row.rejection_reason || null,
    reviewedAt: row.reviewed_at || null,
    createdAt: row.created_at,
    creative: row.media_url
      ? {
          title: row.creative_title || row.name,
          mediaUrl: row.media_url,
          clickUrl: row.click_url || null,
          ctaLabel: row.cta_label || 'Saber mais',
          durationSeconds: row.duration_seconds || 15,
        }
      : null,
  };
}

function isPrivateHost(hostname) {
  const host = String(hostname || '')
    .toLowerCase()
    .replace(/\.$/, '');
  if (!host) return true;
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host === 'metadata.google.internal' ||
    host.endsWith('.internal')
  ) {
    return true;
  }
  const ip = net.isIP(host) ? host : null;
  if (!ip) return false;
  if (ip === '0.0.0.0' || ip === '::' || ip === '::1') return true;
  const parts = ip.split('.').map(Number);
  if (parts.length === 4) {
    if (parts[0] === 10) return true;
    if (parts[0] === 127) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
  }
  return false;
}

function assertSafeHttpsUrl(value, field, { optional = false } = {}) {
  const raw = String(value || '').trim();
  if (!raw) {
    if (optional) return null;
    throw createError(400, `${field} é obrigatório`, 'VALIDATION');
  }
  if (raw.startsWith('/uploads/ads/')) {
    if (raw.includes('..') || raw.includes('\\')) {
      throw createError(400, `${field} inválido`, 'VALIDATION');
    }
    return raw;
  }
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw createError(400, `${field} tem de ser uma ligação HTTPS`, 'VALIDATION');
  }
  if (parsed.protocol !== 'https:') {
    throw createError(400, `${field} tem de ser HTTPS`, 'VALIDATION');
  }
  if (isPrivateHost(parsed.hostname)) {
    throw createError(400, `${field} não pode apontar para uma rede interna`, 'VALIDATION');
  }
  return parsed.toString();
}

function portalGuide(advertiser, campaigns) {
  if (!advertiser) {
    return {
      step: 1,
      of: 3,
      title: 'Identifique a empresa',
      body: 'Nome e email de contacto. Depois cria a campanha em passos; a MinhaTela confirma antes de ir para o ar.',
    };
  }
  if (!campaigns.length) {
    return {
      step: 2,
      of: 3,
      title: 'Crie a primeira campanha',
      body: 'Objectivo, vídeo, página, orçamento em Kwanza e datas. Nada entra sozinho.',
    };
  }
  if (campaigns.some((c) => c.status === 'active')) {
    return {
      step: 3,
      of: 3,
      title: 'No ar',
      body: 'O anúncio passa antes dos filmes gratuitos. Só a visualização completa desce o orçamento.',
    };
  }
  if (campaigns.some((c) => c.status === 'pending_review')) {
    return {
      step: 3,
      of: 3,
      title: 'A MinhaTela confirma',
      body: 'A campanha está na fila. Quando a equipa puser no ar, o público vê-a antes do filme.',
    };
  }
  return {
    step: 3,
    of: 3,
    title: 'Campanhas',
    body: 'Pausada ou recusada não toca no catálogo. Envie outra quando estiver pronta.',
  };
}

function measurementPayload(stats = {}) {
  const impressions = Number(stats.impressions || 0);
  const clicks = Number(stats.clicks || 0);
  return {
    ...BILLING,
    unitKz: unitKz(),
    impressions,
    starts: Number(stats.starts || 0),
    completions: Number(stats.completions || 0),
    billedViews: Number(stats.billed_views || 0),
    clicks,
    ctr: impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(2)) : 0,
  };
}

async function registerAdvertiser(userId, body) {
  const existing = await adRepository.findAdvertiserByUser(userId);
  if (existing) {
    return {
      advertiser: {
        id: existing.id,
        companyName: existing.company_name,
        contactEmail: existing.contact_email,
        status: existing.status,
      },
      alreadyExists: true,
    };
  }

  if (!body.companyName || !body.contactEmail) {
    throw createError(400, 'Empresa e email de contacto são obrigatórios', 'VALIDATION');
  }

  const row = await adRepository.createAdvertiser({
    userId,
    companyName: body.companyName.trim(),
    contactEmail: body.contactEmail.toLowerCase().trim(),
  });

  await userRepository.assignRole(userId, 'advertiser');

  return {
    advertiser: {
      id: row.id,
      companyName: row.company_name,
      contactEmail: row.contact_email,
      status: row.status,
    },
    alreadyExists: false,
  };
}

async function requireAdvertiser(userId) {
  const advertiser = await adRepository.findAdvertiserByUser(userId);
  if (!advertiser || advertiser.status !== 'active') {
    throw createError(
      403,
      'A MinhaTela ainda não activou a sua conta de publicidade',
      'ADVERTISER_REQUIRED'
    );
  }
  return advertiser;
}

async function getPortal(userId, query = {}) {
  const advertiser = await adRepository.findAdvertiserByUser(userId);
  if (!advertiser) {
    return {
      advertiser: null,
      campaigns: [],
      stats: null,
      measurement: measurementPayload({}),
      guide: portalGuide(null, []),
    };
  }
  const [campaignRows, stats] = await Promise.all([
    adRepository.listCampaigns(advertiser.id, {
      status: query.status,
      q: query.q,
    }),
    adRepository.campaignStats(advertiser.id),
  ]);
  const campaigns = campaignRows.map(mapCampaign);
  const budgetKz = Number(stats.budget_kz || 0);
  const spentKz = Number(stats.spent_kz || 0);
  return {
    advertiser: {
      id: advertiser.id,
      companyName: advertiser.company_name,
      contactEmail: advertiser.contact_email,
      status: advertiser.status,
    },
    campaigns,
    guide: portalGuide(advertiser, campaigns),
    stats: {
      campaigns: stats.campaigns,
      budgetKz,
      spentKz,
      remainingKz: Math.max(0, budgetKz - spentKz),
      ...measurementPayload(stats),
    },
    measurement: measurementPayload(stats),
    wizard: {
      objectives: Object.entries(OBJECTIVES).map(([id, label]) => ({ id, label })),
      placements: [{ id: 'pre_roll', label: 'Antes do filme gratuito' }],
      territories: [{ id: 'AO', label: 'Angola' }],
      ctas: ['Saber mais', 'Visitar', 'Ver oferta'],
    },
  };
}

async function listMyCampaigns(userId, query = {}) {
  const advertiser = await requireAdvertiser(userId);
  const rows = await adRepository.listCampaigns(advertiser.id, query);
  return { campaigns: rows.map(mapCampaign) };
}

async function getMyCampaign(userId, campaignId) {
  const advertiser = await requireAdvertiser(userId);
  const row = await adRepository.getOwnedCampaign(advertiser.id, campaignId);
  if (!row) throw createError(404, 'Campanha não encontrada', 'NOT_FOUND');
  const history = await adRepository.listHistory(campaignId, advertiser.id);
  const stats = await adRepository.campaignStats(advertiser.id, { campaignId });
  return {
    campaign: mapCampaign(row),
    history: history.map((h) => ({
      id: h.id,
      action: h.action,
      fromStatus: h.from_status,
      toStatus: h.to_status,
      reason: h.reason,
      createdAt: h.created_at,
    })),
    stats: measurementPayload(stats),
  };
}

async function createCampaign(userId, body) {
  const advertiser = await requireAdvertiser(userId);
  assertPositiveKz(body.budgetKz);

  if (!body.name || !body.startsAt || !body.endsAt || !body.creative?.mediaUrl) {
    throw createError(
      400,
      'Nome, datas e o vídeo do anúncio são obrigatórios',
      'VALIDATION'
    );
  }

  const startsAt = new Date(body.startsAt);
  const endsAt = new Date(body.endsAt);
  if (!(startsAt < endsAt)) {
    throw createError(400, 'A data de fim tem de ser depois do início', 'VALIDATION');
  }

  const objective = OBJECTIVES[body.objective] ? body.objective : 'brand';
  const mediaUrl = assertSafeHttpsUrl(body.creative.mediaUrl, 'Vídeo do anúncio');
  const clickUrl = assertSafeHttpsUrl(body.creative.clickUrl, 'Página de destino', {
    optional: objective !== 'traffic',
  });
  if (objective === 'traffic' && !clickUrl) {
    throw createError(400, 'Tráfego exige uma página HTTPS de destino', 'VALIDATION');
  }

  const targeting = {
    territory: 'AO',
    contentCategory: String(body.targeting?.contentCategory || '').trim() || undefined,
    device: String(body.targeting?.device || '').trim() || undefined,
    frequencyCapPerDay: Math.min(
      20,
      Math.max(0, Number(body.targeting?.frequencyCapPerDay) || 0)
    ),
  };

  const campaign = await adRepository.createCampaign({
    advertiserId: advertiser.id,
    name: String(body.name).trim(),
    placement: 'pre_roll',
    budgetKz: body.budgetKz,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    targeting,
    objective,
  });

  const creative = await adRepository.addCreative({
    campaignId: campaign.id,
    title: body.creative.title || body.name,
    mediaUrl,
    clickUrl,
    durationSeconds: body.creative.durationSeconds || 15,
    ctaLabel: body.creative.ctaLabel || 'Saber mais',
  });

  await adRepository.addHistory({
    campaignId: campaign.id,
    actorId: userId,
    action: 'submitted',
    fromStatus: null,
    toStatus: 'pending_review',
    payload: { name: campaign.name, budgetKz: campaign.budget_kz },
  });

  return {
    campaign: mapCampaign({
      ...campaign,
      media_url: creative.media_url,
      click_url: creative.click_url,
      creative_title: creative.title,
      cta_label: creative.cta_label,
      duration_seconds: creative.duration_seconds,
    }),
    creative,
    message: 'Campanha enviada. A MinhaTela confirma antes de o anúncio passar na app.',
  };
}

async function pauseMyCampaign(userId, campaignId) {
  const advertiser = await requireAdvertiser(userId);
  const row = await adRepository.advertiserPause(advertiser.id, campaignId);
  if (!row) throw createError(409, 'Só pode pausar uma campanha que está no ar', 'NOT_ACTIVE');
  await adRepository.addHistory({
    campaignId,
    actorId: userId,
    action: 'paused_by_advertiser',
    fromStatus: 'active',
    toStatus: 'paused',
  });
  return { campaign: mapCampaign(row) };
}

async function getReports(userId, query = {}) {
  const advertiser = await requireAdvertiser(userId);
  const from = query.from ? new Date(query.from) : null;
  const to = query.to ? new Date(query.to) : null;
  const [stats, rows] = await Promise.all([
    adRepository.campaignStats(advertiser.id, {
      from: from && !Number.isNaN(from.getTime()) ? from.toISOString() : null,
      to: to && !Number.isNaN(to.getTime()) ? to.toISOString() : null,
      campaignId: query.campaignId || null,
    }),
    adRepository.reportRows(advertiser.id, {
      from: from && !Number.isNaN(from.getTime()) ? from.toISOString() : null,
      to: to && !Number.isNaN(to.getTime()) ? to.toISOString() : null,
    }),
  ]);
  return {
    measurement: measurementPayload(stats),
    totals: {
      budgetKz: Number(stats.budget_kz || 0),
      spentKz: Number(stats.spent_kz || 0),
      remainingKz: Math.max(0, Number(stats.budget_kz || 0) - Number(stats.spent_kz || 0)),
    },
    campaigns: rows.map((r) => ({
      id: r.id,
      name: r.name,
      status: r.status,
      statusLabel: campaignStatusLabel(r.status),
      budgetKz: Number(r.budget_kz || 0),
      spentKz: Number(r.spent_kz || 0),
      remainingKz: Math.max(0, Number(r.budget_kz || 0) - Number(r.spent_kz || 0)),
      impressions: r.impressions,
      starts: r.starts,
      completions: r.completions,
      billedViews: r.billed_views,
      clicks: r.clicks,
      ctr:
        r.impressions > 0 ? Number(((r.clicks / r.impressions) * 100).toFixed(2)) : 0,
    })),
  };
}

function reportsToCsv(report) {
  const header = [
    'campanha',
    'estado',
    'orcamento_kz',
    'gasto_kz',
    'saldo_kz',
    'impressoes',
    'inicios',
    'conclusoes',
    'faturadas',
    'cliques',
    'ctr_pct',
  ];
  const lines = [header.join(',')];
  for (const c of report.campaigns) {
    lines.push(
      [
        `"${String(c.name).replace(/"/g, '""')}"`,
        c.status,
        c.budgetKz,
        c.spentKz,
        c.remainingKz,
        c.impressions,
        c.starts,
        c.completions,
        c.billedViews,
        c.clicks,
        c.ctr,
      ].join(',')
    );
  }
  return lines.join('\n');
}

async function decideAd({
  contentId,
  monetization,
  userId,
  placement = 'pre_roll',
  contentGenre = null,
  device = null,
}) {
  if (monetization !== 'avod') {
    return null;
  }

  const active = await adRepository.findActiveDecision({
    placement,
    userId,
    contentGenre,
    device,
  });
  if (!active) {
    return {
      required: false,
      placement,
      enabled: false,
      placeholder: true,
      billed: false,
      message: 'Filme gratuito. Sem anúncio nesta sessão.',
    };
  }

  const impression = await adRepository.recordImpression({
    campaignId: active.campaign_id,
    creativeId: active.creative_id,
    contentId,
    userId,
    placement,
    device,
  });

  return {
    required: true,
    placement,
    enabled: true,
    placeholder: false,
    billed: false,
    billableEvent: BILLING.billableEvent,
    decisionId: impression.id,
    creative: {
      id: active.creative_id,
      title: active.title,
      mediaUrl: active.media_url,
      clickUrl: active.click_url,
      ctaLabel: active.cta_label || 'Saber mais',
      durationSeconds: active.duration_seconds,
    },
  };
}

async function startImpression(userId, impressionId) {
  const owned = await adRepository.findOwnedImpression(impressionId, userId);
  if (!owned) throw createError(404, 'Impressão não encontrada', 'NOT_FOUND');
  const row = await adRepository.startImpression({ impressionId, userId });
  return { impressionId, started: true, alreadyStarted: !row };
}

async function completeImpression(userId, impressionId) {
  const owned = await adRepository.findOwnedImpression(impressionId, userId);
  if (!owned) throw createError(404, 'Impressão não encontrada', 'NOT_FOUND');
  const row = await adRepository.completeImpression({
    impressionId,
    userId,
    unitKz: unitKz(),
  });
  if (!row) {
    return { impressionId, billedKz: 0, completed: true, alreadyCompleted: true };
  }
  if (row.billedKz > 0) {
    try {
      const creatorEarningsService = require('./creatorEarningsService');
      await creatorEarningsService.creditAdShare({
        contentId: row.content_id,
        impressionId: row.id,
        amountKz: row.billedKz,
      });
    } catch {
      /* earnings optional */
    }
  }
  return {
    impressionId: row.id,
    billedKz: row.billedKz,
    billed: Boolean(row.billed),
    completed: true,
    reason: row.reason || null,
  };
}

async function recordClick(userId, impressionId) {
  const owned = await adRepository.findOwnedImpression(impressionId, userId);
  if (!owned) throw createError(404, 'Impressão não encontrada', 'NOT_FOUND');
  const row = await adRepository.recordClick({ impressionId, userId });
  if (!row) {
    return { clickId: null, impressionId, alreadyRecorded: true };
  }
  return { clickId: row.id, impressionId: row.impression_id };
}

async function adminModerateCampaign(adminId, campaignId, status, { reason } = {}) {
  if (!['active', 'rejected', 'paused'].includes(status)) {
    throw createError(400, 'Estado inválido', 'VALIDATION');
  }
  if (status === 'rejected' && !String(reason || '').trim()) {
    throw createError(400, 'Indique o motivo da recusa', 'VALIDATION');
  }
  const previous = await adRepository.findCampaignWithAdvertiser(campaignId);
  if (!previous) throw createError(404, 'Campanha não encontrada', 'NOT_FOUND');
  const { isPlatformScope, currentTenantId } = require('../utils/tenantScope');
  const roles = await userRepository.getRoles(adminId);
  const platform =
    isPlatformScope() || roles.includes('super_admin') || roles.includes('admin');
  const tenantId = currentTenantId();
  if (
    !platform &&
    previous.tenant_id &&
    tenantId &&
    String(previous.tenant_id) !== String(tenantId)
  ) {
    throw createError(404, 'Campanha não encontrada', 'NOT_FOUND');
  }
  const row = await adRepository.moderateCampaign(campaignId, status, {
    reason: String(reason || '').trim() || null,
    reviewerId: adminId,
  });
  if (!row) throw createError(404, 'Campanha não encontrada', 'NOT_FOUND');

  const action =
    status === 'active'
      ? 'CAMPAIGN_APPROVED'
      : status === 'paused'
        ? 'CAMPAIGN_PAUSED'
        : 'CAMPAIGN_REJECTED';

  await auditRepository.write({
    actorId: adminId,
    action,
    entity: 'campaign',
    entityId: campaignId,
    metadata: { status, reason: reason || null },
  });

  await adRepository.addHistory({
    campaignId,
    actorId: adminId,
    action: action.toLowerCase(),
    fromStatus: previous?.status || null,
    toStatus: status,
    reason: reason || null,
  });

  try {
    const owner = previous || (await adRepository.findCampaignWithAdvertiser(campaignId));
    if (owner?.advertiser_user_id) {
      const notificationService = require('./notificationService');
      const copy =
        status === 'active'
          ? {
              title: 'Anúncio no ar',
              body: `«${row.name}» passa agora antes dos filmes gratuitos na MinhaTela.`,
            }
          : status === 'paused'
            ? {
                title: 'Anúncio pausado',
                body: `«${row.name}» saiu do ar. O orçamento pára de gastar em novas sessões.`,
              }
            : {
                title: 'Anúncio recusado',
                body: `«${row.name}»: ${String(reason).trim()}`,
              };
      await notificationService.notify({
        userId: owner.advertiser_user_id,
        type: action.toLowerCase(),
        title: copy.title,
        body: copy.body,
        data: { campaignId, status, reason: reason || null },
      });
    }
  } catch {
    /* optional */
  }

  return { campaign: mapCampaign({ ...row, media_url: previous?.media_url }) };
}

module.exports = {
  registerAdvertiser,
  requireAdvertiser,
  getPortal,
  listMyCampaigns,
  getMyCampaign,
  createCampaign,
  pauseMyCampaign,
  getReports,
  reportsToCsv,
  decideAd,
  startImpression,
  completeImpression,
  recordClick,
  adminModerateCampaign,
  assertSafeHttpsUrl,
  BILLING,
  unitKz,
};
