'use strict';

const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { query } = require('../config/database');
const { env } = require('../config/env');
const auditRepository = require('../repositories/auditRepository');
const { createError } = require('../utils/errors');

/* ─── Users ─────────────────────────────────────────────── */

async function listUsers({ q, limit = 40, offset = 0 } = {}) {
  const needle = q ? `%${String(q).trim().toLowerCase()}%` : null;
  const result = await query(
    `SELECT u.id, u.email, u.full_name, u.subscription_status, u.premium_expires_at,
            u.is_admin, u.created_at, u.updated_at,
            COALESCE(array_agg(DISTINCT r.code) FILTER (WHERE r.code IS NOT NULL), '{}') AS roles
     FROM users u
     LEFT JOIN user_roles ur ON ur.user_id = u.id
     LEFT JOIN roles r ON r.id = ur.role_id
     WHERE ($1::text IS NULL
            OR LOWER(u.email) LIKE $1
            OR LOWER(u.full_name) LIKE $1)
     GROUP BY u.id
     ORDER BY u.created_at DESC
     LIMIT $2 OFFSET $3`,
    [needle, Math.min(100, Number(limit) || 40), Math.max(0, Number(offset) || 0)]
  );
  const count = await query(
    `SELECT COUNT(*)::int AS c FROM users u
     WHERE ($1::text IS NULL
            OR LOWER(u.email) LIKE $1
            OR LOWER(u.full_name) LIKE $1)`,
    [needle]
  );
  return {
    total: count.rows[0].c,
    users: result.rows.map((r) => ({
      id: r.id,
      email: r.email,
      fullName: r.full_name,
      subscriptionStatus: r.subscription_status,
      premiumExpiresAt: r.premium_expires_at,
      isAdmin: r.is_admin,
      roles: r.roles || [],
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })),
  };
}

async function updateUser(actorId, userId, body, meta = {}) {
  const allowedStatus = new Set(['none', 'premium_active', 'premium_expired']);
  if (body.subscriptionStatus && !allowedStatus.has(body.subscriptionStatus)) {
    throw createError(400, 'subscriptionStatus inválido', 'VALIDATION');
  }
  const result = await query(
    `UPDATE users SET
       full_name = COALESCE($2, full_name),
       is_admin = COALESCE($3, is_admin),
       subscription_status = COALESCE($4::subscription_status, subscription_status),
       premium_expires_at = CASE
         WHEN $5::boolean = TRUE THEN $6::timestamptz
         ELSE premium_expires_at
       END,
       updated_at = NOW()
     WHERE id = $1
     RETURNING id, email, full_name, subscription_status, premium_expires_at, is_admin`,
    [
      userId,
      body.fullName || null,
      body.isAdmin === undefined ? null : Boolean(body.isAdmin),
      body.subscriptionStatus || null,
      body.premiumExpiresAt !== undefined,
      body.premiumExpiresAt || null,
    ]
  );
  const row = result.rows[0];
  if (!row) throw createError(404, 'Utilizador não encontrado', 'NOT_FOUND');

  if (body.roleCode) {
    await query(
      `INSERT INTO user_roles (user_id, role_id)
       SELECT $1, r.id FROM roles r WHERE r.code = $2
       ON CONFLICT DO NOTHING`,
      [userId, body.roleCode]
    );
  }

  await auditRepository.write({
    actorId,
    action: 'user.admin_updated',
    entity: 'user',
    entityId: userId,
    metadata: {
      isAdmin: row.is_admin,
      subscriptionStatus: row.subscription_status,
    },
    ip: meta.ip,
  });

  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    subscriptionStatus: row.subscription_status,
    premiumExpiresAt: row.premium_expires_at,
    isAdmin: row.is_admin,
  };
}

/* ─── Plans ─────────────────────────────────────────────── */

function mapPlan(row) {
  return {
    id: row.id,
    name: row.name,
    priceKz: row.price_kz,
    period: row.period,
    streams: row.streams,
    downloads: row.downloads,
    ads: row.ads_enabled,
    quality: row.quality,
    highlights: row.highlights || [],
    cta: row.cta,
    badge: row.badge,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    isDefault: row.is_default,
    market: row.market,
    updatedAt: row.updated_at,
  };
}

async function listPlansAdmin() {
  const result = await query(
    `SELECT * FROM subscription_plans ORDER BY sort_order ASC, name ASC`
  );
  return { plans: result.rows.map(mapPlan), currency: 'AOA', market: 'AO' };
}

