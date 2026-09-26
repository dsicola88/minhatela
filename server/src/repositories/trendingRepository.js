'use strict';

const { query } = require('../config/database');

async function listTopAngola(maturityMax = 18, limit = 10, days = 7) {
  const result = await query(
    `WITH plays AS (
       SELECT
         CASE
           WHEN v.kind = 'episode' THEN COALESCE(v.series_id, v.id)
           ELSE v.id
         END AS title_id,
         COUNT(*)::int AS play_count
       FROM analytics_events ae
       JOIN videos v ON v.id = ae.content_id
       WHERE ae.event_name = 'video_started'
         AND ae.created_at > NOW() - ($3 || ' days')::interval
       GROUP BY 1
     )
     SELECT v.id, v.title, v.slug, v.synopsis_short, v.poster_url, v.backdrop_url,
            v.monetization, v.rental_price_kz, v.release_year, v.maturity_rating,
            v.kind, p.play_count,
            ROW_NUMBER() OVER (ORDER BY p.play_count DESC) AS rank
     FROM plays p
     JOIN videos v ON v.id = p.title_id
     WHERE v.is_published = TRUE
       AND v.workflow_status = 'published'
       AND v.kind IN ('movie', 'series')
       AND v.maturity_rating <= $1
     ORDER BY p.play_count DESC
     LIMIT $2`,
    [maturityMax, Math.min(20, Number(limit) || 10), String(days)]
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
    playCount: row.play_count,
    rank: Number(row.rank),
    badge: `N.º ${row.rank}`,
  }));
}

module.exports = { listTopAngola };
