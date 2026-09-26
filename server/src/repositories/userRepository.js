'use strict';

const { query } = require('../config/database');

async function findByEmail(email) {
  const result = await query(
    `SELECT id, email, full_name, password_hash, subscription_status,
            premium_expires_at, is_admin, created_at, email_verified_at,
            deleted_at, deletion_requested_at, deletion_scheduled_at
     FROM users WHERE email = $1 AND deleted_at IS NULL`,
    [email]
  );
  return result.rows[0] || null;
}

async function findById(id) {
  const result = await query(
    `SELECT id, email, full_name, subscription_status, premium_expires_at,
            is_admin, created_at, email_verified_at,
            deleted_at, deletion_requested_at, deletion_scheduled_at
     FROM users WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  );
  return result.rows[0] || null;
}

async function findAuthById(id) {
  const result = await query(
    `SELECT id, email, full_name, password_hash, subscription_status,
            premium_expires_at, is_admin, created_at, email_verified_at,
            deleted_at, deletion_requested_at, deletion_scheduled_at
     FROM users WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  );
  return result.rows[0] || null;
}

async function create({ email, passwordHash, fullName }) {
  const result = await query(
    `INSERT INTO users (email, password_hash, full_name)
     VALUES ($1, $2, $3)
     RETURNING id, email, full_name, subscription_status, created_at, is_admin`,
    [email, passwordHash, fullName]
  );
  return result.rows[0];
}

async function getRoles(userId) {
  const result = await query(
    `SELECT r.code
     FROM user_roles ur
     JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id = $1`,
    [userId]
  );
  return result.rows.map((r) => r.code);
}

async function assignRole(userId, roleCode) {
  await query(
    `INSERT INTO user_roles (user_id, role_id)
     SELECT $1, id FROM roles WHERE code = $2
     ON CONFLICT DO NOTHING`,
    [userId, roleCode]
  );
}

async function updatePassword(userId, passwordHash) {
  await query(
    `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
    [passwordHash, userId]
  );
}

module.exports = {
  findByEmail,
  findById,
  findAuthById,
  create,
  getRoles,
  assignRole,
  updatePassword,
};
