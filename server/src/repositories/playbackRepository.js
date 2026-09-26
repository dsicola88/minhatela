'use strict';

const { query } = require('../config/database');
const { env } = require('../config/env');

async function createSession(session) {
  const result = await query(
    `INSERT INTO playback_sessions
      (id, user_id, profile_id, content_id, monetization, allowed,
       denial_code, bunny_video_id, expires_at, ip, user_agent,
       device_id, last_heartbeat_at, is_active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW(),$13)
     RETURNING id, expires_at, created_at`,
    [
      session.id,
      session.userId,
      session.profileId,
      session.contentId,
      session.monetization,
      session.allowed,
      session.denialCode,
      session.bunnyVideoId,
      session.expiresAt,
      session.ip,
      session.userAgent,
      session.deviceId || null,
      Boolean(session.isActive),
    ]
  );
  return result.rows[0];
}

async function listContinueWatching(profileId, limit = 12, maturityMax = 18) {
  const result = await query(
    `SELECT wp.position_seconds, wp.duration_seconds, wp.completed, wp.updated_at,
            wp.last_device_id, wp.last_synced_at,
            ds.device_name AS last_device_name, ds.platform AS last_device_platform,
            v.id, v.title, v.slug, v.poster_url, v.backdrop_url, v.monetization,
            v.rental_price_kz, v.release_year, v.synopsis_short, v.maturity_rating,
            v.kind, v.series_id, v.season_number, v.episode_number, v.episode_title,
            s.title AS series_title
     FROM watch_progress wp
     JOIN videos v ON v.id = wp.video_id
     LEFT JOIN videos s ON s.id = v.series_id AND s.kind = 'series'
     LEFT JOIN device_sessions ds ON ds.id = wp.last_device_id
     WHERE wp.profile_id = $1
       AND wp.completed = FALSE
       AND wp.hidden_from_row = FALSE
       AND wp.position_seconds > 15
       AND v.is_published = TRUE
       AND v.workflow_status = 'published'
       AND v.kind IN ('movie', 'episode')
       AND v.maturity_rating <= $3
     ORDER BY wp.updated_at DESC
     LIMIT $2`,
    [profileId, limit, maturityMax]
  );
  return result.rows;
}

async function listActiveStreams(userId) {
  const ttl = env.streamHeartbeatTtlSeconds;
  const result = await query(
    `SELECT ps.id, ps.content_id, ps.device_id, ps.last_heartbeat_at, ps.created_at,
            ds.device_name, ds.platform, v.title AS content_title
     FROM playback_sessions ps
     LEFT JOIN device_sessions ds ON ds.id = ps.device_id
     LEFT JOIN videos v ON v.id = ps.content_id
     WHERE ps.user_id = $1
       AND ps.allowed = TRUE
       AND ps.is_active = TRUE
       AND ps.ended_at IS NULL
       AND ps.last_heartbeat_at > NOW() - ($2 || ' seconds')::interval
     ORDER BY ps.last_heartbeat_at DESC`,
    [userId, String(ttl)]
  );
  return result.rows;
}

async function heartbeat(sessionId, userId) {
  const result = await query(
    `UPDATE playback_sessions
     SET last_heartbeat_at = NOW(), is_active = TRUE
     WHERE id = $1 AND user_id = $2 AND allowed = TRUE AND ended_at IS NULL
     RETURNING id, last_heartbeat_at`,
    [sessionId, userId]
  );
  return result.rows[0] || null;
}

async function endSession(sessionId, userId) {
  const result = await query(
    `UPDATE playback_sessions
     SET ended_at = NOW(), is_active = FALSE
     WHERE id = $1 AND user_id = $2 AND ended_at IS NULL
     RETURNING id`,
    [sessionId, userId]
  );
  return result.rows[0] || null;
}

async function endStaleForUser(userId) {
  await query(
    `UPDATE playback_sessions
     SET is_active = FALSE, ended_at = COALESCE(ended_at, NOW())
     WHERE user_id = $1
       AND is_active = TRUE
       AND last_heartbeat_at < NOW() - ($2 || ' seconds')::interval`,
    [userId, String(env.streamHeartbeatTtlSeconds)]
  );
}

async function forceEndOldest(userId) {
  const active = await listActiveStreams(userId);
  if (!active.length) return null;
  const oldest = active[active.length - 1];
  await endSession(oldest.id, userId);
  return oldest;
}

module.exports = {
  createSession,
  listContinueWatching,
  listActiveStreams,
  heartbeat,
  endSession,
  endStaleForUser,
  forceEndOldest,
};
