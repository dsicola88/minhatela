'use strict';

const qoeRepository = require('../repositories/qoeRepository');
const featureFlagService = require('./featureFlagService');
const { createError } = require('../utils/errors');

async function ingestBatch(userId, body, meta = {}) {
  const enabled = await featureFlagService.isEnabled('qoe_ingest_enabled', true);
  if (!enabled) {
    return { accepted: 0, disabled: true };
  }

  const events = Array.isArray(body?.events) ? body.events : [body];
  if (!events.length) {
    throw createError(400, 'Sem eventos QoE', 'VALIDATION');
  }
  if (events.length > 40) {
    throw createError(400, 'Máximo 40 eventos por lote', 'VALIDATION');
  }

  const normalized = events.map((ev) => ({
    userId,
    profileId: ev.profileId || meta.profileId || null,
    contentId: ev.contentId || null,
    sessionId: ev.sessionId || null,
    eventType: String(ev.eventType || ev.type || '').toLowerCase(),
    startupMs: ev.startupMs != null ? Number(ev.startupMs) : null,
    bitrateKbps: ev.bitrateKbps != null ? Number(ev.bitrateKbps) : null,
    bufferMs: ev.bufferMs != null ? Number(ev.bufferMs) : null,
    errorCode: ev.errorCode || null,
    quality: ev.quality || null,
    platform: ev.platform || meta.platform || null,
    metadata: ev.metadata || {},
  }));

  const inserted = await qoeRepository.ingest(normalized);
  return { accepted: inserted.length, events: inserted };
}

async function adminSummary(days) {
  return qoeRepository.summary({ days });
}

module.exports = { ingestBatch, adminSummary };
