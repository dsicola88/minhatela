'use strict';

const { query } = require('../config/database');
const phase23Repository = require('../repositories/phase23Repository');
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
 * Notifica seguidores quando há episódios novos ainda não anunciados.
 */
async function runNewEpisodeAlerts() {
  const started = Date.now();
  let notified = 0;
  let episodes = 0;

  try {
    const flagOk = await require('../services/featureFlagService').isEnabled(
      'series_follow_enabled',
      true
    );
    if (!flagOk) {
      await logJob('new_episode_alerts', 'skipped', { reason: 'flag_off' });
      return { notified: 0, episodes: 0 };
    }

    const list = await phase23Repository.listUnnotifiedEpisodes(30);
    for (const ep of list) {
      episodes += 1;
      const followers = await phase23Repository.followersForSeries(ep.series_id);
      const label = ep.episode_title
        ? `T${ep.season_number}:E${ep.episode_number} · ${ep.episode_title}`
        : `T${ep.season_number}:E${ep.episode_number}`;

      for (const f of followers) {
        try {
          await notificationService.notify({
            userId: f.user_id,
            type: 'new_episode',
            title: `Novo episódio · ${ep.series_title}`,
            body: label,
            data: { seriesId: ep.series_id, episodeId: ep.id },
          });
          notified += 1;
        } catch {
          /* continue */
        }
      }

      try {
        const userIds = [...new Set(followers.map((f) => f.user_id))];
        if (userIds.length) {
          await pushService.sendToUsers(userIds, {
            title: `Novo episódio · ${ep.series_title}`,
            body: label,
            data: { seriesId: ep.series_id, episodeId: ep.id },
          }).catch(() => {});
        }
      } catch {
        /* optional push */
      }

      await phase23Repository.markEpisodeNotified(ep.id);
    }

    const details = { episodes, notified, durationMs: Date.now() - started };
    await logJob('new_episode_alerts', 'ok', details);
    logger.info('jobs.new_episode_alerts', details);
    return details;
  } catch (err) {
    await logJob('new_episode_alerts', 'error', { message: err.message });
    logger.error('jobs.new_episode_alerts_failed', { message: err.message });
    throw err;
  }
}

let timer = null;

function startScheduler() {
  const interval = Number(process.env.JOBS_INTERVAL_MS || 60_000);
  runNewEpisodeAlerts().catch(() => {});
  timer = setInterval(() => {
    runNewEpisodeAlerts().catch((err) => {
      logger.error('jobs.new_episode_alerts_failed', { message: err.message });
    });
  }, interval);
  if (timer.unref) timer.unref();
  logger.info('jobs.new_episode_alerts_scheduled', { intervalMs: interval });
}

module.exports = { runNewEpisodeAlerts, startScheduler };
