'use strict';

const { randomUUID } = require('crypto');
const contentRepository = require('../repositories/contentRepository');
const profileRepository = require('../repositories/profileRepository');
const playbackRepository = require('../repositories/playbackRepository');
const accessControlService = require('./accessControlService');
const bunnyService = require('./bunnyService');
const adDecisionService = require('./adDecisionService');
const deviceStreamService = require('./deviceStreamService');
const seriesRepository = require('../repositories/seriesRepository');
const analyticsRepository = require('../repositories/analyticsRepository');
const watchProgressRepository = require('../repositories/watchProgressRepository');
const { mapContentPublic, mapContentInternal } = require('../utils/mappers');
const { createError } = require('../utils/errors');
const { logger } = require('../utils/logger');

/**
 * POST /api/watch/:contentId/start
 *
 * Única porta de autorização de reprodução.
 */
async function startPlayback({
  userId,
  contentId,
  profileId,
  ip,
  userAgent,
  deviceKey,
  deviceName,
  platform,
  pin,
}) {
  const featureFlagService = require('./featureFlagService');
  await featureFlagService.assertNotMaintenance();

  let profile = null;
  if (profileId) {
    profile = await profileRepository.findOwned(profileId, userId);
    if (!profile) {
      throw createError(403, 'Perfil inválido para esta conta', 'INVALID_PROFILE');
    }
  }

  let row = await contentRepository.findPublishedById(contentId);
  if (!row) {
    throw createError(404, 'Conteúdo não encontrado', 'CONTENT_NOT_FOUND');
  }

  // Série → resolve episódio a continuar / primeiro
  if (row.kind === 'series') {
    const episode = profileId
      ? await seriesRepository.findContinueEpisode(profileId, row.id)
      : await seriesRepository.findFirstEpisode(row.id);
    if (!episode) {
      throw createError(404, 'Esta série ainda não tem episódios', 'NO_EPISODES');
    }
    row = await contentRepository.findPublishedById(episode.id);
  }

  const content = mapContentInternal(row);

  if (
    content.comingSoonAt &&
    new Date(content.comingSoonAt) > new Date() &&
    !(row.is_published && row.workflow_status === 'published')
  ) {
    throw createError(403, 'Este título estreia em breve', 'COMING_SOON', {
      comingSoonAt: content.comingSoonAt,
    });
  }

  if (row.kind === 'series') {
    throw createError(400, 'Não é possível reproduzir a série directamente', 'SERIES_NOT_PLAYABLE');
  }

  if (!row.bunny_video_id) {
    throw createError(503, 'Asset de vídeo indisponível', 'NO_BUNNY_ASSET');
  }

  const maturityMax = profile?.maturity_max ?? 18;
  const rating = content.maturityRating ?? row.maturity_rating ?? 12;
  if (rating > maturityMax) {
    throw createError(
      403,
      'Este título não está disponível neste perfil (classificação etária)',
      'MATURITY_BLOCKED',
      { maturityRating: rating, maturityMax }
    );
  }

  // PIN no play (perfis com PIN + 16+/require_pin_on_play)
  try {
    const phase24Service = require('./phase24Service');
    await phase24Service.assertPinOnPlay({
      userId,
      profile,
      contentRating: rating,
      pin,
    });
  } catch (err) {
    if (err.code === 'FEATURE_DISABLED') {
      /* flag off */
    } else {
      throw err;
    }
  }

  const parentalService = require('./parentalService');
  await parentalService.assertNotBlocked(profileId, content.id);
  // Bloquear também a série-mãe se for episódio
  if (content.seriesId) {
    await parentalService.assertNotBlocked(profileId, content.seriesId);
  }

  const rightsOk = await contentRepository.hasActiveRights(content.id, 'AO');
  if (!rightsOk) {
    throw createError(403, 'Conteúdo indisponível neste território', 'RIGHTS_DENIED');
  }

  const access = await accessControlService.resolveAccess(userId, content);

  if (!access.canWatch) {
    await playbackRepository.createSession({
      id: randomUUID(),
      userId,
      profileId,
      contentId: content.id,
      monetization: content.monetization,
      allowed: false,
      denialCode: access.denialCode,
      bunnyVideoId: null,
      expiresAt: null,
      ip,
      userAgent,
      isActive: false,
    });

    throw createError(403, access.message, access.denialCode || 'FORBIDDEN', {
      access,
    });
  }

  const { device, limit } = await deviceStreamService.acquireStreamSlot({
    userId,
    deviceKey: deviceKey || `legacy-${userId}`,
    deviceName: deviceName || 'Dispositivo',
    platform: platform || 'unknown',
    ip,
    userAgent,
  });

  const ads = await adDecisionService.decide({
    contentId: content.id,
    monetization: content.monetization,
    userId,
  });

  const signed = bunnyService.signPlayback(content.bunnyVideoId, {
    userIp: ip,
  });
  const sessionId = randomUUID();

  await playbackRepository.createSession({
    id: sessionId,
    userId,
    profileId,
    contentId: content.id,
    monetization: content.monetization,
    allowed: true,
    denialCode: null,
    bunnyVideoId: content.bunnyVideoId,
    expiresAt: signed.expiresAt,
    ip,
    userAgent,
    deviceId: device.id,
    isActive: true,
  });

  logger.info('playback.authorized', {
    sessionId,
    userId,
    contentId: content.id,
    monetization: content.monetization,
    kind: content.kind,
    deviceId: device.id,
    streamLimit: limit,
  });

  let resume = null;
  if (profileId) {
    const progress = await watchProgressRepository.getProgress(profileId, content.id);
    if (progress && !progress.completed && progress.position_seconds > 15) {
      resume = {
        positionSeconds: progress.position_seconds,
        durationSeconds: progress.duration_seconds,
        percentage:
          progress.duration_seconds > 0
            ? Math.min(
                99,
                Math.round((progress.position_seconds / progress.duration_seconds) * 100)
              )
            : 0,
      };
    }
  }

  let series = null;
  let nextEpisode = null;
  if (content.kind === 'episode' && content.seriesId) {
    const seriesRow = await seriesRepository.findSeriesById(content.seriesId);
    series = seriesRow ? mapContentPublic(seriesRow) : null;
    const next = await seriesRepository.findNextEpisode(content.id);
    nextEpisode = next ? mapContentPublic(next) : null;
  }

  let moreLikeThis = { items: [] };
  try {
    const recommendationService = require('./recommendationService');
    moreLikeThis = await recommendationService.moreLikeThis(content.id, {
      profileId,
      limit: 12,
    });
  } catch {
    /* optional */
  }

  await analyticsRepository.track({
    eventName: 'video_started',
    userId,
    profileId,
    contentId: content.id,
    sessionId,
    metadata: {
      monetization: content.monetization,
      deviceId: device.id,
      kind: content.kind,
    },
  });

  let scrub = null;
  try {
    const scrubResult = await require('./phase25Service').getScrub(content.id);
    scrub = scrubResult.scrub || null;
  } catch {
    scrub = null;
  }

  return {
    sessionId,
    content: mapContentPublic(content),
    playback: {
      embedUrl: signed.embedUrl,
      hlsUrl: signed.hlsUrl,
      expiresAt: signed.expiresAt,
    },
    player: {
      ...bunnyService.getPlayerDefaults(),
      introEndSeconds: content.introEndSeconds,
      recapEndSeconds: content.recapEndSeconds || null,
      creditsStartSeconds: content.creditsStartSeconds,
      postCreditsStartSeconds: content.postCreditsStartSeconds || null,
      skipIntroEnabled: Boolean(content.introEndSeconds),
      skipRecapEnabled: Boolean(content.recapEndSeconds),
      watchCreditsEnabled: Boolean(content.creditsStartSeconds),
      postCreditsEnabled: Boolean(content.postCreditsStartSeconds),
      autoplayNext: profile?.autoplay_next !== false,
      autoplayPreviews: profile?.autoplay_previews !== false,
      preferredQuality: profile?.preferred_quality || 'auto',
      ...require('./phase25Service').playerExtras(profile),
    },
    scrub,
    preferences: profile
      ? {
          autoplayNext: profile.autoplay_next !== false,
          autoplayPreviews: profile.autoplay_previews !== false,
          dataSaverDefault: profile.data_saver_default !== false,
          maturityMax: profile.maturity_max,
          preferredAudio: profile.preferred_audio || 'pt',
          preferredSubtitles: profile.preferred_subtitles || 'off',
          subtitleSize: profile.subtitle_size || 'medium',
          preferredQuality: profile.preferred_quality || 'auto',
          wifiOnlyDownloads: profile.wifi_only_downloads !== false,
          loginAlerts: profile.login_alerts !== false,
          requirePinOnPlay: Boolean(profile.require_pin_on_play),
          hideSpoilers: Boolean(profile.hide_spoilers),
          autoplayCountdownSeconds:
            profile.autoplay_countdown_seconds === 0
              ? 0
              : Number(profile.autoplay_countdown_seconds ?? 10),
          a11y: {
            reducedMotion: Boolean(profile.a11y_reduced_motion),
            highContrast: Boolean(profile.a11y_high_contrast),
            audioDescription: Boolean(profile.a11y_audio_description),
            largeText: Boolean(profile.a11y_large_text),
          },
        }
      : null,
    resume,
    ads,
    access: {
      monetization: access.monetization,
      label: access.label,
      expiresAt: access.expiresAt || null,
      premiumSource: access.premiumSource || null,
    },
    series,
    nextEpisode,
    moreLikeThis,
    device: {
      id: device.id,
      name: device.device_name,
      platform: device.platform,
    },
    streams: {
      limit,
    },
  };
}

async function heartbeat({ userId, sessionId }) {
  const row = await playbackRepository.heartbeat(sessionId, userId);
  if (!row) {
    throw createError(404, 'Sessão de reprodução não encontrada', 'SESSION_NOT_FOUND');
  }
  return { sessionId: row.id, lastHeartbeatAt: row.last_heartbeat_at };
}

async function endPlayback({ userId, sessionId }) {
  const row = await playbackRepository.endSession(sessionId, userId);
  if (!row) {
    throw createError(404, 'Sessão de reprodução não encontrada', 'SESSION_NOT_FOUND');
  }
  return { ended: true, sessionId: row.id };
}

module.exports = { startPlayback, heartbeat, endPlayback };
