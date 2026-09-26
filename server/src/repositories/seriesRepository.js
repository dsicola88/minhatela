'use strict';

const { query } = require('../config/database');

async function findSeriesEpisodes(seriesId) {
  const result = await query(
    `SELECT id, title, slug, synopsis_short, poster_url, backdrop_url,
            monetization, rental_price_kz, duration_seconds, release_year,
            kind, series_id, season_number, episode_number, episode_title,
            intro_end_seconds, credits_start_seconds, maturity_rating,
            bunny_video_id, is_published, workflow_status
     FROM videos
     WHERE series_id = $1
       AND kind = 'episode'
       AND is_published = TRUE
       AND workflow_status = 'published'
     ORDER BY season_number ASC, episode_number ASC`,
    [seriesId]
  );
  return result.rows;
}

async function findEpisodeProgress(profileId, seriesId) {
  if (!profileId) return new Map();
  const result = await query(
    `SELECT wp.video_id, wp.position_seconds, wp.duration_seconds, wp.completed
     FROM watch_progress wp
     JOIN videos v ON v.id = wp.video_id
     WHERE wp.profile_id = $1
       AND v.series_id = $2
       AND v.kind = 'episode'`,
    [profileId, seriesId]
  );
  const map = new Map();
  for (const row of result.rows) {
    map.set(row.video_id, row);
  }
  return map;
}

async function findNextEpisode(episodeId) {
  const current = await query(
    `SELECT id, series_id, season_number, episode_number, kind
     FROM videos WHERE id = $1`,
    [episodeId]
  );
  const ep = current.rows[0];
  if (!ep || ep.kind !== 'episode' || !ep.series_id) return null;

  const next = await query(
    `SELECT id, title, slug, synopsis_short, poster_url, backdrop_url,
            monetization, duration_seconds, season_number, episode_number,
            episode_title, series_id, kind, intro_end_seconds, credits_start_seconds
     FROM videos
     WHERE series_id = $1
       AND kind = 'episode'
       AND is_published = TRUE
       AND workflow_status = 'published'
       AND (
         season_number > $2
         OR (season_number = $2 AND episode_number > $3)
       )
     ORDER BY season_number ASC, episode_number ASC
     LIMIT 1`,
    [ep.series_id, ep.season_number, ep.episode_number]
  );
  return next.rows[0] || null;
}

async function findSeriesById(seriesId) {
  const result = await query(
    `SELECT * FROM videos
     WHERE id = $1 AND kind = 'series'
       AND is_published = TRUE AND workflow_status = 'published'`,
    [seriesId]
  );
  return result.rows[0] || null;
}

async function findFirstEpisode(seriesId) {
  const result = await query(
    `SELECT *
     FROM videos
     WHERE series_id = $1
       AND kind = 'episode'
       AND is_published = TRUE
       AND workflow_status = 'published'
     ORDER BY season_number ASC, episode_number ASC
     LIMIT 1`,
    [seriesId]
  );
  return result.rows[0] || null;
}

async function findContinueEpisode(profileId, seriesId) {
  // Último episódio em progresso não completo; senão primeiro não visto; senão primeiro
  const inProgress = await query(
    `SELECT v.*
     FROM watch_progress wp
     JOIN videos v ON v.id = wp.video_id
     WHERE wp.profile_id = $1
       AND v.series_id = $2
       AND v.kind = 'episode'
       AND wp.completed = FALSE
       AND wp.position_seconds > 15
     ORDER BY wp.updated_at DESC
     LIMIT 1`,
    [profileId, seriesId]
  );
  if (inProgress.rows[0]) return inProgress.rows[0];

  const unwatched = await query(
    `SELECT v.*
     FROM videos v
     LEFT JOIN watch_progress wp
       ON wp.video_id = v.id AND wp.profile_id = $1
     WHERE v.series_id = $2
       AND v.kind = 'episode'
       AND v.is_published = TRUE
       AND v.workflow_status = 'published'
       AND (wp.id IS NULL OR wp.completed = FALSE)
     ORDER BY v.season_number ASC, v.episode_number ASC
     LIMIT 1`,
    [profileId, seriesId]
  );
  if (unwatched.rows[0]) return unwatched.rows[0];

  return findFirstEpisode(seriesId);
}

module.exports = {
  findSeriesEpisodes,
  findEpisodeProgress,
  findNextEpisode,
  findSeriesById,
  findFirstEpisode,
  findContinueEpisode,
};
