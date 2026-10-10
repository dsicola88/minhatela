'use strict';

const { query } = require('../config/database');
const creatorRepository = require('../repositories/creatorRepository');
const userRepository = require('../repositories/userRepository');
const auditRepository = require('../repositories/auditRepository');
const rbacService = require('./rbacService');
const { createError } = require('../utils/errors');

function slugify(name) {
  return String(name)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 160);
}

function mapCompany(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    country: row.country,
    status: row.status || 'active',
    tenantId: row.tenant_id,
    ownerCreatorId: row.owner_creator_id,
    createdAt: row.created_at,
  };
}

async function membership(userId) {
  const result = await query(
    `SELECT cm.role, cm.status, pc.*
     FROM company_members cm
     JOIN production_companies pc ON pc.id = cm.company_id
     WHERE cm.user_id = $1 AND cm.status = 'active'
     ORDER BY cm.created_at ASC
     LIMIT 1`,
    [userId]
  );
  return result.rows[0] || null;
}

async function requireMember(userId, allowedRoles = null) {
  const row = await membership(userId);
  if (!row) {
    throw createError(403, 'Sem acesso ao portal da produtora', 'COMPANY_REQUIRED');
  }
  if (allowedRoles && !allowedRoles.includes(row.role)) {
    throw createError(403, 'Permissão insuficiente nesta produtora', 'COMPANY_FORBIDDEN');
  }
  return row;
}

