'use strict';

const { query } = require('../config/database');

async function findActiveRental(userId, videoId) {
  const result = await query(
    `SELECT id, expires_at, starts_at
     FROM rentals
     WHERE user_id = $1 AND video_id = $2 AND expires_at > NOW()
     LIMIT 1`,
    [userId, videoId]
  );
  return result.rows[0] || null;
}

module.exports = { findActiveRental };
