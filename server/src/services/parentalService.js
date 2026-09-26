'use strict';

const profileRepository = require('../repositories/profileRepository');
const parentalRepository = require('../repositories/parentalRepository');
const { query } = require('../config/database');
const { createError } = require('../utils/errors');

async function assertOwnedProfile(userId, profileId) {
  const profile = await profileRepository.findOwned(profileId, userId);
  if (!profile) {
    throw createError(404, 'Perfil não encontrado', 'PROFILE_NOT_FOUND');
  }
  return profile;
}

async function listBlocked(userId, profileId) {
  await assertOwnedProfile(userId, profileId);
  return { blocked: await parentalRepository.listBlocked(profileId) };
}

async function blockTitle(userId, profileId, contentId) {
  await assertOwnedProfile(userId, profileId);
  const check = await query(`SELECT id FROM videos WHERE id = $1`, [contentId]);
  if (!check.rowCount) {
    throw createError(404, 'Título não encontrado', 'CONTENT_NOT_FOUND');
  }
  await parentalRepository.block(profileId, contentId, userId);
  return { blocked: true, contentId };
}

async function unblockTitle(userId, profileId, contentId) {
  await assertOwnedProfile(userId, profileId);
  const ok = await parentalRepository.unblock(profileId, contentId);
  if (!ok) {
    throw createError(404, 'Título não estava bloqueado', 'NOT_BLOCKED');
  }
  return { unblocked: true, contentId };
}

async function assertNotBlocked(profileId, contentId) {
  if (!profileId) return;
  const blocked = await parentalRepository.isBlocked(profileId, contentId);
  if (blocked) {
    throw createError(403, 'Este título está bloqueado neste perfil', 'TITLE_BLOCKED');
  }
}

module.exports = {
  listBlocked,
  blockTitle,
  unblockTitle,
  assertNotBlocked,
};
