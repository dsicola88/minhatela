'use strict';

const { query } = require('../config/database');

async function listAvatars({ kidsOnly } = {}) {
  const result = await query(
    `SELECT id, slug, label, image_url, is_kids, sort_order
     FROM profile_avatars
     WHERE is_active = TRUE
       AND ($1::boolean IS NULL OR is_kids = $1)
     ORDER BY sort_order ASC`,
    [kidsOnly === undefined ? null : Boolean(kidsOnly)]
  );
  return result.rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    label: r.label,
    imageUrl: r.image_url,
    isKids: r.is_kids,
  }));
}

async function listArticles({ category, locale = 'pt-AO' } = {}) {
  const result = await query(
    `SELECT id, slug, category, title, body_md, locale, sort_order, updated_at
     FROM help_articles
     WHERE is_published = TRUE
       AND locale = $1
       AND ($2::text IS NULL OR category = $2)
     ORDER BY sort_order ASC, title ASC`,
    [locale, category || null]
  );
  return result.rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    category: r.category,
    title: r.title,
    bodyMd: r.body_md,
    locale: r.locale,
    updatedAt: r.updated_at,
  }));
}

async function getArticle(slug, locale = 'pt-AO') {
  const result = await query(
    `SELECT id, slug, category, title, body_md, locale, updated_at
     FROM help_articles
     WHERE slug = $1 AND locale = $2 AND is_published = TRUE`,
    [slug, locale]
  );
  const r = result.rows[0];
  if (!r) return null;
  return {
    id: r.id,
    slug: r.slug,
    category: r.category,
    title: r.title,
    bodyMd: r.body_md,
    locale: r.locale,
    updatedAt: r.updated_at,
  };
}

async function createTicket({ userId, subject, category, body, priority }) {
  const result = await query(
    `INSERT INTO support_tickets (user_id, subject, category, body, priority)
     VALUES ($1,$2,$3,$4,$5)
     RETURNING id, subject, category, status, priority, created_at`,
    [userId, subject, category || 'geral', body, priority || 'normal']
  );
  return result.rows[0];
}

async function listTicketsByUser(userId) {
  const result = await query(
    `SELECT id, subject, category, status, priority, body, admin_notes, created_at, resolved_at
     FROM support_tickets
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 50`,
    [userId]
  );
  return result.rows;
}

async function listOpenTickets(limit = 50) {
  const result = await query(
    `SELECT t.id, t.subject, t.category, t.status, t.priority, t.body, t.created_at,
            u.email, u.full_name
     FROM support_tickets t
     JOIN users u ON u.id = t.user_id
     WHERE t.status IN ('open', 'in_progress')
     ORDER BY
       CASE t.priority WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END,
       t.created_at ASC
     LIMIT $1`,
    [Math.min(200, Number(limit) || 50)]
  );
  return result.rows;
}

async function reviewTicket({ ticketId, status, adminNotes, assignedTo }) {
  const result = await query(
    `UPDATE support_tickets SET
       status = COALESCE($2, status),
       admin_notes = COALESCE($3, admin_notes),
       assigned_to = COALESCE($4, assigned_to),
       resolved_at = CASE
         WHEN $2 IN ('resolved', 'closed') THEN NOW()
         ELSE resolved_at
       END,
       updated_at = NOW()
     WHERE id = $1
     RETURNING id, status, resolved_at, admin_notes`,
    [ticketId, status || null, adminNotes || null, assignedTo || null]
  );
  return result.rows[0] || null;
}

async function adminListArticles(limit = 100) {
  const result = await query(
    `SELECT id, slug, category, title, body_md, locale, sort_order, is_published, updated_at
     FROM help_articles
     ORDER BY sort_order ASC, title ASC
     LIMIT $1`,
    [Math.min(200, Number(limit) || 100)]
  );
  return result.rows;
}

async function adminUpsertArticle(body) {
  const result = await query(
    `INSERT INTO help_articles (slug, category, title, body_md, locale, sort_order, is_published)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (slug) DO UPDATE SET
       category = EXCLUDED.category,
       title = EXCLUDED.title,
       body_md = EXCLUDED.body_md,
       locale = EXCLUDED.locale,
       sort_order = EXCLUDED.sort_order,
       is_published = EXCLUDED.is_published,
       updated_at = NOW()
     RETURNING id, slug, category, title, body_md, locale, sort_order, is_published, updated_at`,
    [
      body.slug,
      body.category || 'geral',
      body.title,
      body.bodyMd || body.body_md || '',
      body.locale || 'pt-AO',
      Number(body.sortOrder) || 100,
      body.isPublished !== false,
    ]
  );
  return result.rows[0];
}

async function adminSetArticlePublished(id, isPublished) {
  const result = await query(
    `UPDATE help_articles
     SET is_published = $2, updated_at = NOW()
     WHERE id = $1
     RETURNING id, slug, is_published, updated_at`,
    [id, Boolean(isPublished)]
  );
  return result.rows[0] || null;
}

module.exports = {
  listAvatars,
  listArticles,
  getArticle,
  createTicket,
  listTicketsByUser,
  listOpenTickets,
  reviewTicket,
  adminListArticles,
  adminUpsertArticle,
  adminSetArticlePublished,
};
