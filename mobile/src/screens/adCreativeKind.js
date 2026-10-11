export function mediaKindFromUrl(url) {
  const path = String(url || '').split('?')[0].toLowerCase();
  if (/\.(mp4|webm|mov)$/.test(path)) return 'video';
  if (/\.(jpg|jpeg|png|webp|gif)$/.test(path)) return 'image';
  return null;
}

export function fileKind(file) {
  const type = String(file?.type || file?.mimeType || '').toLowerCase();
  const name = String(file?.name || '').toLowerCase();
  if (type.startsWith('video/') || /\.(mp4|webm|mov)$/.test(name)) return 'video';
  if (type.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif)$/.test(name)) return 'image';
  return null;
}

export function previewUsesVideo(url, kind) {
  const detected = mediaKindFromUrl(url);
  if (detected === 'image') return false;
  return detected === 'video' || kind === 'video';
}
