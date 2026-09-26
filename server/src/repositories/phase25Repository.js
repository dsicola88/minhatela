'use strict';

const crypto = require('crypto');
const { query } = require('../config/database');

async function insertRiskSignal({
  transactionId,
  userId,
  riskScore,
  signals,
  decision,
}) {
  const result = await query(
    `INSERT INTO payment_risk_signals
      (transaction_id, user_id, risk_score, signals, decision)
     VALUES ($1, $2, $3, $4::jsonb, $5)
     RETURNING *`,
    [
      transactionId,
      userId,
      riskScore,
      JSON.stringify(signals || {}),
      decision,
    ]
  );
  return result.rows[0];
}

async function setTransactionRisk(transactionId, { riskScore, proofSha256, riskDecision }) {
  const result = await query(
    `UPDATE transactions
     SET risk_score = $2,
         proof_sha256 = COALESCE($3, proof_sha256),
         risk_decision = COALESCE($4, risk_decision)
     WHERE id = $1
     RETURNING id, risk_score, proof_sha256, risk_decision, status`,
    [transactionId, riskScore, proofSha256 || null, riskDecision || null]
  );
  return result.rows[0] || null;
}

async function listHighRiskPending({ minScore = 40, limit = 50 } = {}) {
  const result = await query(
    `SELECT t.*, u.email, u.full_name, v.title AS video_title,
            r.signals, r.decision AS signal_decision
     FROM transactions t
     JOIN users u ON u.id = t.user_id
     LEFT JOIN videos v ON v.id = t.video_id
     LEFT JOIN LATERAL (
       SELECT signals, decision
       FROM payment_risk_signals
       WHERE transaction_id = t.id
       ORDER BY created_at DESC
       LIMIT 1
     ) r ON TRUE
     WHERE t.status = 'pendente'
       AND t.risk_score >= $1
     ORDER BY t.risk_score DESC, t.created_at ASC
     LIMIT $2`,
    [minScore, limit]
  );
  return result.rows;
}

async function countRecentProofHash(proofSha256, hours = 72) {
  if (!proofSha256) return 0;
  const result = await query(
    `SELECT COUNT(*)::int AS c
     FROM transactions
     WHERE proof_sha256 = $1
       AND created_at > NOW() - ($2 || ' hours')::interval`,
    [proofSha256, String(hours)]
  );
  return result.rows[0]?.c || 0;
}

async function countUserPending(userId) {
  const result = await query(
    `SELECT COUNT(*)::int AS c
     FROM transactions
     WHERE user_id = $1 AND status = 'pendente'`,
    [userId]
  );
  return result.rows[0]?.c || 0;
}

async function countUserSubmissions24h(userId) {
  const result = await query(
    `SELECT COUNT(*)::int AS c
     FROM transactions
     WHERE user_id = $1 AND created_at > NOW() - INTERVAL '24 hours'`,
    [userId]
  );
  return result.rows[0]?.c || 0;
}

async function listEncodingQueue({ status, limit = 40 } = {}) {
  const params = [];
  let where = `WHERE kind IN ('movie', 'episode')`;
  if (status) {
    params.push(status);
    where += ` AND encoding_status = $${params.length}`;
  } else {
    where += ` AND COALESCE(encoding_status, 'pending') NOT IN ('ready', 'finished', 'encoded')`;
  }
  params.push(limit);
  const result = await query(
    `SELECT id, title, kind, bunny_video_id, encoding_status, encoding_error,
            encoding_updated_at, workflow_status, is_published, updated_at
     FROM videos
     ${where}
     ORDER BY
       CASE COALESCE(encoding_status, 'pending')
         WHEN 'failed' THEN 0
         WHEN 'error' THEN 0
         WHEN 'processing' THEN 1
         ELSE 2
       END,
       encoding_updated_at DESC NULLS LAST,
       updated_at DESC
     LIMIT $${params.length}`,
    params
  );
  return result.rows;
}

async function updateEncoding(contentId, { encodingStatus, encodingError }) {
  const result = await query(
    `UPDATE videos
     SET encoding_status = COALESCE($2, encoding_status),
         encoding_error = CASE
           WHEN $2 IN ('ready', 'finished', 'encoded') THEN NULL
           ELSE COALESCE($3, encoding_error)
         END,
         encoding_updated_at = NOW(),
         updated_at = NOW()
     WHERE id = $1
     RETURNING id, title, kind, encoding_status, encoding_error, encoding_updated_at, bunny_video_id`,
    [contentId, encodingStatus || null, encodingError || null]
  );
  return result.rows[0] || null;
}

async function getScrubAssets(contentId) {
  const result = await query(
    `SELECT id, sprite_vtt_url, sprite_image_url, duration_seconds, title
     FROM videos WHERE id = $1`,
    [contentId]
  );
  return result.rows[0] || null;
}

async function findOAuthIdentity(provider, providerSub) {
  const result = await query(
    `SELECT * FROM oauth_identities
     WHERE provider = $1 AND provider_sub = $2`,
    [provider, providerSub]
  );
  return result.rows[0] || null;
}

async function findOAuthByUser(userId) {
  const result = await query(
    `SELECT id, provider, provider_sub, email, created_at, last_login_at
     FROM oauth_identities WHERE user_id = $1`,
    [userId]
  );
  return result.rows;
}

async function upsertOAuthIdentity({
  userId,
  provider,
  providerSub,
  email,
  rawProfile,
}) {
  const result = await query(
    `INSERT INTO oauth_identities (user_id, provider, provider_sub, email, raw_profile, last_login_at)
     VALUES ($1, $2, $3, $4, $5::jsonb, NOW())
     ON CONFLICT (provider, provider_sub) DO UPDATE
       SET user_id = EXCLUDED.user_id,
           email = COALESCE(EXCLUDED.email, oauth_identities.email),
           raw_profile = EXCLUDED.raw_profile,
           last_login_at = NOW()
     RETURNING *`,
    [
      userId,
      provider,
      providerSub,
      email || null,
      JSON.stringify(rawProfile || {}),
    ]
  );
  return result.rows[0];
}

function sha256FileBuffer(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

module.exports = {
  insertRiskSignal,
  setTransactionRisk,
  listHighRiskPending,
  countRecentProofHash,
  countUserPending,
  countUserSubmissions24h,
  listEncodingQueue,
  updateEncoding,
  getScrubAssets,
  findOAuthIdentity,
  findOAuthByUser,
  upsertOAuthIdentity,
  sha256FileBuffer,
};
