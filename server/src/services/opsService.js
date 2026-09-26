'use strict';

const { healthCheck } = require('../config/database');
const { env } = require('../config/env');
const { query } = require('../config/database');
const featureFlagService = require('./featureFlagService');

async function collectOpsStatus() {
  const started = Date.now();
  let postgresOk = false;
  try {
    postgresOk = await healthCheck();
  } catch {
    postgresOk = false;
  }

  const maintenance = await featureFlagService.isEnabled('maintenance_mode', false);
  const [
    openTickets,
    pendingPay,
    liveStreams,
    qoeErrors,
  ] = await Promise.all([
    query(
      `SELECT COUNT(*)::int AS c FROM support_tickets
       WHERE status IN ('open', 'in_progress')`
    ).catch(() => ({ rows: [{ c: 0 }] })),
    query(
      `SELECT COUNT(*)::int AS c FROM transactions WHERE status = 'pendente'`
    ).catch(() => ({ rows: [{ c: 0 }] })),
    query(
      `SELECT COUNT(*)::int AS c FROM playback_sessions
       WHERE is_active = TRUE AND allowed = TRUE AND ended_at IS NULL
         AND last_heartbeat_at > NOW() - INTERVAL '90 seconds'`
    ).catch(() => ({ rows: [{ c: 0 }] })),
    query(
      `SELECT COUNT(*)::int AS c FROM playback_qoe_events
       WHERE event_type = 'error' AND created_at > NOW() - INTERVAL '1 hour'`
    ).catch(() => ({ rows: [{ c: 0 }] })),
  ]);

  const status = {
    service: 'minhatela-api',
    market: 'AO',
    ready: postgresOk && !maintenance,
    postgres: postgresOk ? 'ok' : 'down',
    bunnyConfigured: Boolean(env.bunny.libraryId && env.bunny.cdnHostname),
    tokenAuth: Boolean(env.bunny.tokenAuthKey),
    maintenanceMode: maintenance,
    bunnyHealth: null,
    queues: {
      openTickets: openTickets.rows[0].c,
      pendingPayments: pendingPay.rows[0].c,
      liveStreams: liveStreams.rows[0].c,
      qoeErrors1h: qoeErrors.rows[0].c,
    },
    collectMs: Date.now() - started,
    timestamp: new Date().toISOString(),
  };

  try {
    const enabled = await featureFlagService.isEnabled('cdn_health_enabled', true);
    if (enabled) {
      const latest = await query(
        `SELECT probe_type, ok, latency_ms, checked_at
         FROM cdn_health_checks
         ORDER BY checked_at DESC LIMIT 6`
      );
      status.bunnyHealth = {
        recent: latest.rows.map((r) => ({
          probeType: r.probe_type,
          ok: r.ok,
          latencyMs: r.latency_ms,
          checkedAt: r.checked_at,
        })),
        lastOk: latest.rows.some((r) => r.ok),
      };
    }
  } catch {
    status.bunnyHealth = { recent: [], lastOk: null };
  }

  // Snapshot async (não bloqueia resposta)
  query(
    `INSERT INTO ops_snapshots
      (postgres_ok, bunny_configured, maintenance_mode, open_tickets,
       pending_payments, live_streams, qoe_errors_1h, details)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
    [
      postgresOk,
      status.bunnyConfigured,
      maintenance,
      status.queues.openTickets,
      status.queues.pendingPayments,
      status.queues.liveStreams,
      status.queues.qoeErrors1h,
      JSON.stringify({ collectMs: status.collectMs }),
    ]
  ).catch(() => {});

  return status;
}

module.exports = { collectOpsStatus };
