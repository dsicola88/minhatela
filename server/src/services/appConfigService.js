'use strict';

const appConfigRepository = require('../repositories/appConfigRepository');
const auditRepository = require('../repositories/auditRepository');
const { createError } = require('../utils/errors');

const PUBLIC_KEYS = new Set(['onboarding', 'branding', 'support', 'landing', 'payments']);

function mapRow(row) {
  if (!row) return null;
  return {
    key: row.key,
    value: row.value,
    description: row.description,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}

async function adminList() {
  const rows = await appConfigRepository.listAll();
  return { settings: rows.map(mapRow) };
}

async function adminGet(key) {
  const row = await appConfigRepository.get(key);
  if (!row) throw createError(404, 'Configuração não encontrada', 'CONFIG_NOT_FOUND');
  return mapRow(row);
}

async function adminUpsert(actorId, key, body, meta = {}) {
  if (!key || typeof key !== 'string') {
    throw createError(400, 'Chave obrigatória', 'VALIDATION');
  }
  const safeKey = key.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
  if (!safeKey) throw createError(400, 'Chave inválida', 'VALIDATION');

  const value = body?.value !== undefined ? body.value : body;
  if (value === undefined || value === null || typeof value !== 'object') {
    throw createError(400, 'value JSON obrigatório', 'VALIDATION');
  }

  const row = await appConfigRepository.upsert(safeKey, value, {
    description: body?.description,
    updatedBy: actorId,
  });

  await auditRepository.write({
    actorId,
    action: 'app_config.upserted',
    entity: 'app_settings',
    entityId: safeKey,
    metadata: { keys: Object.keys(value) },
    ip: meta.ip,
  });

  return mapRow(row);
}

/** Bootstrap público (onboarding / branding / support contactos) — sem secrets. */
async function publicBootstrap() {
  try {
    const rows = await appConfigRepository.listAll();
    const out = {};
    for (const row of rows) {
      if (!PUBLIC_KEYS.has(row.key)) continue;
      out[row.key] = row.value;
    }
    return {
      market: 'AO',
      currency: 'Kz',
      config: out,
    };
  } catch (err) {
    // Tabela ainda não migrada ou DB intermitente — defaults seguros
    return {
      market: 'AO',
      currency: 'Kz',
      config: {
        onboarding: {
          enabled: true,
          slides: [
            {
              id: 'welcome',
              title: 'Bem-vindo à MinhaTela',
              subtitle: 'Cinema e séries feitos para Angola.',
              cta: 'Continuar',
            },
          ],
        },
        branding: { tagline: 'A tua tela. A nossa Angola.', homeAnnouncement: null },
        support: {
          email: 'support@minhatela.net',
          hours: 'Seg–Sex 09:00–18:00 (WAT)',
        },
      },
      degraded: true,
    };
  }
}

module.exports = {
  adminList,
  adminGet,
  adminUpsert,
  publicBootstrap,
};
