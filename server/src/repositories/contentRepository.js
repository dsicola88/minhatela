'use strict';

const { query } = require('../config/database');

const BROWSE_KINDS = `v.kind IN ('movie', 'series')`;

async function findPublishedById(id) {
  const result = await query(
    `SELECT v.*,
            COALESCE(
              json_agg(
                json_build_object('id', c.id, 'slug', c.slug, 'title', c.title)
              ) FILTER (WHERE c.id IS NOT NULL),
              '[]'::json
            ) AS categories
     FROM videos v
     LEFT JOIN video_categories vc ON vc.video_id = v.id
     LEFT JOIN categories c ON c.id = vc.category_id
     WHERE v.id = $1
       AND (
         (v.is_published = TRUE AND v.workflow_status = 'published')
         OR (v.coming_soon_at IS NOT NULL AND v.coming_soon_at > NOW())
       )
     GROUP BY v.id`,
    [id]
  );
  return result.rows[0] || null;
}

async function findFeatured(maturityMax = 18) {
  const result = await query(
    `SELECT *
     FROM videos v
     WHERE v.is_published = TRUE
       AND v.is_featured = TRUE
       AND v.workflow_status = 'published'
       AND v.maturity_rating <= $1
       AND ${BROWSE_KINDS}
     ORDER BY v.updated_at DESC
     LIMIT 1`,
    [maturityMax]
  );
  return result.rows[0] || null;
}

async function findHomeRows(maturityMax = 18) {
  const result = await query(
    `SELECT c.id, c.slug, c.title, c.sort_order,
            COALESCE(
              json_agg(
                json_build_object(
                  'id', v.id,
                  'title', v.title,
                  'slug', v.slug,
                  'synopsisShort', v.synopsis_short,
                  'posterUrl', v.poster_url,
                  'backdropUrl', v.backdrop_url,
                  'monetization', v.monetization,
                  'rentalPriceKz', v.rental_price_kz,
                  'releaseYear', v.release_year,
                  'maturityRating', v.maturity_rating,
                  'kind', v.kind,
                  'trailerUrl', v.trailer_url
                )
                ORDER BY v.updated_at DESC
              ) FILTER (WHERE v.id IS NOT NULL),
              '[]'::json
            ) AS videos
     FROM categories c
     LEFT JOIN video_categories vc ON vc.category_id = c.id
     LEFT JOIN videos v ON v.id = vc.video_id
       AND v.is_published = TRUE
       AND v.workflow_status = 'published'
       AND v.maturity_rating <= $1
       AND ${BROWSE_KINDS}
     WHERE c.is_active = TRUE
     GROUP BY c.id
     ORDER BY c.sort_order ASC`,
    [maturityMax]
  );
  return result.rows;
}

async function hasActiveRights(contentId, territory = 'AO') {
  const result = await query(
    `SELECT 1
     FROM content_rights
     WHERE content_id = $1
       AND territory = $2
       AND status = 'active'
       AND starts_at <= NOW()
       AND (ends_at IS NULL OR ends_at > NOW())
     LIMIT 1`,
    [contentId, territory]
  );

  if (result.rowCount > 0) return true;

  const anyRights = await query(
    `SELECT 1 FROM content_rights WHERE content_id = $1 LIMIT 1`,
    [contentId]
  );

  return anyRights.rowCount === 0;
}

module.exports = {
  findPublishedById,
  findFeatured,
  findHomeRows,
  hasActiveRights,
};
