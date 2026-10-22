'use strict';

const { query, withTransaction } = require('../config/database');
const { videoTenantSql, opsVideoSql, tenantWriteSql } = require('../utils/tenantScope');

async function findActiveDecision({
  placement = 'pre_roll',
  userId = null,
  contentGenre = null,
  device = null,
} = {}) {
  const result = await query(
    `SELECT c.id AS campaign_id, c.name, c.placement, c.budget_kz, c.spent_kz,
            c.targeting, cr.id AS creative_id, cr.title, cr.media_url, cr.click_url,
            cr.duration_seconds, cr.cta_label, cr.media_kind, cr.cards
     FROM campaigns c
     JOIN ad_creatives cr ON cr.campaign_id = c.id AND cr.is_active = TRUE
     WHERE c.status = 'active'
       AND ${videoTenantSql('c')}
       AND c.placement = $1
       AND c.starts_at <= NOW()
       AND c.ends_at > NOW()
       AND c.funded = TRUE
       AND c.spent_kz < c.budget_kz
       AND COALESCE(c.targeting->>'territory', 'AO') IN ('AO', 'ALL')
       AND (
         $3::text IS NULL
         OR COALESCE(c.targeting->>'contentCategory', '') = ''
         OR c.targeting->>'contentCategory' = $3
       )
       AND (
         $4::text IS NULL
         OR COALESCE(c.targeting->>'device', '') = ''
         OR c.targeting->>'device' = $4
       )
       AND (
         COALESCE(NULLIF(c.targeting->>'frequencyCapPerDay', ''), '0')::int <= 0
         OR $2::uuid IS NULL
         OR (
           SELECT COUNT(*)::int FROM ad_impressions ai
           WHERE ai.campaign_id = c.id
             AND ai.user_id = $2
             AND ai.created_at >= date_trunc('day', NOW())
         ) < COALESCE(NULLIF(c.targeting->>'frequencyCapPerDay', ''), '0')::int
       )
     ORDER BY c.created_at ASC
     LIMIT 1`,
    [placement, userId || null, contentGenre || null, device || null]
  );
  return result.rows[0] || null;
}

async function recordImpression({
  campaignId,
  creativeId,
  contentId,
  userId,
  placement,
  device,
}) {
  const result = await query(
    `INSERT INTO ad_impressions
      (campaign_id, creative_id, content_id, user_id, placement, device)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING id, campaign_id, content_id, completed, billed`,
    [campaignId, creativeId || null, contentId || null, userId || null, placement, device || null]
  );
  return result.rows[0];
}

async function findOwnedImpression(impressionId, userId) {
  const result = await query(
    `SELECT ai.*, cr.duration_seconds AS creative_duration_seconds
     FROM ad_impressions ai
     LEFT JOIN ad_creatives cr ON cr.id = ai.creative_id
     WHERE ai.id = $1 AND ai.user_id = $2`,
    [impressionId, userId]
  );
  return result.rows[0] || null;
}

async function startImpression({ impressionId, userId }) {
  const result = await query(
    `UPDATE ad_impressions
     SET started = TRUE, started_at = COALESCE(started_at, NOW())
     WHERE id = $1
       AND user_id = $2
       AND started = FALSE
     RETURNING id, started`,
    [impressionId, userId]
  );
  return result.rows[0] || null;
}

async function completeImpression({ impressionId, userId, unitKz, minWatchSeconds = 2 }) {
  const unit = Math.max(1, Number(unitKz) || 1);
  const minSecs = Math.max(1, Number(minWatchSeconds) || 2);
  return withTransaction(async (client) => {
    const billed = await client.query(
      `UPDATE ad_impressions
       SET completed = TRUE,
           completed_at = COALESCE(completed_at, NOW())
       WHERE id = $1
         AND completed = FALSE
         AND billed = FALSE
         AND user_id = $2
         AND started = TRUE
         AND started_at IS NOT NULL
         AND started_at <= NOW() - ($3::text || ' seconds')::interval
       RETURNING id, campaign_id, content_id, user_id`,
      [impressionId, userId, String(minSecs)]
    );
    const row = billed.rows[0];
    if (!row) return null;

    await client.query(`SELECT id FROM campaigns WHERE id = $1 FOR UPDATE`, [row.campaign_id]);

    const spend = await client.query(
      `UPDATE campaigns
       SET spent_kz = spent_kz + $2,
           updated_at = NOW(),
           status = CASE
             WHEN spent_kz + $2 >= budget_kz THEN 'completed'::campaign_status
             ELSE status
           END
       WHERE id = $1
         AND status <> 'rejected'
         AND spent_kz + $2 <= budget_kz
       RETURNING id, spent_kz, status`,
      [row.campaign_id, unit]
    );

    if (!spend.rowCount) {
      await client.query(
        `UPDATE ad_impressions
         SET billed = FALSE, billed_kz = 0, invalid_reason = 'no_budget_or_ineligible'
         WHERE id = $1`,
        [row.id]
      );
      return { ...row, billedKz: 0, billed: false, reason: 'no_budget_or_ineligible' };
    }

    await client.query(
      `UPDATE ad_impressions
       SET billed = TRUE, billed_kz = $2, invalid_reason = NULL
       WHERE id = $1`,
      [row.id, unit]
    );
    return { ...row, billedKz: unit, billed: true };
  });
}

