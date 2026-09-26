'use strict';

const { query } = require('../config/database');

async function findActiveDecision({ placement = 'pre_roll' } = {}) {
  const result = await query(
    `SELECT c.id AS campaign_id, c.name, c.placement, c.budget_kz, c.spent_kz,
            cr.id AS creative_id, cr.title, cr.media_url, cr.click_url, cr.duration_seconds
     FROM campaigns c
     JOIN ad_creatives cr ON cr.campaign_id = c.id AND cr.is_active = TRUE
     WHERE c.status = 'active'
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
     RETURNING id`,
    [campaignId, creativeId || null, contentId || null, userId || null, placement]
  );

  // Custo por impressão simbólico (5 Kz) até CPM real
  await query(
    `UPDATE campaigns
     SET spent_kz = LEAST(budget_kz, spent_kz + 5),
         updated_at = NOW()
     WHERE id = $1`,
    [campaignId]
  );

  return result.rows[0];
}

async function createAdvertiser({ userId, companyName, contactEmail }) {
  const result = await query(
    `INSERT INTO advertisers (user_id, company_name, contact_email, status)
     VALUES ($1,$2,$3,'active')
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
      (advertiser_id, name, placement, budget_kz, starts_at, ends_at, status, targeting)
     VALUES ($1,$2,$3,$4,$5,$6,'pending_review',$7::jsonb)
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
    `UPDATE campaigns SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
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
  createAdvertiser,
  findAdvertiserByUser,
  createCampaign,
  addCreative,
  listCampaigns,
  moderateCampaign,
  campaignStats,
};
