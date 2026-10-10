'use strict';

const { query } = require('../config/database');
const { env } = require('../config/env');
const { opsUserSql, opsVideoSql } = require('../utils/tenantScope');

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
    query(`SELECT COUNT(*)::int AS c FROM users u WHERE ${opsUserSql('u')}`),
    query(
      `SELECT COUNT(*)::int AS c FROM auth_sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.revoked_at IS NULL AND s.expires_at > NOW() AND ${opsUserSql('u')}`
    ).catch(() => ({ rows: [{ c: 0 }] })),
    query(
      `SELECT COUNT(*)::int AS c FROM playback_sessions ps
       JOIN users u ON u.id = ps.user_id
       WHERE ps.is_active = TRUE AND ps.allowed = TRUE AND ps.ended_at IS NULL
         AND ps.last_heartbeat_at > NOW() - INTERVAL '90 seconds'
         AND ${opsUserSql('u')}`
    ).catch(() => ({ rows: [{ c: 0 }] })),
    query(
      `SELECT COUNT(*)::int AS c FROM transactions t
       JOIN users u ON u.id = t.user_id
       WHERE t.status = 'pendente' AND ${opsUserSql('u')}`
    ),
    query(
      `SELECT COUNT(*)::int AS c FROM analytics_events ae
       JOIN videos v ON v.id = ae.content_id
       WHERE ae.event_name = 'video_started' AND ae.created_at::date = CURRENT_DATE
         AND ${opsVideoSql('v')}`
    ).catch(() => ({ rows: [{ c: 0 }] })),
    query(
      `SELECT COUNT(*)::int AS c FROM videos v
       WHERE v.is_published = TRUE AND v.workflow_status = 'published'
         AND v.kind IN ('movie', 'series') AND ${opsVideoSql('v')}`
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
