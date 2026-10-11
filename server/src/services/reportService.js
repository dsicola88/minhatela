'use strict';

const reportRepository = require('../repositories/reportRepository');
const contentRepository = require('../repositories/contentRepository');
const auditRepository = require('../repositories/auditRepository');
const featureFlagService = require('./featureFlagService');
const { query } = require('../config/database');
const { createError } = require('../utils/errors');

async function reportContent(userId, contentId, body, meta = {}) {
  const enabled = await featureFlagService.isEnabled('content_reports_enabled');
  if (!enabled) {
    throw createError(503, 'Denúncias temporariamente indisponíveis', 'FEATURE_DISABLED');
  }

  const reason = String(body?.reason || '').toLowerCase().trim();
  if (!reportRepository.ALLOWED_REASONS.has(reason)) {
    throw createError(
      400,
      `Motivo inválido. Use: ${[...reportRepository.ALLOWED_REASONS].join(', ')}`,
      'VALIDATION'
    );
  }

  const content = await contentRepository.findPublishedById(contentId);
  if (!content) {
    throw createError(404, 'Conteúdo não encontrado', 'CONTENT_NOT_FOUND');
  }

  const details = body?.details ? String(body.details).slice(0, 1000) : null;
  const row = await reportRepository.create({
    reporterUserId: userId,
    contentId,
    profileId: meta.profileId,
    reason,
    details,
  });

  await auditRepository.write({
    actorId: userId,
    action: 'content.report',
    entity: 'video',
    entityId: contentId,
    metadata: { reason, reportId: row.id },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return {
    id: row.id,
    reason: row.reason,
    status: row.status,
    createdAt: row.created_at,
    message: 'Denúncia registada. A equipa de moderação irá analisar.',
  };
}

async function listOpenReports(limit) {
  const rows = await reportRepository.listOpen({ limit });
  return {
    reports: rows.map((r) => ({
      id: r.id,
      reason: r.reason,
      details: r.details,
      status: r.status,
      createdAt: r.created_at,
      contentId: r.content_id,
      contentTitle: r.content_title,
      reporterEmail: r.reporter_email,
    })),
  };
}

async function reviewReport(adminId, reportId, body, meta = {}) {
  const status = body?.status;
  if (!['resolved', 'dismissed'].includes(status)) {
    throw createError(400, 'status deve ser resolved ou dismissed', 'VALIDATION');
  }
  if (body?.remove === true && status !== 'resolved') {
    throw createError(400, 'A remoção exige a denúncia marcada como resolvida', 'VALIDATION');
  }
  const row = await reportRepository.review({
    reportId,
    reviewerId: adminId,
    status,
    notes: body?.notes,
  });
  if (!row) throw createError(404, 'Denúncia não encontrada', 'REPORT_NOT_FOUND');

  let removed = null;
  if (body?.remove === true) {
    removed = await removeDistributedCopy(row.content_id, adminId, reportId, meta);
  }

  await auditRepository.write({
    actorId: adminId,
    action: removed ? 'CONTENT_REMOVED' : 'content.report_reviewed',
    entity: removed ? 'video' : 'content_report',
    entityId: removed ? row.content_id : reportId,
    metadata: {
      status,
      notes: body?.notes || null,
      reportId,
      ownershipProven: false,
      removed: Boolean(removed),
    },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return {
    id: row.id,
    status: row.status,
    reviewedAt: row.reviewed_at,
    removed: Boolean(removed),
    contentId: row.content_id,
  };
}

async function removeDistributedCopy(contentId, adminId, reportId) {
  const video = await query(
    `UPDATE videos
     SET is_published = FALSE,
         workflow_status = 'archived',
         updated_at = NOW()
     WHERE id = $1
     RETURNING id, title, creator_id`,
    [contentId]
  );
  if (!video.rowCount) throw createError(404, 'Conteúdo não encontrado', 'CONTENT_NOT_FOUND');

  await query(
    `UPDATE content_rights
     SET status = 'revoked', updated_at = NOW()
     WHERE content_id = $1 AND status = 'active'`,
    [contentId]
  );

  const owner = await query(`SELECT user_id FROM creators WHERE id = $1`, [
    video.rows[0].creator_id,
  ]);
  const userId = owner.rows[0]?.user_id;
  if (userId) {
    try {
      await require('./notificationService').notify({
        userId,
        type: 'content_removed',
        title: 'Filme retirado do catálogo',
        body: `"${video.rows[0].title}" foi retirado depois de uma reclamação. A declaração de direitos não prova a propriedade.`,
        data: { contentId, reportId },
      });
    } catch {
      /* notify best-effort */
    }
  }

  return { contentId, title: video.rows[0].title, reviewerId: adminId };
}

module.exports = { reportContent, listOpenReports, reviewReport };
