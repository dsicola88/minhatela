'use strict';

const { query } = require('../config/database');

async function upsertPreference({ profileId, contentId, notInterested, markedWatched }) {
  const result = await query(
    `INSERT INTO title_preferences (profile_id, content_id, not_interested, marked_watched, updated_at)
     VALUES ($1, $2, COALESCE($3, FALSE), COALESCE($4, FALSE), NOW())
     ON CONFLICT (profile_id, content_id) DO UPDATE SET
       not_interested = COALESCE($3, title_preferences.not_interested),
       marked_watched = COALESCE($4, title_preferences.marked_watched),
       updated_at = NOW()
     RETURNING *`,
    [
      profileId,
      contentId,
      notInterested === undefined ? null : Boolean(notInterested),
      markedWatched === undefined ? null : Boolean(markedWatched),
    ]
  );
  return result.rows[0];
}

async function getPreference(profileId, contentId) {
  const result = await query(
    `SELECT * FROM title_preferences WHERE profile_id = $1 AND content_id = $2`,
    [profileId, contentId]
  );
  return result.rows[0] || null;
}

async function listNotInterestedIds(profileId) {
  if (!profileId) return [];
  const result = await query(
    `SELECT content_id FROM title_preferences
     WHERE profile_id = $1 AND not_interested = TRUE`,
    [profileId]
  );
  return result.rows.map((r) => r.content_id);
}

async function clearNotInterested(profileId, contentId) {
  const result = await query(
    `UPDATE title_preferences
     SET not_interested = FALSE, updated_at = NOW()
     WHERE profile_id = $1 AND content_id = $2
     RETURNING *`,
    [profileId, contentId]
  );
  return result.rows[0] || null;
}

async function markWatchedInProgress(profileId, contentId) {
  // Force progress to ~100% so Continuar a assistir some e Histórico reflecte
  const video = await query(
    `SELECT id, duration_seconds, kind, series_id FROM videos WHERE id = $1`,
    [contentId]
  );
  if (!video.rowCount) return null;
  const v = video.rows[0];
  const duration = Math.max(Number(v.duration_seconds) || 3600, 60);
  const position = duration;

  await query(
    `INSERT INTO watch_progress (profile_id, video_id, position_seconds, duration_seconds, completed, hidden_from_row, updated_at)
     VALUES ($1, $2, $3, $4, TRUE, TRUE, NOW())
     ON CONFLICT (profile_id, video_id) DO UPDATE SET
       position_seconds = $3,
       duration_seconds = $4,
       completed = TRUE,
       hidden_from_row = TRUE,
       updated_at = NOW()`,
    [profileId, contentId, position, duration]
  );

  await upsertPreference({
    profileId,
    contentId,
    markedWatched: true,
    notInterested: false,
  });

  return { contentId, markedWatched: true, positionSeconds: position, durationSeconds: duration };
}

async function unmarkWatched(profileId, contentId) {
  await query(
    `DELETE FROM watch_progress WHERE profile_id = $1 AND video_id = $2`,
    [profileId, contentId]
  );
  await upsertPreference({
    profileId,
    contentId,
    markedWatched: false,
  });
  return { contentId, markedWatched: false };
}

async function listOriginals(maturityMax = 18, limit = 18) {
  const result = await query(
    `SELECT v.id, v.title, v.slug, v.synopsis_short, v.poster_url, v.backdrop_url,
            v.monetization, v.rental_price_kz, v.release_year, v.genre, v.kind,
            v.maturity_rating, v.trailer_url, v.is_original
     FROM videos v
     WHERE v.is_published = TRUE
       AND v.workflow_status = 'published'
       AND v.is_original = TRUE
       AND v.kind IN ('movie', 'series')
       AND COALESCE(v.maturity_rating, 12) <= $1
     ORDER BY v.updated_at DESC
     LIMIT $2`,
    [maturityMax, limit]
  );
  return result.rows;
}

async function createLoginAlert({ userId, sessionId, deviceName, platform, ip, userAgent }) {
  const result = await query(
    `INSERT INTO login_alerts (user_id, session_id, device_name, platform, ip, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [userId, sessionId || null, deviceName || null, platform || null, ip || null, userAgent || null]
  );
  return result.rows[0];
}

async function recentLoginAlert(userId, hours = 24) {
  const result = await query(
    `SELECT * FROM login_alerts
     WHERE user_id = $1 AND created_at > NOW() - ($2 || ' hours')::interval
     ORDER BY created_at DESC
     LIMIT 5`,
    [userId, String(hours)]
  );
  return result.rows;
}

async function markAlertNotified(alertId) {
  await query(`UPDATE login_alerts SET notified = TRUE WHERE id = $1`, [alertId]);
}

async function countKnownDevices(userId) {
  const result = await query(
    `SELECT COUNT(DISTINCT COALESCE(device_name, '') || '|' || COALESCE(platform, ''))::int AS c
     FROM auth_sessions
     WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId]
  );
  return result.rows[0]?.c || 0;
}

module.exports = {
  upsertPreference,
  getPreference,
  listNotInterestedIds,
  clearNotInterested,
  markWatchedInProgress,
  unmarkWatched,
  listOriginals,
  createLoginAlert,
  recentLoginAlert,
  markAlertNotified,
  countKnownDevices,
};
