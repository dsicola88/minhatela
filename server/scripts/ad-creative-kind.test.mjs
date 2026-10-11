import { fileKind, mediaKindFromUrl, previewUsesVideo } from '../../mobile/src/screens/adCreativeKind.js';
import { destinationFieldText, normalizePublicWebUrl } from '../../mobile/src/screens/publicWebUrl.js';
import {
  PLACEMENT_SCREENS,
  containedRect,
  frameMock,
  mediaFileLabel,
} from '../../mobile/src/screens/adPlacementFrame.js';

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

const phone = containedRect(1920, 1080, PLACEMENT_SCREENS.phone.width, PLACEMENT_SCREENS.phone.height);
assert(phone.width === 390 && phone.height === 219, `phone fit ${phone.width}x${phone.height}`);
assert(phone.x === 0 && phone.y === 313, `phone letterbox ${phone.x},${phone.y}`);
const desktop = containedRect(1920, 1080, PLACEMENT_SCREENS.desktop.width, PLACEMENT_SCREENS.desktop.height);
assert(desktop.width === 1280 && desktop.height === 720, `desktop fit ${desktop.width}x${desktop.height}`);
const portrait = containedRect(1080, 1920, PLACEMENT_SCREENS.desktop.width, PLACEMENT_SCREENS.desktop.height);
assert(portrait.height === 720 && portrait.width === 405, `portrait desktop ${portrait.width}x${portrait.height}`);
const mock = frameMock(PLACEMENT_SCREENS.phone, 220, 460);
assert(mock.width <= 220 && mock.height <= 460, 'mock fits the form');
assert(mock.scale < 1, 'phone is scaled, not stretched to the page');
assert(mediaFileLabel('/uploads/ads/t79t173332422-+s9t0pca.mp4') === 'Vídeo MP4 carregado', 'hide storage path');
assert(mediaFileLabel('https://www.empresa.ao/spot.mp4') === 'empresa.ao', 'https host');

const site = normalizePublicWebUrl('dhundotec.com');
assert(site.ok && site.url === 'https://dhundotec.com/', site.url);
const httpSite = normalizePublicWebUrl('http://dhundotec.com/');
assert(httpSite.url === 'https://dhundotec.com/', httpSite.url);
assert(destinationFieldText('https://dhundotec.com/') === 'dhundotec.com', 'field hides scheme');
assert(normalizePublicWebUrl('http://127.0.0.1').ok === false, 'private host');

console.log('ad-creative-kind: ok');
