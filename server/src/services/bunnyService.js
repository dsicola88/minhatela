'use strict';

const crypto = require('crypto');
const { env } = require('../config/env');
const { createError } = require('../utils/errors');
const { logger } = require('../utils/logger');

/**
 * Abstracção Bunny Stream (enterprise).
 * - API key nunca sai deste serviço
 * - Token Auth SHA-256 quando BUNNY_TOKEN_AUTH_KEY está definido
 * - Em produção, exige token se BUNNY_REQUIRE_TOKEN=true
 */
function assertConfigured() {
  if (!env.bunny.libraryId) {
    throw createError(
      503,
      'Serviço de vídeo temporariamente indisponível',
      'BUNNY_NOT_CONFIGURED'
    );
  }

  if (env.isProd && env.bunny.requireToken && !env.bunny.tokenAuthKey) {
    logger.error('bunny.token_required_missing');
    throw createError(
      503,
      'Protecção de vídeo não configurada',
      'BUNNY_TOKEN_REQUIRED'
    );
  }
}

function sha256Hex(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

/**
 * Gera token Bunny CDN Token Authentication.
 * Formato oficial: SHA256(security_key + path + expires[+ optional IP])
 */
function createToken({ path, expiresUnix, userIp }) {
  const key = env.bunny.tokenAuthKey;
  if (!key) return null;

  let payload = `${key}${path}${expiresUnix}`;
  if (env.bunny.tokenAuthWithIp && userIp) {
    payload = `${key}${path}${expiresUnix}${userIp}`;
  }
  return sha256Hex(payload);
}

function buildEmbedUrl(bunnyVideoId, { autoplay = true, token, expiresUnix } = {}) {
  assertConfigured();
  const params = new URLSearchParams({
    autoplay: String(autoplay),
    preload: 'true',
    responsive: 'true',
  });

  // Força arranque económico de dados (Angola)
  params.set('preload', 'true');

  if (token && expiresUnix) {
    params.set('token', token);
    params.set('expires', String(expiresUnix));
  }

  return `${env.bunny.embedBaseUrl}/${env.bunny.libraryId}/${bunnyVideoId}?${params.toString()}`;
}

function buildHlsUrl(bunnyVideoId, { token, expiresUnix } = {}) {
  if (!env.bunny.cdnHostname || !bunnyVideoId) return null;

  const path = `/${bunnyVideoId}/playlist.m3u8`;
  let url = `https://${env.bunny.cdnHostname}${path}`;

  if (token && expiresUnix) {
    url += `?token=${token}&expires=${expiresUnix}`;
  }

  return url;
}

function signPlayback(bunnyVideoId, { ttlSeconds, userIp } = {}) {
  assertConfigured();

  const ttl = ttlSeconds || env.playbackTtlSeconds;
  const expiresAt = new Date(Date.now() + ttl * 1000);
  const expiresUnix = Math.floor(expiresAt.getTime() / 1000);

  // Path assinado alinhado com CDN HLS (mais seguro que só o videoId)
  const signedPath = `/${bunnyVideoId}/playlist.m3u8`;
  const token = createToken({
    path: signedPath,
    expiresUnix,
    userIp,
  });

  // Fallback: algumas libraries Token Auth usam só o videoId
  const embedToken =
    token ||
    createToken({
      path: `/${bunnyVideoId}`,
      expiresUnix,
      userIp,
    });

  const embedUrl = buildEmbedUrl(bunnyVideoId, {
    autoplay: true,
    token: embedToken,
    expiresUnix: embedToken ? expiresUnix : undefined,
  });

  const hlsUrl = buildHlsUrl(bunnyVideoId, {
    token,
    expiresUnix: token ? expiresUnix : undefined,
  });

  if (env.isProd && env.bunny.requireToken && !token) {
    throw createError(503, 'Falha ao assinar URL de vídeo', 'BUNNY_SIGN_FAILED');
  }

  logger.info('bunny.playback_signed', {
    bunnyVideoId,
    tokenAttached: Boolean(token),
    expiresAt: expiresAt.toISOString(),
    ttl,
  });

  return {
    embedUrl,
    hlsUrl,
    expiresAt: expiresAt.toISOString(),
    tokenAttached: Boolean(token),
    signedPath,
    security: {
      tokenAuth: Boolean(token),
      ipBound: Boolean(env.bunny.tokenAuthWithIp && userIp),
      startQuality: 'auto',
      defaultQuality: '480p',
    },
  };
}

/**
 * URL MP4 progressiva para download offline (Bunny CDN).
 * Qualidades típicas: play_480p.mp4 · play_720p.mp4 · original
 */
function signDownload(bunnyVideoId, { quality = '720p', ttlSeconds, userIp } = {}) {
  assertConfigured();
  if (!env.bunny.cdnHostname) {
    throw createError(503, 'CDN de download indisponível', 'BUNNY_CDN_MISSING');
  }

  const file =
    quality === '480p'
      ? 'play_480p.mp4'
      : quality === 'original'
        ? 'original'
        : 'play_720p.mp4';

  const ttl = ttlSeconds || Math.min(env.playbackTtlSeconds, 6 * 3600);
  const expiresAt = new Date(Date.now() + ttl * 1000);
  const expiresUnix = Math.floor(expiresAt.getTime() / 1000);
  const signedPath = `/${bunnyVideoId}/${file}`;
  const token = createToken({ path: signedPath, expiresUnix, userIp });

  let url = `https://${env.bunny.cdnHostname}${signedPath}`;
  if (token) {
    url += `?token=${token}&expires=${expiresUnix}`;
  }

  if (env.isProd && env.bunny.requireToken && !token) {
    throw createError(503, 'Falha ao assinar URL de download', 'BUNNY_SIGN_FAILED');
  }

  logger.info('bunny.download_signed', {
    bunnyVideoId,
    quality,
    tokenAttached: Boolean(token),
    expiresAt: expiresAt.toISOString(),
  });

  return {
    downloadUrl: url,
    quality,
    expiresAt: expiresAt.toISOString(),
    tokenAttached: Boolean(token),
    signedPath,
  };
}

function getPlayerDefaults() {
  return Object.freeze({
    startQuality: 'auto',
    defaultQuality: '480p',
    forceHighQuality: false,
    allowedStartQualities: ['auto', '480p'],
    drmReady: Boolean(env.bunny.tokenAuthKey),
    offlineSupported: Boolean(env.bunny.cdnHostname),
  });
}

/**
 * Cria um vídeo vazio na library Stream (slot para upload TUS / dashboard).
 * @see https://docs.bunny.net/reference/video_createvideo
 */
async function createVideo({ title }) {
  assertConfigured();
  if (!env.bunny.apiKey) {
    throw createError(503, 'API Bunny não configurada', 'BUNNY_API_MISSING');
  }
  const libraryId = env.bunny.libraryId;
  const response = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      AccessKey: env.bunny.apiKey,
    },
    body: JSON.stringify({ title: String(title).slice(0, 250) }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    logger.error('bunny.create_video_failed', {
      status: response.status,
      message: payload?.Message || payload?.message,
    });
    throw createError(502, 'Falha ao criar vídeo no Bunny Stream', 'BUNNY_CREATE_FAILED');
  }
  const videoId = payload.guid || payload.videoId || payload.id;
  if (!videoId) {
    throw createError(502, 'Bunny não devolveu GUID do vídeo', 'BUNNY_CREATE_FAILED');
  }
  logger.info('bunny.video_created', { videoId, libraryId, title });
  return {
    videoId: String(videoId),
    libraryId: String(libraryId),
    upload: {
      libraryId: String(libraryId),
      videoId: String(videoId),
      dashboardUrl: `https://dash.bunny.net/stream/${libraryId}/library/videos/${videoId}`,
      // Upload via dashboard ou TUS com AccessKey da library
      note: 'Faça upload do ficheiro no dashboard Bunny Stream para este videoId',
    },
  };
}

module.exports = {
  buildEmbedUrl,
  buildHlsUrl,
  signPlayback,
  signDownload,
  getPlayerDefaults,
  createToken,
  createVideo,
  assertConfigured,
};
