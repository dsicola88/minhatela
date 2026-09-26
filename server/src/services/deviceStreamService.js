'use strict';

const userRepository = require('../repositories/userRepository');
const playbackRepository = require('../repositories/playbackRepository');
const deviceRepository = require('../repositories/deviceRepository');
const { env } = require('../config/env');
const { createError } = require('../utils/errors');

function maxStreamsForUser(user) {
  if (user?.subscription_status === 'premium_active') {
    return env.maxConcurrentStreamsPremium;
  }
  return env.maxConcurrentStreamsFree;
}

/**
 * Garante slot de stream simultâneo (nível Netflix).
 * Regista dispositivo, limpa stale, e bloqueia se limite atingido.
 */
async function acquireStreamSlot({
  userId,
  deviceKey,
  deviceName,
  platform,
  ip,
  userAgent,
}) {
  if (!deviceKey) {
    throw createError(400, 'Identificador de dispositivo em falta', 'DEVICE_REQUIRED');
  }

  const user = await userRepository.findById(userId);
  if (!user) {
    throw createError(404, 'Utilizador não encontrado', 'USER_NOT_FOUND');
  }

  const device = await deviceRepository.upsertDevice({
    userId,
    deviceKey,
    deviceName,
    platform,
    userAgent,
    ip,
  });

  await playbackRepository.endStaleForUser(userId);
  const active = await playbackRepository.listActiveStreams(userId);
  const limit = maxStreamsForUser(user);

  // Mesmo dispositivo já a reproduzir conta como refresh, não como novo slot
  const sameDevice = active.filter((s) => s.device_id === device.id);
  const otherDevices = active.filter((s) => s.device_id !== device.id);

  if (otherDevices.length >= limit && sameDevice.length === 0) {
    throw createError(
      409,
      `Limite de reproduções simultâneas atingido (${limit}). Pare noutro dispositivo ou faça upgrade Premium.`,
      'CONCURRENT_STREAM_LIMIT',
      {
        limit,
        activeStreams: otherDevices.map((s) => ({
          sessionId: s.id,
          deviceName: s.device_name,
          platform: s.platform,
          contentTitle: s.content_title,
          lastHeartbeatAt: s.last_heartbeat_at,
        })),
      }
    );
  }

  return {
    device,
    limit,
    activeCount: otherDevices.length + (sameDevice.length ? 1 : 0),
  };
}

async function listDevices(userId) {
  try {
    const phase24Service = require('./phase24Service');
    return phase24Service.listDevicesDetailed(userId);
  } catch {
    const rows = await deviceRepository.listByUser(userId);
    return {
      devices: rows.map((row) => ({
        id: row.id,
        deviceKey: row.device_key,
        name: row.device_name,
        platform: row.platform,
        ip: row.ip,
        lastSeenAt: row.last_seen_at,
        createdAt: row.created_at,
        isTrusted: false,
      })),
    };
  }
}

async function revokeDevice(userId, deviceId) {
  const revoked = await deviceRepository.revoke(deviceId, userId);
  if (!revoked) {
    throw createError(404, 'Dispositivo não encontrado', 'DEVICE_NOT_FOUND');
  }
  // Termina streams activos deste dispositivo
  const active = await playbackRepository.listActiveStreams(userId);
  await Promise.all(
    active
      .filter((s) => s.device_id === deviceId)
      .map((s) => playbackRepository.endSession(s.id, userId))
  );
  return { revoked: true };
}

async function streamStatus(userId) {
  const user = await userRepository.findById(userId);
  await playbackRepository.endStaleForUser(userId);
  const active = await playbackRepository.listActiveStreams(userId);
  const limit = maxStreamsForUser(user);
  return {
    limit,
    active: active.length,
    streams: active.map((s) => ({
      sessionId: s.id,
      deviceName: s.device_name,
      platform: s.platform,
      contentTitle: s.content_title,
      lastHeartbeatAt: s.last_heartbeat_at,
    })),
    subscriptionStatus: user?.subscription_status || 'none',
  };
}

module.exports = {
  acquireStreamSlot,
  listDevices,
  revokeDevice,
  streamStatus,
  maxStreamsForUser,
};
