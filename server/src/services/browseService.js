'use strict';

const browseRepository = require('../repositories/browseRepository');
const profileRepository = require('../repositories/profileRepository');
const parentalRepository = require('../repositories/parentalRepository');
const featureFlagService = require('./featureFlagService');
const { createError } = require('../utils/errors');

async function resolveMaturity(userId, profileId) {
  if (!profileId || !userId) return 18;
  const profile = await profileRepository.findOwned(profileId, userId);
  return profile?.maturity_max ?? 18;
}

async function filterBlocked(profileId, items) {
  if (!profileId || !items?.length) return items || [];
  const blocked = new Set(await parentalRepository.listBlockedIds(profileId));
  return items.filter((v) => !blocked.has(v.id) && !blocked.has(v.seriesId));
}

async function newAndHot({ userId, profileId }) {
  await featureFlagService.assertEnabled(
    'new_and_hot_enabled',
    'Hub Novidades & Em Alta temporariamente indisponível'
  );
  const maturityMax = await resolveMaturity(userId, profileId);
  const data = await browseRepository.getNewAndHot(maturityMax);
  const tabs = [];
  for (const tab of data.tabs) {
    tabs.push({
      ...tab,
      items: await filterBlocked(profileId, tab.items),
    });
  }
  return { tabs };
}

async function genres() {
  return { genres: await browseRepository.listGenres() };
}

async function byGenre({ userId, profileId, genre }) {
  if (!genre) throw createError(400, 'Género obrigatório', 'VALIDATION');
  const maturityMax = await resolveMaturity(userId, profileId);
  const items = await browseRepository.listByGenre(genre, maturityMax, 48);
  return {
    genre,
    items: await filterBlocked(profileId, items),
  };
}

async function browseRows({ userId, profileId }) {
  const maturityMax = await resolveMaturity(userId, profileId);
  const data = await browseRepository.browseHome(maturityMax);
  const rows = [];
  for (const row of data.rows) {
    const videos = await filterBlocked(profileId, row.videos);
    if (videos.length) rows.push({ ...row, videos });
  }
  return { genres: data.genres, rows };
}

module.exports = {
  newAndHot,
  genres,
  byGenre,
  browseRows,
};
