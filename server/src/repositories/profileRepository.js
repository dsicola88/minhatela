'use strict';

const bcrypt = require('bcryptjs');
const { query } = require('../config/database');

async function listByUser(userId) {
  const result = await query(
    `SELECT id, name, avatar_url, is_kids, sort_order, maturity_max, has_pin,
            autoplay_next, autoplay_previews, data_saver_default,
            preferred_audio, preferred_subtitles, subtitle_size,
            a11y_reduced_motion, a11y_high_contrast, a11y_audio_description, a11y_large_text,
            preferred_quality, wifi_only_downloads, login_alerts, require_pin_on_play,
            hide_spoilers, autoplay_countdown_seconds, last_used_at, last_used_device_id
     FROM profiles
     WHERE user_id = $1
     ORDER BY last_used_at DESC NULLS LAST, sort_order ASC
     LIMIT 4`,
    [userId]
  );
  return result.rows;
}

async function createDefault(userId, name) {
  const result = await query(
    `INSERT INTO profiles (user_id, name, sort_order, maturity_max, is_kids)
     VALUES ($1, $2, 0, 18, FALSE)
     RETURNING id, name, avatar_url, is_kids, sort_order, maturity_max, has_pin`,
    [userId, name]
  );
  return result.rows[0];
}

async function findOwned(profileId, userId) {
  const result = await query(
    `SELECT id, name, avatar_url, is_kids, sort_order, maturity_max, has_pin, pin_hash,
            autoplay_next, autoplay_previews, data_saver_default,
            preferred_audio, preferred_subtitles, subtitle_size,
            a11y_reduced_motion, a11y_high_contrast, a11y_audio_description, a11y_large_text,
            preferred_quality, wifi_only_downloads, login_alerts, require_pin_on_play,
            hide_spoilers, autoplay_countdown_seconds
     FROM profiles WHERE id = $1 AND user_id = $2`,
    [profileId, userId]
  );
  return result.rows[0] || null;
}

async function nextSortOrder(userId) {
  const result = await query(
    `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next
     FROM profiles WHERE user_id = $1`,
    [userId]
  );
  return Number(result.rows[0].next);
}

async function countByUser(userId) {
  const result = await query(
    `SELECT COUNT(*)::int AS count FROM profiles WHERE user_id = $1`,
    [userId]
  );
  return result.rows[0].count;
}

async function create({ userId, name, avatarUrl, isKids, pin, maturityMax }) {
  const sortOrder = await nextSortOrder(userId);
  if (sortOrder > 3) {
    return { error: 'LIMIT' };
  }

  const kids = Boolean(isKids);
  const max = kids ? Math.min(Number(maturityMax) || 7, 12) : Number(maturityMax) || 18;
  let pinHash = null;
  let hasPin = false;
  if (pin) {
    pinHash = await bcrypt.hash(String(pin), 10);
    hasPin = true;
  }

  const result = await query(
    `INSERT INTO profiles
      (user_id, name, avatar_url, is_kids, sort_order, maturity_max, pin_hash, has_pin)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING id, name, avatar_url, is_kids, sort_order, maturity_max, has_pin`,
    [
      userId,
      name.trim(),
      avatarUrl || null,
      kids,
      sortOrder,
      max,
      pinHash,
      hasPin,
    ]
  );
  return result.rows[0];
}