async function upsertPlan(actorId, planId, body, meta = {}) {
  const id = String(planId || body.id || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]/g, '');
  if (!id || !body.name) throw createError(400, 'id e name obrigatórios', 'VALIDATION');

  const result = await query(
    `INSERT INTO subscription_plans
       (id, name, price_kz, period, streams, downloads, ads_enabled, quality,
        highlights, cta, badge, sort_order, is_active, is_default, market, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11,$12,$13,$14,'AO',NOW())
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       price_kz = EXCLUDED.price_kz,
       period = EXCLUDED.period,
       streams = EXCLUDED.streams,
       downloads = EXCLUDED.downloads,
       ads_enabled = EXCLUDED.ads_enabled,
       quality = EXCLUDED.quality,
       highlights = EXCLUDED.highlights,
       cta = EXCLUDED.cta,
       badge = EXCLUDED.badge,
       sort_order = EXCLUDED.sort_order,
       is_active = EXCLUDED.is_active,
       is_default = EXCLUDED.is_default,
       updated_at = NOW()
     RETURNING *`,
    [
      id,
      body.name.trim(),
      Number(body.priceKz) || 0,
      body.period || null,
      Number(body.streams) || 1,
      Number(body.downloads) || 0,
      body.ads !== false && body.adsEnabled !== false,
      body.quality || 'Auto',
      JSON.stringify(body.highlights || []),
      JSON.stringify(body.cta || null),
      body.badge || null,
      Number(body.sortOrder) || 100,
      body.isActive !== false,
      Boolean(body.isDefault),
    ]
  );

  await auditRepository.write({
    actorId,
    action: 'plan.upserted',
    entity: 'subscription_plan',
    entityId: id,
    metadata: { priceKz: result.rows[0].price_kz },
    ip: meta.ip,
  });

  return mapPlan(result.rows[0]);
}

/* ─── Leads ─────────────────────────────────────────────── */

async function createLead(body) {
  const email = String(body.email || '')
    .trim()
    .toLowerCase();
  if (!email || !email.includes('@')) {
    throw createError(400, 'Email inválido', 'VALIDATION');
  }
  const result = await query(
    `INSERT INTO leads (email, full_name, phone, source, interest, meta)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb)
     ON CONFLICT (email, source) DO UPDATE SET
       full_name = COALESCE(EXCLUDED.full_name, leads.full_name),
       phone = COALESCE(EXCLUDED.phone, leads.phone),
       interest = EXCLUDED.interest,
       meta = leads.meta || EXCLUDED.meta,
       updated_at = NOW()
     RETURNING id, email, status, created_at`,
    [
      email,
      body.fullName || body.name || null,
      body.phone || null,
      body.source || 'landing',
      body.interest || 'premium',
      JSON.stringify(body.meta || {}),
    ]
  );
  return {
    id: result.rows[0].id,
    email: result.rows[0].email,
    status: result.rows[0].status,
    createdAt: result.rows[0].created_at,
  };
}

async function listLeads({ status, limit = 50 } = {}) {
  const result = await query(
    `SELECT id, email, full_name, phone, source, interest, status, notes, created_at, updated_at
     FROM leads
     WHERE ($1::text IS NULL OR status = $1)
     ORDER BY created_at DESC
     LIMIT $2`,
    [status || null, Math.min(200, Number(limit) || 50)]
  );
  return {
    leads: result.rows.map((r) => ({
      id: r.id,
      email: r.email,
      fullName: r.full_name,
      phone: r.phone,
      source: r.source,
      interest: r.interest,
      status: r.status,
      notes: r.notes,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })),
  };
}

async function updateLead(actorId, leadId, body, meta = {}) {
  const allowed = new Set(['new', 'contacted', 'qualified', 'converted', 'discarded']);
  if (body.status && !allowed.has(body.status)) {
    throw createError(400, 'status inválido', 'VALIDATION');
  }
  const result = await query(
    `UPDATE leads SET
       status = COALESCE($2, status),
       notes = COALESCE($3, notes),
       assigned_to = COALESCE($4, assigned_to),
       updated_at = NOW()
     WHERE id = $1
     RETURNING id, email, status, notes`,
    [leadId, body.status || null, body.notes || null, actorId]
  );
  if (!result.rows[0]) throw createError(404, 'Lead não encontrado', 'NOT_FOUND');
  await auditRepository.write({
    actorId,
    action: 'lead.updated',
    entity: 'lead',
    entityId: leadId,
    metadata: { status: result.rows[0].status },
    ip: meta.ip,
  });
  return {
    id: result.rows[0].id,
    email: result.rows[0].email,
    status: result.rows[0].status,
    notes: result.rows[0].notes,
  };
}

