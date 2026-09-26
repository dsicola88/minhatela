'use strict';

const { Pool } = require('pg');
const { env } = require('./env');
const { logger } = require('../utils/logger');

const pool = new Pool({
  connectionString: env.databaseUrl,
  max: env.isProd ? 30 : 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 8000,
});

pool.on('error', (err) => {
  logger.error('postgres.pool_error', { message: err.message });
});

async function query(text, params) {
  const start = Date.now();
  const result = await pool.query(text, params);
  logger.debug('postgres.query', {
    durationMs: Date.now() - start,
    rows: result.rowCount,
  });
  return result;
}

async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function healthCheck() {
  const result = await query('SELECT 1 AS ok');
  return result.rows[0]?.ok === 1;
}

module.exports = { pool, query, withTransaction, healthCheck };
