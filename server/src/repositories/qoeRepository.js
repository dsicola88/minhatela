'use strict';

const { query } = require('../config/database');

const ALLOWED = new Set([
  'startup',
  'buffering_start',
  'buffering_end',
  'error',
  'bitrate_change',
  'ended',
  'seek',
]);

async function ingest(events) {
  const inserted = [];
  for (const ev of events) {
    if (!ALLOWED.has(ev.eventType)) continue;
    const result = await query(
      `INSERT INTO playback_qoe_events
        (user_id, profile_id, content_id, session_id, event_type,
         startup_ms, bitrate_kbps, buffer_ms, error_code, quality, platform, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)
       RETURNING id, event_type, created_at`,
      [
        ev.userId || null,
        ev.profileId || null,
        ev.contentId || null,
        ev.sessionId || null,
        ev.eventType,
        ev.startupMs ?? null,
        ev.bitrateKbps ?? null,
        ev.bufferMs ?? null,
        ev.errorCode || null,
        ev.quality || null,
        ev.platform || null,
        JSON.stringify(ev.metadata || {}),
      ]
    );
    inserted.push(result.rows[0]);
  }
  return inserted;
}

async function summary({ days = 7 } = {}) {
  const result = await query(
    `SELECT
       COUNT(*) FILTER (WHERE event_type = 'startup')::int AS startups,
       COUNT(*) FILTER (WHERE event_type = 'error')::int AS errors,
       COUNT(*) FILTER (WHERE event_type = 'buffering_start')::int AS buffer_starts,
       ROUND(AVG(startup_ms) FILTER (WHERE event_type = 'startup' AND startup_ms IS NOT NULL))::int AS avg_startup_ms,
       ROUND(AVG(bitrate_kbps) FILTER (WHERE bitrate_kbps IS NOT NULL))::int AS avg_bitrate_kbps
     FROM playback_qoe_events
     WHERE created_at >= NOW() - ($1 || ' days')::interval`,
    [String(Math.min(90, Number(days) || 7))]
  );
  return result.rows[0] || {};
}

module.exports = { ingest, summary, ALLOWED };
