'use strict';

/**
 * Seed · Super Admin MinhaTela
 *
 * Estas credenciais SÃO as de login (acesso total à app + /admin).
 * Depois de `npm run seed`, entra com o email/password abaixo.
 *
 * Acesso: is_admin=true · roles incl. super_admin · Premium vitalício · perfil · Creator activo.
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
  email: String(process.env.SUPERADMIN_EMAIL || 'minhatela2026@gmail.com')
    .trim()
    .toLowerCase(),
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
  if (!SUPERADMIN.email || !SUPERADMIN.email.includes('@')) {
    throw new Error('SUPERADMIN_EMAIL inválido');
  }
  if (!SUPERADMIN.password || String(SUPERADMIN.password).length < 8) {
    throw new Error('SUPERADMIN_PASSWORD deve ter pelo menos 8 caracteres');
  }

  const passwordHash = await bcrypt.hash(SUPERADMIN.password, 12);

  // Credenciais de LOGIN — password_hash actualizado sempre (idempotente)
  const upsert = await query(
    `INSERT INTO users (
       email, password_hash, full_name, is_admin,
       subscription_status, premium_expires_at, email_verified_at, deleted_at
     )
     VALUES ($1, $2, $3, TRUE, 'premium_active', NULL, NOW(), NULL)
     ON CONFLICT (email) DO UPDATE SET
       password_hash = EXCLUDED.password_hash,
       full_name = EXCLUDED.full_name,
       is_admin = TRUE,
       subscription_status = 'premium_active',
       premium_expires_at = NULL,
       email_verified_at = COALESCE(users.email_verified_at, NOW()),
       deleted_at = NULL,
       deletion_requested_at = NULL,
       deletion_scheduled_at = NULL,
       updated_at = NOW()
     RETURNING id, email, is_admin, subscription_status, password_hash`,
    [SUPERADMIN.email, passwordHash, SUPERADMIN.fullName]
  );

  const user = upsert.rows[0];
  if (!user?.id) {
    throw new Error('Falha ao criar/actualizar superadmin');
  }

  // Garantir papéis (incl. super_admin) — necessário para /admin e flags críticas
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

  // Verificação: a password do seed deve autenticar (mesmo algoritmo do login)
  const ok = await bcrypt.compare(SUPERADMIN.password, user.password_hash);
  if (!ok) {
    throw new Error('Seed superadmin: hash de password não confere com a password de login');
  }

  const roles = await query(
    `SELECT r.code
     FROM user_roles ur
     JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id = $1
     ORDER BY r.code`,
    [user.id]
  );

  const roleCodes = roles.rows.map((r) => r.code);
  if (!roleCodes.includes('super_admin') || !roleCodes.includes('admin')) {
    throw new Error(
      `Seed superadmin: papéis em falta (tem: ${roleCodes.join(', ') || 'nenhum'}). Corra as migrations.`
    );
  }

  return {
    email: user.email,
    loginEmail: SUPERADMIN.email,
    /** password só no log de seed local — nunca em APIs */
    loginPasswordSet: true,
    isAdmin: user.is_admin,
    subscription: user.subscription_status,
    roles: roleCodes,
    access: 'full · /admin · Console Empresa',
  };
}

module.exports = { run, SUPERADMIN, ALL_ROLES };
