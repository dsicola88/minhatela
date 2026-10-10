'use strict';

/**
 * Apaga dados da base LOCAL e volta a aplicar migrations + seed SuperAdmin.
 * Recusa hosts remotos (Railway, etc.).
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { pool, query } = require('../src/config/database');
const { logger } = require('../src/utils/logger');

async function resetLocal() {
  const dbUrl = process.env.DATABASE_URL || '';
  if (!/localhost|127\.0\.0\.1/.test(dbUrl)) {
    throw new Error('BLOCKED: reset-local só corre contra localhost');
  }
  if (/railway|onrender|amazonaws\.com|supabase\.co/i.test(dbUrl)) {
    throw new Error('BLOCKED: reset-local recusa host remoto');
  }

  logger.info('reset_local.dropping_schema');
  await query('DROP SCHEMA public CASCADE');
  await query('CREATE SCHEMA public');
  await query('GRANT ALL ON SCHEMA public TO CURRENT_USER');
  await query('GRANT ALL ON SCHEMA public TO public');
  logger.info('reset_local.schema_ready');
}

resetLocal()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async (error) => {
    logger.error('reset_local.failed', { message: error.message });
    await pool.end();
    process.exit(1);
  });
