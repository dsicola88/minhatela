'use strict';

const crypto = require('crypto');
const { env } = require('../config/env');
const bunnyService = require('./bunnyService');
const playbackRepository = require('../repositories/playbackRepository');
const { createError } = require('../utils/errors');
const { logger } = require('../utils/logger');
const {
  assertVariantFile,
  buildLadderBody,
  filterMasterPlaylist,
  playlistHeaders,
  rewritePlaylistUris,
} = require('../utils/hlsLadder');

const MAX_HEIGHT = 480;

function apiBase(explicit) {
  if (explicit) return String(explicit).replace(/\/$/, '');
  return String(process.env.API_BASE_URL || `http://127.0.0.1:${env.port}`).replace(/\/$/, '');
}

function publicBaseFromRequest(req) {
  const proto = String(req.get('x-forwarded-proto') || req.protocol || 'http')
    .split(',')[0]
    .trim()
    .toLowerCase();
  const host = String(req.get('x-forwarded-host') || req.get('host') || '')
    .split(',')[0]
    .trim();
  if ((proto === 'https' || proto === 'http') && /^[A-Za-z0-9.:-]+$/.test(host)) {
    return `${proto}://${host}`;
  }
  return apiBase();
}

function signGrant({ sessionId, file = '', expiresUnix }) {
  return crypto
    .createHmac('sha256', env.jwtSecret)
    .update(`${sessionId}\n${file}\n${expiresUnix}`)
    .digest('hex');
}

function verifyGrant({ sessionId, file = '', expiresUnix, sig }) {
  const exp = Number(expiresUnix);
  if (!sig || !exp || exp * 1000 < Date.now()) return false;
  const expected = signGrant({ sessionId, file, expiresUnix: exp });
  const left = Buffer.from(String(sig));
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function cdnOrigin() {
  return new URL(`https://${env.bunny.cdnHostname}`);
}

function signedCdnFile(bunnyVideoId, file, expiresUnix) {
  const path = `/${bunnyVideoId}/${file}`;
  const token = bunnyService.createToken({ path, expiresUnix });
  let url = `https://${env.bunny.cdnHostname}${path}`;
  if (token) url += `?token=${encodeURIComponent(token)}&expires=${expiresUnix}`;
  return url;
}

async function fetchPlaylist(url) {
  const response = await fetch(url);
  const text = await response.text();
  if (response.status < 200 || response.status >= 300 || !text.includes('#EXT')) {
    const err = new Error(`playlist ${response.status}`);
    err.status = response.status;
    throw err;
  }
  return text;
}

async function loadOpenSession(sessionId) {
  const row = await playbackRepository.findPlayableById(sessionId);
  if (!row?.bunny_video_id) {
    throw createError(404, 'Sessão de reprodução não encontrada', 'NOT_FOUND');
  }
  return row;
}

async function applyDataSaverHls({ dataSaver, signed, sessionId, publicBase }) {
  if (!dataSaver || !signed?.hlsUrl) {
    return { hlsUrl: signed?.hlsUrl || null, qualityCap: 'adaptive' };
  }
  try {
    const text = await fetchPlaylist(signed.hlsUrl);
    const filtered = filterMasterPlaylist(text, MAX_HEIGHT);
    if (!filtered.isMaster || !filtered.kept.length) {
      return { hlsUrl: signed.hlsUrl, qualityCap: 'unavailable' };
    }
    const expiresUnix = Math.floor(new Date(signed.expiresAt).getTime() / 1000);
    const sig = signGrant({ sessionId, file: '', expiresUnix });
    const base = apiBase(publicBase);
    return {
      hlsUrl: `${base}/api/watch/sessions/${sessionId}/ladder.m3u8?cap=480&expires=${expiresUnix}&sig=${sig}`,
      qualityCap: 'max-480',
    };
  } catch (err) {
    logger.warn('hls.cap_unavailable', { message: err.message });
    return { hlsUrl: signed.hlsUrl, qualityCap: 'unavailable' };
  }
}

async function ladderForSession(sessionId, query, publicBase) {
  if (query.cap !== '480' || !verifyGrant({
    sessionId,
    file: '',
    expiresUnix: query.expires,
    sig: query.sig,
  })) {
    throw createError(403, 'Playlist não autorizada', 'HLS_GRANT');
  }
  const row = await loadOpenSession(sessionId);
  const expiresUnix = Number(query.expires);
  const masterUrl = bunnyService.buildHlsUrl(row.bunny_video_id, {
    token: bunnyService.createToken({
      path: `/${row.bunny_video_id}/playlist.m3u8`,
      expiresUnix,
    }),
    expiresUnix,
  });
  const text = await fetchPlaylist(masterUrl);
  const filtered = filterMasterPlaylist(text, MAX_HEIGHT);
  if (!filtered.kept.length) {
    throw createError(404, 'Este título não tem variante até 480p', 'HLS_CAP_UNAVAILABLE');
  }
  const base = apiBase(publicBase);
  const mediaUrlFor = (file) => {
    const sig = signGrant({ sessionId, file, expiresUnix });
    return `${base}/api/watch/sessions/${sessionId}/media.m3u8?file=${encodeURIComponent(file)}&expires=${expiresUnix}&sig=${sig}`;
  };
  try {
    return buildLadderBody({
      playlist: filtered.playlist,
      variants: filtered.kept,
      bunnyVideoId: row.bunny_video_id,
      mapChild: mediaUrlFor,
      maxHeight: MAX_HEIGHT,
    });
  } catch (err) {
    if (err.code === 'HLS_PATH') {
      throw createError(400, 'Variante inválida', 'HLS_PATH');
    }
    throw err;
  }
}

async function mediaForSession(sessionId, query) {
  let file;
  try {
    file = assertVariantFile(String(query.file || ''));
  } catch (err) {
    throw createError(400, 'Variante inválida', 'HLS_PATH');
  }
  if (!verifyGrant({ sessionId, file, expiresUnix: query.expires, sig: query.sig })) {
    throw createError(403, 'Playlist não autorizada', 'HLS_GRANT');
  }
  const row = await loadOpenSession(sessionId);
  const expiresUnix = Number(query.expires);
  const mediaUrl = signedCdnFile(row.bunny_video_id, file, expiresUnix);
  const text = await fetchPlaylist(mediaUrl);
  const origin = cdnOrigin();
  const rewritten = rewritePlaylistUris(text, (uri) => {
    if (uri.startsWith('#')) return uri;
    const absolute = new URL(uri, mediaUrl);
    if (absolute.host !== origin.host) {
      throw createError(400, 'Segmento fora da CDN', 'HLS_PATH');
    }
    const token = bunnyService.createToken({ path: absolute.pathname, expiresUnix });
    if (token) {
      absolute.searchParams.set('token', token);
      absolute.searchParams.set('expires', String(expiresUnix));
    }
    return absolute.toString();
  });
  return rewritten.endsWith('\n') ? rewritten : `${rewritten}\n`;
}

module.exports = {
  MAX_HEIGHT,
  apiBase,
  publicBaseFromRequest,
  signGrant,
  verifyGrant,
  applyDataSaverHls,
  ladderForSession,
  mediaForSession,
  playlistHeaders,
  signedCdnFile,
};
