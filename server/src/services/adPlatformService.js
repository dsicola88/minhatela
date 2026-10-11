'use strict';

const adRepository = require('../repositories/adRepository');
const userRepository = require('../repositories/userRepository');
const auditRepository = require('../repositories/auditRepository');
const { createError } = require('../utils/errors');
const { assertPositiveKz } = require('../utils/money');
const { campaignStatusLabel, placementLabel } = require('../utils/opsCopy');
const { campaignLifecycle, portalStage } = require('../utils/adsLifecycle');
const { env } = require('../config/env');
const { normalizePublicWebUrl } = require('../utils/publicWebUrl');

const OBJECTIVES = {
  brand: 'Notoriedade — o anúncio é visto até ao fim',
  traffic: 'Tráfego — o espectador pode abrir a sua página',
  awareness: 'Presença de marca — o anúncio é visto até ao fim',
};

const BILLING = {
  currency: 'AOA',
  billableEvent: 'completed_view',
  billableEventLabel: 'Visualização completa',
  note: 'Cada visualização até ao fim desconta um valor fixo do orçamento.',
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

function requiredWatchSeconds(durationSeconds) {
  const minFloor = Math.max(1, Number(process.env.AD_COMPLETE_MIN_SECONDS || 2));
  const duration = Math.max(0, Number(durationSeconds) || 0);
  if (duration <= 0) return minFloor;
  return Math.max(minFloor, Math.ceil(duration * 0.8));
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
    funded: Boolean(row.funded),
    fundedAt: row.funded_at || null,
    transactionId: row.transaction_id || null,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
    statusLabel: campaignStatusLabel(row.status),
    paymentStatus: row.payment_status || null,
    lifecycle: campaignLifecycle({
      status: row.status,
      funded: row.funded,
      paymentStatus: row.payment_status,
      transactionId: row.transaction_id,
    }),
    targeting: row.targeting || { territory: 'AO' },
    rejectionReason: row.rejection_reason || null,
    reviewedAt: row.reviewed_at || null,
    createdAt: row.created_at,
    creative: row.media_url
      ? {
          title: row.creative_title || row.name,
          mediaUrl: row.media_url,
          mediaKind: row.media_kind || kindFromUrl(row.media_url) || 'video',
          cards: readCards(row.cards),
          clickUrl: row.click_url || null,
          ctaLabel: row.cta_label || 'Saber mais',
          durationSeconds: row.duration_seconds || 15,
        }
      : null,
  };
}

function kindFromUrl(url) {
  const path = String(url || '').split('?')[0].toLowerCase();
  if (/\.(jpe?g|png|webp|gif)$/.test(path)) return 'image';
  if (/\.(mp4|webm|mov)$/.test(path)) return 'video';
  return null;
}

