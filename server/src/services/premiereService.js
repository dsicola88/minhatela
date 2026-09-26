'use strict';

const premiereRepository = require('../repositories/premiereRepository');
const featureFlagService = require('./featureFlagService');
const auditRepository = require('../repositories/auditRepository');
const { createError } = require('../utils/errors');

async function list(userId) {
  await featureFlagService.assertEnabled(
    'premieres_enabled',
    'Estreias temporariamente indisponíveis'
  );
  const events = await premiereRepository.listUpcoming({ limit: 24 });
  let reminded = new Set();
  if (userId) {
    reminded = await premiereRepository.userReminders(userId);
  }
  return {
    events: events.map((e) => ({
      ...e,
      reminded: reminded.has(e.id),
    })),
    market: 'AO',
  };
}

async function getBySlug(slug, userId) {
  await featureFlagService.assertEnabled(
    'premieres_enabled',
    'Estreias temporariamente indisponíveis'
  );
  const row = await premiereRepository.findBySlug(slug);
  if (!row || !row.is_published) {
    throw createError(404, 'Estreia não encontrada', 'PREMIERE_NOT_FOUND');
  }
  let reminded = false;
  if (userId) {
    const set = await premiereRepository.userReminders(userId);
    reminded = set.has(row.id);
  }
  return { event: premiereRepository.mapEvent(row, reminded) };
}

async function remind(userId, eventId, profileId, meta = {}) {
  await featureFlagService.assertEnabled(
    'premieres_enabled',
    'Estreias temporariamente indisponíveis'
  );
  const row = await premiereRepository.findById(eventId);
  if (!row || !row.is_published) {
    throw createError(404, 'Estreia não encontrada', 'PREMIERE_NOT_FOUND');
  }
  await premiereRepository.setReminder({ eventId, userId, profileId });
  await auditRepository.write({
    actorId: userId,
    action: 'premiere.remind',
    entity: 'premiere_event',
    entityId: eventId,
    ip: meta.ip,
  });
  return { reminded: true, eventId };
}

async function unremind(userId, eventId) {
  await premiereRepository.removeReminder({ eventId, userId });
  return { reminded: false, eventId };
}

async function adminList() {
  return { events: await premiereRepository.adminList() };
}

async function adminCreate(actorId, body, meta = {}) {
  if (!body.slug || !body.title || !body.startsAt) {
    throw createError(400, 'slug, title e startsAt obrigatórios', 'VALIDATION');
  }
  const row = await premiereRepository.adminCreate(body);
  await auditRepository.write({
    actorId,
    action: 'premiere.created',
    entity: 'premiere_event',
    entityId: row.id,
    ip: meta.ip,
  });
  return { event: premiereRepository.mapEvent(row) };
}

async function adminUpdate(actorId, id, body, meta = {}) {
  const row = await premiereRepository.adminUpdate(id, body);
  if (!row) throw createError(404, 'Estreia não encontrada', 'PREMIERE_NOT_FOUND');
  await auditRepository.write({
    actorId,
    action: 'premiere.updated',
    entity: 'premiere_event',
    entityId: id,
    ip: meta.ip,
  });
  return { event: premiereRepository.mapEvent(row) };
}

module.exports = {
  list,
  getBySlug,
  remind,
  unremind,
  adminList,
  adminCreate,
  adminUpdate,
};
