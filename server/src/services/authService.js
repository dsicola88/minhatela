'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const userRepository = require('../repositories/userRepository');
const profileRepository = require('../repositories/profileRepository');
const passwordResetRepository = require('../repositories/passwordResetRepository');
const emailVerificationRepository = require('../repositories/emailVerificationRepository');
const authSessionRepository = require('../repositories/authSessionRepository');
const emailService = require('./emailService');
const { env } = require('../config/env');
const { createError } = require('../utils/errors');
const { logger } = require('../utils/logger');

const GENERIC_RESET_MESSAGE =
  'Se existir uma conta com este email, enviámos instruções de recuperação.';

function signAccessToken(user, roles, sessionId) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      subscriptionStatus: user.subscription_status,
      roles,
      isAdmin: Boolean(user.is_admin) || roles.includes('admin') || roles.includes('super_admin'),
      sid: sessionId,
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );
}

function toPublicUser(user, roles = []) {
  const isAdmin =
    Boolean(user.is_admin) ||
    roles.includes('admin') ||
    roles.includes('super_admin') ||
    roles.includes('moderator');

  return {
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    subscriptionStatus: user.subscription_status,
    premiumExpiresAt: user.premium_expires_at || null,
    emailVerified: Boolean(user.email_verified_at),
    emailVerifiedAt: user.email_verified_at || null,
    roles,
    isAdmin,
    createdAt: user.created_at,
  };
}

function mapSession(row, currentSessionId) {
  return {
    id: row.id,
    deviceName: row.device_name,
    platform: row.platform,
    ip: row.ip,
    lastSeenAt: row.last_seen_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    current: currentSessionId ? row.id === currentSessionId : false,
  };
}

async function issueSession(user, roles, meta = {}) {
  const { session, refreshToken } = await authSessionRepository.create({
    userId: user.id,
    deviceName: meta.deviceName,
    platform: meta.platform,
    ip: meta.ip,
    userAgent: meta.userAgent,
    ttlDays: env.refreshTokenDays,
  });

  const accessToken = signAccessToken(user, roles, session.id);
  return {
    token: accessToken,
    accessToken,
    refreshToken,
    sessionId: session.id,
    user: toPublicUser(user, roles),
  };
}

