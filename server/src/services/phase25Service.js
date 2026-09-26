'use strict';

const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const phase25Repository = require('../repositories/phase25Repository');
const featureFlagService = require('./featureFlagService');
const userRepository = require('../repositories/userRepository');
const profileRepository = require('../repositories/profileRepository');
const { createError } = require('../utils/errors');
const { env } = require('../config/env');
const { logger } = require('../utils/logger');

function decodeJwtPayload(token) {
  try {
    const parts = String(token || '').split('.');
    if (parts.length < 2) return null;
    const json = Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString(
      'utf8'
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

async function scorePaymentProof({ userId, filePath, amountKz, paymentMethod, type }) {
  const enabled = await featureFlagService.isEnabled('payment_fraud_enabled');
  if (!enabled) {
    return { riskScore: 0, decision: 'allow', signals: { skipped: true } };
  }

  const signals = {};
  let score = 0;

  let proofSha256 = null;
  try {
    const buf = fs.readFileSync(filePath);
    proofSha256 = phase25Repository.sha256FileBuffer(buf);
    signals.proofBytes = buf.length;
    if (buf.length < 8_000) {
      score += 25;
      signals.tinyProof = true;
    }
    if (buf.length > 7 * 1024 * 1024) {
      score += 10;
      signals.largeProof = true;
    }
  } catch (err) {
    score += 40;
    signals.readFailed = err.message;
  }

  if (proofSha256) {
    const dupes = await phase25Repository.countRecentProofHash(proofSha256, 72);
    if (dupes > 0) {
      score += 55;
      signals.duplicateProof = dupes;
    }
  }

  const pending = await phase25Repository.countUserPending(userId);
  if (pending >= 3) {
    score += 30;
    signals.highPending = pending;
  }

  const velocity = await phase25Repository.countUserSubmissions24h(userId);
  if (velocity >= 5) {
    score += 35;
    signals.velocity24h = velocity;
  } else if (velocity >= 3) {
    score += 15;
    signals.velocity24h = velocity;
  }

  if (amountKz && amountKz > env.premiumPriceKz * 3) {
    score += 20;
    signals.highAmount = amountKz;
  }

  if (paymentMethod === 'iban' && type === 'rental' && amountKz < 500) {
    score += 10;
    signals.oddRentalAmount = true;
  }

  score = Math.min(100, score);
  let decision = 'allow';
  if (score >= 80) decision = 'block_review';
  else if (score >= 60) decision = 'review';
  else if (score >= 40) decision = 'flag';

  return { riskScore: score, decision, signals, proofSha256 };
}

async function attachPaymentRisk({
  transactionId,
  userId,
  filePath,
  amountKz,
  paymentMethod,
  type,
}) {
  const scored = await scorePaymentProof({
    userId,
    filePath,
    amountKz,
    paymentMethod,
    type,
  });

  await phase25Repository.setTransactionRisk(transactionId, {
    riskScore: scored.riskScore,
    proofSha256: scored.proofSha256,
    riskDecision: scored.decision,
  });

  await phase25Repository.insertRiskSignal({
    transactionId,
    userId,
    riskScore: scored.riskScore,
    signals: scored.signals,
    decision: scored.decision,
  });

  logger.info('payment.risk_scored', {
    transactionId,
    userId,
    riskScore: scored.riskScore,
    decision: scored.decision,
  });

  return scored;
}

async function adminPaymentRisk({ minScore = 40 } = {}) {
  await featureFlagService.assertEnabled('payment_fraud_enabled');
  const rows = await phase25Repository.listHighRiskPending({ minScore, limit: 80 });
  return {
    items: rows.map((row) => ({
      id: row.id,
      type: row.type,
      paymentMethod: row.payment_method,
      amountKz: row.amount_kz,
      riskScore: row.risk_score,
      riskDecision: row.risk_decision,
      signals: row.signals || {},
      email: row.email,
      fullName: row.full_name,
      videoTitle: row.video_title,
      proofUrl: row.proof_url,
      createdAt: row.created_at,
    })),
  };
}

async function adminEncodingQueue(query = {}) {
  await featureFlagService.assertEnabled('encoding_admin_enabled');
  const rows = await phase25Repository.listEncodingQueue({
    status: query.status || null,
    limit: Number(query.limit) || 40,
  });
  return {
    items: rows.map((row) => ({
      id: row.id,
      title: row.title,
      kind: row.kind,
      bunnyVideoId: row.bunny_video_id,
      encodingStatus: row.encoding_status || 'pending',
      encodingError: row.encoding_error,
      encodingUpdatedAt: row.encoding_updated_at,
      workflowStatus: row.workflow_status,
      isPublished: row.is_published,
    })),
  };
}

async function adminUpdateEncoding(contentId, body = {}) {
  await featureFlagService.assertEnabled('encoding_admin_enabled');
  const status = body.encodingStatus || body.status;
  if (!status) {
    throw createError(400, 'encodingStatus obrigatório', 'VALIDATION');
  }
  const allowed = ['pending', 'processing', 'ready', 'failed', 'finished', 'encoded'];
  if (!allowed.includes(status)) {
    throw createError(400, 'Estado de encoding inválido', 'VALIDATION');
  }
  const row = await phase25Repository.updateEncoding(contentId, {
    encodingStatus: status,
    encodingError: body.encodingError || body.error || null,
  });
  if (!row) throw createError(404, 'Conteúdo não encontrado', 'CONTENT_NOT_FOUND');
  return {
    item: {
      id: row.id,
      title: row.title,
      kind: row.kind,
      encodingStatus: row.encoding_status,
      encodingError: row.encoding_error,
      encodingUpdatedAt: row.encoding_updated_at,
      bunnyVideoId: row.bunny_video_id,
    },
  };
}

async function getScrub(contentId) {
  const enabled = await featureFlagService.isEnabled('scrub_thumbs_enabled');
  if (!enabled) return { enabled: false, scrub: null };
  const row = await phase25Repository.getScrubAssets(contentId);
  if (!row) throw createError(404, 'Conteúdo não encontrado', 'CONTENT_NOT_FOUND');
  if (!row.sprite_vtt_url && !row.sprite_image_url) {
    return { enabled: true, scrub: null };
  }
  return {
    enabled: true,
    scrub: {
      vttUrl: row.sprite_vtt_url,
      spriteUrl: row.sprite_image_url,
      durationSeconds: row.duration_seconds,
    },
  };
}

function playerExtras(profile) {
  const countdown =
    profile?.autoplay_countdown_seconds === 0
      ? 0
      : Number(profile?.autoplay_countdown_seconds ?? 10);
  return {
    autoplayCountdownSeconds: Number.isFinite(countdown) ? countdown : 10,
    hideSpoilers: Boolean(profile?.hide_spoilers),
  };
}

async function oauthLogin(provider, body, meta = {}) {
  await featureFlagService.assertEnabled('oauth_enabled', 'Login social temporariamente indisponível');

  if (!['google', 'apple'].includes(provider)) {
    throw createError(400, 'Provider inválido', 'VALIDATION');
  }

  const expectedAud =
    provider === 'google' ? env.oauth?.googleClientId : env.oauth?.appleClientId;
  if (!expectedAud) {
    throw createError(
      503,
      'Login social não configurado. Use email e palavra-passe.',
      'OAUTH_NOT_CONFIGURED'
    );
  }

  const idToken = body.idToken || body.identityToken || body.token;
  if (!idToken || String(idToken).length < 16) {
    throw createError(400, 'idToken OAuth obrigatório', 'OAUTH_TOKEN_REQUIRED');
  }

  const payload = decodeJwtPayload(idToken) || {};
  if (!payload.sub || !payload.aud) {
    throw createError(401, 'Token OAuth inválido', 'OAUTH_TOKEN_INVALID');
  }
  if (String(payload.aud) !== String(expectedAud)) {
    throw createError(401, 'Token OAuth inválido (audience)', 'OAUTH_AUD_MISMATCH');
  }
  if (!payload.exp || payload.exp * 1000 < Date.now()) {
    throw createError(401, 'Token OAuth expirado', 'OAUTH_EXPIRED');
  }

  const providerSub = body.providerSub || payload.sub || body.sub;
  if (!providerSub) {
    throw createError(401, 'Token OAuth sem subject', 'OAUTH_TOKEN_INVALID');
  }

  let email = (body.email || payload.email || '').toLowerCase().trim();
  const fullName =
    body.fullName ||
    payload.name ||
    [payload.given_name, payload.family_name].filter(Boolean).join(' ') ||
    (email ? email.split('@')[0] : `${provider} user`);

  if (!email) {
    email = `${provider}_${String(providerSub).slice(0, 12)}@oauth.minhatela.ao`;
  }

  let identity = await phase25Repository.findOAuthIdentity(provider, providerSub);
  let user;

  if (identity) {
    user = await userRepository.findById(identity.user_id);
  } else {
    user = await userRepository.findByEmail(email);
    if (!user) {
      const passwordHash = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10);
      user = await userRepository.create({
        email,
        passwordHash,
        fullName: String(fullName).slice(0, 120),
      });
      await userRepository.assignRole(user.id, 'customer');
      await profileRepository.createDefault(user.id, String(fullName).split(' ')[0] || 'Perfil');
    }
  }

  if (!user) {
    throw createError(401, 'Falha OAuth', 'OAUTH_FAILED');
  }

  await phase25Repository.upsertOAuthIdentity({
    userId: user.id,
    provider,
    providerSub,
    email,
    rawProfile: { ...payload, source: provider },
  });

  const roles = await userRepository.getRoles(user.id);
  if (!roles.includes('customer')) {
    await userRepository.assignRole(user.id, 'customer');
    roles.push('customer');
  }

  const authService = require('./authService');
  const session = await authService.issueSession(user, roles, {
    ...meta,
    oauthProvider: provider,
  });

  logger.info('auth.oauth_login', { userId: user.id, provider });
  return { ...session, oauthProvider: provider };
}

module.exports = {
  scorePaymentProof,
  attachPaymentRisk,
  adminPaymentRisk,
  adminEncodingQueue,
  adminUpdateEncoding,
  getScrub,
  playerExtras,
  oauthLogin,
};
