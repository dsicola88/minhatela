'use strict';

const phase26Repository = require('../repositories/phase26Repository');
const featureFlagService = require('./featureFlagService');
const premiereRepository = require('../repositories/premiereRepository');
const bunnyService = require('./bunnyService');
const { env } = require('../config/env');
const { createError } = require('../utils/errors');
const { logger } = require('../utils/logger');

function mapPack(row) {
  const items = Array.isArray(row.items)
    ? row.items
    : typeof row.items === 'string'
      ? JSON.parse(row.items)
      : row.items || [];
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    posterUrl: row.poster_url,
    priceKz: row.price_kz,
    rentalHours: row.rental_hours,
    sortOrder: row.sort_order,
    items,
  };
}

async function listPacks() {
  await featureFlagService.assertEnabled('tvod_packs_enabled');
  const rows = await phase26Repository.listPacks();
  return { packs: rows.map(mapPack), currency: 'AOA' };
}

async function getPack(idOrSlug) {
  await featureFlagService.assertEnabled('tvod_packs_enabled');
  let row = await phase26Repository.findPackById(idOrSlug);
  if (!row) row = await phase26Repository.findPackBySlug(idOrSlug);
  if (!row || !row.is_active) throw createError(404, 'Pack não encontrado', 'PACK_NOT_FOUND');
  const items = await phase26Repository.packItems(row.id);
  return {
    pack: {
      ...mapPack({ ...row, items }),
      items: items.map((v) => ({
        id: v.id,
        title: v.title,
        posterUrl: v.poster_url,
        kind: v.kind,
        monetization: v.monetization,
        rentalPriceKz: v.rental_price_kz,
      })),
    },
  };
}

async function selectProfile(userId, profileId, deviceId) {
  await require('./authorizationService').assertProfileOwned(userId, profileId);
  const enabled = await featureFlagService.isEnabled('profile_last_used_enabled', true);
  if (!enabled) return { selected: true };
  const row = await phase26Repository.touchProfileLastUsed(profileId, userId, deviceId);
  if (!row) throw createError(404, 'Perfil não encontrado', 'PROFILE_NOT_FOUND');
  return {
    selected: true,
    lastUsedAt: row.last_used_at,
    isLastUsed: true,
  };
}

async function pendingSurvey(userId) {
  const enabled = await featureFlagService.isEnabled('app_nps_survey_enabled', true);
  if (!enabled) return { pending: null };
  const prompt = await phase26Repository.getPendingSurvey(userId);
  if (!prompt) return { pending: null };
  return {
    pending: {
      key: prompt.key,
      trigger: prompt.trigger,
      ...((prompt.payload && typeof prompt.payload === 'object' ? prompt.payload : {}) || {}),
    },
  };
}

async function respondSurvey(userId, body = {}) {
  await featureFlagService.assertEnabled('app_nps_survey_enabled');
  const promptKey = body.promptKey || 'app_nps_session';
  if (body.nps == null && body.score == null) {
    throw createError(400, 'nps ou score obrigatório', 'VALIDATION');
  }
  if (body.nps != null && (Number(body.nps) < 0 || Number(body.nps) > 10)) {
    throw createError(400, 'NPS deve ser 0–10', 'VALIDATION');
  }

  const pending = await phase26Repository.getPendingSurvey(userId, promptKey);
  if (!pending) {
    throw createError(409, 'Survey já respondida ou indisponível', 'SURVEY_COOLDOWN');
  }

  let profileId = body.profileId || null;
  if (profileId) {
    await require('./authorizationService').assertProfileOwned(userId, profileId);
  }

  const row = await phase26Repository.saveSurveyResponse({
    userId,
    profileId,
    promptKey,
    nps: body.nps,
    score: body.score,
    comment: body.comment,
    appSessionId: body.appSessionId,
  });
  return { saved: true, id: row.id, nps: row.nps, score: row.score };
}

async function adminSurveySummary() {
  const row = await phase26Repository.surveySummary();
  const responses = row.responses || 0;
  const promoters = row.promoters || 0;
  const detractors = row.detractors || 0;
  const npsScore =
    responses > 0 ? Math.round(((promoters - detractors) / responses) * 100) : null;
  return {
    responses,
    avgNps: row.avg_nps,
    avgScore: row.avg_score,
    promoters,
    detractors,
    npsScore,
  };
}

