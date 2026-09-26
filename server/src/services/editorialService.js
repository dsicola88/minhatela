'use strict';

const editorialRepository = require('../repositories/editorialRepository');
const featureFlagService = require('./featureFlagService');
const auditRepository = require('../repositories/auditRepository');
const { createError } = require('../utils/errors');

async function listForHome(maturityMax = 18) {
  const enabled = await featureFlagService.isEnabled('editorial_collections_enabled', true);
  if (!enabled) return [];
  return editorialRepository.listPublished({ placement: 'home', maturityMax });
}

async function getCollection(slug, maturityMax = 18) {
  const row = await editorialRepository.getBySlug(slug, maturityMax);
  if (!row || !row.isPublished) {
    throw createError(404, 'Colecção não encontrada', 'COLLECTION_NOT_FOUND');
  }
  return row;
}

async function adminList() {
  return { collections: await editorialRepository.adminList() };
}

async function adminCreate(body, meta = {}) {
  if (!body?.slug || !body?.title) {
    throw createError(400, 'slug e title obrigatórios', 'VALIDATION');
  }
  const slug = String(body.slug)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-|-$/g, '');
  const created = await editorialRepository.adminCreate({
    slug,
    title: body.title.trim(),
    subtitle: body.subtitle,
    sortOrder: body.sortOrder,
    placement: body.placement || 'home',
    isPublished: body.isPublished !== false,
    createdBy: meta.actorId,
  });
  await auditRepository.write({
    actorId: meta.actorId,
    action: 'editorial.created',
    entity: 'editorial_collection',
    entityId: created.id,
    metadata: { slug: created.slug },
    ip: meta.ip,
  });
  return created;
}

async function adminUpdate(id, body, meta = {}) {
  const updated = await editorialRepository.adminUpdate(id, body);
  if (!updated) throw createError(404, 'Colecção não encontrada', 'COLLECTION_NOT_FOUND');
  await auditRepository.write({
    actorId: meta.actorId,
    action: 'editorial.updated',
    entity: 'editorial_collection',
    entityId: id,
    metadata: body,
    ip: meta.ip,
  });
  return updated;
}

async function adminSetItems(id, items, meta = {}) {
  const result = await editorialRepository.adminSetItems(id, items || []);
  if (!result) throw createError(404, 'Colecção não encontrada', 'COLLECTION_NOT_FOUND');
  await auditRepository.write({
    actorId: meta.actorId,
    action: 'editorial.items_set',
    entity: 'editorial_collection',
    entityId: id,
    metadata: { count: (items || []).length },
    ip: meta.ip,
  });
  return result;
}

module.exports = {
  listForHome,
  getCollection,
  adminList,
  adminCreate,
  adminUpdate,
  adminSetItems,
};
