'use strict';

const { query } = require('../config/database');

async function listByContent(contentId) {
  const result = await query(
    `SELECT p.id, p.slug, p.full_name, p.photo_url, p.nationality,
            cp.role, cp.character_name, cp.sort_order
     FROM content_people cp
     JOIN people p ON p.id = cp.person_id
     WHERE cp.content_id = $1
     ORDER BY cp.sort_order ASC, p.full_name ASC`,
    [contentId]
  );
  return result.rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    fullName: r.full_name,
    photoUrl: r.photo_url,
    nationality: r.nationality,
    role: r.role,
    characterName: r.character_name,
  }));
}

async function getPerson(slugOrId) {
  const result = await query(
    `SELECT id, slug, full_name, bio, photo_url, nationality, role_default
     FROM people
     WHERE slug = $1 OR id::text = $1
     LIMIT 1`,
    [slugOrId]
  );
  const person = result.rows[0];
  if (!person) return null;

  const titles = await query(
    `SELECT v.id, v.title, v.slug, v.poster_url, v.kind, v.release_year, v.monetization,
            cp.role, cp.character_name
     FROM content_people cp
     JOIN videos v ON v.id = cp.content_id
     WHERE cp.person_id = $1
       AND v.is_published = TRUE
       AND v.workflow_status = 'published'
       AND v.kind IN ('movie', 'series')
     ORDER BY v.release_year DESC NULLS LAST, v.updated_at DESC
     LIMIT 40`,
    [person.id]
  );

  return {
    id: person.id,
    slug: person.slug,
    fullName: person.full_name,
    bio: person.bio,
    photoUrl: person.photo_url,
    nationality: person.nationality,
    roleDefault: person.role_default,
    titles: titles.rows.map((r) => ({
      id: r.id,
      title: r.title,
      slug: r.slug,
      posterUrl: r.poster_url,
      kind: r.kind,
      releaseYear: r.release_year,
      monetization: r.monetization,
      role: r.role,
      characterName: r.character_name,
    })),
  };
}

async function listChapters(contentId) {
  const result = await query(
    `SELECT id, title, start_seconds, end_seconds, sort_order
     FROM content_chapters
     WHERE content_id = $1
     ORDER BY sort_order ASC, start_seconds ASC`,
    [contentId]
  );
  return result.rows.map((r) => ({
    id: r.id,
    title: r.title,
    startSeconds: r.start_seconds,
    endSeconds: r.end_seconds,
  }));
}

async function saveFeedback({
  userId,
  profileId,
  contentId,
  sessionId,
  score,
  nps,
  comment,
}) {
  const result = await query(
    `INSERT INTO playback_feedback
      (user_id, profile_id, content_id, session_id, score, nps, comment)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (user_id, content_id, session_id) DO UPDATE
       SET score = EXCLUDED.score,
           nps = EXCLUDED.nps,
           comment = EXCLUDED.comment
     RETURNING id, score, nps, created_at`,
    [
      userId,
      profileId || null,
      contentId,
      sessionId || null,
      score,
      nps != null ? Number(nps) : null,
      comment || null,
    ]
  );
  return result.rows[0];
}

async function createStillWatching({ userId, sessionId, contentId }) {
  await query(
    `UPDATE still_watching_challenges SET status = 'expired'
     WHERE user_id = $1 AND status = 'pending'`,
    [userId]
  );
  const result = await query(
    `INSERT INTO still_watching_challenges (user_id, session_id, content_id)
     VALUES ($1,$2,$3)
     RETURNING id, challenged_at, expires_at, status`,
    [userId, sessionId, contentId || null]
  );
  return result.rows[0];
}

async function confirmStillWatching({ challengeId, userId }) {
  const result = await query(
    `UPDATE still_watching_challenges SET
       status = 'confirmed',
       confirmed_at = NOW()
     WHERE id = $1 AND user_id = $2 AND status = 'pending' AND expires_at > NOW()
     RETURNING id, status, confirmed_at`,
    [challengeId, userId]
  );
  return result.rows[0] || null;
}

async function getPendingStillWatching(userId, sessionId) {
  const result = await query(
    `SELECT id, challenged_at, expires_at, status, content_id
     FROM still_watching_challenges
     WHERE user_id = $1 AND session_id = $2 AND status = 'pending' AND expires_at > NOW()
     ORDER BY challenged_at DESC LIMIT 1`,
    [userId, sessionId]
  );
  return result.rows[0] || null;
}

module.exports = {
  listByContent,
  getPerson,
  listChapters,
  saveFeedback,
  createStillWatching,
  confirmStillWatching,
  getPendingStillWatching,
};
