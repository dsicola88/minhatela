import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  allowHoverPreview,
  nativePlaybackUri,
  shapeEmbedUrl,
  shouldMountCatalogPreview,
} from '../../mobile/src/platform/dataSaverPolicy.mjs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { isValidBunnyVideoId } = require('../src/utils/bunnyAsset');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const hls = 'https://cdn.example/vid/playlist.m3u8';
const mp4 = 'https://cdn.example/vid/play_360p.mp4';

assert.equal(nativePlaybackUri({ hlsUrl: hls, dataSaver: true, saveDataUrl: mp4 }), hls);
assert.equal(nativePlaybackUri({ hlsUrl: hls, dataSaver: false }), hls);
assert.equal(nativePlaybackUri({ hlsUrl: null, dataSaver: true, saveDataUrl: mp4 }), null);

assert.equal(
  shouldMountCatalogPreview({
    hasTrailer: true,
    autoplayPreview: true,
    dataSaver: true,
    platform: 'web',
  }),
  false
);
assert.equal(
  shouldMountCatalogPreview({
    hasTrailer: true,
    autoplayPreview: true,
    dataSaver: false,
    platform: 'web',
  }),
  true
);
assert.equal(
  shouldMountCatalogPreview({
    hasTrailer: true,
    autoplayPreview: true,
    dataSaver: false,
    platform: 'ios',
  }),
  false
);
assert.equal(allowHoverPreview({ dataSaver: true, enableHoverPreview: true, isTV: false }), false);
assert.equal(allowHoverPreview({ dataSaver: false, enableHoverPreview: true, isTV: false }), true);

const shaped = shapeEmbedUrl(
  'https://iframe.mediadelivery.net/embed/1/vid?autoplay=true&preload=true&startQuality=480p'
);
const shapedUrl = new URL(shaped);
assert.equal(shapedUrl.searchParams.get('preload'), 'false');
assert.equal(shapedUrl.searchParams.get('startQuality'), null);
assert.equal(shapedUrl.searchParams.get('autoplay'), 'true');

process.env.BUNNY_LIBRARY_ID = process.env.BUNNY_LIBRARY_ID || '1';
process.env.BUNNY_EMBED_BASE_URL =
  process.env.BUNNY_EMBED_BASE_URL || 'https://iframe.mediadelivery.net/embed';
const bunny = require('../src/services/bunnyService');
const embed = bunny.buildEmbedUrl('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
const embedUrl = new URL(embed);
assert.equal(embedUrl.searchParams.get('preload'), 'false');
assert.equal(embedUrl.searchParams.has('startQuality'), false);
assert.equal(embed.includes('play_480p'), false);
assert.equal(embed.includes('.mp4'), false);

assert.equal(isValidBunnyVideoId('demo-bunny-baia'), false);
assert.equal(isValidBunnyVideoId('pending-abc'), false);
assert.equal(isValidBunnyVideoId(''), false);
assert.equal(isValidBunnyVideoId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), true);

const watchSrc = fs.readFileSync(path.join(root, 'mobile/src/screens/Watch.js'), 'utf8');
assert.match(watchSrc, /nativePlaybackUri\(/);
assert.doesNotMatch(watchSrc, /saveDataUrl/);

const detailsSrc = fs.readFileSync(path.join(root, 'mobile/src/screens/Details.js'), 'utf8');
assert.match(detailsSrc, /onPress=\{\(\) => setShowTrailer\(true\)\}/);
assert.doesNotMatch(detailsSrc, /setTimeout\([\s\S]{0,80}setShowTrailer\(true\)/);

const bunnySrc = fs.readFileSync(path.join(root, 'server/src/services/bunnyService.js'), 'utf8');
assert.doesNotMatch(bunnySrc, /saveDataUrl/);
assert.match(bunnySrc, /preload: 'false'/);

console.log('data-saver: ok');
