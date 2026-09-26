'use strict';

/**
 * Seed · Super Admin MinhaTela
 * Acesso total: todos os papéis, Premium vitalício, perfil e Creator Studio activo.
 * Idempotente: actualiza password / papéis / premium se o email já existir.
 *
 * Overrides via env (recomendado em produção):
 *   SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD, SUPERADMIN_NAME
 */
const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');

/** Monorepo local: ../../server; Docker (WORKDIR /app): /app */
function loadBcrypt() {
  const candidates = [
    path.resolve(__dirname, '../../server/package.json'),
    '/app/package.json',
  ];
  for (const pkg of candidates) {
    if (!fs.existsSync(pkg)) continue;
    try {
      return createRequire(pkg)('bcryptjs');
    } catch (_) {
      /* try next */
    }
  }
  throw new Error('bcryptjs não encontrado (server/node_modules ou /app/node_modules)');
}

const bcrypt = loadBcrypt();

const SUPERADMIN = {
  email: process.env.SUPERADMIN_EMAIL || 'minhatela2026@gmail.com',
  password: process.env.SUPERADMIN_PASSWORD || 'Dpa211088@',
  fullName: process.env.SUPERADMIN_NAME || 'Super Admin MinhaTela',
};

const ALL_ROLES = [
  'customer',
  'creator',
  'producer',
  'advertiser',
  'moderator',
  'admin',
  'super_admin',
];

async function run({ query }) {
  const passwordHash = await bcrypt.hash(SUPERADMIN.password, 12);

  const upsert = await query(
    `INSERT INTO users (
       email, password_hash, full_name, is_admin,
       subscription_status, premium_expires_at, email_verified_at
     )
     VALUES ($1, $2, $3, TRUE, 'premium_active', NULL, NOW())
     ON CONFLICT (email) DO UPDATE SET
       password_hash = EXCLUDED.password_hash,
       full_name = EXCLUDED.full_name,
       is_admin = TRUE,
       subscription_status = 'premium_active',
       premium_expires_at = NULL,
       email_verified_at = COALESCE(users.email_verified_at, NOW()),
       updated_at = NOW()
     RETURNING id, email, is_admin, subscription_status`,
    [SUPERADMIN.email, passwordHash, SUPERADMIN.fullName]
  );

  const user = upsert.rows[0];

  await query(
    `INSERT INTO user_roles (user_id, role_id)
     SELECT $1, r.id
     FROM roles r
     WHERE r.code = ANY($2::text[])
     ON CONFLICT DO NOTHING`,
    [user.id, ALL_ROLES]
  );

  await query(
    `INSERT INTO profiles (user_id, name, sort_order, maturity_max, is_kids)
     SELECT $1, $2, 0, 18, FALSE
     WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE user_id = $1)`,
    [user.id, 'Principal']
  );

  await query(
    `INSERT INTO creators (
       user_id, type, display_name, country, status, verified_at
     )
     VALUES ($1, 'producer', $2, 'AO', 'active', NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       display_name = EXCLUDED.display_name,
       type = 'producer',
       status = 'active',
       verified_at = COALESCE(creators.verified_at, NOW())`,
    [user.id, SUPERADMIN.fullName]
  );

  const roles = await query(
    `SELECT r.code
     FROM user_roles ur
     JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id = $1
     ORDER BY r.code`,
    [user.id]
  );

  return {
    email: user.email,
    isAdmin: user.is_admin,
    subscription: user.subscription_status,
    roles: roles.rows.map((r) => r.code),
  };
}

module.exports = { run, SUPERADMIN, ALL_ROLES };
