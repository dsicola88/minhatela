'use strict';

const assert = require('assert');
const {
  assertVariantFile,
  buildLadderBody,
  fileFromVariantUri,
  filterMasterPlaylist,
  playbackPlaylistKey,
  playlistHeaders,
  rewritePlaylistUris,
} = require('../src/utils/hlsLadder');
const { signGrant, verifyGrant } = require('../src/services/hlsCapService');

const master = `#EXTM3U
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="aac",NAME="pt",DEFAULT=YES,URI="audio/pt.m3u8"
#EXT-X-I-FRAME-STREAM-INF:BANDWIDTH=80000,RESOLUTION=426x240,URI="240p/iframe.m3u8"
#EXT-X-I-FRAME-STREAM-INF:BANDWIDTH=400000,RESOLUTION=1920x1080,URI="1080p/iframe.m3u8"
#EXT-X-STREAM-INF:BANDWIDTH=600000,RESOLUTION=426x240
240p/video.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=1500000,RESOLUTION=854x480
480p/video.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=2800000,RESOLUTION=1280x720
720p/video.m3u8
`;

const videoId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const filtered = filterMasterPlaylist(master, 480);
const body = buildLadderBody({
  playlist: filtered.playlist,
  variants: filtered.kept,
  bunnyVideoId: videoId,
  mapChild: (file) => `https://api.test/media.m3u8?file=${file}`,
});

assert.ok(body.includes('240p/video.m3u8'));
assert.ok(body.includes('480p/video.m3u8'));
assert.ok(!body.includes('720p'));
assert.ok(!body.includes('1280x720'));
assert.ok(body.includes('audio/pt.m3u8'));
assert.ok(body.includes('240p/iframe.m3u8'));
assert.ok(!body.includes('1080p'));

assert.throws(() => assertVariantFile('../secret.m3u8'));
assert.throws(() => assertVariantFile('/etc/passwd.m3u8'));
assert.throws(() => fileFromVariantUri('https://evil.example/x.m3u8', videoId));
assert.strictEqual(fileFromVariantUri(`${'https://cdn.test'}/${videoId}/480p/video.m3u8`, videoId), '480p/video.m3u8');

const rewritten = rewritePlaylistUris('#EXTM3U\n#EXTINF:4,\nseg0.ts\n#EXT-X-KEY:METHOD=AES-128,URI="key"\n', (uri) => `https://cdn.test/v/${uri}?token=1`);
assert.ok(rewritten.includes('https://cdn.test/v/seg0.ts?token=1'));
assert.ok(rewritten.includes('URI="https://cdn.test/v/key?token=1"'));

const expires = Math.floor(Date.now() / 1000) + 60;
const sig = signGrant({ sessionId: 's1', file: '480p/video.m3u8', expiresUnix: expires });
assert.strictEqual(verifyGrant({ sessionId: 's1', file: '480p/video.m3u8', expiresUnix: expires, sig }), true);
assert.strictEqual(verifyGrant({ sessionId: 's1', file: '720p/video.m3u8', expiresUnix: expires, sig }), false);
assert.strictEqual(verifyGrant({ sessionId: 's1', file: '480p/video.m3u8', expiresUnix: 10, sig }), false);

assert.notStrictEqual(
  playbackPlaylistKey({ contentId: videoId, dataSaver: true }),
  playbackPlaylistKey({ contentId: videoId, dataSaver: false })
);
assert.strictEqual(playlistHeaders()['Cache-Control'], 'no-store');

console.log('hls-cap: ok');
