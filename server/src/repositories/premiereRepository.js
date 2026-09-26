'use strict';

const { query } = require('../config/database');

function mapEvent(row, reminded = false, { includeStreamUrl = false } = {}) {
  const starts = row.starts_at ? new Date(row.starts_at) : null;
  const now = new Date();
  let phase = 'upcoming';
  if (row.stream_status === 'live' || row.is_live) phase = 'live';
  else if (row.stream_status === 'ended') phase = 'ended';
  else if (starts && starts <= now) phase = row.ends_at && new Date(row.ends_at) < now ? 'ended' : 'started';
  const event = {
    id: row.id,
    slug: row.slug,
    title: row.title,
    synopsis: row.synopsis,
    contentId: row.content_id,
    posterUrl: row.poster_url,
    backdropUrl: row.backdrop_url,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    isLive: row.is_live || row.stream_status === 'live',
    streamStatus: row.stream_status || (row.is_live ? 'live' : 'scheduled'),
    joinOpensAt: row.join_opens_at || null,
    canJoin:
      (row.stream_status === 'live' || row.is_live) &&
      (!row.join_opens_at || new Date(row.join_opens_at) <= now) &&
      !(row.ends_at && new Date(row.ends_at) < now),
    isPublished: row.is_published,
    market: row.market,
    sortOrder: row.sort_order,
    phase,
    countdownSeconds: starts && starts > now ? Math.floor((starts - now) / 1000) : 0,
    reminded,
  };
  // HLS nunca na listagem — só via POST join autorizado
  if (includeStreamUrl) {
    event.hlsUrl = row.hls_url || null;
  }
  return event;
}

async function listUpcoming({ limit = 20, includePast = false } = {}) {
  const result = await query(
    `SELECT * FROM premiere_events
     WHERE is_published = TRUE
       AND market = 'AO'
       AND (
         $2::boolean = TRUE
         OR starts_at > NOW() - INTERVAL '6 hours'
         OR is_live = TRUE
       )
     ORDER BY
       CASE WHEN is_live THEN 0 ELSE 1 END,
       starts_at ASC
     LIMIT $1`,
    [limit, includePast]
  );
  return result.rows.map((r) => mapEvent(r));
}

async function findBySlug(slug) {
  const result = await query(`SELECT * FROM premiere_events WHERE slug = $1`, [slug]);
  return result.rows[0] || null;
}

async function findById(id) {
  const result = await query(`SELECT * FROM premiere_events WHERE id = $1`, [id]);
  return result.rows[0] || null;
}

async function setReminder({ eventId, userId, profileId }) {
  await query(
    `INSERT INTO premiere_reminders (event_id, user_id, profile_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (event_id, user_id) DO NOTHING`,
    [eventId, userId, profileId || null]
  );
}

async function removeReminder({ eventId, userId }) {
  await query(
    `DELETE FROM premiere_reminders WHERE event_id = $1 AND user_id = $2`,
    [eventId, userId]
  );
}

async function userReminders(userId) {
  const result = await query(
    `SELECT event_id FROM premiere_reminders WHERE user_id = $1`,
    [userId]
  );
  return new Set(result.rows.map((r) => r.event_id));
}

async function adminCreate(body) {
  const result = await query(
    `INSERT INTO premiere_events
       (slug, title, synopsis, content_id, poster_url, backdrop_url,
        starts_at, ends_at, is_live, is_published, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING *`,
    [
      body.slug,
      body.title,
      body.synopsis || null,
      body.contentId || null,
      body.posterUrl || null,
      body.backdropUrl || null,
      body.startsAt,
      body.endsAt || null,
      Boolean(body.isLive),
      body.isPublished !== false,
      Number(body.sortOrder) || 100,
    ]
  );
  return result.rows[0];
}

async function adminUpdate(id, body) {
  const result = await query(
    `UPDATE premiere_events SET
       title = COALESCE($2, title),
       synopsis = COALESCE($3, synopsis),
       content_id = COALESCE($4, content_id),
       poster_url = COALESCE($5, poster_url),
       backdrop_url = COALESCE($6, backdrop_url),
       starts_at = COALESCE($7, starts_at),
       ends_at = COALESCE($8, ends_at),
       is_live = COALESCE($9, is_live),
       is_published = COALESCE($10, is_published),
       sort_order = COALESCE($11, sort_order),
       updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [
      id,
      body.title || null,
      body.synopsis !== undefined ? body.synopsis : null,
      body.contentId || null,
      body.posterUrl || null,
      body.backdropUrl || null,
      body.startsAt || null,
      body.endsAt || null,
      body.isLive === undefined ? null : Boolean(body.isLive),
      body.isPublished === undefined ? null : Boolean(body.isPublished),
      body.sortOrder === undefined ? null : Number(body.sortOrder),
    ]
  );
  return result.rows[0] || null;
}

async function adminList(limit = 40) {
  const result = await query(
    `SELECT * FROM premiere_events ORDER BY starts_at DESC LIMIT $1`,
    [limit]
  );
  return result.rows.map((r) => mapEvent(r));
}

module.exports = {
  mapEvent,
  listUpcoming,
  findBySlug,
  findById,
  setReminder,
  removeReminder,
  userReminders,
  adminCreate,
  adminUpdate,
  adminList,
};