async function joinPremiere(userId, eventId, meta = {}) {
  await featureFlagService.assertEnabled(
    'premiere_live_join_enabled',
    'Estreias ao vivo temporariamente indisponíveis'
  );
  const row = await premiereRepository.findById(eventId);
  if (!row || !row.is_published) {
    throw createError(404, 'Estreia não encontrada', 'PREMIERE_NOT_FOUND');
  }
  if (row.stream_status === 'ended' || (row.ends_at && new Date(row.ends_at) < new Date())) {
    throw createError(410, 'Esta estreia já terminou', 'PREMIERE_ENDED');
  }
  if (row.join_opens_at && new Date(row.join_opens_at) > new Date()) {
    throw createError(403, 'A sala ainda não abriu', 'JOIN_NOT_OPEN', {
      joinOpensAt: row.join_opens_at,
    });
  }
  if (row.stream_status !== 'live' && !row.is_live) {
    throw createError(403, 'A transmissão ainda não está ao vivo', 'NOT_LIVE');
  }

  // Entitlement: se ligada a conteúdo, exige acesso válido (SVOD/TVOD/pack/AVOD)
  if (row.content_id) {
    const contentRepository = require('../repositories/contentRepository');
    const accessControlService = require('./accessControlService');
    const { mapContentPublic } = require('../utils/mappers');
    const contentRow = await contentRepository.findPublishedById(row.content_id);
    if (!contentRow) {
      throw createError(404, 'Conteúdo da estreia indisponível', 'CONTENT_NOT_FOUND');
    }
    const access = await accessControlService.resolveAccess(userId, mapContentPublic(contentRow));
    if (!access.canWatch) {
      throw createError(403, access.message || 'Sem acesso a esta estreia', 'NOT_ENTITLED', {
        action: access.action,
        denialCode: access.denialCode,
      });
    }
  }

  let playback = { hlsUrl: row.hls_url, embedUrl: null, expiresAt: null };
  if (row.bunny_video_id) {
    try {
      const signed = bunnyService.signPlayback(row.bunny_video_id, {
        userIp: meta.ip,
      });
      playback = {
        hlsUrl: signed.hlsUrl || row.hls_url,
        embedUrl: signed.embedUrl,
        expiresAt: signed.expiresAt,
      };
    } catch (err) {
      logger.warn('premiere.join_bunny_failed', { message: err.message });
      if (!row.hls_url) throw err;
    }
  }
  if (!playback.hlsUrl && !playback.embedUrl) {
    throw createError(503, 'Stream indisponível', 'NO_STREAM');
  }

  logger.info('premiere.join', { userId, eventId: row.id });
  return {
    eventId: row.id,
    title: row.title,
    streamStatus: row.stream_status || (row.is_live ? 'live' : 'scheduled'),
    playback,
    live: true,
  };
}

async function probeCdn() {
  await featureFlagService.assertEnabled('cdn_health_enabled');
  const checks = [];

  // CDN hostname HEAD
  if (env.bunny.cdnHostname) {
    const started = Date.now();
    const url = `https://${env.bunny.cdnHostname}/`;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 5000);
      const res = await fetch(url, { method: 'HEAD', signal: ctrl.signal }).catch(() =>
        fetch(url, { method: 'GET', signal: ctrl.signal })
      );
      clearTimeout(t);
      const latencyMs = Date.now() - started;
      const ok = res.status > 0 && res.status < 500;
      const row = await phase26Repository.insertCdnCheck({
        probeType: 'cdn_head',
        ok,
        latencyMs,
        httpStatus: res.status,
        details: { url },
      });
      checks.push(row);
    } catch (err) {
      const row = await phase26Repository.insertCdnCheck({
        probeType: 'cdn_head',
        ok: false,
        latencyMs: Date.now() - started,
        error: err.message,
        details: { url },
      });
      checks.push(row);
    }
  } else {
    const row = await phase26Repository.insertCdnCheck({
      probeType: 'cdn_head',
      ok: false,
      error: 'BUNNY_CDN_HOSTNAME não configurado',
    });
    checks.push(row);
  }

  // Library API ping
  if (env.bunny.libraryId && env.bunny.apiKey) {
    const started = Date.now();
    const url = `https://video.bunnycdn.com/library/${env.bunny.libraryId}`;
    try {
      const res = await fetch(url, {
        headers: { AccessKey: env.bunny.apiKey, Accept: 'application/json' },
        signal: AbortSignal.timeout(6000),
      });
      const row = await phase26Repository.insertCdnCheck({
        probeType: 'library_api',
        ok: res.ok,
        latencyMs: Date.now() - started,
        httpStatus: res.status,
      });
      checks.push(row);
    } catch (err) {
      const row = await phase26Repository.insertCdnCheck({
        probeType: 'library_api',
        ok: false,
        latencyMs: Date.now() - started,
        error: err.message,
      });
      checks.push(row);
    }
  }

  // HLS demo manifest (always as baseline connectivity)
  {
    const started = Date.now();
    const url = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      const row = await phase26Repository.insertCdnCheck({
        probeType: 'hls_manifest',
        ok: res.ok,
        latencyMs: Date.now() - started,
        httpStatus: res.status,
        details: { url, note: 'baseline' },
      });
      checks.push(row);
    } catch (err) {
      const row = await phase26Repository.insertCdnCheck({
        probeType: 'hls_manifest',
        ok: false,
        latencyMs: Date.now() - started,
        error: err.message,
      });
      checks.push(row);
    }
  }

  return {
    checks: checks.map((c) => ({
      id: c.id,
      probeType: c.probe_type,
      ok: c.ok,
      latencyMs: c.latency_ms,
      httpStatus: c.http_status,
      error: c.error,
      checkedAt: c.checked_at,
    })),
    healthy: checks.every((c) => c.ok || c.probe_type === 'cdn_head'),
  };
}

async function cdnHealthHistory(limit = 20) {
  const rows = await phase26Repository.listCdnChecks(limit);
  return {
    items: rows.map((c) => ({
      id: c.id,
      probeType: c.probe_type,
      ok: c.ok,
      latencyMs: c.latency_ms,
      httpStatus: c.http_status,
      error: c.error,
      checkedAt: c.checked_at,
    })),
  };
}

async function adminPacks() {
  const rows = await phase26Repository.adminListPacks();
  return {
    packs: rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      priceKz: r.price_kz,
      rentalHours: r.rental_hours,
      isActive: r.is_active,
      itemCount: r.item_count,
    })),
  };
}

module.exports = {
  listPacks,
  getPack,
  selectProfile,
  pendingSurvey,
  respondSurvey,
  adminSurveySummary,
  joinPremiere,
  probeCdn,
  cdnHealthHistory,
  adminPacks,
  mapPack,
};
