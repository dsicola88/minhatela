'use strict';

const analyticsRepository = require('../repositories/analyticsRepository');
const { createError } = require('../utils/errors');

const ALLOWED = new Set([
  'video_started',
  'video_played',
  'video_paused',
  'video_completed',
  'video_progress',
  'video_seek',
  'video_error',
  'content_viewed',
  'content_added_favorite',
  'search_performed',
  'ad_started',
  'ad_completed',
  'ad_clicked',
  'subscription_started',
  'rental_started',
  'payment_submitted',
  'payment_confirmed',
]);

async function ingest(userId, body) {
  const eventName = body?.eventName;
  if (!ALLOWED.has(eventName)) {
    throw createError(400, 'Evento de analytics inválido', 'INVALID_EVENT');
  }

  await analyticsRepository.track({
    eventName,
    userId,
    profileId: body.profileId || null,
    contentId: body.contentId || null,
    sessionId: body.sessionId || null,
    metadata: body.metadata || {},
  });

  return { accepted: true };
}

module.exports = { ingest };
