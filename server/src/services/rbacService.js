'use strict';

const { query } = require('../config/database');
const { logger } = require('../utils/logger');

const STAFF_ROLES = [
  'super_admin',
  'admin',
  'moderator',
  'content_manager',
  'finance_manager',
  'support_agent',
];

const STUDIO_ROLES = [
  'creator',
  'producer',
  'production_owner',
  'production_manager',
  'production_editor',
  'production_finance',
];

const COMPANY_ROLES = {
  owner: ['owner', 'manager', 'editor', 'finance'],
  manager: ['manager', 'editor'],
  editor: ['editor'],
  finance: ['finance'],
};

let permCache = { at: 0, byRole: new Map() };

async function permissionsForRoles(roles = []) {
  const list = [...new Set(roles.filter(Boolean))];
  if (!list.length) return new Set();
  const now = Date.now();
  if (now - permCache.at > 30_000) {
    permCache = { at: now, byRole: new Map() };
  }
  const missing = list.filter((r) => !permCache.byRole.has(r));
  if (missing.length) {
    try {
      const result = await query(
        `SELECT role_code, permission_code
         FROM role_permissions
         WHERE role_code = ANY($1::text[])`,
        [missing]
      );
      for (const code of missing) {
        permCache.byRole.set(code, new Set());
      }
      for (const row of result.rows) {
        permCache.byRole.get(row.role_code)?.add(row.permission_code);
      }
    } catch (err) {
      logger.warn('rbac.permissions_unavailable', { message: err.message });
    }
  }
  const out = new Set();
  for (const role of list) {
    const set = permCache.byRole.get(role);
    if (set) set.forEach((p) => out.add(p));
  }
  if (list.includes('super_admin')) out.add('*');
  return out;
}

function hasPermission(perms, code) {
  if (!code) return true;
  if (perms.has('*') || perms.has(code)) return true;
  return false;
}

function isStaff(roles = []) {
  return roles.some((r) => STAFF_ROLES.includes(r));
}

function isStudio(roles = []) {
  return roles.some((r) => STUDIO_ROLES.includes(r));
}

function isSuperAdmin(roles = []) {
  return roles.includes('super_admin');
}

function capabilities(roles = []) {
  return {
    adminConsole: isStaff(roles),
    creatorStudio: isStudio(roles),
    adsPortal: roles.includes('advertiser'),
    companyPortal: roles.some((r) =>
      ['producer', 'production_owner', 'production_manager', 'production_editor', 'production_finance'].includes(r)
    ),
    superAdmin: isSuperAdmin(roles),
  };
}

async function defaultTenantId() {
  try {
    const result = await query(`SELECT id FROM tenants WHERE slug = 'minhatela' LIMIT 1`);
    return result.rows[0]?.id || null;
  } catch {
    return null;
  }
}

async function tenantIdForUser(userId) {
  try {
    const result = await query(
      `SELECT tenant_id
       FROM tenant_memberships
       WHERE user_id = $1 AND status = 'active'
       ORDER BY created_at ASC
       LIMIT 1`,
      [userId]
    );
    if (result.rows[0]) return result.rows[0].tenant_id;
    return defaultTenantId();
  } catch {
    return null;
  }
}

async function ensureMembership(userId, roleCode) {
  try {
    if (!userId || !roleCode) return;
    const existing = await query(
      `SELECT 1 FROM tenant_memberships WHERE user_id = $1 AND status = 'active' LIMIT 1`,
      [userId]
    );
    if (existing.rowCount) return;
    const tenantId = await defaultTenantId();
    if (!tenantId) return;
    await query(
      `INSERT INTO tenant_memberships (user_id, tenant_id, role_code, status)
       VALUES ($1, $2, $3, 'active')
       ON CONFLICT DO NOTHING`,
      [userId, tenantId, roleCode]
    );
  } catch (err) {
    logger.warn('rbac.membership_skip', { message: err.message });
  }
}

module.exports = {
  STAFF_ROLES,
  STUDIO_ROLES,
  COMPANY_ROLES,
  permissionsForRoles,
  hasPermission,
  isStaff,
  isStudio,
  isSuperAdmin,
  capabilities,
  defaultTenantId,
  tenantIdForUser,
  ensureMembership,
};
