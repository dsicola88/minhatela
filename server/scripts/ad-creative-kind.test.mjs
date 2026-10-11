import { fileKind, mediaKindFromUrl, previewUsesVideo } from '../../mobile/src/screens/adCreativeKind.js';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(mediaKindFromUrl('/uploads/ads/t791731394545-9fqkfvx5.jpg') === 'image', 'jpg');
assert(mediaKindFromUrl('https://cdn.example/ad.MP4?token=1') === 'video', 'mp4 query');
assert(mediaKindFromUrl('/uploads/ads/banner.png') === 'image', 'png');
assert(previewUsesVideo('/uploads/ads/t.jpg', 'video') === false, 'jpg must not mount video');
assert(previewUsesVideo('/uploads/ads/spot.mp4', 'video') === true, 'mp4 video');
assert(previewUsesVideo('/uploads/ads/spot.webm', 'image') === true, 'webm stays video');
assert(fileKind({ type: 'image/jpeg', name: 'foto.jpg' }) === 'image', 'jpeg file');
assert(fileKind({ type: '', name: 'spot.mov' }) === 'video', 'mov by name');
assert(fileKind({ type: 'application/pdf', name: 'doc.pdf' }) === null, 'pdf rejected');

console.log('ad-creative-kind: ok');
