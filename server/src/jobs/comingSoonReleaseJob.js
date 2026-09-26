'use strict';

const { query } = require('../config/database');
const notificationService = require('../services/notificationService');
const pushService = require('../services/pushService');
const { logger } = require('../utils/logger');

async function logJob(jobName, status, details) {
  await query(
    `INSERT INTO jobs_runs (job_name, status, details, finished_at)
     VALUES ($1,$2,$3::jsonb,NOW())`,
    [jobName, status, JSON.stringify(details || {})]
  ).catch(() => {});
}

/**
 * Publica títulos cujo coming_soon_at já passou e notifica lembretes.
 */
async function runComingSoonReleases() {
  const started = Date.now();
  const due = await query(
    `SELECT id, title, slug
     FROM videos
     WHERE coming_soon_at IS NOT NULL
       AND coming_soon_at <= NOW()
       AND kind IN ('movie', 'series')
       AND (
         is_published = FALSE
         OR workflow_status IS DISTINCT FROM 'published'
       )
     ORDER BY coming_soon_at ASC
     LIMIT 50`
  );

  const published = [];
  for (const row of due.rows) {
    await query(
      `UPDATE videos
       SET is_published = TRUE,
           workflow_status = 'published',
           released_at = COALESCE(released_at, NOW()),
           coming_soon_at = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [row.id]
    );
    published.push(row);

    const reminders = await query(
      `SELECT DISTINCT user_id FROM content_reminders WHERE content_id = $1`,
      [row.id]
    );
    const userIds = reminders.rows.map((r) => r.user_id);

    for (const userId of userIds) {
      await notificationService
        .notify({
          userId,
          type: 'title_released',
          title: 'Já disponível',
          body: `«${row.title}» estreou na MinhaTela. Assista agora.`,
          data: { contentId: row.id, slug: row.slug },
        })
        .catch(() => {});
    }

    if (userIds.length) {
      await pushService
        .sendToUsers(userIds, {
          title: 'Já disponível',
          body: `«${row.title}» estreou na MinhaTela`,
          data: { contentId: row.id, type: 'title_released' },
        })
        .catch(() => {});
    }

    // limpar lembretes cumpridos
    await query(`DELETE FROM content_reminders WHERE content_id = $1`, [row.id]).catch(() => {});
  }

  const details = {
    publishedCount: published.length,
    titles: published.map((p) => p.title),
    durationMs: Date.now() - started,
  };
  await logJob('coming_soon_releases', 'ok', details);
  logger.info('job.coming_soon_releases', details);
  return details;
}

function startScheduler() {
  const intervalMs = Number(process.env.JOBS_INTERVAL_MS || 60_000);
  // primeiro run após 15s (dar tempo ao boot)
  setTimeout(() => {
    runComingSoonReleases().catch((err) =>
      logger.error('job.coming_soon_releases.failed', { message: err.message })
    );
  }, 15_000);

  setInterval(() => {
    runComingSoonReleases().catch((err) =>
      logger.error('job.coming_soon_releases.failed', { message: err.message })
    );
  }, intervalMs);

  logger.info('jobs.scheduler_started', { intervalMs });
}

module.exports = {
  runComingSoonReleases,
  startScheduler,
};