async function recordClick({ impressionId, userId }) {
  const result = await query(
    `INSERT INTO ad_clicks (impression_id, campaign_id)
     SELECT ai.id, ai.campaign_id
     FROM ad_impressions ai
     WHERE ai.id = $1
       AND ai.user_id = $2
       AND NOT EXISTS (SELECT 1 FROM ad_clicks ac WHERE ac.impression_id = ai.id)
     RETURNING id, campaign_id, impression_id`,
    [impressionId, userId]
  );
  return result.rows[0] || null;
}

async function createAdvertiser({ userId, companyName, contactEmail }) {
  const result = await query(
    `INSERT INTO advertisers (user_id, company_name, contact_email, status, tenant_id)
     VALUES ($1,$2,$3,'active', ${tenantWriteSql()})
     RETURNING *`,
    [userId, companyName, contactEmail]
  );
  return result.rows[0];
}

async function findAdvertiserByUser(userId) {
  const result = await query(`SELECT * FROM advertisers WHERE user_id = $1`, [userId]);
  return result.rows[0] || null;
}

async function createCampaign(payload) {
  const result = await query(
    `INSERT INTO campaigns
      (advertiser_id, name, placement, budget_kz, starts_at, ends_at, status,
       targeting, objective, tenant_id)
     VALUES ($1,$2,$3,$4,$5,$6,'pending_review',$7::jsonb,$8, ${tenantWriteSql()})
     RETURNING *`,
    [
      payload.advertiserId,
      payload.name,
      payload.placement || 'pre_roll',
      payload.budgetKz,
      payload.startsAt,
      payload.endsAt,
      JSON.stringify(payload.targeting || {}),
      payload.objective || 'brand',
    ]
  );
  return result.rows[0];
}

async function addCreative({
  campaignId,
  title,
  mediaUrl,
  clickUrl,
  durationSeconds,
  ctaLabel,
  mediaKind,
  cards,
}) {
  const result = await query(
    `INSERT INTO ad_creatives
      (campaign_id, title, media_url, click_url, duration_seconds, cta_label, media_kind, cards)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
     RETURNING *`,
    [
      campaignId,
      title,
      mediaUrl,
      clickUrl || null,
      durationSeconds || 15,
      ctaLabel || 'Saber mais',
      mediaKind || 'video',
      JSON.stringify(cards || []),
    ]
  );
  return result.rows[0];
}

async function listCampaigns(advertiserId, { status, q, limit = 80 } = {}) {
  const needle = q ? `%${String(q).trim().toLowerCase()}%` : null;
  const result = await query(
    `SELECT c.*,
            cr.media_url, cr.click_url, cr.title AS creative_title, cr.cta_label,
            cr.duration_seconds, cr.media_kind, cr.cards,
            tx.status AS payment_status
     FROM campaigns c
     LEFT JOIN LATERAL (
       SELECT * FROM ad_creatives x WHERE x.campaign_id = c.id ORDER BY x.created_at DESC LIMIT 1
     ) cr ON TRUE
     LEFT JOIN LATERAL (
       SELECT t.status FROM transactions t
       WHERE t.id = c.transaction_id OR t.campaign_id = c.id
       ORDER BY t.created_at DESC
       LIMIT 1
     ) tx ON TRUE
     WHERE c.advertiser_id = $1
       AND ($2::text IS NULL OR c.status::text = $2)
       AND ($3::text IS NULL OR LOWER(c.name) LIKE $3)
     ORDER BY c.created_at DESC
     LIMIT $4`,
    [advertiserId, status || null, needle, Math.min(200, Number(limit) || 80)]
  );
  return result.rows;
}

