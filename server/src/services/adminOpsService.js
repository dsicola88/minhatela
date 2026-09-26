'use strict';

const { query } = require('../config/database');
const auditRepository = require('../repositories/auditRepository');
const { env } = require('../config/env');
const { formatKz } = require('../utils/money');

async function getCommandCenter() {
  const [
    users,
    premium,
    pendingPay,
    paidToday,
    revenue7d,
    published,
    series,
    creatorsPending,
    contentPending,
    payoutsPending,
    campaignsPending,
    activeStreams,
    watchToday,
    recentAudit,
  ] = await Promise.all([
    query(`SELECT COUNT(*)::int AS c FROM users`),
    query(
      `SELECT COUNT(*)::int AS c FROM users
       WHERE subscription_status = 'premium_active'
         AND (premium_expires_at IS NULL OR premium_expires_at > NOW())`
    ),
    query(`SELECT COUNT(*)::int AS c FROM transactions WHERE status = 'pendente'`),
    query(
      `SELECT COALESCE(SUM(amount_kz), 0)::int AS c,
              COUNT(*)::int AS n
       FROM transactions
       WHERE status = 'pago' AND paid_at::date = CURRENT_DATE`
    ),
    query(
      `SELECT COALESCE(SUM(amount_kz), 0)::int AS c
       FROM transactions
       WHERE status = 'pago' AND paid_at >= NOW() - INTERVAL '7 days'`
    ),
    query(
      `SELECT COUNT(*)::int AS c FROM videos
       WHERE is_published = TRUE AND workflow_status = 'published'
         AND kind IN ('movie', 'series')`
    ),
    query(
      `SELECT COUNT(*)::int AS c FROM videos
       WHERE kind = 'series' AND is_published = TRUE AND workflow_status = 'published'`
    ),
    query(`SELECT COUNT(*)::int AS c FROM creators WHERE status = 'pending'`),
    query(`SELECT COUNT(*)::int AS c FROM videos WHERE workflow_status = 'submitted'`),
    query(`SELECT COUNT(*)::int AS c FROM creator_payouts WHERE status = 'pending'`),
    query(`SELECT COUNT(*)::int AS c FROM campaigns WHERE status = 'pending_review'`),
    query(
      `SELECT COUNT(*)::int AS c FROM playback_sessions
       WHERE is_active = TRUE
         AND allowed = TRUE
         AND ended_at IS NULL
         AND last_heartbeat_at > NOW() - INTERVAL '90 seconds'`
    ),
    query(
      `SELECT COUNT(*)::int AS c FROM analytics_events
       WHERE event_name = 'video_started'
         AND created_at::date = CURRENT_DATE`
    ).catch(() => ({ rows: [{ c: 0 }] })),
    auditRepository.listRecent({ limit: 12 }),
  ]);

  const queues = {
    payments: pendingPay.rows[0].c,
    creators: creatorsPending.rows[0].c,
    content: contentPending.rows[0].c,
    payouts: payoutsPending.rows[0].c,
    campaigns: campaignsPending.rows[0].c,
  };

  const attention =
    queues.payments + queues.creators + queues.content + queues.payouts + queues.campaigns;

  return {
    generatedAt: new Date().toISOString(),
    market: 'AO',
    currency: 'Kz',
    kpis: {
      users: users.rows[0].c,
      premiumUsers: premium.rows[0].c,
      revenueTodayKz: paidToday.rows[0].c,
      paymentsToday: paidToday.rows[0].n,
      revenue7dKz: revenue7d.rows[0].c,
      publishedTitles: published.rows[0].c,
      seriesCount: series.rows[0].c,
      activeStreams: activeStreams.rows[0].c,
      playsToday: watchToday.rows[0]?.c || 0,
      attentionRequired: attention,
    },
    queues,
    labels: {
      revenueToday: formatKz(paidToday.rows[0].c),
      revenue7d: formatKz(revenue7d.rows[0].c),
      streamLimits: {
        free: env.maxConcurrentStreamsFree,
        premium: env.maxConcurrentStreamsPremium,
      },
    },
    recentAudit: recentAudit.map(mapAudit),
  };
}

function mapAudit(row) {
  return {
    id: row.id,
    action: row.action,
    entity: row.entity,
    entityId: row.entity_id,
    metadata: row.metadata || {},
    ip: row.ip,
    createdAt: row.created_at,
    actor: {
      email: row.actor_email,
      name: row.actor_name,
    },
  };
}

async function listAudit(queryParams = {}) {
  const rows = await auditRepository.listRecent({
    limit: queryParams.limit,
    action: queryParams.action,
    entity: queryParams.entity,
  });
  return { items: rows.map(mapAudit) };
}

async function listPendingCampaigns() {
  const result = await query(
    `SELECT c.id, c.name, c.placement, c.budget_kz, c.status, c.starts_at, c.ends_at,
            c.created_at, a.company_name, a.contact_email
     FROM campaigns c
     JOIN advertisers a ON a.id = c.advertiser_id
     WHERE c.status = 'pending_review'
     ORDER BY c.created_at ASC
     LIMIT 50`
  );
  return {
    campaigns: result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      placement: row.placement,
      budgetKz: row.budget_kz,
      status: row.status,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      createdAt: row.created_at,
      companyName: row.company_name,
      contactEmail: row.contact_email,
    })),
  };
}

async function getLiveStreams() {
  const result = await query(
    `SELECT ps.id, ps.user_id, ps.content_id, ps.last_heartbeat_at, ps.created_at,
            u.email, v.title AS content_title,
            ds.device_name, ds.platform
     FROM playback_sessions ps
     JOIN users u ON u.id = ps.user_id
     LEFT JOIN videos v ON v.id = ps.content_id
     LEFT JOIN device_sessions ds ON ds.id = ps.device_id
     WHERE ps.is_active = TRUE
       AND ps.allowed = TRUE
       AND ps.ended_at IS NULL
       AND ps.last_heartbeat_at > NOW() - INTERVAL '90 seconds'
     ORDER BY ps.last_heartbeat_at DESC
     LIMIT 40`
  );
  return {
    streams: result.rows.map((row) => ({
      sessionId: row.id,
      email: row.email,
      contentTitle: row.content_title,
      deviceName: row.device_name,
      platform: row.platform,
      lastHeartbeatAt: row.last_heartbeat_at,
      startedAt: row.created_at,
    })),
  };
}

module.exports = {
  getCommandCenter,
  listAudit,
  listPendingCampaigns,
  getLiveStreams,
};
