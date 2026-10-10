'use strict';

const { query } = require('../config/database');
const { logger } = require('../utils/logger');
const subscriptionService = require('../services/subscriptionService');

async function logJob(jobName, status, details) {
  await query(
    `INSERT INTO jobs_runs (job_name, status, details, finished_at)
     VALUES ($1,$2,$3::jsonb,NOW())`,
    [jobName, status, JSON.stringify(details || {})]
  ).catch(() => {});
}

async function runSubscriptionExpiry() {
  const started = Date.now();
  const details = await subscriptionService.expireOverdue({ limit: 500 });
  details.ms = Date.now() - started;
  await logJob('subscription_expiry', 'ok', details);
  if (details.expired) {
    logger.info('jobs.subscription_expiry', details);
  }
  return details;
}

let timer = null;

function startScheduler() {
  const interval = Number(process.env.JOBS_INTERVAL_MS || 60_000);
  if (timer) return;
  timer = setInterval(() => {
    runSubscriptionExpiry().catch((err) => {
      logger.error('jobs.subscription_expiry_failed', { message: err.message });
    });
  }, Math.max(30_000, interval));
  setTimeout(() => {
    runSubscriptionExpiry().catch(() => {});
  }, 12_000);
  logger.info('jobs.subscription_expiry_scheduled', { intervalMs: interval });
}

module.exports = { runSubscriptionExpiry, startScheduler };
