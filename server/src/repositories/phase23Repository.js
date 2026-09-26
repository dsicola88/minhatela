'use strict';

const { query } = require('../config/database');

async function saveDiagnostic(row) {
  const result = await query(
    `INSERT INTO network_diagnostics
       (user_id, profile_id, latency_ms, downlink_kbps, recommended_quality, carrier_hint, platform, client_meta)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
     RETURNING *`,
    [
      row.userId || null,
      row.profileId || null,
      row.latencyMs ?? null,
      row.downlinkKbps ?? null,
      row.recommendedQuality || 'auto',
      row.carrierHint || null,
      row.platform || null,
      JSON.stringify(row.clientMeta || {}),
    ]
  );
  return result.rows[0];
}

async function followSeries({ profileId, seriesId, userId, notify = true }) {
  const result = await query(
    `INSERT INTO series_follows (profile_id, series_id, user_id, notify_new_episodes)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (profile_id, series_id) DO UPDATE SET
       notify_new_episodes = EXCLUDED.notify_new_episodes
     RETURNING *`,
    [profileId, seriesId, userId, notify !== false]
  );
  return result.rows[0];
}

async function unfollowSeries(profileId, seriesId) {
  const result = await query(
    `DELETE FROM series_follows WHERE profile_id = $1 AND series_id = $2 RETURNING *`,
    [profileId, seriesId]
  );
  return result.rows[0] || null;
}

async function isFollowing(profileId, seriesId) {
  const result = await query(
    `SELECT 1 FROM series_follows WHERE profile_id = $1 AND series_id = $2`,
    [profileId, seriesId]
  );
  return result.rowCount > 0;
}

async function listFollows(profileId) {
  const result = await query(
    `SELECT sf.*, v.title, v.poster_url, v.slug, v.kind
     FROM series_follows sf
     JOIN videos v ON v.id = sf.series_id
     WHERE sf.profile_id = $1
     ORDER BY sf.created_at DESC`,
    [profileId]
  );
  return result.rows;
}

async function followersForSeries(seriesId) {
  const result = await query(
    `SELECT user_id, profile_id FROM series_follows
     WHERE series_id = $1 AND notify_new_episodes = TRUE`,
    [seriesId]
  );
  return result.rows;
}

