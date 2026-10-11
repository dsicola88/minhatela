'use strict';

/**
 * Filtra um master HLS para uma altura máxima.
 * Não inventa variantes: se a Bunny não publicar RESOLUTION, a linha sai do manifesto limitado.
 * Variantes mais baixas mantêm-se. O bitrate de cada uma é que marca os bytes.
 */

function parseResolution(inf) {
  const match = /RESOLUTION=(\d+)x(\d+)/.exec(inf);
  if (!match) return { width: null, height: null };
  return { width: Number(match[1]), height: Number(match[2]) };
}

function parseBandwidth(inf) {
  const match = /BANDWIDTH=(\d+)/.exec(inf);
  return match ? Number(match[1]) : null;
}

function parseMasterPlaylist(text) {
  const lines = String(text || '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/);
  const header = [];
  const variants = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line || !line.trim()) continue;
    if (line.startsWith('#EXT-X-STREAM-INF:')) {
      const uri = (lines[i + 1] || '').trim();
      const { width, height } = parseResolution(line);
      variants.push({
        inf: line,
        uri,
        width,
        height,
        bandwidth: parseBandwidth(line),
      });
      i += 1;
      continue;
    }
    header.push(line);
  }
  return { header, variants, isMaster: variants.length > 0 };
}

function filterMasterPlaylist(text, maxHeight = 480) {
  const parsed = parseMasterPlaylist(text);
  if (!parsed.isMaster) {
    return {
      playlist: String(text || ''),
      isMaster: false,
      kept: [],
      dropped: [],
      maxHeight,
    };
  }
  const kept = parsed.variants.filter((variant) => variant.height != null && variant.height <= maxHeight);
  const dropped = parsed.variants.filter((variant) => !kept.includes(variant));
  const lines = [...parsed.header];
  for (const variant of kept) {
    lines.push(variant.inf);
    lines.push(variant.uri);
  }
  return {
    playlist: `${lines.join('\n')}\n`,
    isMaster: true,
    kept,
    dropped,
    maxHeight,
  };
}

/** Chave de cache do player. Mudar o modo não pode reutilizar o master anterior. */
function playbackPlaylistKey({ contentId, dataSaver }) {
  return `${contentId}:${dataSaver ? 'max-480' : 'adaptive'}`;
}

function assertVariantFile(file) {
  const value = String(file || '').trim();
  if (!value || value.length > 240 || value.includes('..') || value.startsWith('/')) {
    const err = new Error('Variante inválida');
    err.code = 'HLS_PATH';
    throw err;
  }
  if (!/^[A-Za-z0-9._/-]+$/.test(value) || !value.endsWith('.m3u8')) {
    const err = new Error('Variante inválida');
    err.code = 'HLS_PATH';
    throw err;
  }
  return value;
}

function fileFromVariantUri(uri, bunnyVideoId) {
  const raw = String(uri || '').trim();
  if (/^https?:\/\//i.test(raw)) {
    const url = new URL(raw);
    const prefix = `/${bunnyVideoId}/`;
    if (!url.pathname.startsWith(prefix)) {
      const err = new Error('Variante fora do vídeo');
      err.code = 'HLS_PATH';
      throw err;
    }
    return assertVariantFile(decodeURIComponent(url.pathname.slice(prefix.length)));
  }
  return assertVariantFile(raw.split('?')[0]);
}

function rewritePlaylistUris(text, mapUri) {
  const lines = String(text || '').split(/\r?\n/);
  return lines
    .map((line) => {
      if (!line) return line;
      if (line.startsWith('#')) {
        return line.replace(/URI="([^"]+)"/g, (_, uri) => `URI="${mapUri(uri)}"`);
      }
      return mapUri(line.trim());
    })
    .join('\n');
}

function playlistHeaders() {
  return {
    'Content-Type': 'application/vnd.apple.mpegurl',
    'Cache-Control': 'no-store',
  };
}

function buildLadderBody({ playlist, variants, bunnyVideoId, mapChild, maxHeight = 480 }) {
  const body = String(playlist)
    .split('\n')
    .filter((line) => line.startsWith('#') && !line.startsWith('#EXT-X-STREAM-INF:'))
    .filter((line) => {
      if (!line.startsWith('#EXT-X-I-FRAME-STREAM-INF:')) return true;
      const { height } = parseResolution(line);
      return height == null || height <= maxHeight;
    })
    .map((line) =>
      line.replace(/URI="([^"]+\.m3u8[^"]*)"/g, (_, uri) => `URI="${mapChild(fileFromVariantUri(uri, bunnyVideoId))}"`)
    );
  for (const variant of variants) {
    body.push(variant.inf);
    body.push(mapChild(fileFromVariantUri(variant.uri, bunnyVideoId)));
  }
  return `${body.join('\n')}\n`;
}

module.exports = {
  parseMasterPlaylist,
  filterMasterPlaylist,
  playbackPlaylistKey,
  assertVariantFile,
  fileFromVariantUri,
  rewritePlaylistUris,
  playlistHeaders,
  buildLadderBody,
};
