'use strict';

const { query } = require('../config/database');

async function insertEvent({ provider, eventType, externalId, payload }) {
  try {
    const result = await query(
      `INSERT INTO webhook_events (provider, event_type, external_id, payload)
       VALUES ($1, $2, $3, $4::jsonb)
       RETURNING id`,
      [provider, eventType, externalId || null, JSON.stringify(payload || {})]
    );
    return { id: result.rows[0].id, duplicate: false };
  } catch (err) {
    if (err.code === '23505' && externalId) {
      return { id: null, duplicate: true };
    }
    throw err;
  }
}

async function markProcessed(id, status = 'processed', errorMessage = null) {
  if (!id) return;
  await query(
    `UPDATE webhook_events
     SET status = $2, error_message = $3, processed_at = NOW()
     WHERE id = $1`,
    [id, status, errorMessage]
  );
}

async function updateVideoEncoding(bunnyVideoId, encodingStatus) {
  const result = await query(
    `UPDATE videos
     SET encoding_status = $2,
         encoding_updated_at = NOW(),
         is_published = CASE
           WHEN $2 = 'ready' AND workflow_status = 'published' THEN TRUE
           WHEN $2 = 'failed' THEN is_published
           ELSE is_published
         END
     WHERE bunny_video_id = $1
     RETURNING id, title, kind, workflow_status, encoding_status`,
    [bunnyVideoId, encodingStatus]
  );
  return result.rows;
}

module.exports = {
  insertEvent,
  markProcessed,
  updateVideoEncoding,
};
