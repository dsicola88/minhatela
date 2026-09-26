'use strict';

const { query } = require('../config/database');

function mapLicense(row) {
  return {
    id: row.id,
    contentId: row.content_id,
    profileId: row.profile_id,
    deviceKey: row.device_key,
    deviceName: row.device_name,
    platform: row.platform,
    status: row.status,
    quality: row.quality,
    expiresAt: row.expires_at,
    downloadedAt: row.downloaded_at,
    lastPlayedAt: row.last_played_at,
    playCount: row.play_count,
    maxPlays: row.max_plays,
    bunnyVideoId: row.bunny_video_id,
    createdAt: row.created_at,
    title: row.title,
    posterUrl: row.poster_url,
    kind: row.kind,
    durationSeconds: row.duration_seconds,
  };
}

async function countActive(userId) {
  const result = await query(
    `SELECT COUNT(*)::int AS c FROM download_licenses
     WHERE user_id = $1 AND status = 'active' AND expires_at > NOW()`,
    [userId]
  );
  return result.rows[0].c;
}

async function findActive(profileId, contentId, deviceKey) {
  const result = await query(
    `SELECT * FROM download_licenses
     WHERE profile_id = $1 AND content_id = $2 AND device_key = $3
       AND status = 'active' AND expires_at > NOW()
     LIMIT 1`,
    [profileId, contentId, deviceKey]
  );
  return result.rows[0] || null;
}

async function upsert({
  userId,
  profileId,
  contentId,
  deviceKey,
  deviceName,
  platform,
  quality,
  expiresAt,
  maxPlays,
  bunnyVideoId,
}) {
  const result = await query(
    `INSERT INTO download_licenses
       (user_id, profile_id, content_id, device_key, device_name, platform,
        quality, expires_at, max_plays, bunny_video_id, status, downloaded_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'active', NOW())
     ON CONFLICT (profile_id, content_id, device_key) DO UPDATE SET
       status = 'active',
       quality = EXCLUDED.quality,
       expires_at = EXCLUDED.expires_at,
       max_plays = EXCLUDED.max_plays,
       bunny_video_id = EXCLUDED.bunny_video_id,
       device_name = EXCLUDED.device_name,
       platform = EXCLUDED.platform,
       downloaded_at = NOW(),
       play_count = 0
     RETURNING *`,
    [
      userId,
      profileId,
      contentId,
      deviceKey,
      deviceName,
      platform,
      quality,
      expiresAt,
      maxPlays,
      bunnyVideoId,
    ]
  );
  return result.rows[0];
}

async function listByUser(userId, profileId) {
  const result = await query(
    `SELECT d.*, v.title, v.poster_url, v.kind, v.duration_seconds
     FROM download_licenses d
     JOIN videos v ON v.id = d.content_id
     WHERE d.user_id = $1
       AND ($2::uuid IS NULL OR d.profile_id = $2)
       AND d.status = 'active'
       AND d.expires_at > NOW()
     ORDER BY d.created_at DESC
     LIMIT 100`,
    [userId, profileId || null]
  );
  return result.rows.map(mapLicense);
}

async function findOwned(licenseId, userId) {
  const result = await query(
    `SELECT d.*, v.title, v.poster_url, v.kind, v.duration_seconds, v.bunny_video_id AS content_bunny
     FROM download_licenses d
     JOIN videos v ON v.id = d.content_id
     WHERE d.id = $1 AND d.user_id = $2
     LIMIT 1`,
    [licenseId, userId]
  );
  return result.rows[0] || null;
}

async function revoke(licenseId, userId) {
  const result = await query(
    `UPDATE download_licenses
     SET status = 'revoked'
     WHERE id = $1 AND user_id = $2 AND status = 'active'
     RETURNING id`,
    [licenseId, userId]
  );
  return result.rowCount > 0;
}

async function markPlayed(licenseId, userId) {
  const result = await query(
    `UPDATE download_licenses
     SET play_count = play_count + 1,
         last_played_at = NOW(),
         status = CASE
           WHEN play_count + 1 >= max_plays THEN 'consumed'
           ELSE status
         END
     WHERE id = $1 AND user_id = $2 AND status = 'active' AND expires_at > NOW()
     RETURNING *`,
    [licenseId, userId]
  );
  return result.rows[0] || null;
}

async function expireStale() {
  await query(
    `UPDATE download_licenses
     SET status = 'expired'
     WHERE status = 'active' AND expires_at <= NOW()`
  );
}

module.exports = {
  countActive,
  findActive,
  upsert,
  listByUser,
  findOwned,
  revoke,
  markPlayed,
  expireStale,
  mapLicense,
};
