/**
 * Poupança de dados — só regras comprovadas.
 *
 * expo-av ~15.0.2 (AV.types) não expõe preferredPeakBitRate nem escolha de variante HLS.
 * A documentação Bunny (storage-structure, embedding, Out 2026) lista:
 *   HLS único: /{id}/playlist.m3u8
 *   MP4: play_240p, play_360p, play_720p, play_1080p
 *   embed: preload=true|false. Não existe startQuality.
 * Trocar o filme para MP4 progressivo exigiria medir seek, buffer e bytes; não está feito.
 * Por isso o telemóvel mantém o HLS adaptativo. A poupança corta trailers automáticos
 * e o preload do embed.
 */

export function shouldMountCatalogPreview({
  hasTrailer = false,
  autoplayPreview = true,
  dataSaver = true,
  platform = 'web',
} = {}) {
  if (!hasTrailer || !autoplayPreview || dataSaver) return false;
  return platform === 'web';
}

export function allowHoverPreview({
  dataSaver = true,
  enableHoverPreview = true,
  isTV = false,
} = {}) {
  return Boolean(enableHoverPreview) && !isTV && !dataSaver;
}

/** O filme nativo fica no master HLS. saveDataUrl é ignorado de propósito. */
export function nativePlaybackUri({ hlsUrl = null, saveDataUrl = null } = {}) {
  if (saveDataUrl && !hlsUrl) return null;
  return hlsUrl || null;
}

/** preload=false é parâmetro oficial do embed Bunny. Não inventa qualidade. */
export function shapeEmbedUrl(embedUrl) {
  if (!embedUrl) return embedUrl;
  try {
    const url = new URL(embedUrl);
    url.searchParams.set('preload', 'false');
    url.searchParams.delete('startQuality');
    return url.toString();
  } catch {
    return embedUrl;
  }
}
