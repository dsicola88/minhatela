'use strict';

/**
 * Autorização / ownership — o backend é a autoridade.
 * Roles JWT descrevem capacidades; permissions em role_permissions confirmam.
 */
const profileRepository = require('../repositories/profileRepository');
const rbacService = require('./rbacService');
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
  if (!rbacService.isStaff(roles)) {
    throw createError(403, 'Permissão insuficiente', 'FORBIDDEN');
  }
  return true;
}

function assertSuperAdmin(user) {
  if (!rbacService.isSuperAdmin(user?.roles || [])) {
    throw createError(403, 'Apenas SuperAdmin', 'FORBIDDEN');
  }
  return true;
}

async function assertPermission(user, permissionCode) {
  const roles = user?.roles || [];
  if (rbacService.isSuperAdmin(roles)) return true;
  const perms = await rbacService.permissionsForRoles(roles);
  if (!rbacService.hasPermission(perms, permissionCode)) {
    throw createError(403, 'Permissão insuficiente', 'FORBIDDEN');
  }
  return true;
}

function requirePermission(permissionCode) {
  return async (req, _res, next) => {
    try {
      await assertPermission(req.user, permissionCode);
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

async function assertSameTenant(user, resourceTenantId) {
  if (!resourceTenantId) return true;
  if (rbacService.isSuperAdmin(user?.roles || [])) return true;
  const tenantId = user?.tenantId || (await rbacService.tenantIdForUser(user.id));
  if (tenantId && String(resourceTenantId) !== String(tenantId)) {
    throw createError(404, 'Recurso não encontrado', 'NOT_FOUND');
  }
  return true;
}

module.exports = {
  assertProfileOwned,
  assertAdminRole,
  assertSuperAdmin,
  assertPermission,
  requirePermission,
  assertSameTenant,
};
