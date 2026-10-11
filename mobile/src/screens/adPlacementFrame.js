/** Ecrãs reais onde o anúncio passa, antes do filme. */
export const PLACEMENT_SCREENS = {
  phone: { id: 'phone', label: 'Telemóvel', width: 390, height: 844 },
  desktop: { id: 'desktop', label: 'Computador', width: 1280, height: 720 },
};

/** object-fit: contain. O anúncio não é esticado; as barras ficam no ecrã. */
export function containedRect(mediaWidth, mediaHeight, frameWidth, frameHeight) {
  const mw = Number(mediaWidth);
  const mh = Number(mediaHeight);
  const fw = Number(frameWidth);
  const fh = Number(frameHeight);
  if (!(mw > 0) || !(mh > 0) || !(fw > 0) || !(fh > 0)) {
    return { width: 0, height: 0, x: 0, y: 0 };
  }
  const scale = Math.min(fw / mw, fh / mh);
  const width = Math.round(mw * scale);
  const height = Math.round(mh * scale);
  return {
    width,
    height,
    x: Math.round((fw - width) / 2),
    y: Math.round((fh - height) / 2),
  };
}

export function frameMock(screen, maxWidth, maxHeight) {
  const scale = Math.min(maxWidth / screen.width, maxHeight / screen.height, 1);
  return {
    scale,
    width: Math.max(1, Math.round(screen.width * scale)),
    height: Math.max(1, Math.round(screen.height * scale)),
  };
}

export function mediaFileLabel(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) {
    try {
      return new URL(raw).hostname.replace(/^www\./, '');
    } catch {
      return 'Ligação HTTPS';
    }
  }
  const ext = (raw.split('?')[0].match(/\.([a-z0-9]+)$/i) || [])[1];
  if (!ext) return 'Ficheiro carregado';
  const kind = /^(mp4|webm|mov)$/i.test(ext) ? 'Vídeo' : 'Imagem';
  return `${kind} ${ext.toUpperCase()} carregado`;
}
