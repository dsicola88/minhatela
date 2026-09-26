'use strict';

const { query } = require('../config/database');

async function listPacks() {
  const result = await query(
    `SELECT p.*,
            COALESCE(
              (SELECT json_agg(json_build_object(
                 'id', v.id, 'title', v.title, 'posterUrl', v.poster_url, 'kind', v.kind
               ) ORDER BY i.sort_order)
               FROM tvod_pack_items i
               JOIN videos v ON v.id = i.video_id
               WHERE i.pack_id = p.id),
              '[]'::json
            ) AS items
     FROM tvod_packs p
     WHERE p.is_active = TRUE
     ORDER BY p.sort_order ASC, p.title ASC`
  );
  return result.rows;
}

async function findPackById(id) {
  const result = await query(`SELECT * FROM tvod_packs WHERE id = $1`, [id]);
  return result.rows[0] || null;
}

async function findPackBySlug(slug) {
  const result = await query(`SELECT * FROM tvod_packs WHERE slug = $1`, [slug]);
  return result.rows[0] || null;
}

async function packItems(packId) {
  const result = await query(
    `SELECT v.id, v.title, v.poster_url, v.kind, v.monetization, v.rental_price_kz
     FROM tvod_pack_items i
     JOIN videos v ON v.id = i.video_id
     WHERE i.pack_id = $1
     ORDER BY i.sort_order`,
    [packId]
  );
  return result.rows;
}

async function hasActivePackForVideo(userId, videoId) {
  const result = await query(
    `SELECT pe.expires_at, pe.pack_id, p.title AS pack_title
     FROM pack_entitlements pe
     JOIN tvod_pack_items i ON i.pack_id = pe.pack_id
     JOIN tvod_packs p ON p.id = pe.pack_id
     WHERE pe.user_id = $1
       AND i.video_id = $2
       AND pe.expires_at > NOW()
     ORDER BY pe.expires_at DESC
     LIMIT 1`,
    [userId, videoId]
  );
  return result.rows[0] || null;
}

async function touchProfileLastUsed(profileId, userId, deviceId) {
  const result = await query(
    `UPDATE profiles
     SET last_used_at = NOW(),
         last_used_device_id = COALESCE($3, last_used_device_id)
     WHERE id = $1 AND user_id = $2
     RETURNING id, last_used_at, last_used_device_id`,
    [profileId, userId, deviceId || null]
  );
  return result.rows[0] || null;
}

async function getPendingSurvey(userId, promptKey = 'app_nps_session') {
  const prompt = await query(
    `SELECT * FROM app_survey_prompts WHERE key = $1 AND is_active = TRUE`,
    [promptKey]
  );
  if (!prompt.rowCount) return null;
  const p = prompt.rows[0];
  const recent = await query(
    `SELECT id FROM app_survey_responses
     WHERE user_id = $1 AND prompt_key = $2
       AND created_at > NOW() - ($3 || ' days')::interval
     LIMIT 1`,
    [userId, promptKey, String(p.cooldown_days)]
  );
  if (recent.rowCount) return null;
  return p;
}

async function saveSurveyResponse({
  userId,
  profileId,
  promptKey,
  nps,
  score,
  comment,
  appSessionId,
}) {
  const result = await query(
    `INSERT INTO app_survey_responses
      (user_id, profile_id, prompt_key, nps, score, comment, app_session_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING id, nps, score, created_at`,
    [
      userId,
      profileId || null,
      promptKey,
      nps != null ? Number(nps) : null,
      score != null ? Number(score) : null,
      comment ? String(comment).slice(0, 500) : null,
      appSessionId || null,
    ]
  );
  return result.rows[0];
}

async function surveySummary() {
  const result = await query(
    `SELECT
       COUNT(*)::int AS responses,
       ROUND(AVG(nps)::numeric, 2) AS avg_nps,
       ROUND(AVG(score)::numeric, 2) AS avg_score,
       COUNT(*) FILTER (WHERE nps >= 9)::int AS promoters,
       COUNT(*) FILTER (WHERE nps <= 6)::int AS detractors
     FROM app_survey_responses
     WHERE created_at > NOW() - INTERVAL '90 days'`
  );
  return result.rows[0];
}

async function insertCdnCheck(row) {
  const result = await query(
    `INSERT INTO cdn_health_checks
      (probe_type, ok, latency_ms, http_status, error, details)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb)
     RETURNING *`,
    [
      row.probeType,
      Boolean(row.ok),
      row.latencyMs ?? null,
      row.httpStatus ?? null,
      row.error || null,
      JSON.stringify(row.details || {}),
    ]
  );
  return result.rows[0];
}

async function listCdnChecks(limit = 20) {
  const result = await query(
    `SELECT * FROM cdn_health_checks ORDER BY checked_at DESC LIMIT $1`,
    [limit]
  );
  return result.rows;
}

async function refreshCommunityRating(contentId) {
  const result = await query(
    `UPDATE videos v
     SET community_rating_avg = s.avg_r,
         community_rating_count = s.cnt
     FROM (
       SELECT ROUND(AVG(rating)::numeric, 2) AS avg_r, COUNT(*)::int AS cnt
       FROM content_ratings WHERE content_id = $1
     ) s
     WHERE v.id = $1
     RETURNING v.community_rating_avg, v.community_rating_count`,
    [contentId]
  );
  return result.rows[0] || { community_rating_avg: null, community_rating_count: 0 };
}

async function adminListPacks() {
  const result = await query(
    `SELECT p.*,
            (SELECT COUNT(*)::int FROM tvod_pack_items i WHERE i.pack_id = p.id) AS item_count
     FROM tvod_packs p
     ORDER BY p.sort_order, p.title`
  );
  return result.rows;
}

module.exports = {
  listPacks,
  findPackById,
  findPackBySlug,
  packItems,
  hasActivePackForVideo,
  touchProfileLastUsed,
  getPendingSurvey,
  saveSurveyResponse,
  surveySummary,
  insertCdnCheck,
  listCdnChecks,
  refreshCommunityRating,
  adminListPacks,
};
