'use strict';

const suggestRepository = require('../repositories/suggestRepository');
const profileRepository = require('../repositories/profileRepository');
const featureFlagService = require('./featureFlagService');

async function suggest(userId, { q, limit, profileId }) {
  const enabled = await featureFlagService.isEnabled('search_suggest_enabled', true);
  if (!enabled) return { query: q, titles: [], genres: [], creators: [], disabled: true };

  let maturityMax = 18;
  if (profileId && userId) {
    const profile = await profileRepository.findOwned(profileId, userId);
    maturityMax = profile?.maturity_max ?? 18;
  }
  return suggestRepository.suggest({ q, limit, maturityMax });
}

module.exports = { suggest };
