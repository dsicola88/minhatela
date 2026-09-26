'use strict';

const { query } = require('../config/database');
const crypto = require('crypto');

function genCode() {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

async function createRoom({
  hostUserId,
  hostProfileId,
  contentId,
  playbackSessionId,
  displayName,
}) {
  let room = null;
  for (let i = 0; i < 6; i += 1) {
    const code = genCode();
    try {
      const result = await query(
        `INSERT INTO watch_party_rooms
          (code, host_user_id, host_profile_id, content_id, playback_session_id)
         VALUES ($1,$2,$3,$4,$5)
         RETURNING *`,
        [code, hostUserId, hostProfileId || null, contentId, playbackSessionId || null]
      );
      room = result.rows[0];
      break;
    } catch {
      /* retry code collision */
    }
  }
  if (!room) throw new Error('ROOM_CREATE_FAILED');

  await query(
    `INSERT INTO watch_party_members (room_id, user_id, profile_id, display_name, is_host)
     VALUES ($1,$2,$3,$4,TRUE)
     ON CONFLICT DO NOTHING`,
    [room.id, hostUserId, hostProfileId || null, displayName || 'Anfitrião']
  );
  return room;
}

async function findActiveByCode(code) {
  const result = await query(
    `SELECT r.*, v.title AS content_title, v.poster_url, v.kind
     FROM watch_party_rooms r
     JOIN videos v ON v.id = r.content_id
     WHERE upper(r.code) = upper($1) AND r.status = 'active'`,
    [code]
  );
  return result.rows[0] || null;
}

async function findById(roomId) {
  const result = await query(
    `SELECT r.*, v.title AS content_title, v.poster_url, v.kind
     FROM watch_party_rooms r
     JOIN videos v ON v.id = r.content_id
     WHERE r.id = $1`,
    [roomId]
  );
  return result.rows[0] || null;
}

async function joinRoom({ roomId, userId, profileId, displayName }) {
  const count = await query(
    `SELECT COUNT(*)::int AS c FROM watch_party_members WHERE room_id = $1`,
    [roomId]
  );
  const room = await findById(roomId);
  if (!room || room.status !== 'active') return { error: 'ENDED' };
  if (count.rows[0].c >= room.max_members) return { error: 'FULL' };

  await query(
    `INSERT INTO watch_party_members (room_id, user_id, profile_id, display_name, is_host)
     VALUES ($1,$2,$3,$4,FALSE)
     ON CONFLICT (room_id, user_id) DO UPDATE
       SET last_seen_at = NOW(),
           display_name = COALESCE(EXCLUDED.display_name, watch_party_members.display_name)`,
    [roomId, userId, profileId || null, displayName || 'Convidado']
  );
  return { ok: true };
}

async function syncHost({ roomId, hostUserId, positionSeconds, isPlaying }) {
  const result = await query(
    `UPDATE watch_party_rooms SET
       position_seconds = COALESCE($3, position_seconds),
       is_playing = COALESCE($4, is_playing),
       last_sync_at = NOW()
     WHERE id = $1 AND host_user_id = $2 AND status = 'active'
     RETURNING *`,
    [
      roomId,
      hostUserId,
      positionSeconds != null ? Math.max(0, Math.floor(positionSeconds)) : null,
      isPlaying === undefined ? null : Boolean(isPlaying),
    ]
  );
  return result.rows[0] || null;
}

async function touchMember(roomId, userId) {
  await query(
    `UPDATE watch_party_members SET last_seen_at = NOW()
     WHERE room_id = $1 AND user_id = $2`,
    [roomId, userId]
  );
}

async function listMembers(roomId) {
  const result = await query(
    `SELECT user_id, profile_id, display_name, is_host, joined_at, last_seen_at
     FROM watch_party_members
     WHERE room_id = $1
     ORDER BY is_host DESC, joined_at ASC`,
    [roomId]
  );
  return result.rows;
}

async function endRoom(roomId, hostUserId) {
  const result = await query(
    `UPDATE watch_party_rooms SET status = 'ended', ended_at = NOW()
     WHERE id = $1 AND host_user_id = $2
     RETURNING id, status`,
    [roomId, hostUserId]
  );
  return result.rows[0] || null;
}

async function leaveRoom(roomId, userId) {
  await query(
    `DELETE FROM watch_party_members WHERE room_id = $1 AND user_id = $2 AND is_host = FALSE`,
    [roomId, userId]
  );
}

module.exports = {
  createRoom,
  findActiveByCode,
  findById,
  joinRoom,
  syncHost,
  touchMember,
  listMembers,
  endRoom,
  leaveRoom,
};
