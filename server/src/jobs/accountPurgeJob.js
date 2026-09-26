'use strict';

const complianceRepository = require('../repositories/complianceRepository');
const authSessionRepository = require('../repositories/authSessionRepository');
const { query } = require('../config/database');
const { logger } = require('../utils/logger');

async function logJob(jobName, status, details) {
  await query(
    `INSERT INTO jobs_runs (job_name, status, details, finished_at)
     VALUES ($1,$2,$3::jsonb,NOW())`,
    [jobName, status, JSON.stringify(details || {})]
  ).catch(() => {});
}

/**
 * Soft-delete contas cujo período de graça expirou + revoga sessões.
 */
async function runAccountPurge() {
  const started = Date.now();
  const purged = await complianceRepository.softDeleteDue();

  for (const row of purged) {
    try {
      await authSessionRepository.revokeAllForUser?.(row.id);
    } catch {
      await query(
        `UPDATE auth_sessions SET revoked_at = NOW()
         WHERE user_id = $1 AND revoked_at IS NULL`,
        [row.id]
      ).catch(() => {});
    }
  }

  const details = { purged: purged.length, ms: Date.now() - started };
  await logJob('account_purge', 'ok', details);
  if (purged.length) {
    logger.info('jobs.account_purge', details);
  }
  return details;
}

let timer = null;

function startScheduler() {
  const interval = Number(process.env.JOBS_INTERVAL_MS || 60_000);
  if (timer) return;
  timer = setInterval(() => {
    runAccountPurge().catch((err) => {
      logger.error('jobs.account_purge_failed', { message: err.message });
    });
  }, Math.max(30_000, interval));
  // primeira passagem após arranque
  setTimeout(() => {
    runAccountPurge().catch(() => {});
  }, 15_000);
  logger.info('jobs.account_purge_scheduled', { intervalMs: interval });
}

module.exports = { runAccountPurge, startScheduler };
