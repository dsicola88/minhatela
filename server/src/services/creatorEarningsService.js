'use strict';

const { query, withTransaction } = require('../config/database');
const { logger } = require('../utils/logger');
const { env } = require('../config/env');
const { assertPositiveKz } = require('../utils/money');
const { createError } = require('../utils/errors');

function viewAmountKz() {
  return Math.max(0, Number(env.creatorViewKz || 0));
}

function adShareBps() {
  return Math.min(10000, Math.max(0, Number(env.creatorAdShareBps || 3000)));
}

function traceMissing(err) {
  return /trace_key/i.test(err?.message || '') && /column|does not exist/i.test(err?.message || '');
}

async function creditQualifiedView({ creatorId, contentId, userId }) {
  const amount = viewAmountKz();
  if (!contentId || !userId || amount <= 0) return { credited: false };

  try {
    const result = await query(
      `INSERT INTO creator_earnings (creator_id, content_id, source, amount_kz, metadata, trace_key)
       SELECT v.creator_id, v.id, 'view', $2,
              jsonb_build_object('userId', $3::text, 'rule', 'watch_92'),
              'view:' || v.id::text || ':' || CURRENT_DATE::text || ':' || $3
       FROM videos v
       WHERE v.id = $1
         AND v.creator_id IS NOT NULL
         AND ($4::uuid IS NULL OR v.creator_id = $4::uuid)
       ON CONFLICT (trace_key) WHERE trace_key IS NOT NULL DO NOTHING
       RETURNING id, amount_kz, creator_id`,
      [contentId, amount, String(userId), creatorId || null]
    );
    const row = result.rows[0];
    return { credited: Boolean(row), amountKz: row ? row.amount_kz : 0, entryId: row?.id || null };
  } catch (err) {
    if (!traceMissing(err) && !/no unique or exclusion constraint/i.test(err.message || '')) {
      logger.warn('earnings.view_failed', { message: err.message, contentId });
      return { credited: false };
    }
  }

  try {
    const result = await query(
      `INSERT INTO creator_earnings (creator_id, content_id, source, amount_kz, metadata)
       SELECT v.creator_id, v.id, 'view', $2, jsonb_build_object('userId', $3::text, 'rule', 'watch_92')
       FROM videos v
       WHERE v.id = $1
         AND v.creator_id IS NOT NULL
         AND ($4::uuid IS NULL OR v.creator_id = $4::uuid)
         AND NOT EXISTS (
           SELECT 1 FROM creator_earnings e
           WHERE e.creator_id = v.creator_id
             AND e.content_id = v.id
             AND e.source = 'view'
             AND e.period_date = CURRENT_DATE
             AND e.metadata->>'userId' = $3
         )
       RETURNING id, amount_kz`,
      [contentId, amount, String(userId), creatorId || null]
    );
    const row = result.rows[0];
    return { credited: Boolean(row), amountKz: row ? row.amount_kz : 0, entryId: row?.id || null };
  } catch (err) {
    logger.warn('earnings.view_failed', { message: err.message, contentId });
    return { credited: false };
  }
}

async function creditAdShare({ contentId, impressionId, amountKz }) {
  const share = Math.floor((Number(amountKz) || 0) * (adShareBps() / 10000));
  if (!contentId || !impressionId || share <= 0) return { credited: false };

  try {
    const result = await query(
      `INSERT INTO creator_earnings (creator_id, content_id, source, amount_kz, metadata, trace_key)
       SELECT v.creator_id, v.id, 'ad_share', $2,
              jsonb_build_object('impressionId', $3::text),
              'ad:' || $3
       FROM videos v
       WHERE v.id = $1 AND v.creator_id IS NOT NULL
       ON CONFLICT (trace_key) WHERE trace_key IS NOT NULL DO NOTHING
       RETURNING id, amount_kz`,
      [contentId, share, String(impressionId)]
    );
    const row = result.rows[0];
    return { credited: Boolean(row), amountKz: row ? row.amount_kz : 0, entryId: row?.id || null };
  } catch (err) {
    if (!traceMissing(err) && !/no unique or exclusion constraint/i.test(err.message || '')) {
      logger.warn('earnings.ad_share_failed', { message: err.message, contentId });
      return { credited: false };
    }
  }

  try {
    const result = await query(
      `INSERT INTO creator_earnings (creator_id, content_id, source, amount_kz, metadata)
       SELECT v.creator_id, v.id, 'ad_share', $2, jsonb_build_object('impressionId', $3::text)
       FROM videos v
       WHERE v.id = $1 AND v.creator_id IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM creator_earnings e
           WHERE e.content_id = v.id
             AND e.source = 'ad_share'
             AND e.metadata->>'impressionId' = $3
         )
       RETURNING id, amount_kz`,
      [contentId, share, String(impressionId)]
    );
    const row = result.rows[0];
    return { credited: Boolean(row), amountKz: row ? row.amount_kz : 0, entryId: row?.id || null };
  } catch (err) {
    logger.warn('earnings.ad_share_failed', { message: err.message, contentId });
    return { credited: false };
  }
}

