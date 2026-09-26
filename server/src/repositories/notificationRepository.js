'use strict';

const { query } = require('../config/database');

async function create({ userId, type, title, body, data }) {
  const result = await query(
    `INSERT INTO notifications (user_id, type, title, body, data)
     VALUES ($1, $2, $3, $4, $5::jsonb)
     RETURNING id, user_id, type, title, body, data, read_at, created_at`,
    [userId, type, title, body, JSON.stringify(data || {})]
  );
  return result.rows[0];
}

async function listByUser(userId, { limit = 40, unreadOnly = false } = {}) {
  const result = await query(
    `SELECT id, type, title, body, data, read_at, created_at
     FROM notifications
     WHERE user_id = $1
       AND ($2::boolean = FALSE OR read_at IS NULL)
     ORDER BY created_at DESC
     LIMIT $3`,
    [userId, Boolean(unreadOnly), Math.min(100, Number(limit) || 40)]
  );
  return result.rows;
}

async function unreadCount(userId) {
  const result = await query(
    `SELECT COUNT(*)::int AS count
     FROM notifications
     WHERE user_id = $1 AND read_at IS NULL`,
    [userId]
  );
  return result.rows[0].count;
}

async function markRead(userId, notificationId) {
  const result = await query(
    `UPDATE notifications
     SET read_at = NOW()
     WHERE id = $1 AND user_id = $2 AND read_at IS NULL
     RETURNING id, read_at`,
    [notificationId, userId]
  );
  return result.rows[0] || null;
}

async function markAllRead(userId) {
  const result = await query(
    `UPDATE notifications
     SET read_at = NOW()
     WHERE user_id = $1 AND read_at IS NULL
     RETURNING id`,
    [userId]
  );
  return result.rowCount;
}

module.exports = {
  create,
  listByUser,
  unreadCount,
  markRead,
  markAllRead,
};
