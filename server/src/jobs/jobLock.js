'use strict';

const { pool } = require('../config/database');
const { logger } = require('../utils/logger');

const LOCKS = Object.freeze({
  comingSoon: 738201,
  accountPurge: 738202,
  newEpisode: 738203,
  subscriptionExpiry: 738204,
});

/**
 * Lock de sessão Postgres — uma réplica da API corre o job; as outras saltam.
 * Mantém a conexão até `fn` terminar.
 */
async function withJobLock(lockId, jobName, fn) {
  const client = await pool.connect();
  try {
    const got = await client.query('SELECT pg_try_advisory_lock($1) AS ok', [lockId]);
    if (!got.rows[0]?.ok) {
      logger.debug('jobs.lock_skipped', { jobName, lockId });
      return { skipped: true, reason: 'lock' };
    }
    try {
      return await fn();
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [lockId]).catch(() => {});
    }
  } finally {
    client.release();
  }
}

module.exports = { withJobLock, LOCKS };