async function getOwnedCampaign(advertiserId, campaignId) {
  const result = await query(
    `SELECT c.*,
            cr.id AS creative_id, cr.media_url, cr.click_url, cr.title AS creative_title,
            cr.cta_label, cr.duration_seconds, cr.media_kind, cr.cards,
            tx.status AS payment_status
     FROM campaigns c
     LEFT JOIN LATERAL (
       SELECT * FROM ad_creatives x WHERE x.campaign_id = c.id ORDER BY x.created_at DESC LIMIT 1
     ) cr ON TRUE
     LEFT JOIN LATERAL (
       SELECT t.status FROM transactions t
       WHERE t.id = c.transaction_id OR t.campaign_id = c.id
       ORDER BY t.created_at DESC
       LIMIT 1
     ) tx ON TRUE
     WHERE c.advertiser_id = $1 AND c.id = $2`,
    [advertiserId, campaignId]
  );
  return result.rows[0] || null;
}

async function listHistory(campaignId, advertiserId) {
  const result = await query(
    `SELECT h.*
     FROM campaign_history h
     JOIN campaigns c ON c.id = h.campaign_id
     WHERE h.campaign_id = $1 AND c.advertiser_id = $2
     ORDER BY h.created_at DESC
     LIMIT 50`,
    [campaignId, advertiserId]
  );
  return result.rows;
}

async function addHistory({ campaignId, actorId, action, fromStatus, toStatus, reason, payload }) {
  await query(
    `INSERT INTO campaign_history
      (campaign_id, actor_id, action, from_status, to_status, reason, payload)
     VALUES ($1,$2,$3,$4::campaign_status,$5::campaign_status,$6,$7::jsonb)`,
    [
      campaignId,
      actorId || null,
      action,
      fromStatus || null,
      toStatus || null,
      reason || null,
      JSON.stringify(payload || {}),
    ]
  );
}

async function advertiserWithdraw(advertiserId, campaignId) {
  const current = await query(
    `SELECT id, status FROM campaigns WHERE id = $1 AND advertiser_id = $2`,
    [campaignId, advertiserId]
  );
  const row = current.rows[0];
  if (!row) return { error: 'missing' };
  if (row.status === 'active') return { error: 'active' };
  if (row.status === 'completed') return { error: 'completed' };
  const result = await query(
    `UPDATE campaigns
     SET status = 'rejected',
         rejection_reason = 'Retirada pelo anunciante',
         updated_at = NOW()
     WHERE id = $1 AND advertiser_id = $2
       AND status IN ('draft', 'pending_review', 'paused')
     RETURNING *`,
    [campaignId, advertiserId]
  );
  return { row: result.rows[0] || null, fromStatus: row.status };
}

async function advertiserPause(advertiserId, campaignId) {
  const result = await query(
    `UPDATE campaigns
     SET status = 'paused', updated_at = NOW()
     WHERE id = $1 AND advertiser_id = $2 AND status = 'active'
     RETURNING *`,
    [campaignId, advertiserId]
  );
  return result.rows[0] || null;
}

async function advertiserResume(advertiserId, campaignId) {
  const result = await query(
    `UPDATE campaigns
     SET status = 'active', updated_at = NOW()
     WHERE id = $1
       AND advertiser_id = $2
       AND status = 'paused'
       AND funded = TRUE
       AND spent_kz < budget_kz
       AND starts_at <= NOW()
       AND ends_at > NOW()
     RETURNING *`,
    [campaignId, advertiserId]
  );
  return result.rows[0] || null;
}

async function attachTransaction(campaignId, transactionId) {
  await query(
    `UPDATE campaigns SET transaction_id = $2, updated_at = NOW() WHERE id = $1`,
    [campaignId, transactionId]
  );
}

async function moderateCampaign(id, status, { reason, reviewerId } = {}) {
  const result = await query(
    `UPDATE campaigns
     SET status = $2::campaign_status,
         rejection_reason = CASE WHEN $2::text = 'rejected' THEN $3 ELSE rejection_reason END,
         reviewed_by = $4,
         reviewed_at = NOW(),
         updated_at = NOW()
     WHERE id = $1
       AND (
         $2::text <> 'active'
         OR funded = TRUE
       )
     RETURNING *`,
    [id, status, reason || null, reviewerId || null]
  );
  return result.rows[0] || null;
}

