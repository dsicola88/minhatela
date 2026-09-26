'use strict';

const peopleFeedbackRepository = require('../repositories/peopleFeedbackRepository');
const featureFlagService = require('./featureFlagService');
const { createError } = require('../utils/errors');

async function getPerson(slug) {
  const person = await peopleFeedbackRepository.getPerson(slug);
  if (!person) throw createError(404, 'Pessoa não encontrada', 'PERSON_NOT_FOUND');
  return person;
}

async function castForContent(contentId) {
  return { people: await peopleFeedbackRepository.listByContent(contentId) };
}

async function chaptersForContent(contentId) {
  return { chapters: await peopleFeedbackRepository.listChapters(contentId) };
}

async function submitFeedback(userId, body, meta = {}) {
  await featureFlagService.assertEnabled(
    'playback_feedback_enabled',
    'Feedback temporariamente indisponível'
  );
  const score = Number(body?.score);
  if (!body?.contentId || !Number.isInteger(score) || score < 1 || score > 5) {
    throw createError(400, 'contentId e score (1-5) obrigatórios', 'VALIDATION');
  }
  const row = await peopleFeedbackRepository.saveFeedback({
    userId,
    profileId: meta.profileId || body.profileId,
    contentId: body.contentId,
    sessionId: body.sessionId,
    score,
    nps: body.nps,
    comment: body.comment ? String(body.comment).slice(0, 500) : null,
  });
  return {
    id: row.id,
    score: row.score,
    nps: row.nps,
    createdAt: row.created_at,
    message: 'Obrigado pelo feedback!',
  };
}

async function challengeStillWatching(userId, body) {
  await featureFlagService.assertEnabled(
    'still_watching_enabled',
    'Desafio indisponível'
  );
  if (!body?.sessionId) {
    throw createError(400, 'sessionId obrigatório', 'VALIDATION');
  }
  const row = await peopleFeedbackRepository.createStillWatching({
    userId,
    sessionId: body.sessionId,
    contentId: body.contentId,
  });
  return {
    id: row.id,
    challengedAt: row.challenged_at,
    expiresAt: row.expires_at,
    status: row.status,
    message: 'Ainda está a ver?',
  };
}

async function confirmStillWatching(userId, challengeId) {
  const row = await peopleFeedbackRepository.confirmStillWatching({
    challengeId,
    userId,
  });
  if (!row) {
    throw createError(410, 'Desafio expirado ou inválido', 'CHALLENGE_EXPIRED');
  }
  return { id: row.id, status: row.status, confirmedAt: row.confirmed_at };
}

async function pendingStillWatching(userId, sessionId) {
  const row = await peopleFeedbackRepository.getPendingStillWatching(userId, sessionId);
  if (!row) return { pending: null };
  return {
    pending: {
      id: row.id,
      challengedAt: row.challenged_at,
      expiresAt: row.expires_at,
      contentId: row.content_id,
    },
  };
}

module.exports = {
  getPerson,
  castForContent,
  chaptersForContent,
  submitFeedback,
  challengeStillWatching,
  confirmStillWatching,
  pendingStillWatching,
};
