'use strict';

/**
 * Camada mínima de autorização / ownership (Fase 27).
 * Backend é a autoridade — não duplicar estas regras no cliente.
 */
const profileRepository = require('../repositories/profileRepository');
const { createError } = require('../utils/errors');

async function assertProfileOwned(userId, profileId, { required = true } = {}) {
  if (!profileId) {
    if (required) throw createError(400, 'Perfil obrigatório', 'PROFILE_REQUIRED');
    return null;
  }
  const row = await profileRepository.findOwned(profileId, userId);
  if (!row) {
    throw createError(404, 'Perfil não encontrado', 'PROFILE_NOT_FOUND');
  }
  return row;
}

function assertAdminRole(user) {
  const roles = user?.roles || [];
  const ok =
    user?.isAdmin ||
    roles.includes('admin') ||
    roles.includes('super_admin') ||
    roles.includes('moderator');
  if (!ok) {
    throw createError(403, 'Permissão insuficiente', 'FORBIDDEN');
  }
  return true;
}

module.exports = {
  assertProfileOwned,
  assertAdminRole,
};
