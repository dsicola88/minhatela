'use strict';

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { pool, query } = require('../src/config/database');
const { logger } = require('../src/utils/logger');

const migrationsDir =
  process.env.MIGRATIONS_DIR ||
  path.resolve(__dirname, '../../database/migrations');

/** Não entra no arranque remoto. Só com APPLY_038_LEDGER_TRACE=1, depois da inspeção só de leitura. */
const HELD_ON_REMOTE = new Set(['038_creator_ledger_trace.sql']);

async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function appliedIds() {
  const result = await query('SELECT id FROM schema_migrations ORDER BY id');
  return new Set(result.rows.map((r) => r.id));
}

async function migrate() {
  const dbUrl = process.env.DATABASE_URL || '';
  const remoteHost = /railway|onrender|amazonaws\.com|supabase\.co/i.test(dbUrl);
  if (
    remoteHost &&
    process.env.ALLOW_REMOTE_MIGRATE !== '1'
  ) {
    logger.error('migrate.blocked_remote_host');
    throw new Error('BLOCKED: migrate recusa host remoto sem ALLOW_REMOTE_MIGRATE=1');
  }
  await ensureTable();
  const applied = await appliedIds();
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (applied.has(file)) {
      logger.info('migrate.skip', { file });
      continue;
    }

    if (remoteHost && HELD_ON_REMOTE.has(file) && process.env.APPLY_038_LEDGER_TRACE !== '1') {
      logger.warn('migrate.held', {
        file,
        reason: 'revisão do livro pendente; não altera créditos em produção',
      });
      continue;
    }

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (id) VALUES ($1)', [file]);
      await client.query('COMMIT');
      logger.info('migrate.applied', { file });
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('migrate.failed', { file, message: error.message });
      throw error;
    } finally {
      client.release();
    }
  }
}

migrate()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async () => {
    await pool.end();
    process.exit(1);
  });
