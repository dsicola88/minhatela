'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { env } = require('../config/env');
const totp = require('../utils/totp');
const { createError } = require('../utils/errors');
const auditRepository = require('../repositories/auditRepository');

function key() {
  return crypto.createHash('sha256').update(String(env.jwtSecret)).digest();
}

function encrypt(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

function decrypt(payload) {
  const buf = Buffer.from(String(payload || ''), 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

function staffMfaRequired() {
  return process.env.MFA_STAFF_REQUIRED !== 'false';
}

function signMfaTicket(userId, purpose = 'mfa') {
  return jwt.sign({ sub: userId, purpose }, env.jwtSecret, { expiresIn: '10m' });
}

function readMfaTicket(ticket, purposes = ['mfa']) {
  try {
    const payload = jwt.verify(ticket, env.jwtSecret);
    if (!payload.sub || !purposes.includes(payload.purpose)) return null;
    return payload.sub;
  } catch {
    return null;
  }
}

async function loadMfa(userId) {
  try {
    const result = await query(
      `SELECT mfa_enabled_at, mfa_secret_enc, mfa_pending_secret_enc, email
       FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [userId]
    );
    return result.rows[0] || null;
  } catch {
    return null;
  }
}

async function enroll(userId) {
  const row = await loadMfa(userId);
  if (!row) throw createError(404, 'Utilizador não encontrado', 'USER_NOT_FOUND');
  if (row.mfa_enabled_at) {
    throw createError(409, 'MFA já está activo', 'MFA_ALREADY_ENABLED');
  }
  const secret = totp.randomSecret();
  await query(`UPDATE users SET mfa_pending_secret_enc = $2, updated_at = NOW() WHERE id = $1`, [
    userId,
    encrypt(secret),
  ]);
  return {
    secret,
    otpauthUrl: totp.otpauthUrl({ secret, email: row.email }),
    message: 'Confirme com um código TOTP para activar.',
  };
}

async function confirm(userId, code, meta = {}) {
  const row = await loadMfa(userId);
  if (!row?.mfa_pending_secret_enc) {
    throw createError(400, 'Inicie o enrolamento MFA primeiro', 'MFA_NOT_PENDING');
  }
  const secret = decrypt(row.mfa_pending_secret_enc);
  if (!totp.verify(secret, code)) {
    throw createError(401, 'Código MFA inválido', 'MFA_INVALID');
  }
  await query(
    `UPDATE users SET
       mfa_secret_enc = mfa_pending_secret_enc,
       mfa_pending_secret_enc = NULL,
       mfa_enabled_at = NOW(),
       updated_at = NOW()
     WHERE id = $1`,
    [userId]
  );
  await auditRepository.write({
    actorId: userId,
    action: 'mfa.enabled',
    entity: 'user',
    entityId: userId,
    ip: meta.ip,
  });
  return { enabled: true };
}

async function enrollWithTicket(ticket) {
  const userId = readMfaTicket(ticket, ['mfa_enroll', 'mfa']);
  if (!userId) throw createError(401, 'Ticket MFA inválido ou expirado', 'MFA_TICKET_INVALID');
  return enroll(userId);
}

async function confirmWithTicket(ticket, code, meta = {}) {
  const userId = readMfaTicket(ticket, ['mfa_enroll', 'mfa']);
  if (!userId) throw createError(401, 'Ticket MFA inválido ou expirado', 'MFA_TICKET_INVALID');
  return confirm(userId, code, meta);
}

async function disable(userId, code, meta = {}, roles = []) {
  const rbac = require('./rbacService');
  if (staffMfaRequired() && rbac.isStaff(roles)) {
    throw createError(403, 'Staff não pode desactivar MFA', 'MFA_REQUIRED_STAFF');
  }
  const row = await loadMfa(userId);
  if (!row?.mfa_enabled_at) return { enabled: false };
  const secret = decrypt(row.mfa_secret_enc);
  if (!totp.verify(secret, code)) {
    throw createError(401, 'Código MFA inválido', 'MFA_INVALID');
  }
  await query(
    `UPDATE users SET mfa_secret_enc = NULL, mfa_enabled_at = NULL, updated_at = NOW() WHERE id = $1`,
    [userId]
  );
  await auditRepository.write({
    actorId: userId,
    action: 'mfa.disabled',
    entity: 'user',
    entityId: userId,
    ip: meta.ip,
  });
  return { enabled: false };
}

async function verifyLogin(mfaTicket, code) {
  const userId = readMfaTicket(mfaTicket, ['mfa']);
  if (!userId) throw createError(401, 'Ticket MFA inválido ou expirado', 'MFA_TICKET_INVALID');
  const row = await loadMfa(userId);
  if (!row?.mfa_enabled_at || !row.mfa_secret_enc) {
    throw createError(400, 'MFA não está activo', 'MFA_NOT_ENABLED');
  }
  if (!totp.verify(decrypt(row.mfa_secret_enc), code)) {
    throw createError(401, 'Código MFA inválido', 'MFA_INVALID');
  }
  return userId;
}

async function assertStepUp(user, code) {
  const row = await loadMfa(user.id);
  if (!row?.mfa_enabled_at) return { skipped: true };
  if (user.mfaVerified) return { skipped: false, verified: true };
  if (!code) throw createError(401, 'Código MFA obrigatório nesta operação', 'MFA_REQUIRED');
  const secret = decrypt(row.mfa_secret_enc);
  if (!totp.verify(secret, code)) {
    throw createError(401, 'Código MFA inválido', 'MFA_INVALID');
  }
  return { skipped: false, verified: true };
}

async function totpNow(userId) {
  const row = await loadMfa(userId);
  if (!row?.mfa_secret_enc) return null;
  return totp.generate(decrypt(row.mfa_secret_enc));
}

module.exports = {
  enroll,
  confirm,
  enrollWithTicket,
  confirmWithTicket,
  disable,
  verifyLogin,
  signMfaTicket,
  loadMfa,
  assertStepUp,
  staffMfaRequired,
  totpNow,
};
