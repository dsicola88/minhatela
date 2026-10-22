'use strict';

const { query } = require('../config/database');

const { videoTenantSql } = require('../utils/tenantScope');

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
       AND ${videoTenantSql('v')}
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
       AND ${videoTenantSql('v')}
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
       AND ${videoTenantSql('v')}
     WHERE c.is_active = TRUE
     GROUP BY c.id
     ORDER BY c.sort_order ASC`,
    [maturityMax]
  );
  return result.rows;
}

async function listPublishedForSitemap(limit = 2000) {
  const safeLimit = Math.min(5000, Math.max(1, Number(limit) || 2000));
  const result = await query(
    `SELECT v.id, v.slug, v.title, v.kind, v.updated_at
     FROM videos v
     WHERE v.is_published = TRUE
       AND v.workflow_status = 'published'
       AND ${BROWSE_KINDS}
       AND ${videoTenantSql('v')}
     ORDER BY v.updated_at DESC
     LIMIT $1`,
    [safeLimit]
  );
  return result.rows;
}

async function hasActiveRights(contentId, territory = 'AO', modality = null) {
  const rightsService = require('../services/rightsService');
  const decision = await rightsService.canDistribute({ contentId, territory, modality });
  return decision.ok;
}

module.exports = {
  findPublishedById,
  findFeatured,
  findHomeRows,
  listPublishedForSitemap,
  hasActiveRights,
};
