'use strict';

const nodemailer = require('nodemailer');
const { env } = require('../config/env');
const { logger } = require('../utils/logger');

let transporter;

function getTransporter() {
  if (transporter) return transporter;
  if (!env.smtp.host) return null;

  transporter = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.secure,
    auth: env.smtp.user
      ? { user: env.smtp.user, pass: env.smtp.pass }
      : undefined,
  });
  return transporter;
}

async function deliver({ to, subject, text, html }) {
  const tx = getTransporter();
  if (!tx) {
    if (env.isProd) {
      logger.warn('email.smtp_not_configured', { to, subject });
    }
    return { queued: true, delivered: false };
  }

  const info = await tx.sendMail({
    from: env.smtp.from,
    to,
    subject,
    text,
    html: html || undefined,
    replyTo: env.smtp.replyTo || undefined,
  });

  logger.info('email.sent', {
    to,
    subject,
    messageId: info.messageId,
  });
  return { queued: true, delivered: true, messageId: info.messageId };
}

/**
 * Abstracção de email · SMTP (produção) ou log estruturado (dev / sem SMTP).
 */
async function sendPasswordReset({ to, resetUrl, expiresAt }) {
  logger.info('email.password_reset_queued', {
    to,
    resetUrl: env.isProd ? '[redacted]' : resetUrl,
    expiresAt,
  });

  const subject = 'MinhaTela · repor palavra-passe';
  const text = [
    'Recebemos um pedido para repor a palavra-passe da tua conta MinhaTela.',
    '',
    `Abre este link (válido até ${expiresAt}):`,
    resetUrl,
    '',
    'Se não foste tu, ignora este email.',
    '',
    `— Equipa MinhaTela · ${env.smtp.supportEmail}`,
  ].join('\n');

  return deliver({ to, subject, text });
}

async function sendTransactional({ to, subject, text, html, template, meta }) {
  logger.info('email.transactional_queued', {
    to,
    subject,
    template,
    meta: env.isProd ? undefined : meta,
  });

  return deliver({
    to,
    subject: subject || `MinhaTela · ${template || 'notificação'}`,
    text: text || '',
    html,
  });
}

module.exports = { sendPasswordReset, sendTransactional };
