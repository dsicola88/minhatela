'use strict';

const profileRepository = require('../repositories/profileRepository');
const watchProgressRepository = require('../repositories/watchProgressRepository');
const { createError } = require('../utils/errors');

async function saveProgress({
  userId,
  profileId,
  contentId,
  positionSeconds,
  durationSeconds,
  deviceId,
}) {
  if (!profileId) {
    throw createError(400, 'Perfil obrigatório para guardar progresso', 'PROFILE_REQUIRED');
  }

  const owned = await profileRepository.findOwned(profileId, userId);
  if (!owned) {
    throw createError(403, 'Perfil inválido para esta conta', 'INVALID_PROFILE');
  }

  const position = Number(positionSeconds);
  const duration = Number(durationSeconds || 0);

  if (!Number.isFinite(position) || position < 0) {
    throw createError(400, 'Posição de progresso inválida', 'VALIDATION');
  }
  if (duration < 0 || !Number.isFinite(duration)) {
    throw createError(400, 'Duração inválida', 'VALIDATION');
  }
  // Não aceitar progresso absurdamente além da duração conhecida
  const cappedPosition =
    duration > 0 ? Math.min(position, duration + 30) : Math.min(position, 60 * 60 * 12);

  const completed = duration > 0 && cappedPosition / duration >= 0.92;

  const uuidRe =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const safeDeviceId =
    deviceId && uuidRe.test(String(deviceId)) ? String(deviceId) : null;

  const row = await watchProgressRepository.upsertProgress({
    profileId,
    contentId,
    positionSeconds: cappedPosition,
    durationSeconds: duration,
    completed,
    deviceId: safeDeviceId,
  });

  return {
    contentId,
    profileId,
    positionSeconds: row.position_seconds,
    durationSeconds: row.duration_seconds,
    completed: row.completed,
    percentage:
      row.duration_seconds > 0
        ? Math.min(99, Math.round((row.position_seconds / row.duration_seconds) * 100))
        : 0,
    updatedAt: row.updated_at,
    lastSyncedAt: row.last_synced_at,
  };
}

async function getProgress({ userId, profileId, contentId }) {
  if (!profileId) return null;
  const owned = await profileRepository.findOwned(profileId, userId);
  if (!owned) {
    throw createError(403, 'Perfil inválido para esta conta', 'INVALID_PROFILE');
  }
  const row = await watchProgressRepository.getProgress(profileId, contentId);
  if (!row) return null;
  return {
    positionSeconds: row.position_seconds,
    durationSeconds: row.duration_seconds,
    completed: row.completed,
    percentage:
      row.duration_seconds > 0
        ? Math.min(99, Math.round((row.position_seconds / row.duration_seconds) * 100))
        : 0,
    updatedAt: row.updated_at,
  };
}

module.exports = { saveProgress, getProgress };
