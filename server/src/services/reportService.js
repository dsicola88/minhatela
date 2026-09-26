'use strict';

const reportRepository = require('../repositories/reportRepository');
const contentRepository = require('../repositories/contentRepository');
const auditRepository = require('../repositories/auditRepository');
const featureFlagService = require('./featureFlagService');
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
  const row = await reportRepository.review({
    reportId,
    reviewerId: adminId,
    status,
    notes: body?.notes,
  });
  if (!row) throw createError(404, 'Denúncia não encontrada', 'REPORT_NOT_FOUND');

  await auditRepository.write({
    actorId: adminId,
    action: 'content.report_reviewed',
    entity: 'content_report',
    entityId: reportId,
    metadata: { status, notes: body?.notes },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return { id: row.id, status: row.status, reviewedAt: row.reviewed_at };
}

module.exports = { reportContent, listOpenReports, reviewReport };
