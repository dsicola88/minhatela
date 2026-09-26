'use strict';

const creatorRepository = require('../repositories/creatorRepository');
const creatorContentRepository = require('../repositories/creatorContentRepository');
const userRepository = require('../repositories/userRepository');
const auditRepository = require('../repositories/auditRepository');
const { createError } = require('../utils/errors');
const { assertPositiveKz } = require('../utils/money');

function mapCreator(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    displayName: row.display_name,
    bio: row.bio,
    country: row.country,
    status: row.status,
    bankIban: row.bank_iban,
    bankName: row.bank_name,
    bankAccountName: row.bank_account_name,
    verifiedAt: row.verified_at,
    createdAt: row.created_at,
  };
}

function mapContent(row) {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    workflowStatus: row.workflow_status,
    monetization: row.monetization,
    posterUrl: row.poster_url,
    rentalPriceKz: row.rental_price_kz,
    durationSeconds: row.duration_seconds,
    releaseYear: row.release_year,
    isPublished: row.is_published,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    rejectionReason: row.rejection_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    creatorDisplayName: row.creator_display_name,
    creatorEmail: row.creator_email,
  };
}

async function requireActiveCreator(userId) {
  const creator = await creatorRepository.findByUserId(userId);
  if (!creator) {
    throw createError(403, 'Conta de criador necessária', 'CREATOR_REQUIRED');
  }
  if (creator.status !== 'active') {
    throw createError(
      403,
      'A sua conta de criador ainda não está activa',
      'CREATOR_NOT_ACTIVE',
      { status: creator.status }
    );
  }
  return creator;
}

async function registerCreator(userId, body) {
  const existing = await creatorRepository.findByUserId(userId);
  if (existing) {
    return { creator: mapCreator(existing), alreadyExists: true };
  }

  if (!body.displayName) {
    throw createError(400, 'Nome artístico / produtora é obrigatório', 'VALIDATION');
  }

  const creator = await creatorRepository.create({
    userId,
    type: body.type || 'creator',
    displayName: body.displayName.trim(),
    bio: body.bio,
    bankIban: body.bankIban,
    bankName: body.bankName,
    bankAccountName: body.bankAccountName,
  });

  await userRepository.assignRole(userId, 'creator');

  return { creator: mapCreator(creator), alreadyExists: false };
}

async function getStudioHome(userId) {
  const creator = await creatorRepository.findByUserId(userId);
  if (!creator) {
    return { creator: null, contents: [], analytics: null };
  }

  const [contents, analytics] = await Promise.all([
    creatorContentRepository.listByCreator(creator.id),
    creator.status === 'active'
      ? creatorContentRepository.creatorAnalytics(creator.id)
      : null,
  ]);

  return {
    creator: mapCreator(creator),
    contents: contents.map(mapContent),
    analytics,
  };
}

async function createContent(userId, body) {
  const creator = await requireActiveCreator(userId);

  if (!body.title || !body.synopsisShort || !body.posterUrl) {
    throw createError(400, 'Título, sinopse e poster são obrigatórios', 'VALIDATION');
  }

  if (body.monetization === 'tvod') {
    assertPositiveKz(body.rentalPriceKz || 0);
  }

  const row = await creatorContentRepository.createDraft({
    ...body,
    creatorId: creator.id,
    creatorDisplayName: creator.display_name,
  });

  return { content: mapContent(row) };
}

async function updateContent(userId, contentId, body) {
  const creator = await requireActiveCreator(userId);
  const row = await creatorContentRepository.updateOwnedDraft(contentId, creator.id, body);
  if (!row) {
    throw createError(404, 'Rascunho não encontrado ou não editável', 'NOT_FOUND');
  }
  return { content: mapContent(row) };
}

async function submitContent(userId, contentId) {
  const creator = await requireActiveCreator(userId);
  const row = await creatorContentRepository.submitForReview(contentId, creator.id);
  if (!row) {
    throw createError(404, 'Conteúdo não pode ser submetido', 'NOT_SUBMISSION');
  }

  await auditRepository.write({
    actorId: userId,
    action: 'CONTENT_SUBMITTED',
    entity: 'video',
    entityId: contentId,
    metadata: { creatorId: creator.id },
  });

  return { content: mapContent(row) };
}

async function adminListCreators() {
  const rows = await creatorRepository.listPending();
  return {
    creators: rows.map((row) => ({
      ...mapCreator(row),
      email: row.email,
      fullName: row.full_name,
    })),
  };
}

async function adminReviewCreator(adminId, creatorId, status) {
  if (!['active', 'rejected', 'suspended'].includes(status)) {
    throw createError(400, 'Estado inválido', 'VALIDATION');
  }
  const row = await creatorRepository.updateStatus(creatorId, status);
  if (!row) throw createError(404, 'Criador não encontrado', 'NOT_FOUND');

  await auditRepository.write({
    actorId: adminId,
    action: status === 'active' ? 'CREATOR_APPROVED' : 'CREATOR_REJECTED',
    entity: 'creator',
    entityId: creatorId,
    metadata: { status },
  });

  return { creator: mapCreator(row) };
}

async function adminListContent(status = 'submitted') {
  const rows = await creatorContentRepository.listForModeration(status);
  return { contents: rows.map(mapContent) };
}

async function adminModerateContent(adminId, contentId, { action, rejectionReason }) {
  const map = {
    approve: 'published',
    publish: 'published',
    reject: 'rejected',
    review: 'under_review',
  };
  const status = map[action];
  if (!status) {
    throw createError(400, 'Acção inválida', 'VALIDATION');
  }

  // Criador NÃO pode aprovar o próprio conteúdo — já garantido por requireRoles admin
  const row = await creatorContentRepository.moderate(contentId, {
    status,
    reviewerId: adminId,
    rejectionReason: status === 'rejected' ? rejectionReason || 'Rejeitado pela moderação' : null,
  });

  if (!row) {
    throw createError(404, 'Conteúdo não encontrado para moderação', 'NOT_FOUND');
  }

  await auditRepository.write({
    actorId: adminId,
    action: status === 'published' ? 'CONTENT_PUBLISHED' : 'CONTENT_REJECTED',
    entity: 'video',
    entityId: contentId,
    metadata: { status, rejectionReason: rejectionReason || null },
  });

  return { content: mapContent(row) };
}

module.exports = {
  registerCreator,
  getStudioHome,
  createContent,
  updateContent,
  submitContent,
  adminListCreators,
  adminReviewCreator,
  adminListContent,
  adminModerateContent,
};
