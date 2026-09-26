'use strict';

const engagementRepository = require('../repositories/engagementRepository');
const profileRepository = require('../repositories/profileRepository');
const { createError } = require('../utils/errors');

async function getWatchHistory(userId, profileId) {
  if (!profileId) {
    throw createError(400, 'Perfil obrigatório', 'PROFILE_REQUIRED');
  }
  const owned = await profileRepository.findOwned(profileId, userId);
  if (!owned) {
    throw createError(403, 'Perfil inválido', 'INVALID_PROFILE');
  }
  const items = await engagementRepository.listWatchHistory(profileId);
  return { items };
}

async function clearHistory(userId, profileId) {
  if (!profileId) throw createError(400, 'Perfil obrigatório', 'PROFILE_REQUIRED');
  const owned = await profileRepository.findOwned(profileId, userId);
  if (!owned) throw createError(403, 'Perfil inválido', 'INVALID_PROFILE');
  const deleted = await engagementRepository.clearWatchHistory(profileId);
  return { cleared: true, deleted };
}

async function removeHistoryItem(userId, profileId, contentId) {
  if (!profileId) throw createError(400, 'Perfil obrigatório', 'PROFILE_REQUIRED');
  const owned = await profileRepository.findOwned(profileId, userId);
  if (!owned) throw createError(403, 'Perfil inválido', 'INVALID_PROFILE');
  const ok = await engagementRepository.removeFromHistory(profileId, contentId);
  if (!ok) throw createError(404, 'Item não encontrado no histórico', 'NOT_FOUND');
  return { removed: true };
}

async function hideContinueItem(userId, profileId, contentId) {
  if (!profileId) throw createError(400, 'Perfil obrigatório', 'PROFILE_REQUIRED');
  const owned = await profileRepository.findOwned(profileId, userId);
  if (!owned) throw createError(403, 'Perfil inválido', 'INVALID_PROFILE');
  const ok = await engagementRepository.hideFromContinue(profileId, contentId);
  if (!ok) throw createError(404, 'Item não encontrado', 'NOT_FOUND');
  return { hidden: true };
}

async function getComingSoon(maturityMax = 18) {
  return { items: await engagementRepository.listComingSoon(maturityMax) };
}

async function getNewReleases(maturityMax = 18) {
  return { items: await engagementRepository.listNewReleases(maturityMax) };
}

module.exports = {
  getWatchHistory,
  clearHistory,
  removeHistoryItem,
  hideContinueItem,
  getComingSoon,
  getNewReleases,
};
