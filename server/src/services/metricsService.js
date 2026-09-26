'use strict';

const { query } = require('../config/database');
const { env } = require('../config/env');

async function collectMetrics() {
  const started = Date.now();
  const [
    users,
    sessions,
    streams,
    pendingPay,
    playsToday,
    content,
  ] = await Promise.all([
    query(`SELECT COUNT(*)::int AS c FROM users`),
    query(
      `SELECT COUNT(*)::int AS c FROM auth_sessions
       WHERE revoked_at IS NULL AND expires_at > NOW()`
    ).catch(() => ({ rows: [{ c: 0 }] })),
    query(
      `SELECT COUNT(*)::int AS c FROM playback_sessions
       WHERE is_active = TRUE AND allowed = TRUE AND ended_at IS NULL
         AND last_heartbeat_at > NOW() - INTERVAL '90 seconds'`
    ).catch(() => ({ rows: [{ c: 0 }] })),
    query(`SELECT COUNT(*)::int AS c FROM transactions WHERE status = 'pendente'`),
    query(
      `SELECT COUNT(*)::int AS c FROM analytics_events
       WHERE event_name = 'video_started' AND created_at::date = CURRENT_DATE`
    ).catch(() => ({ rows: [{ c: 0 }] })),
    query(
      `SELECT COUNT(*)::int AS c FROM videos
       WHERE is_published = TRUE AND workflow_status = 'published'
         AND kind IN ('movie', 'series')`
    ),
  ]);

  return {
    service: 'minhatela-api',
    market: 'AO',
    env: env.nodeEnv,
    generatedAt: new Date().toISOString(),
    collectMs: Date.now() - started,
    metrics: {
      users_total: users.rows[0].c,
      auth_sessions_active: sessions.rows[0].c,
      playback_streams_live: streams.rows[0].c,
      payments_pending: pendingPay.rows[0].c,
      plays_today: playsToday.rows[0].c,
      catalog_titles: content.rows[0].c,
      stream_limit_free: env.maxConcurrentStreamsFree,
      stream_limit_premium: env.maxConcurrentStreamsPremium,
    },
  };
}

module.exports = { collectMetrics };
