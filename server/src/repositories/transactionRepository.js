'use strict';

const { query } = require('../config/database');
const { STATUS } = require('../utils/transactionStatus');

async function findPendingRental(userId, videoId) {
  const result = await query(
    `SELECT id, status
     FROM transactions
     WHERE user_id = $1
       AND video_id = $2
       AND type = 'rental'
       AND status = $3
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId, videoId, STATUS.PENDING]
  );
  return result.rows[0] || null;
}

async function create({ userId, videoId, packId, type, paymentMethod, amountKz, proofUrl, idempotencyKey }) {
  const result = await query(
    `INSERT INTO transactions
      (user_id, video_id, pack_id, type, payment_method, amount_kz, status, proof_url, idempotency_key)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, status, amount_kz, created_at, proof_url, idempotency_key, pack_id`,
    [
      userId,
      videoId || null,
      packId || null,
      type,
      paymentMethod,
      amountKz,
      STATUS.PENDING,
      proofUrl,
      idempotencyKey || null,
    ]
  );
  return result.rows[0];
}

async function findByIdempotency(userId, idempotencyKey) {
  if (!idempotencyKey) return null;
  const result = await query(
    `SELECT id, status, amount_kz, created_at, proof_url, idempotency_key, type, video_id
     FROM transactions
     WHERE user_id = $1 AND idempotency_key = $2
     LIMIT 1`,
    [userId, idempotencyKey]
  );
  return result.rows[0] || null;
}

async function listByUser(userId) {
  const result = await query(
    `SELECT t.id, t.type, t.payment_method, t.amount_kz, t.status, t.video_id,
            t.proof_url, t.paid_at, t.access_expires_at, t.created_at,
            v.title AS video_title
     FROM transactions t
     LEFT JOIN videos v ON v.id = t.video_id
     WHERE t.user_id = $1
     ORDER BY t.created_at DESC
     LIMIT 50`,
    [userId]
  );
  return result.rows;
}

async function listPending() {
  const result = await query(
    `SELECT t.*, u.email, u.full_name, v.title AS video_title
     FROM transactions t
     JOIN users u ON u.id = t.user_id
     LEFT JOIN videos v ON v.id = t.video_id
     WHERE t.status = $1
     ORDER BY COALESCE(t.risk_score, 0) DESC, t.created_at ASC`,
    [STATUS.PENDING]
  );
  return result.rows;
}

async function updateStatus(
  id,
  status,
  adminNotes,
  { reviewerId, rejectionReason, fromStatus = 'pendente' } = {}
) {
  const result = await query(
    `UPDATE transactions
     SET status = $1::transaction_status,
         admin_notes = COALESCE($2, admin_notes),
         rejection_reason = COALESCE($3, rejection_reason),
         reviewer_id = COALESCE($4, reviewer_id),
         reviewed_at = CASE
           WHEN $1::text IN ('pago', 'rejeitado') THEN NOW()
           ELSE reviewed_at
         END
     WHERE id = $5
       AND status = $6::transaction_status
     RETURNING *`,
    [
      status,
      adminNotes || null,
      rejectionReason || null,
      reviewerId || null,
      id,
      fromStatus,
    ]
  );
  return result.rows[0] || null;
}

async function revokeEntitlementsForTransaction(transactionId) {
  await query(`DELETE FROM rentals WHERE transaction_id = $1`, [transactionId]);
  await query(`DELETE FROM pack_entitlements WHERE transaction_id = $1`, [transactionId]);
}

async function findById(id) {
  const result = await query(`SELECT * FROM transactions WHERE id = $1`, [id]);
  return result.rows[0] || null;
}

async function findOwnedById(userId, transactionId) {
  const result = await query(
    `SELECT t.*, u.email, u.full_name, v.title AS video_title
     FROM transactions t
     JOIN users u ON u.id = t.user_id
     LEFT JOIN videos v ON v.id = t.video_id
     WHERE t.id = $1 AND t.user_id = $2`,
    [transactionId, userId]
  );
  return result.rows[0] || null;
}

module.exports = {
  findPendingRental,
  create,
  findByIdempotency,
  listByUser,
  listPending,
  updateStatus,
  findOwnedById,
  revokeEntitlementsForTransaction,
  findById,
};
