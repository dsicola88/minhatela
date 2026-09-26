'use strict';

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { pool, query } = require('../src/config/database');
const { logger } = require('../src/utils/logger');

const seedDir = path.resolve(__dirname, '../../database/seed');

async function seed() {
  const files = fs
    .readdirSync(seedDir)
    .filter((f) => f.endsWith('.sql') || f.endsWith('.js'))
    .sort();

  for (const file of files) {
    const fullPath = path.join(seedDir, file);
    if (file.endsWith('.sql')) {
      const sql = fs.readFileSync(fullPath, 'utf8');
      await query(sql);
      logger.info('seed.applied', { file });
      continue;
    }

    const mod = require(fullPath);
    const result = typeof mod.run === 'function' ? await mod.run({ query }) : await mod({ query });
    logger.info('seed.applied', { file, ...(result || {}) });
  }
}

seed()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async (error) => {
    logger.error('seed.failed', { message: error.message });
    await pool.end();
    process.exit(1);
  });
