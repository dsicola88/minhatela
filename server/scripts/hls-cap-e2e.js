'use strict';

/**
 * E2E local do tecto HLS 480p.
 * Sobe uma CDN de teste em HTTPS (certificado efémero) e a API desta pasta.
 * Só corre se DATABASE_URL for localhost. Não chama produção.
 *
 * Uso: node server/scripts/hls-cap-e2e.js
 */
const crypto = require('crypto');
const fs = require('fs');
const http = require('https');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const dbUrl = new URL(process.env.DATABASE_URL || 'postgres://invalid');
if (dbUrl.hostname !== 'localhost' && dbUrl.hostname !== '127.0.0.1') {
  console.error('Recusado: este e2e só corre contra Postgres local.');
  process.exit(1);
}

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
process.env.E2E_DISABLE_RATE_LIMIT = 'true';
process.env.JOBS_ENABLED = 'false';
process.env.BUNNY_TOKEN_AUTH_WITH_IP = 'false';
process.env.BUNNY_LIBRARY_ID = process.env.BUNNY_LIBRARY_ID || '1';
process.env.BUNNY_TOKEN_AUTH_KEY = process.env.BUNNY_TOKEN_AUTH_KEY || 'e2e-hls-cap-local-key';
process.env.BUNNY_REQUIRE_TOKEN = 'true';

const BUNNY_LADDER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const BUNNY_HIGH = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const SEGMENT = {
  '240p': 120,
  '360p': 240,
  '480p': 480,
  '720p': 960,
  '1080p': 1920,
};

const results = [];
let failed = 0;

function ok(name, detail) {
  results.push({ name, ok: true });
  console.log(`✓ ${name}${detail ? ` · ${detail}` : ''}`);
}

function fail(name, err) {
  failed += 1;
  results.push({ name, ok: false });
  console.error(`✗ ${name}: ${err.message || err}`);
}

async function step(name, fn) {
  try {
    const detail = await fn();
    ok(name, typeof detail === 'string' ? detail : '');
    return detail;
  } catch (err) {
    fail(name, err);
    return null;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function tokenFor(filePath, expires) {
  return crypto
    .createHash('sha256')
    .update(`${process.env.BUNNY_TOKEN_AUTH_KEY}${filePath}${expires}`)
    .digest('hex');
}

function masterFor(id, heights) {
  const lines = ['#EXTM3U', '#EXT-X-VERSION:3'];
  for (const item of heights) {
    lines.push(
      `#EXT-X-STREAM-INF:BANDWIDTH=${item.bandwidth},RESOLUTION=${item.width}x${item.height},CODECS="avc1.42e01e,mp4a.40.2"`
    );
    lines.push(`${item.name}/video.m3u8`);
  }
  return `${lines.join('\n')}\n`;
}

function mediaFor(name) {
  return [
    '#EXTM3U',
    '#EXT-X-VERSION:3',
    '#EXT-X-TARGETDURATION:4',
    '#EXT-X-MEDIA-SEQUENCE:0',
    '#EXT-X-PLAYLIST-TYPE:VOD',
    '#EXT-X-KEY:METHOD=AES-128,URI="key"',
    '#EXTINF:4.000,',
    'seg0.ts',
    '#EXTINF:4.000,',
    'seg1.ts',
    '#EXTINF:4.000,',
    'seg2.ts',
    '#EXT-X-ENDLIST',
    '',
  ].join('\n');
}

function renditionFromPath(pathname) {
  const match = pathname.match(/\/(240p|360p|480p|720p|1080p)\//);
  return match ? match[1] : null;
}

function startFixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-hls-'));
  const keyPath = path.join(dir, 'key.pem');
  const certPath = path.join(dir, 'cert.pem');
  execFileSync('openssl', [
    'req', '-x509', '-newkey', 'rsa:2048',
    '-keyout', keyPath, '-out', certPath,
    '-days', '1', '-nodes', '-subj', '/CN=127.0.0.1',
  ], { stdio: 'ignore' });

  const hits = [];
  const ladders = {
    [BUNNY_LADDER]: [
      { name: '240p', width: 426, height: 240, bandwidth: 400000 },
      { name: '360p', width: 640, height: 360, bandwidth: 800000 },
      { name: '480p', width: 854, height: 480, bandwidth: 1400000 },
      { name: '720p', width: 1280, height: 720, bandwidth: 2800000 },
      { name: '1080p', width: 1920, height: 1080, bandwidth: 5000000 },
    ],
    [BUNNY_HIGH]: [
      { name: '720p', width: 1280, height: 720, bandwidth: 2800000 },
      { name: '1080p', width: 1920, height: 1080, bandwidth: 5000000 },
    ],
  };

  const server = http.createServer(
    { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) },
    (req, res) => {
      const url = new URL(req.url, 'https://127.0.0.1');
      hits.push(url.pathname);
      const expires = url.searchParams.get('expires');
      const token = url.searchParams.get('token');
      const expected = tokenFor(url.pathname, expires || '');
      if (!token || token !== expected) {
        res.writeHead(403);
        res.end('forbidden');
        return;
      }
      const parts = url.pathname.split('/').filter(Boolean);
      const videoId = parts[0];
      if (!ladders[videoId]) {
        res.writeHead(404);
        res.end('missing');
        return;
      }
      if (parts.length === 2 && parts[1] === 'playlist.m3u8') {
        res.writeHead(200, { 'Content-Type': 'application/vnd.apple.mpegurl' });
        res.end(masterFor(videoId, ladders[videoId]));
        return;
      }
      const rendition = renditionFromPath(url.pathname);
      if (!rendition || !ladders[videoId].some((item) => item.name === rendition)) {
        res.writeHead(404);
        res.end('missing');
        return;
      }
      if (url.pathname.endsWith('/video.m3u8')) {
        res.writeHead(200, { 'Content-Type': 'application/vnd.apple.mpegurl' });
        res.end(mediaFor(rendition));
        return;
      }
      if (url.pathname.endsWith('/key')) {
        res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
        res.end(Buffer.alloc(16, 1));
        return;
      }
      if (/\/seg[012]\.ts$/.test(url.pathname)) {
        res.writeHead(200, { 'Content-Type': 'video/mp2t' });
        res.end(Buffer.alloc(SEGMENT[rendition], 0x47));
        return;
      }
      res.writeHead(404);
      res.end('missing');
    }
  );

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        server,
        port,
        hits,
        dir,
        resetHits() {
          hits.length = 0;
        },
      });
    });
  });
}

