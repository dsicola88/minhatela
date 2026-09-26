'use strict';

const { query } = require('../config/database');
const { mapContentPublic } = require('../utils/mappers');

function mapCard(row) {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    synopsisShort: row.synopsis_short,
    posterUrl: row.poster_url,
    backdropUrl: row.backdrop_url,
    monetization: row.monetization,
    rentalPriceKz: row.rental_price_kz,
    releaseYear: row.release_year,
    genre: row.genre,
    kind: row.kind || 'movie',
    maturityRating: row.maturity_rating,
    trailerUrl: row.trailer_url || null,
    comingSoonAt: row.coming_soon_at || null,
    badge: row.coming_soon_at && new Date(row.coming_soon_at) > new Date() ? 'EM BREVE' : null,
  };
}

async function search({
  q,
  limit = 24,
  userId,
  profileId,
  kind,
  monetization,
  genre,
  year,
}) {
  const term = String(q || '').trim();
  const filters = [];
  const params = [];
  let idx = 1;

  // Base browse kinds
  filters.push(`v.kind IN ('movie', 'series')`);
  filters.push(`(
    (v.is_published = TRUE AND v.workflow_status = 'published')
    OR (v.coming_soon_at IS NOT NULL AND v.coming_soon_at > NOW())
  )`);

  if (kind && ['movie', 'series'].includes(kind)) {
    filters.push(`v.kind = $${idx++}`);
    params.push(kind);
  }
  if (monetization && ['avod', 'svod', 'tvod'].includes(monetization)) {
    filters.push(`v.monetization = $${idx++}`);
    params.push(monetization);
  }
  if (genre) {
    filters.push(`v.genre ILIKE $${idx++}`);
    params.push(genre);
  }
  if (year && Number(year)) {
    filters.push(`v.release_year = $${idx++}`);
    params.push(Number(year));
  }

  let orderSql = `v.updated_at DESC`;
  let searchParamIndex = null;

  if (term.length >= 2) {
    searchParamIndex = idx;
    filters.push(`(
      v.search_vector @@ plainto_tsquery('portuguese', $${idx})
      OR v.title ILIKE '%' || $${idx} || '%'
      OR coalesce(v.genre, '') ILIKE '%' || $${idx} || '%'
      OR coalesce(v.creator_name, '') ILIKE '%' || $${idx} || '%'
    )`);
    params.push(term);
    idx += 1;
    orderSql = `ts_rank(v.search_vector, plainto_tsquery('portuguese', $${searchParamIndex})) DESC NULLS LAST, v.updated_at DESC`;
  }

  const limitIdx = idx;
  params.push(Math.min(50, Number(limit) || 24));

  const sql = `
    SELECT v.id, v.title, v.slug, v.synopsis_short, v.poster_url, v.backdrop_url,
           v.monetization, v.rental_price_kz, v.release_year, v.genre, v.kind,
           v.maturity_rating, v.trailer_url, v.coming_soon_at
           ${searchParamIndex ? `, ts_rank(v.search_vector, plainto_tsquery('portuguese', $${searchParamIndex})) AS rank` : ''}
    FROM videos v
    WHERE ${filters.join(' AND ')}
    ORDER BY ${orderSql}
    LIMIT $${limitIdx}
  `;

  const result = await query(sql, params);

  if (term.length >= 2) {
    await query(
      `INSERT INTO search_queries (user_id, profile_id, query, results_count)
       VALUES ($1,$2,$3,$4)`,
      [userId || null, profileId || null, term, result.rowCount]
    );
  }

  return {
    query: term,
    filters: { kind: kind || null, monetization: monetization || null, genre: genre || null, year: year || null },
    results: result.rows.map(mapCard),
    total: result.rowCount,
  };
}

async function listFavorites(profileId) {
  const result = await query(
    `SELECT v.id, v.title, v.slug, v.synopsis_short, v.poster_url, v.backdrop_url,
            v.monetization, v.rental_price_kz, v.release_year, v.genre, v.kind
     FROM favorites f
     JOIN videos v ON v.id = f.content_id
     WHERE f.profile_id = $1
       AND v.kind IN ('movie', 'series')
       AND (
         (v.is_published = TRUE AND v.workflow_status = 'published')
         OR (v.coming_soon_at IS NOT NULL AND v.coming_soon_at > NOW())
       )
     ORDER BY f.created_at DESC
     LIMIT 40`,
    [profileId]
  );
  return result.rows.map(mapCard);
}

async function addFavorite(profileId, contentId) {
  await query(
    `INSERT INTO favorites (profile_id, content_id)
     VALUES ($1,$2)
     ON CONFLICT DO NOTHING`,
    [profileId, contentId]
  );
}

async function removeFavorite(profileId, contentId) {
  await query(
    `DELETE FROM favorites WHERE profile_id = $1 AND content_id = $2`,
    [profileId, contentId]
  );
}

async function isFavorite(profileId, contentId) {
  const result = await query(
    `SELECT 1 FROM favorites WHERE profile_id = $1 AND content_id = $2`,
    [profileId, contentId]
  );
  return result.rowCount > 0;
}

async function related(contentId, limit = 12) {
  const base = await query(
    `SELECT id, genre, monetization, creator_id FROM videos
     WHERE id = $1`,
    [contentId]
  );
  if (!base.rowCount) return [];

  const item = base.rows[0];
  const result = await query(
    `SELECT v.id, v.title, v.slug, v.synopsis_short, v.poster_url, v.backdrop_url,
            v.monetization, v.rental_price_kz, v.release_year, v.genre, v.kind
     FROM videos v
     WHERE v.is_published = TRUE
       AND v.workflow_status = 'published'
       AND v.kind IN ('movie', 'series')
       AND v.id <> $1
       AND (
         (v.genre IS NOT NULL AND v.genre = $2)
         OR v.monetization = $3
         OR (v.creator_id IS NOT NULL AND v.creator_id = $4)
         OR v.country_code = 'AO'
       )
     ORDER BY
       CASE WHEN v.genre = $2 THEN 0 ELSE 1 END,
       v.updated_at DESC
     LIMIT $5`,
    [contentId, item.genre, item.monetization, item.creator_id, limit]
  );
  return result.rows.map(mapCard);
}

module.exports = {
  search,
  listFavorites,
  addFavorite,
  removeFavorite,
  isFavorite,
  related,
  mapCard,
};
