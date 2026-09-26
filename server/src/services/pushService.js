'use strict';

const pushTokenRepository = require('../repositories/pushTokenRepository');
const { createError } = require('../utils/errors');
const { logger } = require('../utils/logger');
const { env } = require('../config/env');

async function registerToken(userId, { token, platform, deviceKey }) {
  if (!token || String(token).length < 20) {
    throw createError(400, 'Token push inválido', 'VALIDATION');
  }
  const row = await pushTokenRepository.upsert({
    userId,
    token: String(token).trim(),
    platform,
    deviceKey,
  });
  return {
    registered: true,
    platform: row.platform,
    lastSeenAt: row.last_seen_at,
  };
}

async function unregisterToken(userId, token) {
  await pushTokenRepository.revoke(userId, token);
  return { revoked: true };
}

/**
 * Envia via Expo Push API (HTTPS). Sem SDK — enterprise-friendly.
 * https://docs.expo.dev/push-notifications/sending-notifications/
 */
async function sendToUsers(userIds, { title, body, data }) {
  const rows = await pushTokenRepository.listActiveByUsers(userIds);
  if (!rows.length) {
    return { sent: 0, skipped: true };
  }

  const messages = rows.map((row) => ({
    to: row.token,
    sound: 'default',
    title,
    body,
    data: data || {},
    channelId: 'minhatela',
  }));

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });
    const payload = await response.json().catch(() => null);
    logger.info('push.sent', {
      count: messages.length,
      ok: response.ok,
      env: env.nodeEnv,
      tickets: env.isProd ? undefined : payload,
    });
    return { sent: messages.length, response: payload };
  } catch (err) {
    logger.error('push.failed', { message: err.message, count: messages.length });
    return { sent: 0, error: err.message };
  }
}

async function notifyUser(userId, payload) {
  return sendToUsers([userId], payload);
}

module.exports = {
  registerToken,
  unregisterToken,
  sendToUsers,
  notifyUser,
};