function readCards(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function normalizeCreative(creative = {}) {
  const requested = ['image', 'video', 'carousel'].includes(creative.mediaKind)
    ? creative.mediaKind
    : null;

  if (requested === 'carousel') {
    const source = Array.isArray(creative.cards) ? creative.cards : [];
    const cards = source.map((item) => {
      const raw = typeof item === 'string' ? item : item?.mediaUrl;
      const mediaUrl = assertSafeHttpsUrl(raw, 'Cartão do carrossel');
      if (kindFromUrl(mediaUrl) === 'video') {
        throw createError(400, 'O carrossel aceita imagens (JPG, PNG ou WEBP)', 'VALIDATION');
      }
      return { mediaUrl, mediaKind: 'image' };
    });
    if (cards.length < 2 || cards.length > 10) {
      throw createError(400, 'O carrossel precisa de 2 a 10 imagens', 'VALIDATION');
    }
    return {
      mediaKind: 'carousel',
      mediaUrl: cards[0].mediaUrl,
      cards,
      durationSeconds: cards.length * 5,
    };
  }

  const mediaUrl = assertSafeHttpsUrl(
    creative.mediaUrl,
    requested === 'image' ? 'Imagem do anúncio' : 'Criativo do anúncio'
  );
  const detected = kindFromUrl(mediaUrl);
  const mediaKind = requested || detected || 'video';
  if (mediaKind === 'image' && detected === 'video') {
    throw createError(400, 'Este ficheiro é um vídeo. Escolha o formato Vídeo.', 'VALIDATION');
  }
  if (mediaKind === 'video' && detected === 'image') {
    throw createError(400, 'Este ficheiro é uma imagem. Escolha o formato Imagem.', 'VALIDATION');
  }
  let durationSeconds = Number(creative.durationSeconds) || (mediaKind === 'image' ? 6 : 15);
  if (mediaKind === 'image') durationSeconds = Math.min(15, Math.max(5, Math.round(durationSeconds)));
  else durationSeconds = Math.min(60, Math.max(2, Math.round(durationSeconds)));
  return { mediaKind, mediaUrl, cards: [], durationSeconds };
}

function assertSafeHttpsUrl(value, field, options = {}) {
  const result = normalizePublicWebUrl(value, { allowUpload: true, ...options });
  if (!result.ok) throw createError(400, `${field}: ${result.message}`, 'VALIDATION');
  return result.url || null;
}

function portalGuide(advertiser, campaigns) {
  return portalStage(advertiser, campaigns);
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
      formats: [
        { id: 'image', label: 'Imagem' },
        { id: 'video', label: 'Vídeo' },
        { id: 'carousel', label: 'Carrossel' },
      ],
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

const MIN_AD_BUDGET_KZ = 5000;

async function createCampaign(userId, body) {
  const advertiser = await requireAdvertiser(userId);
  let budgetKz;
  try {
    budgetKz = assertPositiveKz(body.budgetKz);
  } catch {
    throw createError(400, 'Orçamento em Kwanza inválido', 'VALIDATION');
  }
  if (budgetKz < MIN_AD_BUDGET_KZ) {
    throw createError(
      400,
      `Orçamento mínimo: ${MIN_AD_BUDGET_KZ.toLocaleString('pt-AO')} Kz`,
      'AD_BUDGET_MIN'
    );
  }

  if (!body.name || !body.startsAt || !body.endsAt || !body.creative) {
    throw createError(400, 'Nome, datas e o criativo são obrigatórios', 'VALIDATION');
  }

  const startsAt = new Date(body.startsAt);
  const endsAt = new Date(body.endsAt);
  if (!(startsAt < endsAt)) {
    throw createError(400, 'A data de fim tem de ser depois do início', 'VALIDATION');
  }

  const objective = OBJECTIVES[body.objective] ? body.objective : 'brand';
  const normalized = normalizeCreative(body.creative);
  const clickUrl = assertSafeHttpsUrl(body.creative.clickUrl, 'Página de destino', {
    optional: objective !== 'traffic',
    allowUpload: false,
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
    budgetKz,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    targeting,
    objective,
  });

  const creative = await adRepository.addCreative({
    campaignId: campaign.id,
    title: body.creative.title || body.name,
    mediaUrl: normalized.mediaUrl,
    clickUrl,
    durationSeconds: normalized.durationSeconds,
    ctaLabel: body.creative.ctaLabel || 'Saber mais',
    mediaKind: normalized.mediaKind,
    cards: normalized.cards,
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
      media_kind: creative.media_kind,
      cards: creative.cards,
    }),
    creative,
    message:
      'Campanha criada. Pague o orçamento por transferência IBAN (comprovativo) ou Multicaixa Express. Só depois da confirmação do pagamento e da aprovação da MinhaTela o anúncio entra no ar.',
  };
}

async function withdrawMyCampaign(userId, campaignId) {
  const advertiser = await requireAdvertiser(userId);
  const result = await adRepository.advertiserWithdraw(advertiser.id, campaignId);
  if (result.error === 'missing') {
    throw createError(404, 'Campanha não encontrada', 'NOT_FOUND');
  }
  if (result.error === 'active') {
    throw createError(409, 'Pause a campanha no ar antes de a retirar', 'CAMPAIGN_ACTIVE');
  }
  if (result.error === 'completed') {
    throw createError(409, 'Uma campanha concluída não pode ser apagada', 'CAMPAIGN_CLOSED');
  }
  if (!result.row) throw createError(409, 'Esta campanha não pode ser retirada', 'CAMPAIGN_LOCKED');
  await adRepository.addHistory({
    campaignId,
    actorId: userId,
    action: 'withdrawn_by_advertiser',
    fromStatus: result.fromStatus,
    toStatus: 'rejected',
    reason: 'Retirada pelo anunciante',
  });
  return { campaign: mapCampaign(result.row) };
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
    campaignId: active.campaign_id,
    creative: {
      id: active.creative_id,
      title: active.title,
      mediaUrl: active.media_url,
      mediaKind: active.media_kind || kindFromUrl(active.media_url) || 'video',
      cards: readCards(active.cards),
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
  if (owned.completed) {
    return { impressionId, billedKz: 0, completed: true, alreadyCompleted: true };
  }
  if (!owned.started || !owned.started_at) {
    return {
      impressionId,
      billedKz: 0,
      billed: false,
      completed: false,
      reason: 'not_started',
    };
  }

  const requiredSeconds = requiredWatchSeconds(owned.creative_duration_seconds);
  const elapsed = (Date.now() - new Date(owned.started_at).getTime()) / 1000;
  if (elapsed < requiredSeconds) {
    return {
      impressionId,
      billedKz: 0,
      billed: false,
      completed: false,
      reason: 'too_early',
      retryAfterSeconds: Math.ceil(requiredSeconds - elapsed),
    };
  }

  const row = await adRepository.completeImpression({
    impressionId,
    userId,
    unitKz: unitKz(),
    minWatchSeconds: requiredSeconds,
  });
  if (!row) {
    const again = await adRepository.findOwnedImpression(impressionId, userId);
    if (again?.completed) {
      return { impressionId, billedKz: 0, completed: true, alreadyCompleted: true };
    }
    return {
      impressionId,
      billedKz: 0,
      billed: false,
      completed: false,
      reason: 'too_early',
    };
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
  if (status === 'active' && !previous.funded) {
    throw createError(
      409,
      'O orçamento ainda não está pago. Confirme o pagamento antes de pôr no ar.',
      'AD_NOT_FUNDED'
    );
  }
  const row = await adRepository.moderateCampaign(campaignId, status, {
    reason: String(reason || '').trim() || null,
    reviewerId: adminId,
  });
  if (!row) {
    throw createError(
      status === 'active' ? 409 : 404,
      status === 'active'
        ? 'O orçamento ainda não está pago. Confirme o pagamento antes de pôr no ar.'
        : 'Campanha não encontrada',
      status === 'active' ? 'AD_NOT_FUNDED' : 'NOT_FOUND'
    );
  }

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
  withdrawMyCampaign,
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
  requiredWatchSeconds,
  MIN_AD_BUDGET_KZ,
};
