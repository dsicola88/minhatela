'use strict';

/**
 * Só leitura. Recusa host remoto.
 * Uso: node scripts/inspect-pre-boot.js
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { pool } = require('../src/config/database');

function assertLocal() {
  const url = process.env.DATABASE_URL || '';
  let host = '';
  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error('DATABASE_URL inválida');
  }
  if (!/^(localhost|127\.0\.0\.1)$/.test(host)) {
    throw new Error(`recusa host ${host} — este script não lê produção`);
  }
  return host;
}

function dupKeyExpr() {
  return `
    CASE
      WHEN source = 'view' AND metadata ? 'userId'
        THEN 'view:' || content_id::text || ':' || period_date::text || ':' || (metadata->>'userId')
      WHEN source = 'ad_share' AND metadata ? 'impressionId'
        THEN 'ad:' || (metadata->>'impressionId')
      ELSE NULL
    END`;
}

async function main() {
  const host = assertLocal();
  const client = await pool.connect();
  try {
    const applied = await client.query(
      `SELECT id FROM schema_migrations WHERE id IN ('037_ads_manager.sql','038_creator_ledger_trace.sql') ORDER BY id`
    );
    const clicks = await client.query(
      `SELECT impression_id, COUNT(*)::int AS n
       FROM ad_clicks
       GROUP BY impression_id
       HAVING COUNT(*) > 1
       ORDER BY n DESC
       LIMIT 50`
    );
    const clickTotal = await client.query(
      `SELECT COALESCE(SUM(n-1),0)::int AS extra_rows
       FROM (
         SELECT COUNT(*)::int AS n FROM ad_clicks GROUP BY impression_id HAVING COUNT(*) > 1
       ) d`
    );
    const key = dupKeyExpr();
    const ledgerDupes = await client.query(
      `WITH ranked AS (
         SELECT id, creator_id, content_id, source, amount_kz, period_date, created_at,
                ${key} AS trace_candidate,
                ROW_NUMBER() OVER (
                  PARTITION BY ${key}
                  ORDER BY created_at, id
                ) AS n
         FROM creator_earnings
         WHERE source IN ('view', 'ad_share')
           AND (${key}) IS NOT NULL
       )
       SELECT id, creator_id, content_id, source, amount_kz, period_date, created_at, trace_candidate
       FROM ranked
       WHERE n > 1
       ORDER BY created_at, id
       LIMIT 200`
    );
    const ledgerTotals = await client.query(
      `WITH ranked AS (
         SELECT amount_kz, source, creator_id, ${key} AS trace_candidate,
                ROW_NUMBER() OVER (PARTITION BY ${key} ORDER BY created_at, id) AS n
         FROM creator_earnings
         WHERE source IN ('view', 'ad_share')
           AND (${key}) IS NOT NULL
       )
       SELECT COUNT(*)::int AS extra_rows,
              COALESCE(SUM(amount_kz),0)::int AS extra_kz,
              COUNT(DISTINCT creator_id)::int AS creators
       FROM ranked
       WHERE n > 1`
    );
    const orphans = await client.query(
      `SELECT COUNT(*)::int AS n, COALESCE(SUM(amount_kz),0)::int AS kz
       FROM creator_earnings
       WHERE source IN ('view', 'ad_share')
         AND trace_key IS NULL`
    ).catch(() => ({ rows: [{ n: null, kz: null, note: 'coluna trace_key ainda não existe' }] }));
    const uniq = await client.query(
      `SELECT indexname FROM pg_indexes
       WHERE tablename = 'creator_earnings' AND indexname = 'creator_earnings_trace_key_uidx'`
    );
    const clickIdx = await client.query(
      `SELECT indexname FROM pg_indexes
       WHERE tablename = 'ad_clicks' AND indexname = 'ad_clicks_impression_unique'`
    );

    const extra = ledgerTotals.rows[0];
    console.log(
      JSON.stringify(
        {
          host,
          readOnly: true,
          railway: 'não consultado',
          applied: applied.rows.map((r) => r.id),
          adClicks: {
            uniqueIndex: Boolean(clickIdx.rowCount),
            duplicateGroups: clicks.rowCount,
            extraRows: clickTotal.rows[0].extra_rows,
            sample: clicks.rows,
          },
          ledger: {
            uniqueIndex: Boolean(uniq.rowCount),
            wouldHaveBeenDeleted: {
              extraRows: extra.extra_rows,
              extraKz: extra.extra_kz,
              creators: extra.creators,
              sample: ledgerDupes.rows,
            },
            viewAdShareWithoutTrace: orphans.rows[0],
          },
          note:
            extra.extra_rows > 0
              ? 'Estas linhas NÃO devem ser apagadas no arranque. Inspeccione em produção com uma sessão só de leitura antes de qualquer limpeza manual.'
              : 'Nesta base local não há duplicados que a 038 antiga teria apagado.',
        },
        null,
        2
      )
    );
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('inspect-pre-boot: fail', err.message);
  process.exit(1);
});
