'use strict';

const { query } = require('../config/database');
const { logger } = require('../utils/logger');
const { env } = require('../config/env');

function viewAmountKz() {
  return Math.max(0, Number(env.creatorViewKz || 0));
}

function adShareBps() {
  return Math.min(10000, Math.max(0, Number(env.creatorAdShareBps || 3000)));
}

async function creditQualifiedView({ creatorId, contentId, userId }) {
  const amount = viewAmountKz();
  if (!creatorId || !contentId || !userId || amount <= 0) {
    return { credited: false };
  }

  try {
    const result = await query(
      `INSERT INTO creator_earnings (creator_id, content_id, source, amount_kz, metadata)
       SELECT $1, $2, 'view', $3, jsonb_build_object('userId', $4::text)
       WHERE NOT EXISTS (
         SELECT 1 FROM creator_earnings
         WHERE creator_id = $1
           AND content_id = $2
           AND source = 'view'
           AND period_date = CURRENT_DATE
           AND metadata->>'userId' = $4
       )
       RETURNING id`,
      [creatorId, contentId, amount, String(userId)]
    );
    return { credited: result.rowCount > 0, amountKz: amount };
  } catch (err) {
    logger.warn('earnings.view_failed', { message: err.message, contentId, creatorId });
    return { credited: false };
  }
}

async function creditAdShare({ contentId, impressionId, amountKz }) {
  const share = Math.floor((Number(amountKz) || 0) * (adShareBps() / 10000));
  if (!contentId || share <= 0) return { credited: false };

  try {
    const result = await query(
      `INSERT INTO creator_earnings (creator_id, content_id, source, amount_kz, metadata)
       SELECT v.creator_id, v.id, 'ad_share', $2,
              jsonb_build_object('impressionId', $3::text)
       FROM videos v
       WHERE v.id = $1 AND v.creator_id IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM creator_earnings
           WHERE content_id = $1
             AND source = 'ad_share'
             AND metadata->>'impressionId' = $3
         )
       RETURNING id`,
      [contentId, share, String(impressionId)]
    );
    return { credited: result.rowCount > 0, amountKz: share };
  } catch (err) {
    logger.warn('earnings.ad_share_failed', { message: err.message, contentId });
    return { credited: false };
  }
}

module.exports = { creditQualifiedView, creditAdShare, viewAmountKz, adShareBps };