async function registerCompany(userId, body, meta = {}) {
  const existing = await membership(userId);
  if (existing) {
    return { company: mapCompany(existing), role: existing.role, alreadyExists: true };
  }

  const name = String(body.name || '').trim();
  if (!name) throw createError(400, 'Nome da produtora é obrigatório', 'VALIDATION');

  const creator = await creatorRepository.findByUserId(userId);
  if (!creator || creator.status !== 'active') {
    throw createError(403, 'Conta de criador activa necessária', 'CREATOR_NOT_ACTIVE');
  }

  const tenantId = await rbacService.defaultTenantId();
  const slugBase = slugify(name) || `produtora-${Date.now()}`;
  const slug = `${slugBase}-${Math.random().toString(36).slice(2, 6)}`;

  let created;
  try {
    created = await query(
      `INSERT INTO production_companies (name, slug, country, owner_creator_id, tenant_id, status)
       VALUES ($1, $2, $3, $4, $5, 'active')
       RETURNING *`,
      [name, slug, body.country || 'AO', creator.id, tenantId]
    );
  } catch {
    created = await query(
      `INSERT INTO production_companies (name, slug, country, owner_creator_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name, slug, body.country || 'AO', creator.id]
    );
  }

  await query(
    `INSERT INTO company_members (company_id, user_id, role, status)
     VALUES ($1, $2, 'owner', 'active')
     ON CONFLICT (company_id, user_id) DO UPDATE SET role = 'owner', status = 'active'`,
    [created.rows[0].id, userId]
  );

  await query(
    `UPDATE creators SET production_company_id = $1 WHERE id = $2`,
    [created.rows[0].id, creator.id]
  );

  await userRepository.assignRole(userId, 'producer');
  await userRepository.assignRole(userId, 'production_owner');

  await auditRepository.write({
    actorId: userId,
    action: 'company.registered',
    entity: 'production_company',
    entityId: created.rows[0].id,
    tenantId,
    ip: meta.ip,
  });

  return { company: mapCompany(created.rows[0]), role: 'owner', alreadyExists: false };
}

async function dashboard(userId) {
  const row = await membership(userId);
  if (!row) {
    return { company: null, role: null, members: [], contents: [], finance: null };
  }

  const [members, contents, finance] = await Promise.all([
    listMembers(row.id),
    listContent(row.id),
    row.role === 'owner' || row.role === 'finance' || row.role === 'manager'
      ? financeSummary(row.id)
      : Promise.resolve(null),
  ]);

  return {
    company: mapCompany(row),
    role: row.role,
    members,
    contents: row.role === 'finance' ? [] : contents,
    finance: row.role === 'editor' ? null : finance,
  };
}

async function listMembers(companyId) {
  const result = await query(
    `SELECT cm.user_id, cm.role, cm.status, cm.created_at, u.email, u.full_name
     FROM company_members cm
     JOIN users u ON u.id = cm.user_id
     WHERE cm.company_id = $1 AND cm.status <> 'removed'
     ORDER BY cm.created_at`,
    [companyId]
  );
  return result.rows.map((r) => ({
    userId: r.user_id,
    email: r.email,
    fullName: r.full_name,
    role: r.role,
    status: r.status,
    createdAt: r.created_at,
  }));
}

async function listContent(companyId) {
  const result = await query(
    `SELECT id, title, workflow_status, monetization, is_published, created_at, updated_at
     FROM videos
     WHERE production_company_id = $1
     ORDER BY updated_at DESC
     LIMIT 100`,
    [companyId]
  );
  return result.rows.map((r) => ({
    id: r.id,
    title: r.title,
    workflowStatus: r.workflow_status,
    monetization: r.monetization,
    isPublished: r.is_published,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

async function financeSummary(companyId) {
  const result = await query(
    `SELECT COALESCE(SUM(ce.amount_kz), 0)::int AS total_kz
     FROM creator_earnings ce
     JOIN creators c ON c.id = ce.creator_id
     WHERE c.production_company_id = $1`,
    [companyId]
  );
  return { revenueKz: result.rows[0]?.total_kz || 0 };
}

async function addMember(actorId, body, meta = {}) {
  const company = await requireMember(actorId, ['owner', 'manager']);
  const email = String(body.email || '').toLowerCase().trim();
  const role = body.role || 'editor';
  if (!['owner', 'manager', 'editor', 'finance'].includes(role)) {
    throw createError(400, 'Role inválida', 'VALIDATION');
  }
  if (company.role === 'manager' && role === 'owner') {
    throw createError(403, 'Manager não pode promover owner', 'COMPANY_FORBIDDEN');
  }
  const user = await userRepository.findByEmail(email);
  if (!user) throw createError(404, 'Utilizador não encontrado', 'USER_NOT_FOUND');

  await query(
    `INSERT INTO company_members (company_id, user_id, role, status)
     VALUES ($1, $2, $3, 'active')
     ON CONFLICT (company_id, user_id)
     DO UPDATE SET role = EXCLUDED.role, status = 'active'`,
    [company.id, user.id, role]
  );

  const roleMap = {
    owner: 'production_owner',
    manager: 'production_manager',
    editor: 'production_editor',
    finance: 'production_finance',
  };
  await userRepository.assignRole(user.id, roleMap[role]);
  await userRepository.assignRole(user.id, 'producer');

  await auditRepository.write({
    actorId,
    action: 'company.member_added',
    entity: 'production_company',
    entityId: company.id,
    tenantId: company.tenant_id,
    metadata: { memberUserId: user.id, role },
    ip: meta.ip,
  });

  return { ok: true, members: await listMembers(company.id) };
}

async function removeMember(actorId, memberUserId, meta = {}) {
  const company = await requireMember(actorId, ['owner']);
  if (memberUserId === actorId) {
    throw createError(400, 'O owner não pode remover-se a si próprio', 'VALIDATION');
  }
  await query(
    `UPDATE company_members SET status = 'removed'
     WHERE company_id = $1 AND user_id = $2`,
    [company.id, memberUserId]
  );
  await auditRepository.write({
    actorId,
    action: 'company.member_removed',
    entity: 'production_company',
    entityId: company.id,
    metadata: { memberUserId },
    ip: meta.ip,
  });
  return { ok: true, members: await listMembers(company.id) };
}

async function assertCompanyContent(userId, contentId) {
  const company = await requireMember(userId, ['owner', 'manager', 'editor']);
  const result = await query(
    `SELECT id FROM videos WHERE id = $1 AND production_company_id = $2 LIMIT 1`,
    [contentId, company.id]
  );
  if (!result.rowCount) {
    throw createError(404, 'Conteúdo não encontrado', 'CONTENT_NOT_FOUND');
  }
  return company;
}

module.exports = {
  registerCompany,
  dashboard,
  addMember,
  removeMember,
  requireMember,
  assertCompanyContent,
  membership,
};