async function listUnnotifiedEpisodes(limit = 40) {
  const result = await query(
    `SELECT e.id, e.title, e.episode_title, e.season_number, e.episode_number,
            e.series_id, s.title AS series_title
     FROM videos e
     JOIN videos s ON s.id = e.series_id
     WHERE e.kind = 'episode'
       AND e.is_published = TRUE
       AND e.workflow_status = 'published'
       AND e.episode_notified_at IS NULL
       AND e.created_at > NOW() - INTERVAL '14 days'
     ORDER BY e.created_at ASC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}

async function markEpisodeNotified(episodeId) {
  await query(
    `UPDATE videos SET episode_notified_at = NOW() WHERE id = $1`,
    [episodeId]
  );
}

async function listLanguages() {
  const result = await query(
    `SELECT lang AS language, COUNT(*)::int AS count
     FROM videos v, unnest(COALESCE(v.languages, ARRAY['pt']::text[])) AS lang
     WHERE v.is_published = TRUE
       AND v.workflow_status = 'published'
       AND v.kind IN ('movie', 'series')
     GROUP BY lang
     ORDER BY count DESC, lang ASC`
  );
  return result.rows;
}

async function byLanguage(lang, maturityMax = 18, limit = 40) {
  const result = await query(
    `SELECT v.id, v.title, v.slug, v.synopsis_short, v.poster_url, v.backdrop_url,
            v.monetization, v.rental_price_kz, v.release_year, v.genre, v.kind,
            v.maturity_rating, v.languages, v.is_original
     FROM videos v
     WHERE v.is_published = TRUE
       AND v.workflow_status = 'published'
       AND v.kind IN ('movie', 'series')
       AND COALESCE(v.maturity_rating, 12) <= $2
       AND $1 = ANY(COALESCE(v.languages, ARRAY['pt']::text[]))
     ORDER BY v.updated_at DESC
     LIMIT $3`,
    [lang, maturityMax, limit]
  );
  return result.rows;
}

async function listCategoryHub() {
  const result = await query(
    `SELECT c.id, c.slug, c.title,
            COUNT(vc.video_id)::int AS count
     FROM categories c
     LEFT JOIN video_categories vc ON vc.category_id = c.id
     LEFT JOIN videos v ON v.id = vc.video_id
       AND v.is_published = TRUE
       AND v.workflow_status = 'published'
       AND v.kind IN ('movie', 'series')
     GROUP BY c.id, c.slug, c.title
     HAVING COUNT(vc.video_id) > 0
     ORDER BY count DESC, c.title ASC`
  );
  return result.rows;
}

async function byCategorySlug(slug, maturityMax = 18, limit = 40) {
  const result = await query(
    `SELECT v.id, v.title, v.slug, v.synopsis_short, v.poster_url, v.backdrop_url,
            v.monetization, v.rental_price_kz, v.release_year, v.genre, v.kind,
            v.maturity_rating, v.is_original
     FROM categories c
     JOIN video_categories vc ON vc.category_id = c.id
     JOIN videos v ON v.id = vc.video_id
     WHERE c.slug = $1
       AND v.is_published = TRUE
       AND v.workflow_status = 'published'
       AND v.kind IN ('movie', 'series')
       AND COALESCE(v.maturity_rating, 12) <= $2
     ORDER BY v.updated_at DESC
     LIMIT $3`,
    [slug, maturityMax, limit]
  );
  return result.rows;
}

async function listInvoices(userId, limit = 50) {
  const result = await query(
    `SELECT * FROM billing_invoices
     WHERE user_id = $1
     ORDER BY issued_at DESC
     LIMIT $2`,
    [userId, limit]
  );
  return result.rows;
}

async function findInvoice(userId, invoiceId) {
  const result = await query(
    `SELECT * FROM billing_invoices WHERE id = $1 AND user_id = $2`,
    [invoiceId, userId]
  );
  return result.rows[0] || null;
}

async function ensureInvoiceFromTransaction(tx) {
  if (!tx?.id || !tx?.user_id) return null;
  const existing = await query(
    `SELECT * FROM billing_invoices WHERE transaction_id = $1`,
    [tx.id]
  );
  if (existing.rowCount) return existing.rows[0];

  const num =
    'MT-' +
    new Date().toISOString().slice(0, 10).replace(/-/g, '') +
    '-' +
    String(tx.id).replace(/-/g, '').slice(0, 8).toUpperCase();

  const result = await query(
    `INSERT INTO billing_invoices
       (user_id, transaction_id, invoice_number, title, amount_kz, status, issued_at, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7, NOW()),$8::jsonb)
     ON CONFLICT (invoice_number) DO NOTHING
     RETURNING *`,
    [
      tx.user_id,
      tx.id,
      num,
      tx.type === 'subscription' ? 'Assinatura Premium MinhaTela' : 'Aluguer TVOD',
      tx.amount_kz || 0,
      tx.status === 'pago' ? 'paid' : 'pending',
      tx.paid_at || null,
      JSON.stringify({ type: tx.type, method: tx.payment_method }),
    ]
  );
  return result.rows[0] || null;
}

module.exports = {
  saveDiagnostic,
  followSeries,
  unfollowSeries,
  isFollowing,
  listFollows,
  followersForSeries,
  listUnnotifiedEpisodes,
  markEpisodeNotified,
  listLanguages,
  byLanguage,
  listCategoryHub,
  byCategorySlug,
  listInvoices,
  findInvoice,
  ensureInvoiceFromTransaction,
};
