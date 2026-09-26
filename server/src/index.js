'use strict';

const { createApp } = require('./app');
const { env } = require('./config/env');
const { logger } = require('./utils/logger');
const { startScheduler } = require('./jobs/comingSoonReleaseJob');
const { startScheduler: startPurgeScheduler } = require('./jobs/accountPurgeJob');
const { startScheduler: startEpisodeScheduler } = require('./jobs/newEpisodeAlertJob');

const app = createApp();

app.listen(env.port, () => {
  logger.info('api.started', {
    port: env.port,
    env: env.nodeEnv,
    market: 'AO',
  });
  if (process.env.JOBS_ENABLED !== 'false') {
    startScheduler();
    startPurgeScheduler();
    startEpisodeScheduler();
  }
});
