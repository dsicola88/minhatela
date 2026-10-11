'use strict';

const assert = require('assert');
const { filterMasterPlaylist, playbackPlaylistKey } = require('../src/utils/hlsLadder');

const master = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="aac",NAME="pt",DEFAULT=YES,URI="audio/pt.m3u8"
#EXT-X-STREAM-INF:BANDWIDTH=600000,RESOLUTION=426x240
240p/video.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=900000,RESOLUTION=640x360
360p/video.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=1500000,RESOLUTION=854x480
480p/video.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=2800000,RESOLUTION=1280x720
720p/video.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080
1080p/video.m3u8
`;

const capped = filterMasterPlaylist(master, 480);
assert.deepStrictEqual(
  capped.kept.map((v) => v.height),
  [240, 360, 480]
);
assert.deepStrictEqual(
  capped.dropped.map((v) => v.height),
  [720, 1080]
);
assert.ok(!/RESOLUTION=1280x720/.test(capped.playlist));
assert.ok(!/RESOLUTION=1920x1080/.test(capped.playlist));
assert.ok(capped.playlist.includes('480p/video.m3u8'));
assert.ok(capped.playlist.includes('#EXT-X-MEDIA:TYPE=AUDIO'));

const open = filterMasterPlaylist(master, 1080);
assert.strictEqual(open.dropped.length, 0);
assert.strictEqual(open.kept.length, 5);

const media = '#EXTM3U\n#EXTINF:6.0,\nseg0.ts\n';
const notMaster = filterMasterPlaylist(media, 480);
assert.strictEqual(notMaster.isMaster, false);

const id = 'film-1';
assert.notStrictEqual(
  playbackPlaylistKey({ contentId: id, dataSaver: true }),
  playbackPlaylistKey({ contentId: id, dataSaver: false })
);
const cache = new Map();
cache.set(playbackPlaylistKey({ contentId: id, dataSaver: false }), master);
assert.strictEqual(cache.get(playbackPlaylistKey({ contentId: id, dataSaver: true })), undefined);

console.log('hls-ladder: ok');