async function main() {
  const fixture = await startFixture();
  process.env.BUNNY_CDN_HOSTNAME = `127.0.0.1:${fixture.port}`;

  const { createApp } = require('../src/app');
  const { query, pool } = require('../src/config/database');
  const app = createApp();
  const api = await new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
  });
  const apiPort = api.address().port;
  const base = `http://127.0.0.1:${apiPort}`;
  const contentIds = [];
  const email = `hls-e2e-${Date.now()}@minhatela.ao`;

  async function apiFetch(method, urlPath, { token, body, headers } = {}) {
    const res = await fetch(`${base}${urlPath}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return { status: res.status, json, text, headers: res.headers };
  }

  async function pull(url) {
    const res = await fetch(url);
    const buf = Buffer.from(await res.arrayBuffer());
    return {
      status: res.status,
      headers: res.headers,
      text: buf.toString('utf8'),
      bytes: buf.length,
    };
  }

  try {
    console.log(`\n══ E2E HLS 480p · API ${base} · CDN 127.0.0.1:${fixture.port} ══\n`);

    let token = null;
    let profileId = null;
    let avodId = null;
    let spentBefore = 0;

    await step('Cliente · registo local', async () => {
      const r = await apiFetch('POST', '/api/auth/register', {
        body: {
          email,
          password: 'Angola2026!Segura',
          fullName: 'E2E HLS',
          acceptTerms: true,
          deviceName: 'E2E HLS',
          platform: 'ios',
        },
      });
      assert([200, 201].includes(r.status), `registo ${r.status} ${r.json?.code || ''}`);
      token = r.json.token || r.json.accessToken;
      assert(token, 'sem token');
    });

    await step('Cliente · perfil', async () => {
      const profiles = await apiFetch('GET', '/api/auth/profiles', { token });
      assert(profiles.status === 200 && profiles.json?.profiles?.length >= 1, 'perfis');
      profileId = profiles.json.profiles[0].id;
    });

    await step('Catálogo de teste · títulos locais', async () => {
      const rows = [
        ['E2E HLS AVOD', 'avod', null, BUNNY_LADDER],
        ['E2E HLS só alto', 'avod', null, BUNNY_HIGH],
        ['E2E HLS SVOD', 'svod', null, BUNNY_LADDER],
        ['E2E HLS TVOD', 'tvod', 1500, BUNNY_LADDER],
        ['E2E HLS sem asset', 'avod', null, 'pending-e2e-hls'],
      ];
      for (const [title, monetization, price, bunnyId] of rows) {
        const inserted = await query(
          `INSERT INTO videos (
             title, slug, synopsis_short, synopsis_full, poster_url, backdrop_url,
             bunny_video_id, monetization, rental_price_kz, duration_seconds,
             is_published, workflow_status, kind, tenant_id
           ) VALUES (
             $1, $2, 'E2E', 'Prova local do tecto HLS', 'https://example.test/p.jpg',
             'https://example.test/b.jpg', $3, $4, $5, 600, TRUE, 'published', 'movie',
             (SELECT id FROM tenants WHERE slug = 'minhatela' LIMIT 1)
           ) RETURNING id`,
          [title, `${title.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`, bunnyId, monetization, price]
        );
        contentIds.push(inserted.rows[0].id);
      }
      avodId = contentIds[0];
      assert(contentIds.length === 5, 'inserts');
      return `titulos=${contentIds.length}`;
    });

    await step('Anúncios · gasto antes do play', async () => {
      const spent = await query(`SELECT COALESCE(SUM(spent_kz), 0)::int AS spent FROM campaigns`);
      spentBefore = spent.rows[0].spent;
      return `spent_kz=${spentBefore}`;
    });

    const device = {
      'x-profile-id': null,
      'x-device-key': `e2e-hls-${Date.now()}`,
      'x-device-name': 'E2E HLS',
      'x-device-platform': 'ios',
    };

    let saver = null;
    await step('Play · poupança ligada devolve manifesto max-480', async () => {
      device['x-profile-id'] = profileId;
      fixture.resetHits();
      const r = await apiFetch('POST', `/api/watch/${avodId}/start`, {
        token,
        headers: device,
        body: { profileId, platform: 'ios', dataSaver: true },
      });
      assert(r.status === 200, `start ${r.status} ${r.json?.code || r.json?.message || ''}`);
      assert(r.json?.playback?.qualityCap === 'max-480', `cap ${r.json?.playback?.qualityCap}`);
      assert(String(r.json.playback.hlsUrl).includes('/ladder.m3u8?'), 'hls da API');
      assert(String(r.json.playback.hlsUrl).includes('cap=480'), 'cap na url');
      assert(r.json.ads?.billed !== true, 'anúncio não facturado no arranque');
      saver = r.json;
      return saver.playback.qualityCap;
    });

    let ladderText = '';
    let mediaBytes = 0;
    await step('Play · manifesto só tem 240, 360 e 480', async () => {
      assert(saver?.playback?.hlsUrl, 'sem url');
      const playlist = await pull(saver.playback.hlsUrl);
      assert(playlist.status === 200, `ladder ${playlist.status}`);
      assert(playlist.headers.get('cache-control') === 'no-store', 'cache');
      assert(
        (playlist.headers.get('content-type') || '').includes('mpegurl'),
        'content-type'
      );
      ladderText = playlist.text;
      assert(ladderText.includes('426x240'), '240');
      assert(ladderText.includes('640x360'), '360');
      assert(ladderText.includes('854x480'), '480');
      assert(!ladderText.includes('1280x720'), '720 ficou no manifesto');
      assert(!ladderText.includes('1920x1080'), '1080 ficou no manifesto');
      assert(!ladderText.includes('720p'), 'caminho 720');
      assert(!saver.playback.hlsUrl.includes('Authorization'), 'url sem jwt');
    });

    await step('Play · segmentos 480p com token, pausa, seek e retoma', async () => {
      const variant = ladderText
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.startsWith('http'));
      const mediaUrl = variant.find((line) => line.includes('480p'));
      assert(mediaUrl, 'sem variante 480');
      const media = await pull(mediaUrl);
      assert(media.status === 200, `media ${media.status}`);
      assert(media.headers.get('cache-control') === 'no-store', 'media cache');
      assert(!media.text.includes('720p') && !media.text.includes('1080p'), 'media alta');
      const lines = media.text.split('\n').map((line) => line.trim()).filter(Boolean);
      const keyLine = lines.find((line) => line.startsWith('#EXT-X-KEY'));
      const keyUrl = /URI="([^"]+)"/.exec(keyLine || '')?.[1];
      const segs = lines.filter((line) => line.startsWith('https://'));
      assert(keyUrl && segs.length === 3, `key/segs ${Boolean(keyUrl)} ${segs.length}`);
      for (const fileUrl of [keyUrl, ...segs]) {
        const parsed = new URL(fileUrl);
        assert(parsed.hostname === '127.0.0.1', `host ${parsed.hostname}`);
        assert(parsed.port === String(fixture.port), 'porta da cdn');
        const expected = tokenFor(parsed.pathname, parsed.searchParams.get('expires'));
        assert(parsed.searchParams.get('token') === expected, `token ${parsed.pathname}`);
      }
      const seg0 = await pull(segs[0]);
      assert(seg0.status === 200 && seg0.bytes === SEGMENT['480p'], `seg0 ${seg0.status} ${seg0.bytes}`);
      mediaBytes += seg0.bytes;
      const seg2 = await pull(segs[2]);
      assert(seg2.status === 200 && seg2.bytes === SEGMENT['480p'], `seek ${seg2.status}`);
      mediaBytes += seg2.bytes;
      const seg1 = await pull(segs[1]);
      assert(seg1.status === 200 && seg1.bytes === SEGMENT['480p'], `retoma ${seg1.status}`);
      mediaBytes += seg1.bytes;
      const key = await pull(keyUrl);
      assert(key.status === 200 && key.bytes === 16, 'chave');
      assert(media.text.includes('#EXT-X-ENDLIST'), 'fim de vod');
      const leaked = fixture.hits.filter((hit) => /720p|1080p/.test(hit));
      assert(leaked.length === 0, `cdn alta ${leaked.join(',')}`);
      return `${mediaBytes} B de segmentos 480p`;
    });

    await step('Play · 720p não entra com a assinatura do 480p', async () => {
      const mediaUrl = ladderText.split('\n').find((line) => line.includes('480p'));
      const stolen = new URL(mediaUrl);
      stolen.searchParams.set('file', '720p/video.m3u8');
      const blocked = await pull(stolen.toString());
      assert(blocked.status === 403, `720 ${blocked.status}`);
      const traversal = new URL(mediaUrl);
      traversal.searchParams.set('file', '../secret.m3u8');
      const badPath = await pull(traversal.toString());
      assert(badPath.status === 400, `path ${badPath.status}`);
      const wrongCap = new URL(saver.playback.hlsUrl);
      wrongCap.searchParams.set('cap', '1080');
      const badCap = await pull(wrongCap.toString());
      assert(badCap.status === 403, `cap ${badCap.status}`);
    });

    await step('Play · fim da sessão invalida o manifesto', async () => {
      const beat = await apiFetch('POST', `/api/watch/sessions/${saver.sessionId}/heartbeat`, { token });
      assert(beat.status === 200, `heartbeat ${beat.status}`);
      const end = await apiFetch('POST', `/api/watch/sessions/${saver.sessionId}/end`, { token });
      assert(end.status === 200, `end ${end.status}`);
      const again = await pull(saver.playback.hlsUrl);
      assert(again.status === 404, `ladder depois do fim ${again.status}`);
    });

    let adaptiveUrl = '';
    await step('Play · poupança desligada mantém o master completo', async () => {
      fixture.resetHits();
      const r = await apiFetch('POST', `/api/watch/${avodId}/start`, {
        token,
        headers: device,
        body: { profileId, platform: 'ios', dataSaver: false },
      });
      assert(r.status === 200, `start ${r.status} ${r.json?.code || ''}`);
      assert(r.json?.playback?.qualityCap === 'adaptive', `cap ${r.json?.playback?.qualityCap}`);
      adaptiveUrl = r.json.playback.hlsUrl;
      assert(!adaptiveUrl.includes('ladder.m3u8'), 'não é o manifesto filtrado');
      assert(adaptiveUrl !== saver.playback.hlsUrl, 'url diferente da poupança');
      const master = await pull(adaptiveUrl);
      assert(master.status === 200, `master ${master.status}`);
      assert(master.text.includes('1280x720') && master.text.includes('1920x1080'), 'master completo');
      await apiFetch('POST', `/api/watch/sessions/${r.json.sessionId}/end`, { token });
    });

    await step('Play · nova sessão de poupança não reutiliza a playlist anterior', async () => {
      const r = await apiFetch('POST', `/api/watch/${avodId}/start`, {
        token,
        headers: device,
        body: { profileId, platform: 'ios', dataSaver: true },
      });
      assert(r.status === 200 && r.json?.playback?.qualityCap === 'max-480', 'segunda poupança');
      assert(r.json.playback.hlsUrl !== saver.playback.hlsUrl, 'sessão nova');
      assert(r.json.playback.hlsUrl !== adaptiveUrl, 'diferente do adaptativo');
      const playlist = await pull(r.json.playback.hlsUrl);
      assert(playlist.status === 200 && !playlist.text.includes('720p'), 'manifesto novo filtrado');
      await apiFetch('POST', `/api/watch/sessions/${r.json.sessionId}/end`, { token });
    });

    await step('Play · título sem variante ≤480p não bloqueia', async () => {
      const r = await apiFetch('POST', `/api/watch/${contentIds[1]}/start`, {
        token,
        headers: device,
        body: { profileId, platform: 'ios', dataSaver: true },
      });
      assert(r.status === 200, `start ${r.status} ${r.json?.code || ''}`);
      assert(r.json?.playback?.qualityCap === 'unavailable', `cap ${r.json?.playback?.qualityCap}`);
      assert(String(r.json.playback.hlsUrl).includes('playlist.m3u8'), 'master original');
      const master = await pull(r.json.playback.hlsUrl);
      assert(master.status === 200 && master.text.includes('1920x1080'), 'master alto');
      await apiFetch('POST', `/api/watch/sessions/${r.json.sessionId}/end`, { token });
    });

    await step('Play · sem asset Bunny continua recusado', async () => {
      const r = await apiFetch('POST', `/api/watch/${contentIds[4]}/start`, {
        token,
        headers: device,
        body: { profileId, platform: 'ios', dataSaver: true },
      });
      assert(r.status === 503 && r.json?.code === 'NO_BUNNY_ASSET', `${r.status} ${r.json?.code}`);
    });

    await step('Play · SVOD sem Premium continua recusado', async () => {
      const r = await apiFetch('POST', `/api/watch/${contentIds[2]}/start`, {
        token,
        headers: device,
        body: { profileId, platform: 'ios', dataSaver: true },
      });
      assert(r.status === 403 && r.json?.code === 'SUBSCRIPTION_REQUIRED', `${r.status} ${r.json?.code}`);
    });

    await step('Play · TVOD sem aluguer continua recusado', async () => {
      const r = await apiFetch('POST', `/api/watch/${contentIds[3]}/start`, {
        token,
        headers: device,
        body: { profileId, platform: 'ios', dataSaver: true },
      });
      assert(r.status === 403 && r.json?.code === 'RENTAL_REQUIRED', `${r.status} ${r.json?.code}`);
    });

    await step('Anúncios · gasto da campanha não mudou', async () => {
      const spent = await query(`SELECT COALESCE(SUM(spent_kz), 0)::int AS spent FROM campaigns`);
      assert(spent.rows[0].spent === spentBefore, `spent ${spent.rows[0].spent} vs ${spentBefore}`);
      const impressions = await query(
        `SELECT COUNT(*)::int AS n, COALESCE(SUM(CASE WHEN billed THEN 1 ELSE 0 END), 0)::int AS billed
         FROM ad_impressions WHERE content_id = ANY($1::uuid[])`,
        [contentIds]
      );
      assert(impressions.rows[0].billed === 0, 'impressões facturadas');
      if (impressions.rows[0].n > 0) {
        await query(`DELETE FROM ad_impressions WHERE content_id = ANY($1::uuid[])`, [contentIds]);
      }
      return `impressoes_apagadas=${impressions.rows[0].n}`;
    });

    const uncapped = SEGMENT['1080p'] * 3;
    console.log(
      `\nBytes de segmentos no caminho 480p: ${mediaBytes}. O mesmo intervalo em 1080p na CDN de teste seria ${uncapped}.`
    );
  } finally {
    try {
      if (contentIds.length) {
        await query(`DELETE FROM ad_impressions WHERE content_id = ANY($1::uuid[])`, [contentIds]);
        await query(`DELETE FROM analytics_events WHERE content_id = ANY($1::uuid[])`, [contentIds]);
        await query(`DELETE FROM videos WHERE id = ANY($1::uuid[])`, [contentIds]);
        await query(`DELETE FROM users WHERE email = $1`, [email]);
      }
    } catch (err) {
      console.error(`limpeza: ${err.message}`);
      failed += 1;
    }
    await new Promise((resolve) => api.close(resolve));
    await new Promise((resolve) => fixture.server.close(resolve));
    fs.rmSync(fixture.dir, { recursive: true, force: true });
    await pool.end();
  }

  console.log(`\n${results.filter((item) => item.ok).length}/${results.length} passos ok\n`);
  if (failed) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
