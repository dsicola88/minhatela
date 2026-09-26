'use strict';

const crypto = require('crypto');
const webhookRepository = require('../repositories/webhookRepository');
const { createError } = require('../utils/errors');
const { logger } = require('../utils/logger');

function assertWebhookAuth(req) {
  const secret = process.env.BUNNY_WEBHOOK_SECRET || '';
  if (!secret) {
    throw createError(503, 'Webhook Bunny não configurado', 'WEBHOOK_NOT_CONFIGURED');
  }
  const token =
    req.query.token ||
    req.headers['x-webhook-token'] ||
    (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token || token !== secret) {
    throw createError(401, 'Token de webhook inválido', 'WEBHOOK_UNAUTHORIZED');
  }
}

function mapBunnyStatus(status) {
  const s = String(status ?? '').toLowerCase();
  if (['finished', 'finishedencoding', 'ready', '4', '3'].includes(s)) return 'ready';
  if (['failed', 'error', '5'].includes(s)) return 'failed';
  if (['processing', 'encoding', '2', '1'].includes(s)) return 'processing';
  if (['queued', 'pending', '0'].includes(s)) return 'pending';
  return 'unknown';
}

async function handleBunnyWebhook(req) {
  assertWebhookAuth(req);
  const body = req.body || {};

  const videoGuid =
    body.VideoGuid ||
    body.videoGuid ||
    body.guid ||
    body.VideoId ||
    body.videoId ||
    null;
  const statusRaw = body.Status ?? body.status ?? body.StatusCode ?? body.statusCode;
  const eventType = `bunny.status.${statusRaw ?? 'unknown'}`;
  const externalId = videoGuid
    ? `${videoGuid}:${statusRaw ?? 'na'}`
    : body.EventId || body.eventId || crypto.randomUUID();

  const inserted = await webhookRepository.insertEvent({
    provider: 'bunny',
    eventType,
    externalId,
    payload: body,
  });

  if (inserted.duplicate) {
    return { ok: true, duplicate: true };
  }

  try {
    if (!videoGuid) {
      await webhookRepository.markProcessed(inserted.id, 'ignored', 'missing video guid');
      return { ok: true, ignored: true };
    }

    const encodingStatus = mapBunnyStatus(statusRaw);
    const updated = await webhookRepository.updateVideoEncoding(videoGuid, encodingStatus);
    await webhookRepository.markProcessed(inserted.id, 'processed');

    logger.info('webhook.bunny.processed', {
      videoGuid,
      encodingStatus,
      matched: updated.length,
    });

    return {
      ok: true,
      encodingStatus,
      updated: updated.map((r) => ({ id: r.id, title: r.title, status: r.encoding_status })),
    };
  } catch (err) {
    await webhookRepository.markProcessed(inserted.id, 'failed', err.message);
    throw err;
  }
}

module.exports = {
  handleBunnyWebhook,
  mapBunnyStatus,
};
