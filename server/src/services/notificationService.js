'use strict';

const notificationRepository = require('../repositories/notificationRepository');
const emailService = require('./emailService');
const { logger } = require('../utils/logger');

function mapNotification(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    data: row.data || {},
    readAt: row.read_at,
    createdAt: row.created_at,
    unread: !row.read_at,
  };
}

async function notify({ userId, type, title, body, data, email }) {
  const row = await notificationRepository.create({
    userId,
    type,
    title,
    body,
    data,
  });

  if (email?.to) {
    await emailService.sendTransactional({
      to: email.to,
      subject: title,
      text: body,
      template: type,
      meta: data,
    });
  }

  // Push paralelo (não bloqueia a resposta)
  require('./pushService')
    .notifyUser(userId, { title, body, data: { ...(data || {}), type } })
    .catch(() => {});

  logger.info('notification.created', { userId, type, id: row.id });
  return mapNotification(row);
}

async function list(userId, query) {
  const rows = await notificationRepository.listByUser(userId, query);
  const unread = await notificationRepository.unreadCount(userId);
  return {
    unread,
    notifications: rows.map(mapNotification),
  };
}

async function unreadCount(userId) {
  return { unread: await notificationRepository.unreadCount(userId) };
}

async function markRead(userId, id) {
  await notificationRepository.markRead(userId, id);
  return unreadCount(userId);
}

async function markAllRead(userId) {
  const updated = await notificationRepository.markAllRead(userId);
  return { marked: updated, unread: 0 };
}

async function notifyPaymentSubmitted(userId, { transactionId, amountKz, type }) {
  return notify({
    userId,
    type: 'payment_submitted',
    title: 'Comprovativo recebido',
    body: `Recebemos o seu comprovativo (${amountKz} Kz). A equipa MinhaTela vai confirmar em breve.`,
    data: { transactionId, type, amountKz },
  });
}

async function notifyPaymentReviewed(user, tx, approved) {
  if (approved) {
    return notify({
      userId: user.id || tx.user_id,
      type: 'payment_approved',
      title: 'Pagamento confirmado',
      body:
        tx.type === 'subscription'
          ? 'O seu Premium MinhaTela está activo. Bom cinema!'
          : 'O aluguer está activo. Tem 48 horas a partir da confirmação.',
      data: {
        transactionId: tx.id,
        type: tx.type,
        videoId: tx.video_id,
        accessExpiresAt: tx.access_expires_at,
      },
      email: {
        to: user.email,
      },
    });
  }

  return notify({
    userId: user.id || tx.user_id,
    type: 'payment_rejected',
    title: 'Pagamento não confirmado',
    body: 'Não foi possível validar o comprovativo. Envie um novo em Checkout ou contacte o suporte.',
    data: { transactionId: tx.id, type: tx.type },
    email: {
      to: user.email,
    },
  });
}

module.exports = {
  notify,
  list,
  unreadCount,
  markRead,
  markAllRead,
  notifyPaymentSubmitted,
  notifyPaymentReviewed,
};
