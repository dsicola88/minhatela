'use strict';

const { query } = require('../config/database');
const { mapContentPublic } = require('../utils/mappers');
const { videoTenantSql } = require('../utils/tenantScope');

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
    creatorName: row.creator_name || null,
    trailerUrl: row.trailer_url || null,
    comingSoonAt: row.coming_soon_at || null,
    badge: row.coming_soon_at && new Date(row.coming_soon_at) > new Date() ? 'EM BREVE' : null,
  };
}

const SORTS = {
  newest: 'v.release_year DESC NULLS LAST, v.title ASC',
  oldest: 'v.release_year ASC NULLS LAST, v.title ASC',
  title: 'v.title ASC',
  added: 'COALESCE(v.released_at, v.updated_at) DESC, v.title ASC',
};

const CARD_COLUMNS = `v.id, v.title, v.slug, v.synopsis_short, v.poster_url, v.backdrop_url,
           v.monetization, v.rental_price_kz, v.release_year, v.genre, v.kind,
           v.maturity_rating, v.trailer_url, v.coming_soon_at, v.creator_name`;

async function search({
  q,
  limit = 24,
  offset = 0,
  userId,
  profileId,
  kind,
  monetization,
  genre,
  year,
  creator,
  subtitle,
  sort,
  maturityMax = 18,
}) {
  const term = String(q || '').trim();
  const filters = [];
  const params = [];
  let idx = 1;

  filters.push(`v.kind IN ('movie', 'series')`);
  filters.push(videoTenantSql('v'));
  filters.push(`(
    (v.is_published = TRUE AND v.workflow_status = 'published')
    OR (v.coming_soon_at IS NOT NULL AND v.coming_soon_at > NOW())
  )`);
  filters.push(`v.maturity_rating <= $${idx++}`);
  params.push(Number(maturityMax) || 18);

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
  if (creator) {
    filters.push(`lower(v.creator_name) = lower($${idx++})`);
    params.push(String(creator).trim());
  }
  if (subtitle) {
    filters.push(`$${idx++} = ANY(v.subtitle_languages)`);
    params.push(String(subtitle).trim().toLowerCase());
  }

  let orderSql = SORTS[sort] || 'v.updated_at DESC, v.title ASC';
  let searchParamIndex = null;

  if (term.length >= 2) {
    searchParamIndex = idx;
    filters.push(`(
      v.search_vector @@ plainto_tsquery('portuguese', $${idx})
      OR v.title ILIKE '%' || $${idx} || '%'
      OR coalesce(v.genre, '') ILIKE '%' || $${idx} || '%'
      OR coalesce(v.creator_name, '') ILIKE '%' || $${idx} || '%'
      OR coalesce(v.cast_text, '') ILIKE '%' || $${idx} || '%'
    )`);
    params.push(term);
    idx += 1;
    if (!sort || sort === 'relevance') {
      orderSql = `ts_rank(v.search_vector, plainto_tsquery('portuguese', $${searchParamIndex})) DESC NULLS LAST, v.title ASC`;
    }
  }

  const where = filters.join(' AND ');
  const counted = await query(
    `SELECT COUNT(*)::int AS total FROM videos v WHERE ${where}`,
    params
  );
  const total = counted.rows[0]?.total || 0;

  const pageLimit = Math.min(48, Math.max(1, Number(limit) || 24));
  const pageOffset = Math.max(0, Number(offset) || 0);
  const limitIdx = idx;
  const offsetIdx = idx + 1;
  const pageParams = params.concat([pageLimit, pageOffset]);

  const sql = `
    SELECT ${CARD_COLUMNS}
           ${searchParamIndex ? `, ts_rank(v.search_vector, plainto_tsquery('portuguese', $${searchParamIndex})) AS rank` : ''}
    FROM videos v
    WHERE ${where}
    ORDER BY ${orderSql}
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
  `;

  const result = await query(sql, pageParams);

  if (term.length >= 2) {
    await query(
      `INSERT INTO search_queries (user_id, profile_id, query, results_count)
       VALUES ($1,$2,$3,$4)`,
      [userId || null, profileId || null, term, total]
    );
  }

  return {
    query: term,
    filters: {
      kind: kind || null,
      monetization: monetization || null,
      genre: genre || null,
      year: year || null,
      creator: creator || null,
      subtitle: subtitle || null,
      sort: sort || (term.length >= 2 ? 'relevance' : 'added'),
    },
    results: result.rows.map(mapCard),
    total,
    limit: pageLimit,
    offset: pageOffset,
  };
}

