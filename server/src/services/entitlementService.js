'use strict';

const contentRepository = require('../repositories/contentRepository');
const accessControlService = require('./accessControlService');
const rightsService = require('./rightsService');
const rbacService = require('./rbacService');
const { createError } = require('../utils/errors');
const { logger } = require('../utils/logger');

/**
 * Única porta de decisão: o utilizador X pode assistir ao conteúdo Y agora?
 * Rights (legal) + entitlement comercial (SVOD/TVOD/pack) + tenant.
 */
async function authorizeWatch({
  userId,
  content,
  territory = 'AO',
  tenantId = null,
  modality = null,
  requirePublished = true,
}) {
  if (!content) {
    throw createError(404, 'Conteúdo não encontrado', 'CONTENT_NOT_FOUND');
  }

  const resolvedTenant = tenantId || (await rbacService.tenantIdForUser(userId));
  if (content.tenant_id && resolvedTenant && content.tenant_id !== resolvedTenant) {
    logger.info('entitlement.tenant_mismatch', {
      userId,
      contentId: content.id,
      contentTenant: content.tenant_id,
      userTenant: resolvedTenant,
    });
    throw createError(404, 'Conteúdo não encontrado', 'CONTENT_NOT_FOUND');
  }

  if (
    requirePublished &&
    content.is_published === false &&
    content.isPublished === false
  ) {
    throw createError(403, 'Conteúdo indisponível', 'NOT_PUBLISHED');
  }

  const mon = content.monetization || 'avod';
  const mode = modality || (mon === 'live' ? 'live' : mon);

  const rights = await rightsService.canDistribute({
    contentId: content.id,
    territory,
    modality: mode === 'live' ? 'live' : mon,
    tenantId: resolvedTenant,
  });

  if (!rights.ok) {
    throw createError(403, 'Conteúdo indisponível neste território', 'RIGHTS_DENIED', {
      reason: rights.reason,
    });
  }

  const access = await accessControlService.resolveAccess(userId, content);
  if (!access.canWatch) {
    const err = createError(403, access.message, access.denialCode || 'FORBIDDEN', { access });
    throw err;
  }

  return {
    canWatch: true,
    rights,
    access,
    tenantId: resolvedTenant,
  };
}

async function authorizePublishedContent(userId, contentId, opts = {}) {
  const row = await contentRepository.findPublishedById(contentId);
  if (!row) {
    throw createError(404, 'Conteúdo não encontrado', 'CONTENT_NOT_FOUND');
  }
  const { mapContentPublic } = require('../utils/mappers');
  const content = mapContentPublic(row);
  content.tenant_id = row.tenant_id || null;
  content.is_published = row.is_published;
  return authorizeWatch({
    userId,
    content,
    territory: opts.territory,
    tenantId: opts.tenantId,
    modality: opts.modality,
  });
}

module.exports = { authorizeWatch, authorizePublishedContent };