/* ─── Uploads ───────────────────────────────────────────── */

const mediaDir = path.join(env.uploadsDir, 'media');
fs.mkdirSync(mediaDir, { recursive: true });

const mediaUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, mediaDir),
    filename: (_req, file, cb) => {
      const safe = String(file.originalname || 'file')
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .slice(0, 80);
      cb(null, `${Date.now()}-${safe}`);
    },
  }),
  limits: { fileSize: 25 * 1024 * 1024 },
});

async function listUploads({ kind, limit = 40 } = {}) {
  const result = await query(
    `SELECT id, kind, original_name, stored_name, path, mime_type, size_bytes, created_at, uploaded_by
     FROM media_uploads
     WHERE ($1::text IS NULL OR kind = $1)
     ORDER BY created_at DESC
     LIMIT $2`,
    [kind || null, Math.min(100, Number(limit) || 40)]
  );
  return {
    uploads: result.rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      originalName: r.original_name,
      url: r.path,
      mimeType: r.mime_type,
      sizeBytes: Number(r.size_bytes || 0),
      createdAt: r.created_at,
      uploadedBy: r.uploaded_by,
    })),
  };
}

async function registerUpload(actorId, file, body = {}) {
  if (!file) throw createError(400, 'Ficheiro obrigatório', 'VALIDATION');
  const kind = body.kind || 'asset';
  const publicPath = `/uploads/media/${file.filename}`;
  const result = await query(
    `INSERT INTO media_uploads
       (kind, original_name, stored_name, path, mime_type, size_bytes, uploaded_by, meta)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
     RETURNING id, path, kind, created_at`,
    [
      kind,
      file.originalname,
      file.filename,
      publicPath,
      file.mimetype,
      file.size,
      actorId,
      JSON.stringify({ field: body.field || null }),
    ]
  );
  await auditRepository.write({
    actorId,
    action: 'media.uploaded',
    entity: 'media_upload',
    entityId: result.rows[0].id,
    metadata: { kind, path: publicPath },
  });
  return {
    id: result.rows[0].id,
    kind: result.rows[0].kind,
    url: result.rows[0].path,
    createdAt: result.rows[0].created_at,
  };
}

async function listProofUploads(limit = 40) {
  const result = await query(
    `SELECT t.id, t.proof_url, t.status, t.amount_kz, t.created_at, u.email, u.full_name
     FROM transactions t
     JOIN users u ON u.id = t.user_id
     WHERE t.proof_url IS NOT NULL
     ORDER BY t.created_at DESC
     LIMIT $1`,
    [Math.min(100, Number(limit) || 40)]
  );
  return {
    proofs: result.rows.map((r) => ({
      transactionId: r.id,
      proofUrl: r.proof_url,
      status: r.status,
      amountKz: r.amount_kz,
      email: r.email,
      fullName: r.full_name,
      createdAt: r.created_at,
    })),
  };
}

/* ─── Ads ───────────────────────────────────────────────── */

async function listAllCampaigns({ status, limit = 50 } = {}) {
  const result = await query(
    `SELECT c.id, c.name, c.placement, c.budget_kz, c.spent_kz, c.status, c.created_at,
            a.company_name, a.contact_email
     FROM campaigns c
     JOIN advertisers a ON a.id = c.advertiser_id
     WHERE ($1::text IS NULL OR c.status::text = $1)
     ORDER BY c.created_at DESC
     LIMIT $2`,
    [status || null, Math.min(100, Number(limit) || 50)]
  );
  return {
    campaigns: result.rows.map((r) => ({
      id: r.id,
      name: r.name,
      placement: r.placement,
      budgetKz: r.budget_kz,
      spentKz: r.spent_kz,
      status: r.status,
      companyName: r.company_name,
      contactEmail: r.contact_email,
      createdAt: r.created_at,
    })),
  };
}

module.exports = {
  listUsers,
  updateUser,
  listPlansAdmin,
  upsertPlan,
  createLead,
  listLeads,
  updateLead,
  mediaUpload,
  listUploads,
  registerUpload,
  listProofUploads,
  listAllCampaigns,
  mapPlan,
};
