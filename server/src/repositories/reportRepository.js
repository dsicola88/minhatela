'use strict';

const { query } = require('../config/database');

const ALLOWED_REASONS = new Set([
  'inappropriate',
  'violence',
  'copyright',
  'spam',
  'wrong_metadata',
  'other',
]);

async function create({ reporterUserId, contentId, profileId, reason, details }) {
  const result = await query(
    `INSERT INTO content_reports
       (reporter_user_id, content_id, profile_id, reason, details)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (reporter_user_id, content_id, reason) DO UPDATE
       SET details = EXCLUDED.details,
           status = 'open',
           created_at = NOW()
     RETURNING id, reason, status, created_at`,
    [reporterUserId, contentId, profileId || null, reason, details || null]
  );
  return result.rows[0];
}

async function listOpen({ limit = 50 } = {}) {
  const result = await query(
    `SELECT r.id, r.reason, r.details, r.status, r.created_at,
            r.content_id, v.title AS content_title,
            u.email AS reporter_email
     FROM content_reports r
     JOIN videos v ON v.id = r.content_id
     JOIN users u ON u.id = r.reporter_user_id
     WHERE r.status = 'open'
     ORDER BY r.created_at ASC
     LIMIT $1`,
    [Math.min(200, Number(limit) || 50)]
  );
  return result.rows;
}

async function review({ reportId, reviewerId, status, notes }) {
  const result = await query(
    `UPDATE content_reports
     SET status = $2,
         reviewed_by = $3,
         reviewed_at = NOW(),
         review_notes = $4
     WHERE id = $1
     RETURNING id, status, reviewed_at`,
    [reportId, status, reviewerId, notes || null]
  );
  return result.rows[0] || null;
}

module.exports = {
  ALLOWED_REASONS,
  create,
  listOpen,
  review,
};
