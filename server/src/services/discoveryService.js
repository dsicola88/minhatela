'use strict';

const discoveryRepository = require('../repositories/discoveryRepository');
const engagementSocialRepository = require('../repositories/engagementSocialRepository');
const profileRepository = require('../repositories/profileRepository');
const contentRepository = require('../repositories/contentRepository');
const analyticsRepository = require('../repositories/analyticsRepository');
const notificationService = require('./notificationService');
const { createError } = require('../utils/errors');

async function search(userId, query) {
  const profileId = query.profileId;
  if (profileId) {
    const owned = await profileRepository.findOwned(profileId, userId);
    if (!owned) throw createError(403, 'Perfil inválido', 'INVALID_PROFILE');
  }

  const result = await discoveryRepository.search({
    q: query.q,
    limit: query.limit,
    userId,
    profileId,
    kind: query.kind,
    monetization: query.monetization,
    genre: query.genre,
    year: query.year,
  });

  if (result.query && result.query.length >= 2) {
    await analyticsRepository.track({
      eventName: 'search_performed',
      userId,
      profileId,
      metadata: { query: result.query, results: result.total, filters: result.filters },
    });
    try {
      await require('./phase24Service').trackSearchEvent({
        userId,
        profileId,
        query: result.query,
        resultsCount: result.total,
      });
    } catch {
      /* optional */
    }
  }

  return result;
}

async function facets() {
  const genres = await engagementSocialRepository.listGenres();
  return {
    kinds: [
      { id: 'movie', label: 'Filmes' },
      { id: 'series', label: 'Séries' },
    ],
    monetization: [
      { id: 'avod', label: 'Grátis' },
      { id: 'svod', label: 'Premium' },
      { id: 'tvod', label: 'Aluguer' },
    ],
    genres: genres.map((g) => ({ id: g.genre, label: g.genre, count: g.count })),
  };
}

async function favorites(userId, profileId) {
  const owned = await profileRepository.findOwned(profileId, userId);
  if (!owned) throw createError(403, 'Perfil inválido', 'INVALID_PROFILE');
  return { favorites: await discoveryRepository.listFavorites(profileId) };
}

async function toggleFavorite(userId, profileId, contentId, add = true) {
  const owned = await profileRepository.findOwned(profileId, userId);
  if (!owned) throw createError(403, 'Perfil inválido', 'INVALID_PROFILE');

  if (add) {
    await discoveryRepository.addFavorite(profileId, contentId);
    await analyticsRepository.track({
      eventName: 'content_added_favorite',
      userId,
      profileId,
      contentId,
    });
  } else {
    await discoveryRepository.removeFavorite(profileId, contentId);
  }

  return { favorited: add };
}

async function related(contentId) {
  return { related: await discoveryRepository.related(contentId) };
}

async function rateContent(userId, profileId, contentId, rating) {
  if (!profileId) throw createError(400, 'Perfil obrigatório', 'PROFILE_REQUIRED');
  const owned = await profileRepository.findOwned(profileId, userId);
  if (!owned) throw createError(403, 'Perfil inválido', 'INVALID_PROFILE');

  let value;
  if (rating === 'up' || rating === 1 || rating === '1') value = 5;
  else if (rating === 'down' || rating === -1 || rating === '-1') value = 1;
  else {
    value = Number(rating?.stars ?? rating);
  }
  if (!Number.isFinite(value) || value < 1 || value > 5) {
    throw createError(400, 'Rating inválido (estrelas 1–5)', 'VALIDATION');
  }
  value = Math.round(value);

  const content = await contentRepository.findPublishedById(contentId);
  if (!content) throw createError(404, 'Conteúdo não encontrado', 'CONTENT_NOT_FOUND');

  await engagementSocialRepository.upsertRating(profileId, contentId, value);

  let community = { community_rating_avg: null, community_rating_count: 0 };
  try {
    community = await require('../repositories/phase26Repository').refreshCommunityRating(
      contentId
    );
  } catch {
    /* optional */
  }

  await analyticsRepository.track({
    eventName: 'content_star_rating',
    userId,
    profileId,
    contentId,
    metadata: { stars: value },
  });

  const stats = await engagementSocialRepository.ratingStats(contentId);
  return {
    rating: value,
    stars: value,
    stats: {
      up: stats.up,
      down: stats.down,
      avg: community.community_rating_avg,
      count: community.community_rating_count,
    },
    communityRating: {
      avg: community.community_rating_avg,
      count: community.community_rating_count,
    },
  };
}

async function getSocialState(userId, profileId, contentId) {
  const [rating, stats, reminded, community] = await Promise.all([
    profileId ? engagementSocialRepository.getRating(profileId, contentId) : null,
    engagementSocialRepository.ratingStats(contentId),
    userId ? engagementSocialRepository.hasReminder(userId, contentId) : false,
    contentRepository.findPublishedById(contentId).catch(() => null),
  ]);
  const stars = rating != null ? Number(rating) : null;
  return {
    userRating: stars,
    stars,
    legacyThumbs: stars >= 4 ? 'up' : stars != null && stars <= 2 ? 'down' : null,
    stats: { up: stats.up || 0, down: stats.down || 0 },
    communityRating: {
      avg: community?.community_rating_avg ?? null,
      count: community?.community_rating_count ?? 0,
    },
    reminded: Boolean(reminded),
  };
}

async function setReminder(userId, contentId, enable = true) {
  const content = await contentRepository.findPublishedById(contentId);
  if (!content) throw createError(404, 'Conteúdo não encontrado', 'CONTENT_NOT_FOUND');

  if (enable) {
    await engagementSocialRepository.addReminder(userId, contentId);
    await notificationService.notify({
      userId,
      type: 'reminder_set',
      title: 'Lembrete activado',
      body: `Avisamos quando «${content.title}» estiver disponível.`,
      data: { contentId },
    });
  } else {
    await engagementSocialRepository.removeReminder(userId, contentId);
  }

  return { reminded: enable };
}

async function listReminders(userId) {
  return { items: await engagementSocialRepository.listReminders(userId) };
}

module.exports = {
  search,
  facets,
  favorites,
  toggleFavorite,
  related,
  rateContent,
  getSocialState,
  setReminder,
  listReminders,
};
