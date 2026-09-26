'use strict';

const { query } = require('../config/database');
const discoveryRepository = require('../repositories/discoveryRepository');

/**
 * Recommendation Service (heurístico, preparado para ML).
 * Sinais: histórico do perfil, género, popularidade, Angola, recente, semelhantes.
 */
async function forProfile(profileId, limit = 18) {
  if (!profileId) {
    return popularAngola(limit);
  }

  const result = await query(
    `WITH watched AS (
       SELECT v.id, v.genre, v.monetization
       FROM watch_progress wp
       JOIN videos v ON v.id = wp.video_id
       WHERE wp.profile_id = $1
       ORDER BY wp.updated_at DESC
       LIMIT 20
     ),
     top_genres AS (
       SELECT genre, COUNT(*) AS c
       FROM watched
       WHERE genre IS NOT NULL
       GROUP BY genre
       ORDER BY c DESC
       LIMIT 3
     ),
     popular AS (
       SELECT ae.content_id, COUNT(*) AS plays
       FROM analytics_events ae
       WHERE ae.event_name IN ('video_started', 'video_played')
         AND ae.created_at > NOW() - INTERVAL '30 days'
       GROUP BY ae.content_id
     )
     SELECT DISTINCT ON (v.id)
            v.id, v.title, v.slug, v.synopsis_short, v.poster_url, v.backdrop_url,
            v.monetization, v.rental_price_kz, v.release_year, v.genre,
            COALESCE(p.plays, 0) AS popularity,
            CASE
              WHEN v.genre IN (SELECT genre FROM top_genres) THEN 0
              WHEN v.country_code = 'AO' THEN 1
              ELSE 2
            END AS affinity
     FROM videos v
     LEFT JOIN popular p ON p.content_id = v.id
     WHERE v.is_published = TRUE
       AND v.workflow_status = 'published'
       AND v.id NOT IN (SELECT id FROM watched)
     ORDER BY v.id, affinity ASC, popularity DESC, v.updated_at DESC
     LIMIT $2`,
    [profileId, limit]
  );

  // DISTINCT ON exige reordenar em app
  const cards = result.rows
    .sort((a, b) => a.affinity - b.affinity || b.popularity - a.popularity)
    .slice(0, limit)
    .map((row) => discoveryRepository.mapCard(row));

  if (cards.length < Math.min(8, limit)) {
    const fallback = await popularAngola(limit);
    const ids = new Set(cards.map((c) => c.id));
    for (const item of fallback) {
      if (!ids.has(item.id)) cards.push(item);
      if (cards.length >= limit) break;
    }
  }

  return cards;
}

async function popularAngola(limit = 18) {
  const result = await query(
    `SELECT v.id, v.title, v.slug, v.synopsis_short, v.poster_url, v.backdrop_url,
            v.monetization, v.rental_price_kz, v.release_year, v.genre,
            COUNT(ae.id)::int AS popularity
     FROM videos v
     LEFT JOIN analytics_events ae
       ON ae.content_id = v.id
      AND ae.event_name IN ('video_started', 'video_played')
      AND ae.created_at > NOW() - INTERVAL '45 days'
     WHERE v.is_published = TRUE
       AND v.workflow_status = 'published'
     GROUP BY v.id
     ORDER BY
       CASE WHEN v.country_code = 'AO' THEN 0 ELSE 1 END,
       popularity DESC,
       v.updated_at DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows.map(discoveryRepository.mapCard);
}

async function becauseYouWatched(profileId, limit = 12) {
  if (!profileId) return [];
  const last = await query(
    `SELECT v.id, v.title, v.genre
     FROM watch_progress wp
     JOIN videos v ON v.id = wp.video_id
     WHERE wp.profile_id = $1
     ORDER BY wp.updated_at DESC
     LIMIT 1`,
    [profileId]
  );
  if (!last.rowCount) return [];
  const seed = last.rows[0];
  const related = await discoveryRepository.related(seed.id, limit);
  return {
    seedTitle: seed.title,
    items: related,
  };
}

/** Mais como isto — rail pós-créditos / ficha (Netflix end-screen). */
async function moreLikeThis(contentId, { profileId, limit = 12 } = {}) {
  if (!contentId) return { items: [] };
  const items = await discoveryRepository.related(contentId, limit);
  let seedTitle = null;
  const seed = await query(`SELECT title FROM videos WHERE id = $1`, [contentId]);
  if (seed.rowCount) seedTitle = seed.rows[0].title;

  // Se perfil tem histórico no mesmo género, prioriza títulos não vistos
  if (profileId && items.length) {
    const watched = await query(
      `SELECT video_id FROM watch_progress WHERE profile_id = $1`,
      [profileId]
    );
    const seen = new Set(watched.rows.map((r) => r.video_id));
    items.sort((a, b) => Number(seen.has(a.id)) - Number(seen.has(b.id)));
  }

  return {
    seedTitle,
    contentId,
    items: items.slice(0, limit),
  };
}

module.exports = {
  forProfile,
  popularAngola,
  becauseYouWatched,
  moreLikeThis,
};
