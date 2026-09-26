'use strict';

const { query } = require('../config/database');

async function upsertRating(profileId, contentId, rating) {
  const result = await query(
    `INSERT INTO content_ratings (profile_id, content_id, rating, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (profile_id, content_id)
     DO UPDATE SET rating = EXCLUDED.rating, updated_at = NOW()
     RETURNING rating`,
    [profileId, contentId, rating]
  );
  return result.rows[0];
}

async function getRating(profileId, contentId) {
  const result = await query(
    `SELECT rating FROM content_ratings
     WHERE profile_id = $1 AND content_id = $2`,
    [profileId, contentId]
  );
  return result.rows[0]?.rating ?? null;
}

async function ratingStats(contentId) {
  const result = await query(
    `SELECT
       COUNT(*) FILTER (WHERE rating >= 4)::int AS up,
       COUNT(*) FILTER (WHERE rating <= 2)::int AS down,
       ROUND(AVG(rating)::numeric, 2) AS avg,
       COUNT(*)::int AS count
     FROM content_ratings
     WHERE content_id = $1`,
    [contentId]
  );
  return result.rows[0];
}

async function addReminder(userId, contentId) {
  await query(
    `INSERT INTO content_reminders (user_id, content_id)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [userId, contentId]
  );
}

async function removeReminder(userId, contentId) {
  await query(
    `DELETE FROM content_reminders WHERE user_id = $1 AND content_id = $2`,
    [userId, contentId]
  );
}

async function hasReminder(userId, contentId) {
  const result = await query(
    `SELECT 1 FROM content_reminders WHERE user_id = $1 AND content_id = $2`,
    [userId, contentId]
  );
  return result.rowCount > 0;
}

async function listReminders(userId) {
  const result = await query(
    `SELECT v.id, v.title, v.slug, v.poster_url, v.backdrop_url, v.monetization,
            v.kind, v.coming_soon_at, v.synopsis_short, r.created_at
     FROM content_reminders r
     JOIN videos v ON v.id = r.content_id
     WHERE r.user_id = $1
     ORDER BY r.created_at DESC
     LIMIT 40`,
    [userId]
  );
  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    posterUrl: row.poster_url,
    backdropUrl: row.backdrop_url,
    monetization: row.monetization,
    kind: row.kind,
    comingSoonAt: row.coming_soon_at,
    synopsisShort: row.synopsis_short,
    remindedAt: row.created_at,
  }));
}

async function listGenres() {
  const result = await query(
    `SELECT genre, COUNT(*)::int AS count
     FROM videos
     WHERE genre IS NOT NULL
       AND genre <> ''
       AND kind IN ('movie', 'series')
       AND (
         (is_published = TRUE AND workflow_status = 'published')
         OR (coming_soon_at IS NOT NULL AND coming_soon_at > NOW())
       )
     GROUP BY genre
     ORDER BY count DESC, genre ASC
     LIMIT 30`
  );
  return result.rows;
}

module.exports = {
  upsertRating,
  getRating,
  ratingStats,
  addReminder,
  removeReminder,
  hasReminder,
  listReminders,
  listGenres,
};