const SUBTITLE_LABELS = {
  pt: 'Português',
  en: 'Inglês',
  fr: 'Francês',
  es: 'Espanhol',
  umb: 'Umbundu',
  kmb: 'Kimbundu',
};

async function catalogFacets() {
  const published = `
    v.kind IN ('movie', 'series')
    AND ${videoTenantSql('v')}
    AND (
      (v.is_published = TRUE AND v.workflow_status = 'published')
      OR (v.coming_soon_at IS NOT NULL AND v.coming_soon_at > NOW())
    )`;
  const [genres, years, creators, subtitles] = await Promise.all([
    query(
      `SELECT v.genre, COUNT(*)::int AS count
       FROM videos v
       WHERE v.genre IS NOT NULL AND v.genre <> '' AND ${published}
       GROUP BY v.genre
       ORDER BY count DESC, v.genre ASC`
    ),
    query(
      `SELECT v.release_year AS year, COUNT(*)::int AS count
       FROM videos v
       WHERE v.release_year IS NOT NULL AND ${published}
       GROUP BY v.release_year
       ORDER BY v.release_year DESC`
    ),
    query(
      `SELECT v.creator_name AS name, COUNT(*)::int AS count
       FROM videos v
       WHERE v.creator_name IS NOT NULL AND btrim(v.creator_name) <> '' AND ${published}
       GROUP BY v.creator_name
       ORDER BY count DESC, v.creator_name ASC`
    ),
    query(
      `SELECT lang, COUNT(*)::int AS count
       FROM videos v, unnest(v.subtitle_languages) AS lang
       WHERE ${published}
       GROUP BY lang
       ORDER BY count DESC, lang ASC`
    ),
  ]);
  return {
    genres: genres.rows.map((row) => ({ id: row.genre, label: row.genre, count: row.count })),
    years: years.rows.map((row) => ({ id: String(row.year), label: String(row.year), count: row.count })),
    creators: creators.rows.map((row) => ({ id: row.name, label: row.name, count: row.count })),
    subtitles: subtitles.rows.map((row) => ({
      id: row.lang,
      label: SUBTITLE_LABELS[row.lang] || row.lang,
      count: row.count,
    })),
    sorts: [
      { id: 'relevance', label: 'Relevância' },
      { id: 'newest', label: 'Ano recente' },
      { id: 'oldest', label: 'Ano antigo' },
      { id: 'added', label: 'Recém-adicionados' },
      { id: 'title', label: 'A–Z' },
    ],
  };
}

async function listFavorites(profileId) {
  const result = await query(
    `SELECT v.id, v.title, v.slug, v.synopsis_short, v.poster_url, v.backdrop_url,
            v.monetization, v.rental_price_kz, v.release_year, v.genre, v.kind
     FROM favorites f
     JOIN videos v ON v.id = f.content_id
     WHERE f.profile_id = $1
       AND ${videoTenantSql('v')}
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
    `SELECT id, genre, monetization, creator_id FROM videos v
     WHERE v.id = $1 AND ${videoTenantSql('v')}`,
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
       AND ${videoTenantSql('v')}
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
  catalogFacets,
  listFavorites,
  addFavorite,
  removeFavorite,
  isFavorite,
  related,
  mapCard,
};
