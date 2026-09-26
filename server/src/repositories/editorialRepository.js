'use strict';

const { query } = require('../config/database');

function mapCollection(row) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle,
    sortOrder: row.sort_order,
    isPublished: row.is_published,
    placement: row.placement,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    updatedAt: row.updated_at,
  };
}

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
    kind: row.kind || 'movie',
    maturityRating: row.maturity_rating,
    trailerUrl: row.trailer_url || null,
    badge: row.item_badge || null,
  };
}

async function listPublished({ placement = 'home', maturityMax = 18 } = {}) {
  const result = await query(
    `SELECT c.*
     FROM editorial_collections c
     WHERE c.is_published = TRUE
       AND c.placement = $1
       AND (c.starts_at IS NULL OR c.starts_at <= NOW())
       AND (c.ends_at IS NULL OR c.ends_at > NOW())
     ORDER BY c.sort_order ASC, c.updated_at DESC`,
    [placement]
  );

  const collections = [];
  for (const row of result.rows) {
    const items = await query(
      `SELECT v.id, v.title, v.slug, v.synopsis_short, v.poster_url, v.backdrop_url,
              v.monetization, v.rental_price_kz, v.release_year, v.kind,
              v.maturity_rating, v.trailer_url, i.badge AS item_badge
       FROM editorial_collection_items i
       JOIN videos v ON v.id = i.content_id
       WHERE i.collection_id = $1
         AND v.is_published = TRUE
         AND v.workflow_status = 'published'
         AND v.kind IN ('movie', 'series')
         AND v.maturity_rating <= $2
       ORDER BY i.sort_order ASC, v.updated_at DESC
       LIMIT 24`,
      [row.id, maturityMax]
    );
    if (!items.rows.length) continue;
    collections.push({
      ...mapCollection(row),
      videos: items.rows.map(mapCard),
    });
  }
  return collections;
}

async function getBySlug(slug, maturityMax = 18) {
  const result = await query(
    `SELECT * FROM editorial_collections WHERE slug = $1 LIMIT 1`,
    [slug]
  );
  const row = result.rows[0];
  if (!row) return null;
  const items = await query(
    `SELECT v.id, v.title, v.slug, v.synopsis_short, v.poster_url, v.backdrop_url,
            v.monetization, v.rental_price_kz, v.release_year, v.kind,
            v.maturity_rating, v.trailer_url, i.badge AS item_badge
     FROM editorial_collection_items i
     JOIN videos v ON v.id = i.content_id
     WHERE i.collection_id = $1
       AND v.maturity_rating <= $2
     ORDER BY i.sort_order ASC`,
    [row.id, maturityMax]
  );
  return { ...mapCollection(row), videos: items.rows.map(mapCard) };
}

async function adminList() {
  const result = await query(
    `SELECT c.*,
            (SELECT COUNT(*)::int FROM editorial_collection_items i WHERE i.collection_id = c.id) AS item_count
     FROM editorial_collections c
     ORDER BY c.sort_order ASC, c.updated_at DESC`
  );
  return result.rows.map((r) => ({ ...mapCollection(r), itemCount: r.item_count }));
}

async function adminCreate({
  slug,
  title,
  subtitle,
  sortOrder,
  placement,
  isPublished,
  createdBy,
}) {
  const result = await query(
    `INSERT INTO editorial_collections
      (slug, title, subtitle, sort_order, placement, is_published, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING *`,
    [
      slug,
      title,
      subtitle || null,
      Number(sortOrder) || 100,
      placement || 'home',
      Boolean(isPublished),
      createdBy || null,
    ]
  );
  return mapCollection(result.rows[0]);
}

async function adminUpdate(id, body) {
  const result = await query(
    `UPDATE editorial_collections SET
       title = COALESCE($2, title),
       subtitle = COALESCE($3, subtitle),
       sort_order = COALESCE($4, sort_order),
       placement = COALESCE($5, placement),
       is_published = COALESCE($6, is_published),
       updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [
      id,
      body.title || null,
      body.subtitle !== undefined ? body.subtitle : null,
      body.sortOrder !== undefined ? Number(body.sortOrder) : null,
      body.placement || null,
      body.isPublished === undefined ? null : Boolean(body.isPublished),
    ]
  );
  return result.rows[0] ? mapCollection(result.rows[0]) : null;
}

async function adminSetItems(collectionId, items = []) {
  await query(`DELETE FROM editorial_collection_items WHERE collection_id = $1`, [
    collectionId,
  ]);
  let order = 0;
  for (const item of items) {
    const contentId = item.contentId || item.id;
    if (!contentId) continue;
    await query(
      `INSERT INTO editorial_collection_items (collection_id, content_id, sort_order, badge)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (collection_id, content_id) DO UPDATE
         SET sort_order = EXCLUDED.sort_order, badge = EXCLUDED.badge`,
      [collectionId, contentId, order++, item.badge || null]
    );
  }
  return getBySlugAdmin(collectionId);
}

async function getBySlugAdmin(idOrSlug) {
  const result = await query(
    `SELECT * FROM editorial_collections
     WHERE id::text = $1 OR slug = $1
     LIMIT 1`,
    [idOrSlug]
  );
  const row = result.rows[0];
  if (!row) return null;
  return getBySlug(row.slug, 18);
}

module.exports = {
  listPublished,
  getBySlug,
  adminList,
  adminCreate,
  adminUpdate,
  adminSetItems,
  getBySlugAdmin,
};