async function update(
  profileId,
  userId,
  {
    name,
    avatarUrl,
    isKids,
    pin,
    maturityMax,
    clearPin,
    autoplayNext,
    autoplayPreviews,
    dataSaverDefault,
    preferredAudio,
    preferredSubtitles,
    subtitleSize,
    a11yReducedMotion,
    a11yHighContrast,
    a11yAudioDescription,
    a11yLargeText,
    preferredQuality,
    wifiOnlyDownloads,
    loginAlerts,
    requirePinOnPlay,
    hideSpoilers,
    autoplayCountdownSeconds,
  }
) {
  const existing = await findOwned(profileId, userId);
  if (!existing) return null;

  const kids = isKids === undefined ? existing.is_kids : Boolean(isKids);
  let max =
    maturityMax === undefined
      ? existing.maturity_max
      : Number(maturityMax);
  if (kids) max = Math.min(max || 7, 12);

  let pinHash = existing.pin_hash;
  let hasPin = existing.has_pin;
  if (clearPin) {
    pinHash = null;
    hasPin = false;
  } else if (pin) {
    pinHash = await bcrypt.hash(String(pin), 10);
    hasPin = true;
  }

  const quality =
    preferredQuality && ['auto', '480p', '720p', '1080p'].includes(preferredQuality)
      ? preferredQuality
      : null;

  let countdown = null;
  if (autoplayCountdownSeconds !== undefined && autoplayCountdownSeconds !== null) {
    countdown = Math.max(0, Math.min(30, Number(autoplayCountdownSeconds)));
    if (!Number.isFinite(countdown)) countdown = null;
  }

  const result = await query(
    `UPDATE profiles SET
       name = COALESCE($3, name),
       avatar_url = COALESCE($4, avatar_url),
       is_kids = $5,
       maturity_max = $6,
       pin_hash = $7,
       has_pin = $8,
       autoplay_next = COALESCE($9, autoplay_next),
       autoplay_previews = COALESCE($10, autoplay_previews),
       data_saver_default = COALESCE($11, data_saver_default),
       preferred_audio = COALESCE($12, preferred_audio),
       preferred_subtitles = COALESCE($13, preferred_subtitles),
       subtitle_size = COALESCE($14, subtitle_size),
       a11y_reduced_motion = COALESCE($15, a11y_reduced_motion),
       a11y_high_contrast = COALESCE($16, a11y_high_contrast),
       a11y_audio_description = COALESCE($17, a11y_audio_description),
       a11y_large_text = COALESCE($18, a11y_large_text),
       preferred_quality = COALESCE($19, preferred_quality),
       wifi_only_downloads = COALESCE($20, wifi_only_downloads),
       login_alerts = COALESCE($21, login_alerts),
       require_pin_on_play = COALESCE($22, require_pin_on_play),
       hide_spoilers = COALESCE($23, hide_spoilers),
       autoplay_countdown_seconds = COALESCE($24, autoplay_countdown_seconds)
     WHERE id = $1 AND user_id = $2
     RETURNING id, name, avatar_url, is_kids, sort_order, maturity_max, has_pin,
               autoplay_next, autoplay_previews, data_saver_default,
               preferred_audio, preferred_subtitles, subtitle_size,
               a11y_reduced_motion, a11y_high_contrast, a11y_audio_description, a11y_large_text,
               preferred_quality, wifi_only_downloads, login_alerts, require_pin_on_play,
               hide_spoilers, autoplay_countdown_seconds`,
    [
      profileId,
      userId,
      name ? name.trim() : null,
      avatarUrl !== undefined ? avatarUrl : null,
      kids,
      max,
      pinHash,
      hasPin,
      autoplayNext === undefined ? null : Boolean(autoplayNext),
      autoplayPreviews === undefined ? null : Boolean(autoplayPreviews),
      dataSaverDefault === undefined ? null : Boolean(dataSaverDefault),
      preferredAudio || null,
      preferredSubtitles || null,
      subtitleSize || null,
      a11yReducedMotion === undefined ? null : Boolean(a11yReducedMotion),
      a11yHighContrast === undefined ? null : Boolean(a11yHighContrast),
      a11yAudioDescription === undefined ? null : Boolean(a11yAudioDescription),
      a11yLargeText === undefined ? null : Boolean(a11yLargeText),
      quality,
      wifiOnlyDownloads === undefined ? null : Boolean(wifiOnlyDownloads),
      loginAlerts === undefined ? null : Boolean(loginAlerts),
      requirePinOnPlay === undefined ? null : Boolean(requirePinOnPlay),
      hideSpoilers === undefined ? null : Boolean(hideSpoilers),
      countdown,
    ]
  );
  return result.rows[0] || null;
}

async function remove(profileId, userId) {
  const count = await countByUser(userId);
  if (count <= 1) return { error: 'LAST' };

  const result = await query(
    `DELETE FROM profiles WHERE id = $1 AND user_id = $2 RETURNING id`,
    [profileId, userId]
  );
  return result.rows[0] || null;
}

async function verifyPin(profileId, userId, pin) {
  const profile = await findOwned(profileId, userId);
  if (!profile) return { ok: false, code: 'NOT_FOUND' };
  if (!profile.has_pin || !profile.pin_hash) return { ok: true, profile };
  if (!pin) return { ok: false, code: 'PIN_REQUIRED' };
  const valid = await bcrypt.compare(String(pin), profile.pin_hash);
  if (!valid) return { ok: false, code: 'PIN_INVALID' };
  return { ok: true, profile };
}

module.exports = {
  listByUser,
  createDefault,
  findOwned,
  create,
  update,
  remove,
  verifyPin,
  countByUser,
};
