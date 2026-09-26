'use strict';

const { query } = require('../config/database');

async function listWatchHistory(profileId, limit = 40) {
  const result = await query(
    `SELECT wp.position_seconds, wp.duration_seconds, wp.completed, wp.updated_at,
            v.id, v.title, v.slug, v.poster_url, v.backdrop_url, v.monetization,
            v.kind, v.series_id, v.season_number, v.episode_number, v.episode_title,
            s.title AS series_title
     FROM watch_progress wp
     JOIN videos v ON v.id = wp.video_id
     LEFT JOIN videos s ON s.id = v.series_id AND s.kind = 'series'
     WHERE wp.profile_id = $1
       AND wp.position_seconds > 5
     ORDER BY wp.updated_at DESC
     LIMIT $2`,
    [profileId, Math.min(100, Number(limit) || 40)]
  );

  return result.rows.map((row) => {
    const isEpisode = row.kind === 'episode';
    const percentage =
      row.duration_seconds > 0
        ? Math.min(100, Math.round((row.position_seconds / row.duration_seconds) * 100))
        : 0;
    return {
      id: row.id,
      title: isEpisode
        ? `${row.series_title || row.title} · T${row.season_number}:E${row.episode_number}`
        : row.title,
      subtitle: isEpisode ? row.episode_title || null : null,
      slug: row.slug,
      posterUrl: row.poster_url,
      backdropUrl: row.backdrop_url,
      monetization: row.monetization,
      kind: row.kind,
      seriesId: row.series_id,
      completed: row.completed,
      watchedAt: row.updated_at,
      progress: {
        positionSeconds: row.position_seconds,
        durationSeconds: row.duration_seconds,
        percentage,
      },
    };
  });
}

async function clearWatchHistory(profileId) {
  const result = await query(
    `DELETE FROM watch_progress WHERE profile_id = $1`,
    [profileId]
  );
  return result.rowCount || 0;
}

async function removeFromHistory(profileId, contentId) {
  const result = await query(
    `DELETE FROM watch_progress
     WHERE profile_id = $1 AND video_id = $2
     RETURNING video_id`,
    [profileId, contentId]
  );
  return result.rowCount > 0;
}

async function hideFromContinue(profileId, contentId) {
  const result = await query(
    `UPDATE watch_progress
     SET hidden_from_row = TRUE, updated_at = NOW()
     WHERE profile_id = $1 AND video_id = $2
     RETURNING video_id`,
    [profileId, contentId]
  );
  return result.rowCount > 0;
}

async function listComingSoon(maturityMax = 18, limit = 16) {
  const result = await query(
    `SELECT id, title, slug, synopsis_short, poster_url, backdrop_url,
            monetization, rental_price_kz, release_year, maturity_rating,
            kind, coming_soon_at
     FROM videos
     WHERE coming_soon_at IS NOT NULL
       AND coming_soon_at > NOW()
       AND kind IN ('movie', 'series')
       AND maturity_rating <= $1
       AND (
         is_published = FALSE
         OR workflow_status <> 'published'
       )
     ORDER BY coming_soon_at ASC
     LIMIT $2`,
    [maturityMax, limit]
  );
  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    synopsisShort: row.synopsis_short,
    posterUrl: row.poster_url,
    backdropUrl: row.backdrop_url,
    monetization: row.monetization,
    rentalPriceKz: row.rental_price_kz,
    releaseYear: row.release_year,
    maturityRating: row.maturity_rating,
    kind: row.kind,
    comingSoonAt: row.coming_soon_at,
    badge: 'EM BREVE',
  }));
}

async function listNewReleases(maturityMax = 18, limit = 16) {
  const result = await query(
    `SELECT id, title, slug, synopsis_short, poster_url, backdrop_url,
            monetization, rental_price_kz, release_year, maturity_rating,
            kind, released_at
     FROM videos
     WHERE is_published = TRUE
       AND workflow_status = 'published'
       AND kind IN ('movie', 'series')
       AND maturity_rating <= $1
       AND released_at IS NOT NULL
       AND released_at > NOW() - INTERVAL '45 days'
     ORDER BY released_at DESC
     LIMIT $2`,
    [maturityMax, limit]
  );
  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    synopsisShort: row.synopsis_short,
    posterUrl: row.poster_url,
    backdropUrl: row.backdrop_url,
    monetization: row.monetization,
    rentalPriceKz: row.rental_price_kz,
    releaseYear: row.release_year,
    maturityRating: row.maturity_rating,
    kind: row.kind,
    releasedAt: row.released_at,
    badge: 'NOVO',
  }));
}

module.exports = {
  listWatchHistory,
  clearWatchHistory,
  removeFromHistory,
  hideFromContinue,
  listComingSoon,
  listNewReleases,
};
