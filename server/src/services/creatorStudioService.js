'use strict';

const creatorRepository = require('../repositories/creatorRepository');
const creatorContentRepository = require('../repositories/creatorContentRepository');
const userRepository = require('../repositories/userRepository');
const auditRepository = require('../repositories/auditRepository');
const { createError } = require('../utils/errors');
const { assertPositiveKz } = require('../utils/money');

function mapCreator(row) {
  if (!row) return null;
  const { creatorTypeLabel, workflowLabel } = require('../utils/opsCopy');
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    typeLabel: creatorTypeLabel(row.type),
    displayName: row.display_name,
    bio: row.bio,
    country: row.country,
    status: row.status,
    statusLabel: workflowLabel(row.status),
    bankIban: row.bank_iban,
    bankName: row.bank_name,
    bankAccountName: row.bank_account_name,
    verifiedAt: row.verified_at,
    createdAt: row.created_at,
  };
}

function mapContent(row) {
  const { workflowLabel, monetizationLabel } = require('../utils/opsCopy');
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    workflowStatus: row.workflow_status,
    workflowLabel: workflowLabel(row.workflow_status),
    monetization: row.monetization,
    monetizationLabel: monetizationLabel(row.monetization),
    synopsisShort: row.synopsis_short || null,
    posterUrl: row.poster_url,
    bunnyVideoId: row.bunny_video_id,
    encodingStatus: row.encoding_status || null,
    hasVideo: Boolean(row.bunny_video_id),
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

function studioGuide(creator, contents) {
  if (!creator) {
    return {
      step: 1,
      of: 4,
      title: 'Candidatura ao estúdio',
      body: 'A MinhaTela revê quem entra. Só depois envia filmes para o catálogo da app.',
    };
  }
  if (creator.status === 'pending') {
    return {
      step: 2,
      of: 4,
      title: 'A equipa está a ver a sua candidatura',
      body: 'Não precisa de voltar a enviar. Recebe um aviso quando puder carregar filmes.',
    };
  }
  if (creator.status === 'rejected') {
    return {
      step: 1,
      of: 4,
      title: 'Candidatura não aceite',
      body: 'Fale com a MinhaTela se quiser voltar a candidatar-se.',
    };
  }
  if (creator.status === 'suspended') {
    return {
      step: 0,
      of: 4,
      title: 'Estúdio suspenso',
      body: 'Os envios estão parados até a equipa decidir.',
    };
  }
  const list = contents || [];
  if (list.some((c) => c.workflowStatus === 'published')) {
    return {
      step: 4,
      of: 4,
      title: 'Os seus títulos estão na app',
      body: 'Quem abre a MinhaTela já os pode ver. Pode enviar mais quando quiser.',
    };
  }
  if (list.some((c) => ['submitted', 'under_review'].includes(c.workflowStatus))) {
    return {
      step: 3,
      of: 4,
      title: 'Filme na mesa da equipa',
      body: 'Moderação decide se entra no catálogo. Recebe aviso da decisão.',
    };
  }
  return {
    step: 3,
    of: 4,
    title: 'Envie o primeiro filme',
    body: 'Título, cartaz e ficheiro. A equipa publica — não vai directo para a app.',
  };
}

async function requireActiveCreator(userId) {
  const creator = await creatorRepository.findByUserId(userId);
  if (!creator) {
    throw createError(403, 'Peça o estúdio primeiro', 'CREATOR_REQUIRED');
  }
  if (creator.status !== 'active') {
    throw createError(
      403,
      'A equipa ainda não aceitou o seu estúdio',
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

  try {
    await require('./notificationService').notify({
      userId,
      type: 'creator_applied',
      title: 'Candidatura recebida',
      body: 'A equipa MinhaTela vai rever o seu estúdio. Recebe um aviso quando puder enviar filmes.',
      data: { creatorId: creator.id },
    });
  } catch {
    /* notify best-effort */
  }

  return { creator: mapCreator(creator), alreadyExists: false };
}

async function getStudioHome(userId) {
  const creator = await creatorRepository.findByUserId(userId);
  if (!creator) {
    return { creator: null, contents: [], analytics: null, guide: studioGuide(null, []) };
  }

  const [contents, analytics] = await Promise.all([
    creatorContentRepository.listByCreator(creator.id),
    creator.status === 'active'
      ? creatorContentRepository.creatorAnalytics(creator.id)
      : null,
  ]);

  const mapped = contents.map(mapContent);
  return {
    creator: mapCreator(creator),
    contents: mapped,
    analytics,
    guide: studioGuide(mapCreator(creator), mapped),
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

  const { assertBunnyVideoId } = require('../utils/bunnyAsset');
  let bunnyVideoId = null;
  if (body.bunnyVideoId) {
    try {
      bunnyVideoId = assertBunnyVideoId(body.bunnyVideoId);
    } catch (err) {
      throw createError(err.status || 400, err.message, err.code || 'VALIDATION');
    }
  }

  const row = await creatorContentRepository.createDraft({
    ...body,
    bunnyVideoId,
    creatorId: creator.id,
    creatorDisplayName: creator.display_name,
    createdByUserId: userId,
    productionCompanyId: creator.production_company_id || null,
    contentFormat: body.contentFormat || body.kind || 'movie',
  });

  return { content: mapContent(row) };
}

async function updateContent(userId, contentId, body) {
  const creator = await requireActiveCreator(userId);
  const patch = { ...body };
  if (body.bunnyVideoId != null && String(body.bunnyVideoId).trim() !== '') {
    const { assertBunnyVideoId } = require('../utils/bunnyAsset');
    try {
      patch.bunnyVideoId = assertBunnyVideoId(body.bunnyVideoId);
    } catch (err) {
      throw createError(err.status || 400, err.message, err.code || 'VALIDATION');
    }
  }
  const row = await creatorContentRepository.updateOwnedDraft(contentId, creator.id, patch);
  if (!row) {
    throw createError(404, 'Rascunho não encontrado ou não editável', 'NOT_FOUND');
  }
  return { content: mapContent(row) };
}

async function submitContent(userId, contentId) {
  const creator = await requireActiveCreator(userId);
  const current = await creatorContentRepository.findOwned(contentId, creator.id);
  if (!current) {
    throw createError(404, 'Conteúdo não pode ser submetido', 'NOT_SUBMISSION');
  }
  const { isValidBunnyVideoId } = require('../utils/bunnyAsset');
  if (!isValidBunnyVideoId(current.bunny_video_id)) {
    throw createError(
      400,
      'Antes de enviar à equipa, crie a ficha de vídeo e carregue o ficheiro.',
      'BUNNY_VIDEO_REQUIRED'
    );
  }
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

  if (status === 'active' && row.user_id) {
    await userRepository.assignRole(row.user_id, 'creator');
  }

  try {
    const notify = require('./notificationService');
    if (row.user_id) {
      await notify.notify({
        userId: row.user_id,
        type: status === 'active' ? 'creator_approved' : 'creator_rejected',
        title: status === 'active' ? 'Estúdio aceite' : 'Candidatura não aceite',
        body:
          status === 'active'
            ? 'Já pode enviar filmes. A equipa publica-os no catálogo da MinhaTela.'
            : 'A candidatura ao estúdio não foi aceite.',
        data: { creatorId: creatorId, status },
      });
    }
  } catch {
    /* notify best-effort */
  }

  await auditRepository.write({
    actorId: adminId,
    action: status === 'active' ? 'CREATOR_APPROVED' : 'CREATOR_REJECTED',
    entity: 'creator',
    entityId: creatorId,
    metadata: { status },
  });

  return { creator: mapCreator(row) };
}

async function ensureDistributionRights(video) {
  const rightsService = require('./rightsService');
  const { env } = require('../config/env');
  const territory = env.market?.country || 'AO';
  const check = await rightsService.canDistribute({
    contentId: video.id,
    territory,
    modality: video.monetization || 'avod',
  });
  if (check.ok) return check;

  const { query } = require('../config/database');
  await query(
    `INSERT INTO content_rights (
       content_id, owner_name, territory, license_type, status,
       avod_allowed, svod_allowed, tvod_allowed
     ) VALUES ($1,$2,$3,'ugc_distribution','active', TRUE, TRUE, TRUE)`,
    [
      video.id,
      video.creator_name || video.creator_display_name || 'Criador MinhaTela',
      territory,
    ]
  );

  const again = await rightsService.canDistribute({
    contentId: video.id,
    territory,
    modality: video.monetization || 'avod',
  });
  if (!again.ok) {
    throw createError(
      400,
      'Não é possível publicar sem direitos de distribuição activos neste território',
      'RIGHTS_REQUIRED',
      { reason: again.reason }
    );
  }
  return again;
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

  const pending = await creatorContentRepository.findById(contentId);
  let ownerUserId = null;
  if (pending) {
    const { query } = require('../config/database');
    const owner = await query(
      `SELECT c.user_id FROM videos v
       JOIN creators c ON c.id = v.creator_id
       WHERE v.id = $1 LIMIT 1`,
      [contentId]
    );
    ownerUserId = owner.rows[0]?.user_id || null;
    if (ownerUserId && ownerUserId === adminId) {
      throw createError(403, 'Não pode pôr o próprio filme no catálogo', 'SELF_APPROVAL_FORBIDDEN');
    }
  }

  if (status === 'published') {
    const { isValidBunnyVideoId } = require('../utils/bunnyAsset');
    if (!pending || !isValidBunnyVideoId(pending.bunny_video_id)) {
      throw createError(
        400,
        'Não dá para pôr no catálogo sem o ficheiro de vídeo pronto.',
        'BUNNY_VIDEO_REQUIRED'
      );
    }
    const encoding = String(pending.encoding_status || '').toLowerCase();
    if (['processing', 'encoding', 'queued', 'error', 'failed'].includes(encoding)) {
      throw createError(
        400,
        'O ficheiro ainda está a processar qualidade. Espere e publique de novo.',
        'ENCODING_NOT_READY'
      );
    }
    await ensureDistributionRights(pending);
  }
  const row = await creatorContentRepository.moderate(contentId, {
    status,
    reviewerId: adminId,
         rejectionReason: status === 'rejected' ? rejectionReason || 'Recusado pela equipa MinhaTela' : null,
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

  try {
    if (ownerUserId) {
      await require('./notificationService').notify({
        userId: ownerUserId,
        type: status === 'published' ? 'content_published' : 'content_rejected',
        title: status === 'published' ? 'O seu filme está na app' : 'Título recusado',
        body:
          status === 'published'
            ? `"${row.title}" já aparece no catálogo MinhaTela.`
            : `"${row.title}" não entrou no catálogo.${rejectionReason ? ` ${rejectionReason}` : ''}`,
        data: { contentId, status },
      });
    }
  } catch {
    /* notify best-effort */
  }

  return { content: mapContent(row) };
}

async function createBunnySlot(userId, body) {
  const creator = await requireActiveCreator(userId);
  const title = String(body.title || '').trim();
  if (!title) {
    throw createError(400, 'Título do vídeo Bunny é obrigatório', 'VALIDATION');
  }
  const bunnyService = require('./bunnyService');
  const created = await bunnyService.createVideo({ title });
  await auditRepository.write({
    actorId: userId,
    action: 'BUNNY_VIDEO_CREATED',
    entity: 'bunny_video',
    entityId: created.videoId,
    metadata: { creatorId: creator.id, title },
  });
  return {
    bunnyVideoId: created.videoId,
    libraryId: created.libraryId,
    upload: created.upload,
    message:
      'Ficha criada. Envie agora o ficheiro — depois submeta o título à equipa.',
  };
}

module.exports = {
  registerCreator,
  getStudioHome,
  createContent,
  updateContent,
  submitContent,
  createBunnySlot,
  adminListCreators,
  adminReviewCreator,
  adminListContent,
  adminModerateContent,
};
