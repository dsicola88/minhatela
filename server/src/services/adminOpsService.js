'use strict';

const { query } = require('../config/database');
const { opsVideoSql, opsUserSql } = require('../utils/tenantScope');
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
    ticketsOpen,
    activeStreams,
    watchToday,
    recentAudit,
  ] = await Promise.all([
    query(`SELECT COUNT(*)::int AS c FROM users u WHERE ${opsUserSql('u')}`),
    query(
      `SELECT COUNT(*)::int AS c FROM users u
       WHERE ${opsUserSql('u')}
         AND u.subscription_status = 'premium_active'
         AND (u.premium_expires_at IS NULL OR u.premium_expires_at > NOW())`
    ),
    query(
      `SELECT COUNT(*)::int AS c FROM transactions t
       JOIN users u ON u.id = t.user_id
       WHERE t.status = 'pendente' AND ${opsUserSql('u')}`
    ),
    query(
      `SELECT COALESCE(SUM(t.amount_kz), 0)::int AS c,
              COUNT(*)::int AS n
       FROM transactions t
       JOIN users u ON u.id = t.user_id
       WHERE t.status = 'pago' AND t.paid_at::date = CURRENT_DATE AND ${opsUserSql('u')}`
    ),
    query(
      `SELECT COALESCE(SUM(t.amount_kz), 0)::int AS c
       FROM transactions t
       JOIN users u ON u.id = t.user_id
       WHERE t.status = 'pago' AND t.paid_at >= NOW() - INTERVAL '7 days' AND ${opsUserSql('u')}`
    ),
    query(
      `SELECT COUNT(*)::int AS c FROM videos v
       WHERE v.is_published = TRUE AND v.workflow_status = 'published'
         AND v.kind IN ('movie', 'series')
         AND ${opsVideoSql('v')}`
    ),
    query(
      `SELECT COUNT(*)::int AS c FROM videos v
       WHERE v.kind = 'series' AND v.is_published = TRUE AND v.workflow_status = 'published'
         AND ${opsVideoSql('v')}`
    ),
    query(
      `SELECT COUNT(*)::int AS c FROM creators c WHERE c.status = 'pending' AND ${opsVideoSql('c')}`
    ),
    query(
      `SELECT COUNT(*)::int AS c FROM videos v
       WHERE v.workflow_status = 'submitted' AND ${opsVideoSql('v')}`
    ),
    query(
      `SELECT COUNT(*)::int AS c FROM creator_payouts p
       JOIN creators c ON c.id = p.creator_id
       WHERE p.status = 'pending' AND ${opsVideoSql('c')}`
    ),
    query(
      `SELECT COUNT(*)::int AS c FROM campaigns c
       WHERE c.status = 'pending_review' AND ${opsVideoSql('c')}`
    ),
    query(
      `SELECT COUNT(*)::int AS c FROM support_tickets st
       JOIN users u ON u.id = st.user_id
       WHERE st.status IN ('open', 'in_progress') AND ${opsUserSql('u')}`
    ).catch(() => ({ rows: [{ c: 0 }] })),
    query(
      `SELECT COUNT(*)::int AS c FROM playback_sessions ps
       LEFT JOIN videos v ON v.id = ps.content_id
       WHERE ps.is_active = TRUE
         AND ps.allowed = TRUE
         AND ps.ended_at IS NULL
         AND ps.last_heartbeat_at > NOW() - INTERVAL '90 seconds'
         AND (v.id IS NULL OR ${opsVideoSql('v')})`
    ),
    query(
      `SELECT COUNT(*)::int AS c FROM analytics_events ae
       JOIN videos v ON v.id = ae.content_id
       WHERE ae.event_name = 'video_started'
         AND ae.created_at::date = CURRENT_DATE
         AND ${opsVideoSql('v')}`
    ).catch(() => ({ rows: [{ c: 0 }] })),
    auditRepository.listRecent({ limit: 12 }),
  ]);

  const queues = {
    payments: pendingPay.rows[0].c,
    creators: creatorsPending.rows[0].c,
    content: contentPending.rows[0].c,
    payouts: payoutsPending.rows[0].c,
    campaigns: campaignsPending.rows[0].c,
    tickets: ticketsOpen.rows[0]?.c || 0,
  };

  const attention =
    queues.payments +
    queues.creators +
    queues.content +
    queues.payouts +
    queues.campaigns +
    queues.tickets;

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
       AND ${opsVideoSql('c')}
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
       AND (v.id IS NULL OR ${opsVideoSql('v')})
       AND ${opsUserSql('u')}
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
