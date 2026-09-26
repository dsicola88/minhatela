'use strict';

const { query } = require('../config/database');

function slugify(title) {
  return String(title)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 180);
}

async function createDraft(payload) {
  const slugBase = slugify(payload.title) || `content-${Date.now()}`;
  const slug = `${slugBase}-${Math.random().toString(36).slice(2, 7)}`;

  const result = await query(
    `INSERT INTO videos (
      title, slug, synopsis_short, synopsis_full, cast_text, creator_name,
      poster_url, backdrop_url, trailer_url, bunny_video_id, monetization,
      rental_price_kz, duration_seconds, release_year, is_featured, is_published,
      workflow_status, creator_id, age_rating, language_code, country_code,
      genre, director_name
    ) VALUES (
      $1,$2,$3,$4,$5,$6,
      $7,$8,$9,$10,$11,
      $12,$13,$14,FALSE,FALSE,
      'draft',$15,$16,$17,$18,
      $19,$20
    ) RETURNING *`,
    [
      payload.title,
      slug,
      payload.synopsisShort,
      payload.synopsisFull || payload.synopsisShort,
      payload.cast || null,
      payload.creatorDisplayName || null,
      payload.posterUrl,
      payload.backdropUrl || payload.posterUrl,
      payload.trailerUrl || null,
      payload.bunnyVideoId || null,
      payload.monetization || 'avod',
      payload.rentalPriceKz || null,
      payload.durationSeconds || 0,
      payload.releaseYear || new Date().getFullYear(),
      payload.creatorId,
      payload.ageRating || '12',
      payload.languageCode || 'pt',
      payload.countryCode || 'AO',
      payload.genre || null,
      payload.directorName || null,
    ]
  );
  return result.rows[0];
}

async function updateOwnedDraft(contentId, creatorId, patch) {
  const result = await query(
    `UPDATE videos SET
      title = COALESCE($3, title),
      synopsis_short = COALESCE($4, synopsis_short),
      synopsis_full = COALESCE($5, synopsis_full),
      cast_text = COALESCE($6, cast_text),
      poster_url = COALESCE($7, poster_url),
      backdrop_url = COALESCE($8, backdrop_url),
      trailer_url = COALESCE($9, trailer_url),
      bunny_video_id = COALESCE($10, bunny_video_id),
      monetization = COALESCE($11, monetization),
      rental_price_kz = COALESCE($12, rental_price_kz),
      duration_seconds = COALESCE($13, duration_seconds),
      release_year = COALESCE($14, release_year),
      age_rating = COALESCE($15, age_rating),
      genre = COALESCE($16, genre),
      director_name = COALESCE($17, director_name),
      updated_at = NOW()
     WHERE id = $1
       AND creator_id = $2
       AND workflow_status IN ('draft', 'rejected')
     RETURNING *`,
    [
      contentId,
      creatorId,
      patch.title || null,
      patch.synopsisShort || null,
      patch.synopsisFull || null,
      patch.cast || null,
      patch.posterUrl || null,
      patch.backdropUrl || null,
      patch.trailerUrl || null,
      patch.bunnyVideoId || null,
      patch.monetization || null,
      patch.rentalPriceKz ?? null,
      patch.durationSeconds ?? null,
      patch.releaseYear ?? null,
      patch.ageRating || null,
      patch.genre || null,
      patch.directorName || null,
    ]
  );
  return result.rows[0] || null;
}

async function findOwned(contentId, creatorId) {
  const result = await query(
    `SELECT * FROM videos WHERE id = $1 AND creator_id = $2 LIMIT 1`,
    [contentId, creatorId]
  );
  return result.rows[0] || null;
}

async function findById(contentId) {
  const result = await query(`SELECT * FROM videos WHERE id = $1 LIMIT 1`, [contentId]);
  return result.rows[0] || null;
}

async function listByCreator(creatorId) {
  const result = await query(
    `SELECT id, title, slug, workflow_status, monetization, poster_url,
            bunny_video_id, rental_price_kz, duration_seconds, release_year, is_published,
            submitted_at, reviewed_at, rejection_reason, created_at, updated_at
     FROM videos
     WHERE creator_id = $1
     ORDER BY updated_at DESC`,
    [creatorId]
  );
  return result.rows;
}

async function submitForReview(contentId, creatorId) {
  const result = await query(
    `UPDATE videos
     SET workflow_status = 'submitted',
         submitted_at = NOW(),
         rejection_reason = NULL,
         updated_at = NOW()
     WHERE id = $1
       AND creator_id = $2
       AND workflow_status IN ('draft', 'rejected')
     RETURNING *`,
    [contentId, creatorId]
  );
  return result.rows[0] || null;
}

async function listForModeration(status = 'submitted') {
  const result = await query(
    `SELECT v.*, c.display_name AS creator_display_name, u.email AS creator_email
     FROM videos v
     LEFT JOIN creators c ON c.id = v.creator_id
     LEFT JOIN users u ON u.id = c.user_id
     WHERE v.workflow_status = $1
     ORDER BY v.submitted_at ASC NULLS LAST, v.created_at ASC`,
    [status]
  );
  return result.rows;
}

async function moderate(contentId, { status, reviewerId, rejectionReason }) {
  const publish = status === 'published' || status === 'approved';
  const workflow = status === 'approved' ? 'approved' : status;

  const result = await query(
    `UPDATE videos
     SET workflow_status = $2,
         is_published = CASE WHEN $2 = 'published' THEN TRUE ELSE FALSE END,
         reviewed_at = NOW(),
         reviewer_id = $3,
         rejection_reason = $4,
         updated_at = NOW()
     WHERE id = $1
       AND workflow_status IN ('submitted', 'under_review', 'approved')
     RETURNING *`,
    [contentId, workflow, reviewerId, rejectionReason || null]
  );

  // approved -> can be published in second step; support direct publish
  if (publish && result.rows[0] && workflow === 'approved') {
    const pub = await query(
      `UPDATE videos
       SET workflow_status = 'published', is_published = TRUE, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [contentId]
    );
    return pub.rows[0] || result.rows[0];
  }

  return result.rows[0] || null;
}

async function creatorAnalytics(creatorId) {
  const [content, views, earnings] = await Promise.all([
    query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE workflow_status = 'published')::int AS published,
         COUNT(*) FILTER (WHERE workflow_status = 'submitted')::int AS submitted,
         COUNT(*) FILTER (WHERE workflow_status = 'draft')::int AS drafts
       FROM videos WHERE creator_id = $1`,
      [creatorId]
    ),
    query(
      `SELECT COUNT(*)::int AS views
       FROM analytics_events ae
       JOIN videos v ON v.id = ae.content_id
       WHERE v.creator_id = $1 AND ae.event_name IN ('video_started', 'video_played')`,
      [creatorId]
    ),
    query(
      `SELECT COALESCE(SUM(amount_kz), 0)::int AS total_kz
       FROM creator_earnings WHERE creator_id = $1`,
      [creatorId]
    ),
  ]);

  return {
    content: content.rows[0],
    views: views.rows[0].views,
    revenueKz: earnings.rows[0].total_kz,
  };
}

module.exports = {
  createDraft,
  updateOwnedDraft,
  findOwned,
  findById,
  listByCreator,
  submitForReview,
  listForModeration,
  moderate,
  creatorAnalytics,
};
