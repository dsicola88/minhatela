'use strict';

const profileRepository = require('../repositories/profileRepository');
const userRepository = require('../repositories/userRepository');
const deviceStreamService = require('./deviceStreamService');
const { createError } = require('../utils/errors');

function mapProfile(row) {
  return {
    id: row.id,
    name: row.name,
    avatarUrl: row.avatar_url,
    isKids: row.is_kids,
    sortOrder: row.sort_order,
    maturityMax: row.maturity_max,
    hasPin: row.has_pin,
    autoplayNext: row.autoplay_next !== false,
    autoplayPreviews: row.autoplay_previews !== false,
    dataSaverDefault: row.data_saver_default !== false,
    preferredAudio: row.preferred_audio || 'pt',
    preferredSubtitles: row.preferred_subtitles || 'off',
    subtitleSize: row.subtitle_size || 'medium',
    preferredQuality: row.preferred_quality || 'auto',
    wifiOnlyDownloads: row.wifi_only_downloads !== false,
    loginAlerts: row.login_alerts !== false,
    requirePinOnPlay: Boolean(row.require_pin_on_play),
    hideSpoilers: Boolean(row.hide_spoilers),
    autoplayCountdownSeconds:
      row.autoplay_countdown_seconds === 0
        ? 0
        : Number(row.autoplay_countdown_seconds ?? 10),
    lastUsedAt: row.last_used_at || null,
    isLastUsed: Boolean(row.last_used_at),
    a11y: {
      reducedMotion: Boolean(row.a11y_reduced_motion),
      highContrast: Boolean(row.a11y_high_contrast),
      audioDescription: Boolean(row.a11y_audio_description),
      largeText: Boolean(row.a11y_large_text),
    },
  };
}

async function getAccount(userId) {
  const user = await userRepository.findById(userId);
  if (!user) throw createError(404, 'Utilizador não encontrado', 'USER_NOT_FOUND');
  const roles = await userRepository.getRoles(userId);
  const streams = await deviceStreamService.streamStatus(userId);
  const deviceData = await deviceStreamService.listDevices(userId);
  const devices = Array.isArray(deviceData) ? deviceData : deviceData.devices || [];
  const profiles = await profileRepository.listByUser(userId);


  let effectiveSub = {
    status: user.subscription_status,
    expiresAt: user.premium_expires_at,
    source: 'self',
  };
  try {
    const householdService = require('./householdService');
    effectiveSub = await householdService.resolveEffectiveSubscription(userId);
  } catch {
    /* optional */
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      subscriptionStatus: user.subscription_status,
      premiumExpiresAt: user.premium_expires_at,
      effectiveSubscription: effectiveSub,
      emailVerified: Boolean(user.email_verified_at),
      deletionRequestedAt: user.deletion_requested_at || null,
      deletionScheduledAt: user.deletion_scheduled_at || null,
      roles,
      isAdmin: Boolean(user.is_admin) || roles.includes('admin'),
    },
    streams,
    devices,
    profiles: (() => {
      const latest = profiles.find((r) => r.last_used_at)?.id || null;
      return profiles.map((row) => ({
        ...mapProfile(row),
        isLastUsed: latest ? row.id === latest : false,
      }));
    })(),
  };
}

async function listProfiles(userId) {
  const rows = await profileRepository.listByUser(userId);
  const latest = rows.find((r) => r.last_used_at)?.id || null;
  return {
    profiles: rows.map((row) => ({
      ...mapProfile(row),
      isLastUsed: latest ? row.id === latest : false,
    })),
  };
}

async function createProfile(userId, body) {
  const count = await profileRepository.countByUser(userId);
  if (count >= 4) {
    throw createError(400, 'Máximo de 4 perfis por conta', 'PROFILE_LIMIT');
  }
  if (!body?.name || String(body.name).trim().length < 2) {
    throw createError(400, 'Nome do perfil inválido', 'VALIDATION');
  }
  if (body.pin && !/^\d{4}$/.test(String(body.pin))) {
    throw createError(400, 'PIN deve ter 4 dígitos', 'VALIDATION');
  }

  const row = await profileRepository.create({
    userId,
    name: body.name,
    avatarUrl: body.avatarUrl,
    isKids: body.isKids,
    pin: body.pin,
    maturityMax: body.maturityMax,
  });

  if (row?.error === 'LIMIT') {
    throw createError(400, 'Máximo de 4 perfis por conta', 'PROFILE_LIMIT');
  }

  return mapProfile(row);
}

async function updateProfile(userId, profileId, body) {
  if (body.pin && !/^\d{4}$/.test(String(body.pin))) {
    throw createError(400, 'PIN deve ter 4 dígitos', 'VALIDATION');
  }
  const row = await profileRepository.update(profileId, userId, {
    name: body.name,
    avatarUrl: body.avatarUrl,
    isKids: body.isKids,
    pin: body.pin,
    maturityMax: body.maturityMax,
    clearPin: body.clearPin,
    autoplayNext: body.autoplayNext,
    autoplayPreviews: body.autoplayPreviews,
    dataSaverDefault: body.dataSaverDefault,
    preferredAudio: body.preferredAudio,
    preferredSubtitles: body.preferredSubtitles,
    subtitleSize: body.subtitleSize,
    a11yReducedMotion: body.a11yReducedMotion ?? body.a11y?.reducedMotion,
    a11yHighContrast: body.a11yHighContrast ?? body.a11y?.highContrast,
    a11yAudioDescription: body.a11yAudioDescription ?? body.a11y?.audioDescription,
    a11yLargeText: body.a11yLargeText ?? body.a11y?.largeText,
    preferredQuality: body.preferredQuality,
    wifiOnlyDownloads: body.wifiOnlyDownloads,
    loginAlerts: body.loginAlerts,
    requirePinOnPlay: body.requirePinOnPlay,
    hideSpoilers: body.hideSpoilers,
    autoplayCountdownSeconds: body.autoplayCountdownSeconds,
  });
  if (!row) throw createError(404, 'Perfil não encontrado', 'PROFILE_NOT_FOUND');
  return mapProfile(row);
}

async function deleteProfile(userId, profileId) {
  const result = await profileRepository.remove(profileId, userId);
  if (result?.error === 'LAST') {
    throw createError(400, 'Não pode eliminar o único perfil', 'LAST_PROFILE');
  }
  if (!result) throw createError(404, 'Perfil não encontrado', 'PROFILE_NOT_FOUND');
  return { deleted: true };
}

async function unlockProfile(userId, profileId, pin) {
  const result = await profileRepository.verifyPin(profileId, userId, pin);
  if (!result.ok) {
    if (result.code === 'NOT_FOUND') {
      throw createError(404, 'Perfil não encontrado', 'PROFILE_NOT_FOUND');
    }
    if (result.code === 'PIN_REQUIRED') {
      throw createError(403, 'PIN necessário', 'PIN_REQUIRED');
    }
    throw createError(403, 'PIN incorrecto', 'PIN_INVALID');
  }
  return mapProfile(result.profile);
}

module.exports = {
  getAccount,
  listProfiles,
  createProfile,
  updateProfile,
  deleteProfile,
  unlockProfile,
  mapProfile,
};
