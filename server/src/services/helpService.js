'use strict';

const helpRepository = require('../repositories/helpRepository');
const featureFlagService = require('./featureFlagService');
const auditRepository = require('../repositories/auditRepository');
const notificationService = require('./notificationService');
const { createError } = require('../utils/errors');

async function listAvatars(query = {}) {
  const kidsOnly =
    query.kids === '1' || query.kids === 'true'
      ? true
      : query.kids === '0' || query.kids === 'false'
        ? false
        : undefined;
  return { avatars: await helpRepository.listAvatars({ kidsOnly }) };
}

async function listHelp(query = {}) {
  await featureFlagService.assertEnabled('help_center_enabled', 'Ajuda temporariamente indisponível');
  const articles = await helpRepository.listArticles({
    category: query.category,
    locale: query.locale || 'pt-AO',
  });
  const categories = [...new Set(articles.map((a) => a.category))];
  return { categories, articles };
}

async function getHelpArticle(slug, locale) {
  await featureFlagService.assertEnabled('help_center_enabled', 'Ajuda temporariamente indisponível');
  const article = await helpRepository.getArticle(slug, locale || 'pt-AO');
  if (!article) throw createError(404, 'Artigo não encontrado', 'HELP_NOT_FOUND');
  return article;
}

async function createTicket(userId, body, meta = {}) {
  await featureFlagService.assertEnabled('help_center_enabled', 'Ajuda temporariamente indisponível');
  if (!body?.subject || String(body.subject).trim().length < 4) {
    throw createError(400, 'Assunto inválido', 'VALIDATION');
  }
  if (!body?.body || String(body.body).trim().length < 10) {
    throw createError(400, 'Descreva o problema (mín. 10 caracteres)', 'VALIDATION');
  }
  const allowed = new Set(['geral', 'pagamento', 'playback', 'conta', 'conteudo', 'outro']);
  const category = allowed.has(body.category) ? body.category : 'geral';

  const row = await helpRepository.createTicket({
    userId,
    subject: String(body.subject).trim().slice(0, 160),
    category,
    body: String(body.body).trim().slice(0, 4000),
    priority: body.priority === 'high' ? 'high' : 'normal',
  });

  await auditRepository.write({
    actorId: userId,
    action: 'support.ticket_created',
    entity: 'support_ticket',
    entityId: row.id,
    metadata: { category },
    ip: meta.ip,
  });

  try {
    await notificationService.notify({
      userId,
      type: 'support',
      title: 'Pedido de ajuda recebido',
      body: `Ticket «${row.subject}» aberto. Responderemos em breve.`,
      data: { ticketId: row.id },
    });
  } catch {
    /* optional */
  }

  return {
    id: row.id,
    subject: row.subject,
    category: row.category,
    status: row.status,
    priority: row.priority,
    createdAt: row.created_at,
    message: 'Ticket criado. A equipa MinhaTela irá responder.',
  };
}

async function myTickets(userId) {
  const rows = await helpRepository.listTicketsByUser(userId);
  return {
    tickets: rows.map((r) => ({
      id: r.id,
      subject: r.subject,
      category: r.category,
      status: r.status,
      priority: r.priority,
      body: r.body,
      adminNotes: r.admin_notes,
      createdAt: r.created_at,
      resolvedAt: r.resolved_at,
    })),
  };
}

async function adminListTickets(limit) {
  const rows = await helpRepository.listOpenTickets(limit);
  return {
    tickets: rows.map((r) => ({
      id: r.id,
      subject: r.subject,
      category: r.category,
      status: r.status,
      priority: r.priority,
      body: r.body,
      createdAt: r.created_at,
      email: r.email,
      fullName: r.full_name,
    })),
  };
}

async function adminReviewTicket(adminId, ticketId, body, meta = {}) {
  const allowed = new Set(['open', 'in_progress', 'resolved', 'closed']);
  if (body?.status && !allowed.has(body.status)) {
    throw createError(400, 'Estado inválido', 'VALIDATION');
  }
  const row = await helpRepository.reviewTicket({
    ticketId,
    status: body.status,
    adminNotes: body.adminNotes || body.notes,
    assignedTo: adminId,
  });
  if (!row) throw createError(404, 'Ticket não encontrado', 'NOT_FOUND');

  await auditRepository.write({
    actorId: adminId,
    action: 'support.ticket_reviewed',
    entity: 'support_ticket',
    entityId: ticketId,
    metadata: { status: row.status },
    ip: meta.ip,
  });

  return {
    id: row.id,
    status: row.status,
    resolvedAt: row.resolved_at,
    adminNotes: row.admin_notes,
  };
}

module.exports = {
  listAvatars,
  listHelp,
  getHelpArticle,
  createTicket,
  myTickets,
  adminListTickets,
  adminReviewTicket,
};
