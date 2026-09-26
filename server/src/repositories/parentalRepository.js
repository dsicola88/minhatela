'use strict';

const { query } = require('../config/database');
const { mapContentPublic } = require('../utils/mappers');

async function listBlocked(profileId) {
  const result = await query(
    `SELECT v.id, v.title, v.slug, v.poster_url, v.backdrop_url, v.kind,
            v.monetization, v.release_year, v.maturity_rating, b.blocked_at
     FROM profile_blocked_titles b
     JOIN videos v ON v.id = b.content_id
     WHERE b.profile_id = $1
     ORDER BY b.blocked_at DESC
     LIMIT 200`,
    [profileId]
  );
  return result.rows.map((row) => ({
    ...mapContentPublic(row),
    blockedAt: row.blocked_at,
  }));
}

async function isBlocked(profileId, contentId) {
  if (!profileId || !contentId) return false;
  const result = await query(
    `SELECT 1 FROM profile_blocked_titles
     WHERE profile_id = $1 AND content_id = $2
     LIMIT 1`,
    [profileId, contentId]
  );
  return result.rowCount > 0;
}

async function block(profileId, contentId, blockedBy) {
  await query(
    `INSERT INTO profile_blocked_titles (profile_id, content_id, blocked_by)
     VALUES ($1, $2, $3)
     ON CONFLICT DO NOTHING`,
    [profileId, contentId, blockedBy || null]
  );
}

async function unblock(profileId, contentId) {
  const result = await query(
    `DELETE FROM profile_blocked_titles
     WHERE profile_id = $1 AND content_id = $2
     RETURNING content_id`,
    [profileId, contentId]
  );
  return result.rowCount > 0;
}

async function listBlockedIds(profileId) {
  if (!profileId) return [];
  const result = await query(
    `SELECT content_id FROM profile_blocked_titles WHERE profile_id = $1`,
    [profileId]
  );
  return result.rows.map((r) => r.content_id);
}

module.exports = {
  listBlocked,
  isBlocked,
  block,
  unblock,
  listBlockedIds,
};
