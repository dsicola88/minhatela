'use strict';

const { env } = require('../config/env');

function write(level, event, meta = {}) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    event,
    service: 'minhatela-api',
    ...meta,
  };
  const line = JSON.stringify(payload);
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else if (level === 'debug' && env.isProd) {
    return;
  } else {
    console.log(line);
  }
}

const logger = {
  info: (event, meta) => write('info', event, meta),
  warn: (event, meta) => write('warn', event, meta),
  error: (event, meta) => write('error', event, meta),
  debug: (event, meta) => write('debug', event, meta),
};

module.exports = { logger };
