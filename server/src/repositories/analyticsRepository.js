'use strict';

const { query } = require('../config/database');

async function track({
  eventName,
  userId,
  profileId,
  contentId,
  sessionId,
  metadata,
}) {
  await query(
    `INSERT INTO analytics_events
      (event_name, user_id, profile_id, content_id, session_id, metadata)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
    [
      eventName,
      userId || null,
      profileId || null,
      contentId || null,
      sessionId || null,
      JSON.stringify(metadata || {}),
    ]
  );
}

module.exports = { track };
