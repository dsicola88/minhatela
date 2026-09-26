'use strict';

const forYouRepository = require('../repositories/forYouRepository');
const profileRepository = require('../repositories/profileRepository');
const discoveryRepository = require('../repositories/discoveryRepository');
const recommendationService = require('./recommendationService');
const featureFlagService = require('./featureFlagService');
const auditRepository = require('./../repositories/auditRepository');
const { createError } = require('../utils/errors');

function mapPref(row) {
  if (!row) return { notInterested: false, markedWatched: false };
  return {
    notInterested: Boolean(row.not_interested),
    markedWatched: Boolean(row.marked_watched),
    updatedAt: row.updated_at,
  };
}

async function assertProfile(userId, profileId) {
  if (!profileId) throw createError(400, 'Perfil obrigatório', 'PROFILE_REQUIRED');
  const owned = await profileRepository.findOwned(profileId, userId);
  if (!owned) throw createError(403, 'Perfil inválido', 'INVALID_PROFILE');
  return owned;
}

async function setNotInterested(userId, profileId, contentId, value = true, meta = {}) {
  await featureFlagService.assertEnabled(
    'not_interested_enabled',
    'Preferência temporariamente indisponível'
  );
  await assertProfile(userId, profileId);
  const row = await forYouRepository.upsertPreference({
    profileId,
    contentId,
    notInterested: value,
  });
  await auditRepository.write({
    actorId: userId,
    action: value ? 'title.not_interested' : 'title.interested_again',
    entity: 'video',
    entityId: contentId,
    metadata: { profileId },
    ip: meta.ip,
  });
  return { preference: mapPref(row), contentId };
}

async function markWatched(userId, profileId, contentId, meta = {}) {
  await assertProfile(userId, profileId);
  const result = await forYouRepository.markWatchedInProgress(profileId, contentId);
  if (!result) throw createError(404, 'Conteúdo não encontrado', 'CONTENT_NOT_FOUND');
  await auditRepository.write({
    actorId: userId,
    action: 'title.marked_watched',
    entity: 'video',
    entityId: contentId,
    metadata: { profileId },
    ip: meta.ip,
  });
  return result;
}

async function unmarkWatched(userId, profileId, contentId) {
  await assertProfile(userId, profileId);
  return forYouRepository.unmarkWatched(profileId, contentId);
}

async function getPreference(userId, profileId, contentId) {
  await assertProfile(userId, profileId);
  const row = await forYouRepository.getPreference(profileId, contentId);
  return { preference: mapPref(row), contentId };
}

async function hub(userId, profileId) {
  await featureFlagService.assertEnabled('for_you_hub_enabled', 'Hub Para si indisponível');
  const profile = await assertProfile(userId, profileId);
  const maturityMax = profile.maturity_max ?? 18;
  const blocked = await forYouRepository.listNotInterestedIds(profileId);
  const blockedSet = new Set(blocked);

  const [forYou, because, originals, favorites] = await Promise.all([
    recommendationService.forProfile(profileId, 24),
    recommendationService.becauseYouWatched(profileId, 12),
    forYouRepository.listOriginals(maturityMax, 18),
    discoveryRepository.listFavorites(profileId).catch(() => []),
  ]);

  const filter = (items) =>
    (items || []).filter((i) => !blockedSet.has(i.id) && (i.maturityRating ?? 12) <= maturityMax);

  const originalCards = originals.map((row) => ({
    ...discoveryRepository.mapCard(row),
    isOriginal: true,
    badge: 'ORIGINAL',
  }));

  return {
    profileId,
    rows: [
      {
        id: 'for-you',
        title: 'Para si',
        videos: filter(forYou),
      },
      because?.items?.length
        ? {
            id: 'because',
            title: `Porque assistiu a ${because.seedTitle}`,
            videos: filter(because.items),
          }
        : null,
      {
        id: 'originals',
        title: 'Originais MinhaTela',
        videos: filter(originalCards),
      },
      favorites?.length
        ? {
            id: 'my-list',
            title: 'A Minha Lista',
            videos: filter(favorites),
          }
        : null,
    ].filter(Boolean),
    notInterestedCount: blocked.length,
  };
}

async function listOriginalsRow(maturityMax = 18) {
  try {
    await featureFlagService.assertEnabled('originals_row_enabled');
  } catch {
    return [];
  }
  const rows = await forYouRepository.listOriginals(maturityMax, 16);
  return rows.map((row) => ({
    ...discoveryRepository.mapCard(row),
    isOriginal: true,
    badge: 'ORIGINAL',
  }));
}

/**
 * Filtra listas de recomendação removendo «não tenho interesse».
 */
async function filterNotInterested(profileId, items) {
  if (!profileId || !items?.length) return items || [];
  try {
    await featureFlagService.assertEnabled('not_interested_enabled');
  } catch {
    return items;
  }
  const ids = await forYouRepository.listNotInterestedIds(profileId);
  if (!ids.length) return items;
  const set = new Set(ids);
  return items.filter((i) => !set.has(i.id));
}

module.exports = {
  setNotInterested,
  markWatched,
  unmarkWatched,
  getPreference,
  hub,
  listOriginalsRow,
  filterNotInterested,
  mapPref,
};
