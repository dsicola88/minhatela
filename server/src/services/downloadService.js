'use strict';

const contentRepository = require('../repositories/contentRepository');
const profileRepository = require('../repositories/profileRepository');
const downloadRepository = require('../repositories/downloadRepository');
const parentalRepository = require('../repositories/parentalRepository');
const accessControlService = require('./accessControlService');
const bunnyService = require('./bunnyService');
const userRepository = require('../repositories/userRepository');
const featureFlagService = require('./featureFlagService');
const { mapContentPublic, mapContentInternal } = require('../utils/mappers');
const { createError } = require('../utils/errors');
const { env } = require('../config/env');
const { logger } = require('../utils/logger');

function isPremium(user) {
  return (
    user?.subscription_status === 'premium_active' &&
    (!user.premium_expires_at || new Date(user.premium_expires_at) > new Date())
  );
}

function limitsFor(user) {
  if (isPremium(user)) {
    return {
      maxActive: Number(process.env.DOWNLOAD_MAX_PREMIUM || 10),
      ttlDays: Number(process.env.DOWNLOAD_TTL_DAYS_PREMIUM || 30),
      qualityDefault: '720p',
      maxPlays: 100,
    };
  }
  return {
    maxActive: Number(process.env.DOWNLOAD_MAX_FREE || 3),
    ttlDays: Number(process.env.DOWNLOAD_TTL_DAYS_FREE || 7),
    qualityDefault: '480p',
    maxPlays: 30,
  };
}

async function requestDownload({
  userId,
  contentId,
  profileId,
  deviceKey,
  deviceName,
  platform,
  quality,
  ip,
}) {
  // Downloads offline
  await featureFlagService.assertNotMaintenance();
  await featureFlagService.assertEnabled(
    'downloads_enabled',
    'Downloads temporariamente indisponíveis'
  );

  if (!profileId) {
    throw createError(400, 'Perfil obrigatório para downloads', 'PROFILE_REQUIRED');
  }
  if (!deviceKey) {
    throw createError(400, 'Dispositivo obrigatório para downloads', 'DEVICE_REQUIRED');
  }

  const profile = await profileRepository.findOwned(profileId, userId);
  if (!profile) {
    throw createError(403, 'Perfil inválido', 'INVALID_PROFILE');
  }

  let row = await contentRepository.findPublishedById(contentId);
  if (!row) {
    throw createError(404, 'Conteúdo não encontrado', 'CONTENT_NOT_FOUND');
  }

  if (row.kind === 'series') {
    throw createError(
      400,
      'Descarregue episódios individuais, não a série',
      'SERIES_NOT_DOWNLOADABLE'
    );
  }

  if (!['movie', 'episode'].includes(row.kind || 'movie')) {
    throw createError(400, 'Só filmes e episódios podem ser descarregados', 'KIND_DENIED');
  }

  const content = mapContentInternal(row);
  const maturityMax = profile.maturity_max ?? 18;
  if ((content.maturityRating ?? 12) > maturityMax) {
    throw createError(403, 'Classificação etária bloqueada', 'MATURITY_BLOCKED');
  }

  if (await parentalRepository.isBlocked(profileId, content.id)) {
    throw createError(403, 'Título bloqueado neste perfil', 'TITLE_BLOCKED');
  }

  const access = await accessControlService.resolveAccess(userId, content);
  if (!access.canWatch) {
    throw createError(403, access.message || 'Sem direitos para descarregar', access.denialCode || 'NO_ACCESS');
  }

  if (!row.bunny_video_id) {
    throw createError(503, 'Asset indisponível para download', 'NO_BUNNY_ASSET');
  }

  const user = await userRepository.findById(userId);
  const limits = limitsFor(user);

  await downloadRepository.expireStale();
  const existing = await downloadRepository.findActive(profileId, content.id, deviceKey);
  if (!existing) {
    const active = await downloadRepository.countActive(userId);
    if (active >= limits.maxActive) {
      throw createError(
        403,
        `Limite de downloads activos (${limits.maxActive}). Remova um para continuar.`,
        'DOWNLOAD_LIMIT',
        { maxActive: limits.maxActive, active }
      );
    }
  }

  let expiresAt = new Date(Date.now() + limits.ttlDays * 24 * 3600 * 1000);
  if (access.expiresAt) {
    const rentalEnd = new Date(access.expiresAt);
    if (rentalEnd < expiresAt) expiresAt = rentalEnd;
  }

  const q = quality || limits.qualityDefault;
  const license = await downloadRepository.upsert({
    userId,
    profileId,
    contentId: content.id,
    deviceKey,
    deviceName: deviceName || 'Dispositivo',
    platform: platform || 'unknown',
    quality: q,
    expiresAt,
    maxPlays: limits.maxPlays,
    bunnyVideoId: row.bunny_video_id,
  });

  const signed = bunnyService.signDownload(row.bunny_video_id, {
    quality: q,
    ttlSeconds: Math.min(6 * 3600, Math.floor((expiresAt - Date.now()) / 1000)),
    userIp: ip,
  });

  logger.info('download.issued', {
    userId,
    contentId: content.id,
    licenseId: license.id,
    quality: q,
  });

  return {
    license: downloadRepository.mapLicense({
      ...license,
      title: content.title,
      poster_url: content.posterUrl,
      kind: content.kind,
      duration_seconds: content.durationSeconds,
    }),
    playback: {
      downloadUrl: signed.downloadUrl,
      expiresAt: signed.expiresAt,
      quality: signed.quality,
      tokenAttached: signed.tokenAttached,
    },
    limits: {
      maxActive: limits.maxActive,
      ttlDays: limits.ttlDays,
      plan: isPremium(user) ? 'premium' : 'free',
    },
    content: mapContentPublic(row),
  };
}

