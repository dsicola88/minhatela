'use strict';

const { query } = require('../config/database');

async function findByUserId(userId) {
  const result = await query(`SELECT * FROM creators WHERE user_id = $1`, [userId]);
  return result.rows[0] || null;
}

async function findById(id) {
  const result = await query(`SELECT * FROM creators WHERE id = $1`, [id]);
  return result.rows[0] || null;
}

async function create({
  userId,
  type,
  displayName,
  bio,
  bankIban,
  bankName,
  bankAccountName,
}) {
  const result = await query(
    `INSERT INTO creators
      (user_id, type, display_name, bio, bank_iban, bank_name, bank_account_name, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'pending')
     RETURNING *`,
    [
      userId,
      type || 'creator',
      displayName,
      bio || null,
      bankIban || null,
      bankName || null,
      bankAccountName || null,
    ]
  );
  return result.rows[0];
}

async function updateStatus(id, status) {
  const result = await query(
    `UPDATE creators
     SET status = $1,
         verified_at = CASE WHEN $1 = 'active' THEN NOW() ELSE verified_at END,
         updated_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [status, id]
  );
  return result.rows[0] || null;
}

async function listPending() {
  const result = await query(
    `SELECT c.*, u.email, u.full_name
     FROM creators c
     JOIN users u ON u.id = c.user_id
     WHERE c.status = 'pending'
     ORDER BY c.created_at ASC`
  );
  return result.rows;
}

module.exports = {
  findByUserId,
  findById,
  create,
  updateStatus,
  listPending,
};
