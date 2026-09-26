'use strict';

const phase24Repository = require('../repositories/phase24Repository');
const deviceRepository = require('../repositories/deviceRepository');
const profileRepository = require('../repositories/profileRepository');
const featureFlagService = require('./featureFlagService');
const auditRepository = require('../repositories/auditRepository');
const { createError } = require('../utils/errors');

function mapDevice(row) {
  return {
    id: row.id,
    deviceKey: row.device_key,
    name: row.device_name,
    platform: row.platform,
    ip: row.ip,
    lastSeenAt: row.last_seen_at,
    createdAt: row.created_at,
    isTrusted: Boolean(row.is_trusted),
    trustedAt: row.trusted_at || null,
  };
}

async function listDevicesDetailed(userId) {
  await featureFlagService.assertEnabled(
    'trusted_devices_enabled',
    'Gestão de dispositivos indisponível'
  );
  const rows = await phase24Repository.listTrusted(userId);
  return {
    devices: rows.map(mapDevice),
    trustedCount: rows.filter((r) => r.is_trusted).length,
  };
}

async function setDeviceTrusted(userId, deviceId, trusted, meta = {}) {
  await featureFlagService.assertEnabled(
    'trusted_devices_enabled',
    'Gestão de dispositivos indisponível'
  );
  const row = await phase24Repository.setTrusted(deviceId, userId, trusted);
  if (!row) throw createError(404, 'Dispositivo não encontrado', 'DEVICE_NOT_FOUND');
  await auditRepository.write({
    actorId: userId,
    action: trusted ? 'device.trusted' : 'device.untrusted',
    entity: 'device_session',
    entityId: deviceId,
    ip: meta.ip,
  });
  return { device: mapDevice(row) };
}

async function renameDevice(userId, deviceId, name, meta = {}) {
  if (!name || String(name).trim().length < 2) {
    throw createError(400, 'Nome inválido', 'VALIDATION');
  }
  const row = await phase24Repository.renameDevice(deviceId, userId, name);
  if (!row) throw createError(404, 'Dispositivo não encontrado', 'DEVICE_NOT_FOUND');
  await auditRepository.write({
    actorId: userId,
    action: 'device.renamed',
    entity: 'device_session',
    entityId: deviceId,
    metadata: { name: row.device_name },
    ip: meta.ip,
  });
  return { device: mapDevice(row) };
}

/**
 * Se perfil exige PIN no play (ou conteúdo 16+ com PIN), valida pin.
 */
async function assertPinOnPlay({ userId, profile, contentRating, pin }) {
  await featureFlagService.assertEnabled('pin_on_play_enabled');
  if (!profile) return { required: false, ok: true };

  const requireAlways = Boolean(profile.require_pin_on_play);
  const matureGate = profile.has_pin && (contentRating || 12) >= 16;
  const needed = (requireAlways || matureGate) && profile.has_pin;

  if (!needed) return { required: false, ok: true };

  if (!pin) {
    throw createError(403, 'Introduza o PIN do perfil para assistir', 'PIN_REQUIRED_PLAY', {
      requirePinOnPlay: true,
    });
  }

  const result = await profileRepository.verifyPin(profile.id, userId, pin);
  if (!result.ok) {
    throw createError(403, 'PIN incorrecto', 'PIN_INVALID');
  }
  return { required: true, ok: true };
}

async function assignExperiments(userId) {
  await featureFlagService.assertEnabled(
    'experiments_enabled',
    'Experiências temporariamente indisponíveis'
  );
  const experiments = await phase24Repository.getActiveExperiments();
  const assigned = [];

  for (const exp of experiments) {
    let row = await phase24Repository.getAssignment(exp.id, userId);
    if (!row) {
      const variants = exp.variants || ['control'];
      let variant = phase24Repository.stableVariant(userId, exp.key, variants);
      const bucketHash = require('crypto')
        .createHash('sha256')
        .update(`${userId}:${exp.key}:traffic`)
        .digest('hex');
      const pct = parseInt(bucketHash.slice(0, 8), 16) % 100;
      if (pct >= (exp.traffic_percent ?? 100)) {
        variant = 'control';
      }
      row = await phase24Repository.assignVariant(exp.id, userId, variant);
    }
    assigned.push({
      key: exp.key,
      name: exp.name,
      variant: row.variant,
    });
  }

  return { experiments: assigned };
}

async function getExperiments(userId) {
  try {
    return await assignExperiments(userId);
  } catch {
    return { experiments: [] };
  }
}

async function trendingSearches() {
  await featureFlagService.assertEnabled(
    'trending_search_enabled',
    'Pesquisas em alta indisponíveis'
  );
  const rows = await phase24Repository.trendingSearches({ days: 7, limit: 12 });
  return {
    market: 'AO',
    items: rows.map((r, i) => ({
      rank: i + 1,
      query: r.query,
      count: r.count,
    })),
  };
}

async function trackSearchEvent(payload) {
  try {
    await phase24Repository.trackSearch(payload);
  } catch {
    /* non-blocking */
  }
}

async function adminExperiments() {
  const rows = await phase24Repository.adminListExperiments();
  return {
    experiments: rows.map((e) => ({
      id: e.id,
      key: e.key,
      name: e.name,
      description: e.description,
      variants: e.variants,
      trafficPercent: e.traffic_percent,
      isActive: e.is_active,
      assignments: e.assignments,
      startsAt: e.starts_at,
      endsAt: e.ends_at,
    })),
  };
}

module.exports = {
  listDevicesDetailed,
  setDeviceTrusted,
  renameDevice,
  assertPinOnPlay,
  assignExperiments,
  getExperiments,
  trendingSearches,
  trackSearchEvent,
  adminExperiments,
};