async function register(body, meta = {}) {
  const { email, password, fullName, acceptTerms } = body;
  if (!email || !password || !fullName) {
    throw createError(400, 'Email, palavra-passe e nome são obrigatórios', 'VALIDATION');
  }
  if (String(password).length < 8) {
    throw createError(400, 'A palavra-passe deve ter pelo menos 8 caracteres', 'VALIDATION');
  }
  if (!acceptTerms) {
    throw createError(
      400,
      'Deve aceitar os Termos e a Política de Privacidade',
      'CONSENT_REQUIRED'
    );
  }

  const normalized = email.toLowerCase().trim();
  const existing = await userRepository.findByEmail(normalized);
  if (existing) {
    throw createError(409, 'Já existe uma conta com este email', 'EMAIL_TAKEN');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await userRepository.create({
    email: normalized,
    passwordHash,
    fullName: fullName.trim(),
  });

  await userRepository.assignRole(user.id, 'customer');
  await profileRepository.createDefault(user.id, fullName.trim().split(' ')[0]);

  try {
    const legalService = require('./legalService');
    await legalService.acceptCurrent(user.id, ['terms', 'privacy'], {
      ip: meta.ip,
      userAgent: meta.userAgent,
      locale: 'pt-AO',
    });
  } catch (err) {
    logger.warn('auth.consent_failed', { userId: user.id, message: err.message });
  }

  const roles = await userRepository.getRoles(user.id);
  const session = await issueSession(user, roles, meta);

  try {
    const { token, expiresAt } = await emailVerificationRepository.create({
      userId: user.id,
      ttlHours: 48,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    const base = env.appPublicUrl;
    const verifyUrl = `${base}/verify-email?token=${token}`;
    await emailService.sendTransactional({
      to: user.email,
      subject: 'Confirme o seu email · MinhaTela',
      text: `Bem-vindo à MinhaTela. Confirme o email: ${verifyUrl}`,
      template: 'email_verification',
      meta: { verifyUrl, expiresAt },
    });
  } catch (err) {
    logger.warn('auth.verify_email_send_failed', { userId: user.id, message: err.message });
  }

  return session;
}

async function login(body, meta = {}) {
  const { email, password } = body;
  if (!email || !password) {
    throw createError(400, 'Email e palavra-passe são obrigatórios', 'VALIDATION');
  }

  const user = await userRepository.findByEmail(email.toLowerCase().trim());
  if (!user) {
    throw createError(401, 'Credenciais inválidas', 'INVALID_CREDENTIALS');
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    throw createError(401, 'Credenciais inválidas', 'INVALID_CREDENTIALS');
  }

  const roles = await userRepository.getRoles(user.id);
  if (!roles.includes('customer')) {
    await userRepository.assignRole(user.id, 'customer');
    roles.push('customer');
  }

  const sessionPayload = await issueSession(user, roles, meta);

  try {
    const loginAlertService = require('./loginAlertService');
    await loginAlertService.maybeAlertNewLogin(user, { id: sessionPayload.sessionId }, meta);
  } catch (err) {
    logger.warn('auth.login_alert_failed', { message: err.message });
  }

  return sessionPayload;
}

async function refresh({ refreshToken, ip, userAgent }) {
  if (!refreshToken) {
    throw createError(400, 'Refresh token obrigatório', 'VALIDATION');
  }

  const session = await authSessionRepository.findActiveByRefreshToken(refreshToken);
  if (!session) {
    throw createError(401, 'Sessão expirada. Entre novamente.', 'REFRESH_INVALID');
  }

  const user = await userRepository.findById(session.user_id);
  if (!user) {
    throw createError(401, 'Utilizador inválido', 'USER_NOT_FOUND');
  }

  const roles = await userRepository.getRoles(user.id);
  const newRefresh = await authSessionRepository.rotateRefreshToken(session.id);
  await authSessionRepository.touch(session.id);

  if (ip || userAgent) {
    // touch already updated last_seen; device metadata stays
  }

  const accessToken = signAccessToken(user, roles, session.id);
  logger.info('auth.refresh', { userId: user.id, sessionId: session.id });

  return {
    token: accessToken,
    accessToken,
    refreshToken: newRefresh,
    sessionId: session.id,
    user: toPublicUser(user, roles),
  };
}

async function logout(sessionId, userId) {
  if (sessionId && userId) {
    await authSessionRepository.revoke(sessionId, userId);
  } else if (sessionId) {
    await authSessionRepository.revokeById(sessionId);
  }
  return { loggedOut: true };
}

async function listSessions(userId, currentSessionId) {
  const rows = await authSessionRepository.listByUser(userId);
  return {
    sessions: rows.map((row) => mapSession(row, currentSessionId)),
  };
}

async function revokeSession(userId, sessionId) {
  const revoked = await authSessionRepository.revoke(sessionId, userId);
  if (!revoked) {
    throw createError(404, 'Sessão não encontrada', 'SESSION_NOT_FOUND');
  }
  return { revoked: true };
}

async function revokeOtherSessions(userId, currentSessionId) {
  const count = await authSessionRepository.revokeAllExcept(userId, currentSessionId);
  return { revoked: count };
}

async function me(userId) {
  const user = await userRepository.findById(userId);
  if (!user) {
    throw createError(404, 'Utilizador não encontrado', 'USER_NOT_FOUND');
  }
  const roles = await userRepository.getRoles(userId);
  return toPublicUser(user, roles);
}

async function listProfiles(userId) {
  const rows = await profileRepository.listByUser(userId);
  return {
    profiles: rows.map((row) => ({
      id: row.id,
      name: row.name,
      avatarUrl: row.avatar_url,
      isKids: row.is_kids,
      sortOrder: row.sort_order,
      maturityMax: row.maturity_max,
      hasPin: row.has_pin,
      autoplayNext: row.autoplay_next !== false,
      autoplayPreviews: row.autoplay_previews !== false,
      dataSaverDefault: row.data_saver_default !== false,
    })),
  };
}

async function requestPasswordReset({ email, ip, userAgent, appBaseUrl }) {
  const normalized = String(email || '').toLowerCase().trim();
  if (!normalized) {
    throw createError(400, 'Email é obrigatório', 'VALIDATION');
  }

  const user = await userRepository.findByEmail(normalized);
  const response = { message: GENERIC_RESET_MESSAGE };

  if (!user) {
    return response;
  }

  await passwordResetRepository.invalidateUserTokens(user.id);
  const { token, expiresAt } = await passwordResetRepository.create({
    userId: user.id,
    ttlMinutes: 30,
    ip,
    userAgent,
  });

  const base = appBaseUrl || env.appPublicUrl || 'http://localhost:8081';
  const resetUrl = `${base}/reset-password?token=${token}`;

  await emailService.sendPasswordReset({
    to: user.email,
    resetUrl,
    expiresAt,
  });

  logger.info('auth.password_reset_requested', { userId: user.id });

  if (!env.isProd) {
    response.devResetToken = token;
    response.devResetUrl = resetUrl;
  }

  return response;
}

async function resetPassword({ token, password }) {
  if (!token || !password) {
    throw createError(400, 'Token e nova palavra-passe são obrigatórios', 'VALIDATION');
  }
  if (String(password).length < 8) {
    throw createError(400, 'A palavra-passe deve ter pelo menos 8 caracteres', 'VALIDATION');
  }

  const record = await passwordResetRepository.findValid(token);
  if (!record) {
    throw createError(400, 'Link de recuperação inválido ou expirado', 'RESET_TOKEN_INVALID');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await userRepository.updatePassword(record.user_id, passwordHash);
  await passwordResetRepository.markUsed(record.id);
  await passwordResetRepository.invalidateUserTokens(record.user_id);
  await authSessionRepository.revokeAllExcept(record.user_id, null);

  logger.info('auth.password_reset_completed', { userId: record.user_id });

  return { message: 'Palavra-passe actualizada. Já pode entrar.' };
}

async function changePassword(userId, { currentPassword, newPassword }, currentSessionId) {
  if (!currentPassword || !newPassword) {
    throw createError(400, 'Palavra-passe actual e nova são obrigatórias', 'VALIDATION');
  }
  if (String(newPassword).length < 8) {
    throw createError(400, 'A nova palavra-passe deve ter pelo menos 8 caracteres', 'VALIDATION');
  }
  if (currentPassword === newPassword) {
    throw createError(400, 'A nova palavra-passe deve ser diferente', 'VALIDATION');
  }

  const user = await userRepository.findAuthById(userId);
  if (!user) throw createError(404, 'Utilizador não encontrado', 'USER_NOT_FOUND');

  const valid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!valid) {
    throw createError(401, 'Palavra-passe actual incorrecta', 'BAD_PASSWORD');
  }

  const passwordHash = await bcrypt.hash(String(newPassword), 12);
  await userRepository.updatePassword(userId, passwordHash);
  const revoked = await authSessionRepository.revokeAllExcept(userId, currentSessionId);

  logger.info('auth.password_changed', { userId, revokedOthers: revoked });

  return {
    changed: true,
    revokedOtherSessions: revoked,
    message: 'Palavra-passe actualizada. Outras sessões foram terminadas.',
  };
}

async function verifyEmail({ token }) {
  if (!token) throw createError(400, 'Token obrigatório', 'VALIDATION');
  const record = await emailVerificationRepository.findValid(token);
  if (!record) {
    throw createError(400, 'Link de verificação inválido ou expirado', 'VERIFY_INVALID');
  }
  await emailVerificationRepository.markUserVerified(record.user_id);
  await emailVerificationRepository.markUsed(record.id);
  logger.info('auth.email_verified', { userId: record.user_id });
  return { verified: true, message: 'Email confirmado com sucesso.' };
}

async function resendVerification(userId, meta = {}) {
  const user = await userRepository.findById(userId);
  if (!user) throw createError(404, 'Utilizador não encontrado', 'USER_NOT_FOUND');
  if (user.email_verified_at) {
    return { alreadyVerified: true, message: 'Email já confirmado.' };
  }
  const { token, expiresAt } = await emailVerificationRepository.create({
    userId,
    ttlHours: 48,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
  const verifyUrl = `${env.appPublicUrl}/verify-email?token=${token}`;
  await emailService.sendTransactional({
    to: user.email,
    subject: 'Confirme o seu email · MinhaTela',
    text: `Confirme o email: ${verifyUrl}`,
    template: 'email_verification',
    meta: { verifyUrl, expiresAt },
  });
  return {
    sent: true,
    message: 'Se a conta existir, enviámos um novo link de confirmação.',
  };
}

module.exports = {
  register,
  login,
  refresh,
  logout,
  listSessions,
  revokeSession,
  revokeOtherSessions,
  me,
  listProfiles,
  requestPasswordReset,
  resetPassword,
  changePassword,
  verifyEmail,
  resendVerification,
  issueSession,
};