async function findCampaignWithAdvertiser(id) {
  const result = await query(
    `SELECT c.*, a.user_id AS advertiser_user_id, a.contact_email, a.company_name,
            cr.media_url, cr.click_url, cr.cta_label, cr.title AS creative_title,
            cr.media_kind, cr.cards
     FROM campaigns c
     JOIN advertisers a ON a.id = c.advertiser_id
     LEFT JOIN LATERAL (
       SELECT * FROM ad_creatives x WHERE x.campaign_id = c.id ORDER BY x.created_at DESC LIMIT 1
     ) cr ON TRUE
     WHERE c.id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

async function campaignStats(advertiserId, { from, to, campaignId } = {}) {
  const result = await query(
    `SELECT
       COUNT(DISTINCT c.id)::int AS campaigns,
       COALESCE(SUM(c.budget_kz),0)::int AS budget_kz,
       COALESCE(SUM(c.spent_kz),0)::int AS spent_kz,
       (
         SELECT COUNT(*)::int FROM ad_impressions ai
         JOIN campaigns cx ON cx.id = ai.campaign_id
         WHERE cx.advertiser_id = $1
           AND ($2::uuid IS NULL OR cx.id = $2)
           AND ($3::timestamptz IS NULL OR ai.created_at >= $3)
           AND ($4::timestamptz IS NULL OR ai.created_at < $4)
       ) AS impressions,
       (
         SELECT COUNT(*)::int FROM ad_impressions ai
         JOIN campaigns cx ON cx.id = ai.campaign_id
         WHERE cx.advertiser_id = $1 AND ai.started = TRUE
           AND ($2::uuid IS NULL OR cx.id = $2)
           AND ($3::timestamptz IS NULL OR ai.created_at >= $3)
           AND ($4::timestamptz IS NULL OR ai.created_at < $4)
       ) AS starts,
       (
         SELECT COUNT(*)::int FROM ad_impressions ai
         JOIN campaigns cx ON cx.id = ai.campaign_id
         WHERE cx.advertiser_id = $1 AND ai.completed = TRUE
           AND ($2::uuid IS NULL OR cx.id = $2)
           AND ($3::timestamptz IS NULL OR ai.created_at >= $3)
           AND ($4::timestamptz IS NULL OR ai.created_at < $4)
       ) AS completions,
       (
         SELECT COUNT(*)::int FROM ad_impressions ai
         JOIN campaigns cx ON cx.id = ai.campaign_id
         WHERE cx.advertiser_id = $1 AND ai.billed = TRUE
           AND ($2::uuid IS NULL OR cx.id = $2)
           AND ($3::timestamptz IS NULL OR ai.created_at >= $3)
           AND ($4::timestamptz IS NULL OR ai.created_at < $4)
       ) AS billed_views,
       (
         SELECT COUNT(*)::int FROM ad_clicks ac
         JOIN campaigns cy ON cy.id = ac.campaign_id
         WHERE cy.advertiser_id = $1
           AND ($2::uuid IS NULL OR cy.id = $2)
           AND ($3::timestamptz IS NULL OR ac.created_at >= $3)
           AND ($4::timestamptz IS NULL OR ac.created_at < $4)
       ) AS clicks
     FROM campaigns c
     WHERE c.advertiser_id = $1
       AND ($2::uuid IS NULL OR c.id = $2)`,
    [advertiserId, campaignId || null, from || null, to || null]
  );
  return result.rows[0];
}

async function reportRows(advertiserId, { from, to } = {}) {
  const result = await query(
    `SELECT c.id, c.name, c.status, c.budget_kz, c.spent_kz,
            COUNT(ai.id)::int AS impressions,
            COUNT(ai.id) FILTER (WHERE ai.started)::int AS starts,
            COUNT(ai.id) FILTER (WHERE ai.completed)::int AS completions,
            COUNT(ai.id) FILTER (WHERE ai.billed)::int AS billed_views,
            COUNT(ac.id)::int AS clicks
     FROM campaigns c
     LEFT JOIN ad_impressions ai ON ai.campaign_id = c.id
       AND ($2::timestamptz IS NULL OR ai.created_at >= $2)
       AND ($3::timestamptz IS NULL OR ai.created_at < $3)
     LEFT JOIN ad_clicks ac ON ac.campaign_id = c.id AND ac.impression_id = ai.id
     WHERE c.advertiser_id = $1
     GROUP BY c.id
     ORDER BY c.created_at DESC`,
    [advertiserId, from || null, to || null]
  );
  return result.rows;
}

module.exports = {
  findActiveDecision,
  recordImpression,
  findOwnedImpression,
  startImpression,
  completeImpression,
  recordClick,
  createAdvertiser,
  findAdvertiserByUser,
  createCampaign,
  addCreative,
  listCampaigns,
  getOwnedCampaign,
  listHistory,
  addHistory,
  advertiserWithdraw,
  advertiserPause,
  advertiserResume,
  attachTransaction,
  moderateCampaign,
  findCampaignWithAdvertiser,
  campaignStats,
  reportRows,
};
