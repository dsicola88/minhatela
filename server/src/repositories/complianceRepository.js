'use strict';

const { query, withTransaction } = require('../config/database');

async function requestDeletion(userId, graceDays = 30) {
  const result = await query(
    `UPDATE users
     SET deletion_requested_at = NOW(),
         deletion_scheduled_at = NOW() + ($2 || ' days')::interval,
         updated_at = NOW()
     WHERE id = $1
       AND deleted_at IS NULL
     RETURNING id, deletion_requested_at, deletion_scheduled_at`,
    [userId, String(graceDays)]
  );
  return result.rows[0] || null;
}

async function cancelDeletion(userId) {
  const result = await query(
    `UPDATE users
     SET deletion_requested_at = NULL,
         deletion_scheduled_at = NULL,
         updated_at = NOW()
     WHERE id = $1
       AND deleted_at IS NULL
       AND deletion_requested_at IS NOT NULL
     RETURNING id`,
    [userId]
  );
  return result.rows[0] || null;
}

async function softDeleteDue() {
  const result = await query(
    `UPDATE users
     SET deleted_at = NOW(),
         email = email || '.deleted.' || id::text,
         updated_at = NOW()
     WHERE deleted_at IS NULL
       AND deletion_scheduled_at IS NOT NULL
       AND deletion_scheduled_at <= NOW()
     RETURNING id`
  );
  return result.rows;
}

async function saveExport({ userId, payload, ip }) {
  const result = await query(
    `INSERT INTO account_data_exports (user_id, status, payload, request_ip)
     VALUES ($1, 'ready', $2::jsonb, $3)
     RETURNING id, status, created_at, expires_at`,
    [userId, JSON.stringify(payload), ip || null]
  );
  return result.rows[0];
}

async function getLatestExport(userId) {
  const result = await query(
    `SELECT id, status, payload, created_at, expires_at
     FROM account_data_exports
     WHERE user_id = $1
       AND expires_at > NOW()
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId]
  );
  return result.rows[0] || null;
}

async function getExportById(userId, exportId) {
  const result = await query(
    `SELECT id, status, payload, created_at, expires_at
     FROM account_data_exports
     WHERE id = $1 AND user_id = $2 AND expires_at > NOW()`,
    [exportId, userId]
  );
  return result.rows[0] || null;
}

async function gatherUserData(userId) {
  const [user, profiles, transactions, progress, favorites, consents, sessions] =
    await Promise.all([
      query(
        `SELECT id, email, full_name, subscription_status, premium_expires_at,
                email_verified_at, created_at, deletion_requested_at, deletion_scheduled_at
         FROM users WHERE id = $1`,
        [userId]
      ),
      query(
        `SELECT id, name, is_kids, maturity_max, created_at
         FROM profiles WHERE user_id = $1`,
        [userId]
      ),
      query(
        `SELECT id, type, amount_kz, status, created_at, paid_at
         FROM transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 200`,
        [userId]
      ),
      query(
        `SELECT wp.video_id AS content_id, wp.position_seconds, wp.duration_seconds,
                wp.updated_at, v.title
         FROM watch_progress wp
         JOIN profiles p ON p.id = wp.profile_id
         LEFT JOIN videos v ON v.id = wp.video_id
         WHERE p.user_id = $1
         ORDER BY wp.updated_at DESC
         LIMIT 500`,
        [userId]
      ).catch(() => ({ rows: [] })),
      query(
        `SELECT f.content_id, f.created_at, v.title
         FROM favorites f
         JOIN profiles p ON p.id = f.profile_id
         LEFT JOIN videos v ON v.id = f.content_id
         WHERE p.user_id = $1
         LIMIT 500`,
        [userId]
      ).catch(() => ({ rows: [] })),
      query(
        `SELECT doc_type, doc_version, locale, accepted_at
         FROM user_consents WHERE user_id = $1`,
        [userId]
      ),
      query(
        `SELECT id, device_name, platform, ip, last_seen_at, created_at
         FROM auth_sessions
         WHERE user_id = $1 AND revoked_at IS NULL
         LIMIT 50`,
        [userId]
      ).catch(() => ({ rows: [] })),
    ]);

  return {
    exportedAt: new Date().toISOString(),
    market: 'AO',
    user: user.rows[0] || null,
    profiles: profiles.rows,
    transactions: transactions.rows,
    watchProgress: progress.rows,
    favorites: favorites.rows,
    consents: consents.rows,
    sessions: sessions.rows,
  };
}

module.exports = {
  requestDeletion,
  cancelDeletion,
  softDeleteDue,
  saveExport,
  getLatestExport,
  getExportById,
  gatherUserData,
  withTransaction,
};
