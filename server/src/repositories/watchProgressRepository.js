'use strict';

const { query } = require('../config/database');

async function upsertProgress({
  profileId,
  contentId,
  positionSeconds,
  durationSeconds,
  completed,
  deviceId,
}) {
  const result = await query(
    `INSERT INTO watch_progress
      (profile_id, video_id, position_seconds, duration_seconds, completed,
       last_device_id, last_synced_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
     ON CONFLICT (profile_id, video_id)
     DO UPDATE SET
       position_seconds = CASE
         WHEN EXCLUDED.completed THEN EXCLUDED.position_seconds
         WHEN EXCLUDED.position_seconds >= watch_progress.position_seconds
           THEN EXCLUDED.position_seconds
         ELSE watch_progress.position_seconds
       END,
       duration_seconds = GREATEST(EXCLUDED.duration_seconds, watch_progress.duration_seconds),
       completed = EXCLUDED.completed OR watch_progress.completed,
       last_device_id = CASE
         WHEN EXCLUDED.completed
           OR EXCLUDED.position_seconds >= watch_progress.position_seconds
         THEN COALESCE(EXCLUDED.last_device_id, watch_progress.last_device_id)
         ELSE watch_progress.last_device_id
       END,
       last_synced_at = NOW(),
       updated_at = CASE
         WHEN EXCLUDED.completed
           OR EXCLUDED.position_seconds >= watch_progress.position_seconds
         THEN NOW()
         ELSE watch_progress.updated_at
       END
     RETURNING profile_id, video_id, position_seconds, duration_seconds, completed,
               updated_at, last_device_id, last_synced_at`,
    [
      profileId,
      contentId,
      Math.max(0, Math.floor(positionSeconds)),
      Math.max(0, Math.floor(durationSeconds || 0)),
      Boolean(completed),
      deviceId || null,
    ]
  );
  return result.rows[0];
}

async function getProgress(profileId, contentId) {
  const result = await query(
    `SELECT position_seconds, duration_seconds, completed, updated_at
     FROM watch_progress
     WHERE profile_id = $1 AND video_id = $2`,
    [profileId, contentId]
  );
  return result.rows[0] || null;
}

module.exports = { upsertProgress, getProgress };
