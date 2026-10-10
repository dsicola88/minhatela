'use strict';

const { query } = require('../config/database');
const { videoTenantSql, opsVideoSql, tenantWriteSql } = require('../utils/tenantScope');

async function findActiveDecision({ placement = 'pre_roll' } = {}) {
  const result = await query(
    `SELECT c.id AS campaign_id, c.name, c.placement, c.budget_kz, c.spent_kz,
            cr.id AS creative_id, cr.title, cr.media_url, cr.click_url, cr.duration_seconds
     FROM campaigns c
     JOIN ad_creatives cr ON cr.campaign_id = c.id AND cr.is_active = TRUE
     WHERE c.status = 'active'
       AND ${videoTenantSql('c')}
       AND c.placement = $1
       AND c.starts_at <= NOW()
       AND c.ends_at > NOW()
       AND c.spent_kz < c.budget_kz
     ORDER BY c.created_at ASC
     LIMIT 1`,
    [placement]
  );
  return result.rows[0] || null;
}

async function recordImpression({
  campaignId,
  creativeId,
  contentId,
  userId,
  placement,
}) {
  const result = await query(
    `INSERT INTO ad_impressions
      (campaign_id, creative_id, content_id, user_id, placement)
     VALUES ($1,$2,$3,$4,$5)
     RETURNING id, campaign_id, content_id, completed`,
    [campaignId, creativeId || null, contentId || null, userId || null, placement]
  );

  return result.rows[0];
}

async function completeImpression({ impressionId, userId, unitKz }) {
  const billed = await query(
    `UPDATE ad_impressions
     SET completed = TRUE
     WHERE id = $1
       AND completed = FALSE
       AND ($2::uuid IS NULL OR user_id = $2)
     RETURNING id, campaign_id, content_id, user_id`,
    [impressionId, userId || null]
  );
  const row = billed.rows[0];
  if (!row) return null;

  const unit = Math.max(1, Number(unitKz) || 1);
  await query(
    `UPDATE campaigns
     SET spent_kz = LEAST(budget_kz, spent_kz + $2),
         updated_at = NOW()
     WHERE id = $1 AND spent_kz < budget_kz`,
    [row.campaign_id, unit]
  );
  return { ...row, billedKz: unit };
}

async function recordClick({ impressionId, userId }) {
  const result = await query(
    `INSERT INTO ad_clicks (impression_id, campaign_id)
     SELECT ai.id, ai.campaign_id
     FROM ad_impressions ai
     WHERE ai.id = $1
       AND ($2::uuid IS NULL OR ai.user_id = $2)
       AND NOT EXISTS (SELECT 1 FROM ad_clicks ac WHERE ac.impression_id = ai.id)
     RETURNING id, campaign_id, impression_id`,
    [impressionId, userId || null]
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
      (advertiser_id, name, placement, budget_kz, starts_at, ends_at, status, targeting, tenant_id)
     VALUES ($1,$2,$3,$4,$5,$6,'pending_review',$7::jsonb, ${tenantWriteSql()})
     RETURNING *`,
    [
      payload.advertiserId,
      payload.name,
      payload.placement || 'pre_roll',
      payload.budgetKz,
      payload.startsAt,
      payload.endsAt,
      JSON.stringify(payload.targeting || {}),
    ]
  );
  return result.rows[0];
}

async function addCreative({ campaignId, title, mediaUrl, clickUrl, durationSeconds }) {
  const result = await query(
    `INSERT INTO ad_creatives (campaign_id, title, media_url, click_url, duration_seconds)
     VALUES ($1,$2,$3,$4,$5)
     RETURNING *`,
    [campaignId, title, mediaUrl, clickUrl || null, durationSeconds || 15]
  );
  return result.rows[0];
}

async function listCampaigns(advertiserId) {
  const result = await query(
    `SELECT * FROM campaigns WHERE advertiser_id = $1 ORDER BY created_at DESC`,
    [advertiserId]
  );
  return result.rows;
}

async function moderateCampaign(id, status) {
  const result = await query(
    `UPDATE campaigns SET status = $2::campaign_status, updated_at = NOW()
     WHERE id = $1 AND ${opsVideoSql('campaigns')}
     RETURNING *`,
    [id, status]
  );
  return result.rows[0] || null;
}

async function campaignStats(advertiserId) {
  const result = await query(
    `SELECT
       COUNT(DISTINCT c.id)::int AS campaigns,
       COALESCE(SUM(c.budget_kz),0)::int AS budget_kz,
       COALESCE(SUM(c.spent_kz),0)::int AS spent_kz,
       (
         SELECT COUNT(*)::int FROM ad_impressions ai
         JOIN campaigns cx ON cx.id = ai.campaign_id
         WHERE cx.advertiser_id = $1
       ) AS impressions,
       (
         SELECT COUNT(*)::int FROM ad_clicks ac
         JOIN campaigns cy ON cy.id = ac.campaign_id
         WHERE cy.advertiser_id = $1
       ) AS clicks
     FROM campaigns c
     WHERE c.advertiser_id = $1`,
    [advertiserId]
  );
  return result.rows[0];
}

module.exports = {
  findActiveDecision,
  recordImpression,
  completeImpression,
  recordClick,
  createAdvertiser,
  findAdvertiserByUser,
  createCampaign,
  addCreative,
  listCampaigns,
  moderateCampaign,
  campaignStats,
};
