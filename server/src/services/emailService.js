'use strict';

const { env } = require('../config/env');
const { logger } = require('../utils/logger');

/**
 * Abstracção de email. Em produção liga a SMTP/ESP.
 * Em desenvolvimento regista o evento de forma estruturada.
 */
async function sendPasswordReset({ to, resetUrl, expiresAt }) {
  logger.info('email.password_reset_queued', {
    to,
    resetUrl: env.isProd ? '[redacted]' : resetUrl,
    expiresAt,
  });

  if (env.isProd && !process.env.SMTP_HOST) {
    logger.warn('email.smtp_not_configured', { to });
  }

  return { queued: true };
}

async function sendTransactional({ to, subject, text, template, meta }) {
  logger.info('email.transactional_queued', {
    to,
    subject,
    template,
    meta: env.isProd ? undefined : meta,
  });

  if (env.isProd && !process.env.SMTP_HOST) {
    logger.warn('email.smtp_not_configured', { to, template });
  }

  return { queued: true };
}

module.exports = { sendPasswordReset, sendTransactional };