async function postStaffEntry({ creatorId, contentId, source, amountKz, traceKey, reason }) {
  if (!['adjustment', 'reversal'].includes(source)) {
    throw createError(400, 'Movimento inválido', 'VALIDATION');
  }
  if (!String(reason || '').trim()) {
    throw createError(400, 'Indique o motivo do lançamento', 'VALIDATION');
  }
  let amount;
  try {
    amount = assertPositiveKz(amountKz);
  } catch {
    throw createError(400, 'Valor em Kz inválido', 'VALIDATION');
  }
  const key = String(traceKey || `${source}:${creatorId}:${contentId || 'none'}:${Date.now()}`).slice(0, 180);
  const reasonText = String(reason || '').trim().slice(0, 300);
  const params = [creatorId, contentId || null, source, amount, reasonText, key];

  return withTransaction(async (client) => {
    await client.query(`SELECT id FROM creators WHERE id = $1 FOR UPDATE`, [creatorId]);
    try {
      const result = await client.query(
        `INSERT INTO creator_earnings (creator_id, content_id, source, amount_kz, metadata, trace_key)
         SELECT c.id, $2, $3, $4,
                jsonb_build_object('reason', $5::text),
                $6
         FROM creators c
         WHERE c.id = $1
           AND ($2::uuid IS NULL OR EXISTS (
             SELECT 1 FROM videos v WHERE v.id = $2 AND v.creator_id = c.id
           ))
         ON CONFLICT (trace_key) WHERE trace_key IS NOT NULL DO NOTHING
         RETURNING id, creator_id, content_id, source, amount_kz, created_at`,
        params
      );
      if (!result.rowCount) {
        throw createError(409, 'Movimento já registado ou filme de outro estúdio', 'LEDGER_REJECTED');
      }
      return mapEntry(result.rows[0]);
    } catch (err) {
      if (err.statusCode) throw err;
      if (!traceMissing(err) && !/no unique or exclusion constraint/i.test(err.message || '')) throw err;
    }

    const result = await client.query(
      `INSERT INTO creator_earnings (creator_id, content_id, source, amount_kz, metadata)
       SELECT c.id, $2, $3, $4, jsonb_build_object('reason', $5::text, 'traceKey', $6::text)
       FROM creators c
       WHERE c.id = $1
         AND ($2::uuid IS NULL OR EXISTS (
           SELECT 1 FROM videos v WHERE v.id = $2 AND v.creator_id = c.id
         ))
         AND NOT EXISTS (
           SELECT 1 FROM creator_earnings e
           WHERE e.creator_id = c.id AND e.metadata->>'traceKey' = $6
         )
       RETURNING id, creator_id, content_id, source, amount_kz, created_at`,
      params
    );
    if (!result.rowCount) {
      throw createError(409, 'Movimento já registado ou filme de outro estúdio', 'LEDGER_REJECTED');
    }
    return mapEntry(result.rows[0]);
  });
}

async function listForCreator(creatorId) {
  let rows;
  try {
    rows = await query(
      `SELECT e.id, e.content_id, e.source, e.amount_kz, e.period_date, e.created_at,
              v.title AS content_title
       FROM creator_earnings e
       LEFT JOIN videos v ON v.id = e.content_id AND v.creator_id = e.creator_id
       WHERE e.creator_id = $1
       ORDER BY e.created_at DESC
       LIMIT 50`,
      [creatorId]
    );
  } catch (err) {
    logger.warn('earnings.list_failed', { message: err.message });
    return [];
  }
  return rows.rows.map(mapEntry);
}

function mapEntry(row) {
  return {
    id: row.id,
    contentId: row.content_id,
    contentTitle: row.content_title || null,
    source: row.source,
    amountKz: row.amount_kz,
    periodDate: row.period_date,
    createdAt: row.created_at,
  };
}

module.exports = {
  creditQualifiedView,
  creditAdShare,
  postStaffEntry,
  listForCreator,
  viewAmountKz,
  adShareBps,
};
