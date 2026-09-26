'use strict';

const adRepository = require('../repositories/adRepository');
const userRepository = require('../repositories/userRepository');
const auditRepository = require('../repositories/auditRepository');
const { createError } = require('../utils/errors');
const { assertPositiveKz } = require('../utils/money');

function mapCampaign(row) {
  return {
    id: row.id,
    name: row.name,
    placement: row.placement,
    budgetKz: row.budget_kz,
    spentKz: row.spent_kz,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
    targeting: row.targeting,
    createdAt: row.created_at,
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
    throw createError(403, 'Conta de anunciante activa necessária', 'ADVERTISER_REQUIRED');
  }
  return advertiser;
}

async function getPortal(userId) {
  const advertiser = await adRepository.findAdvertiserByUser(userId);
  if (!advertiser) {
    return { advertiser: null, campaigns: [], stats: null };
  }
  const [campaigns, stats] = await Promise.all([
    adRepository.listCampaigns(advertiser.id),
    adRepository.campaignStats(advertiser.id),
  ]);
  return {
    advertiser: {
      id: advertiser.id,
      companyName: advertiser.company_name,
      contactEmail: advertiser.contact_email,
      status: advertiser.status,
    },
    campaigns: campaigns.map(mapCampaign),
    stats: {
      campaigns: stats.campaigns,
      budgetKz: stats.budget_kz,
      spentKz: stats.spent_kz,
      impressions: stats.impressions,
      clicks: stats.clicks,
      ctr:
        stats.impressions > 0
          ? Number(((stats.clicks / stats.impressions) * 100).toFixed(2))
          : 0,
    },
  };
}

async function createCampaign(userId, body) {
  const advertiser = await requireAdvertiser(userId);
  assertPositiveKz(body.budgetKz);

  if (!body.name || !body.startsAt || !body.endsAt || !body.creative?.mediaUrl) {
    throw createError(
      400,
      'Nome, datas e criativo (mediaUrl) são obrigatórios',
      'VALIDATION'
    );
  }

  const campaign = await adRepository.createCampaign({
    advertiserId: advertiser.id,
    name: body.name,
    placement: body.placement || 'pre_roll',
    budgetKz: body.budgetKz,
    startsAt: body.startsAt,
    endsAt: body.endsAt,
    targeting: body.targeting || { territory: 'AO' },
  });

  const creative = await adRepository.addCreative({
    campaignId: campaign.id,
    title: body.creative.title || body.name,
    mediaUrl: body.creative.mediaUrl,
    clickUrl: body.creative.clickUrl,
    durationSeconds: body.creative.durationSeconds || 15,
  });

  return { campaign: mapCampaign(campaign), creative };
}

async function decideAd({ contentId, monetization, userId, placement = 'pre_roll' }) {
  if (monetization !== 'avod') {
    return null;
  }

  const active = await adRepository.findActiveDecision({ placement });
  if (!active) {
    return {
      required: true,
      placement,
      enabled: false,
      placeholder: true,
      message: 'Espaço AVOD reservado — sem campanha activa no momento.',
    };
  }

  const impression = await adRepository.recordImpression({
    campaignId: active.campaign_id,
    creativeId: active.creative_id,
    contentId,
    userId,
    placement,
  });

  return {
    required: true,
    placement,
    enabled: true,
    placeholder: false,
    decisionId: impression.id,
    creative: {
      id: active.creative_id,
      title: active.title,
      mediaUrl: active.media_url,
      clickUrl: active.click_url,
      durationSeconds: active.duration_seconds,
    },
  };
}

async function adminModerateCampaign(adminId, campaignId, status) {
  if (!['active', 'rejected', 'paused'].includes(status)) {
    throw createError(400, 'Estado inválido', 'VALIDATION');
  }
  const row = await adRepository.moderateCampaign(campaignId, status);
  if (!row) throw createError(404, 'Campanha não encontrada', 'NOT_FOUND');

  await auditRepository.write({
    actorId: adminId,
    action: 'CAMPAIGN_APPROVED',
    entity: 'campaign',
    entityId: campaignId,
    metadata: { status },
  });

  return { campaign: mapCampaign(row) };
}

module.exports = {
  registerAdvertiser,
  getPortal,
  createCampaign,
  decideAd,
  adminModerateCampaign,
};
