'use strict';

const complianceRepository = require('../repositories/complianceRepository');
const authSessionRepository = require('../repositories/authSessionRepository');
const auditRepository = require('../repositories/auditRepository');
const { createError } = require('../utils/errors');
const { env } = require('../config/env');

const GRACE_DAYS = Number(process.env.ACCOUNT_DELETION_GRACE_DAYS || 30);

async function exportMyData(userId, meta = {}) {
  const existing = await complianceRepository.getLatestExport(userId);
  if (existing) {
    const ageMs = Date.now() - new Date(existing.created_at).getTime();
    if (ageMs < 60_000) {
      return {
        id: existing.id,
        status: existing.status,
        createdAt: existing.created_at,
        expiresAt: existing.expires_at,
        data: existing.payload,
        cached: true,
      };
    }
  }

  const payload = await complianceRepository.gatherUserData(userId);
  const row = await complianceRepository.saveExport({
    userId,
    payload,
    ip: meta.ip,
  });

  await auditRepository.write({
    actorId: userId,
    action: 'account.data_export',
    entity: 'user',
    entityId: userId,
    metadata: { exportId: row.id },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return {
    id: row.id,
    status: row.status,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    data: payload,
    cached: false,
  };
}

async function getExport(userId, exportId) {
  const row = await complianceRepository.getExportById(userId, exportId);
  if (!row) throw createError(404, 'Exportação não encontrada ou expirada', 'EXPORT_NOT_FOUND');
  return {
    id: row.id,
    status: row.status,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    data: row.payload,
  };
}

async function requestAccountDeletion(userId, { password, confirm }, meta = {}) {
  if (confirm !== 'ELIMINAR') {
    throw createError(
      400,
      'Confirme escrevendo ELIMINAR',
      'CONFIRMATION_REQUIRED'
    );
  }
  if (!password || String(password).length < 8) {
    throw createError(400, 'Palavra-passe necessária', 'VALIDATION');
  }

  const bcrypt = require('bcryptjs');
  const userRepository = require('../repositories/userRepository');
  const user = await userRepository.findAuthById(userId);
  if (!user || user.deleted_at) {
    throw createError(404, 'Conta não encontrada', 'USER_NOT_FOUND');
  }
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    throw createError(403, 'Palavra-passe incorrecta', 'INVALID_PASSWORD');
  }

  const row = await complianceRepository.requestDeletion(userId, GRACE_DAYS);
  if (!row) {
    throw createError(400, 'Não foi possível solicitar eliminação', 'DELETE_FAILED');
  }

  // Revoga todas as sessões excepto a actual (utilizador pode cancelar)
  try {
    if (meta.sessionId) {
      await authSessionRepository.revokeAllExcept(userId, meta.sessionId);
    }
  } catch {
    /* ignore */
  }

  await auditRepository.write({
    actorId: userId,
    action: 'account.deletion_requested',
    entity: 'user',
    entityId: userId,
    metadata: {
      graceDays: GRACE_DAYS,
      scheduledAt: row.deletion_scheduled_at,
    },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return {
    requested: true,
    graceDays: GRACE_DAYS,
    scheduledAt: row.deletion_scheduled_at,
    message: `A sua conta será eliminada em ${GRACE_DAYS} dias. Pode cancelar em Conta → Privacidade.`,
  };
}

async function cancelAccountDeletion(userId, meta = {}) {
  const row = await complianceRepository.cancelDeletion(userId);
  if (!row) {
    throw createError(400, 'Não há eliminação pendente', 'NO_PENDING_DELETION');
  }
  await auditRepository.write({
    actorId: userId,
    action: 'account.deletion_cancelled',
    entity: 'user',
    entityId: userId,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
  return { cancelled: true };
}

async function getPrivacyOverview(userId) {
  const userRepository = require('../repositories/userRepository');
  const legalService = require('./legalService');
  const user = await userRepository.findById(userId);
  const consents = await legalService.getConsentStatus(userId);
  return {
    deletionRequestedAt: user?.deletion_requested_at || null,
    deletionScheduledAt: user?.deletion_scheduled_at || null,
    graceDays: GRACE_DAYS,
    consents,
  };
}

module.exports = {
  exportMyData,
  getExport,
  requestAccountDeletion,
  cancelAccountDeletion,
  getPrivacyOverview,
  GRACE_DAYS,
};