async function listDownloads(userId, profileId) {
  await downloadRepository.expireStale();
  if (profileId) {
    const profile = await profileRepository.findOwned(profileId, userId);
    if (!profile) throw createError(403, 'Perfil inválido', 'INVALID_PROFILE');
  }
  const items = await downloadRepository.listByUser(userId, profileId);
  const user = await userRepository.findById(userId);
  const limits = limitsFor(user);
  return {
    downloads: items,
    limits: {
      maxActive: limits.maxActive,
      active: items.length,
      plan: isPremium(user) ? 'premium' : 'free',
    },
  };
}

async function refreshLicense({ userId, licenseId, deviceKey, ip }) {
  const row = await downloadRepository.findOwned(licenseId, userId);
  if (!row || row.status !== 'active') {
    throw createError(404, 'Licença não encontrada', 'LICENSE_NOT_FOUND');
  }
  if (new Date(row.expires_at) <= new Date()) {
    throw createError(403, 'Licença expirada', 'LICENSE_EXPIRED');
  }
  if (deviceKey && row.device_key !== deviceKey) {
    throw createError(403, 'Licença ligada a outro dispositivo', 'DEVICE_MISMATCH');
  }
  if (row.play_count >= row.max_plays) {
    throw createError(403, 'Limite de reproduções offline atingido', 'MAX_PLAYS');
  }

  const bunnyId = row.bunny_video_id || row.content_bunny;
  const signed = bunnyService.signDownload(bunnyId, {
    quality: row.quality,
    ttlSeconds: 6 * 3600,
    userIp: ip,
  });

  return {
    license: downloadRepository.mapLicense(row),
    playback: {
      downloadUrl: signed.downloadUrl,
      expiresAt: signed.expiresAt,
      quality: signed.quality,
    },
  };
}

async function revokeDownload(userId, licenseId) {
  const ok = await downloadRepository.revoke(licenseId, userId);
  if (!ok) throw createError(404, 'Licença não encontrada', 'LICENSE_NOT_FOUND');
  return { revoked: true };
}

async function markPlayed(userId, licenseId, deviceKey) {
  const owned = await downloadRepository.findOwned(licenseId, userId);
  if (!owned) throw createError(404, 'Licença não encontrada', 'LICENSE_NOT_FOUND');
  if (deviceKey && owned.device_key !== deviceKey) {
    throw createError(403, 'Licença ligada a outro dispositivo', 'DEVICE_MISMATCH');
  }
  const row = await downloadRepository.markPlayed(licenseId, userId);
  if (!row) throw createError(403, 'Licença inválida ou expirada', 'LICENSE_INVALID');
  return { playCount: row.play_count, status: row.status };
}

module.exports = {
  requestDownload,
  listDownloads,
  refreshLicense,
  revokeDownload,
  markPlayed,
  limitsFor,
};
