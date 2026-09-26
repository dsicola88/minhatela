/**
 * O cliente NÃO constrói URLs Bunny.
 * Toda a autorização de playback vem de POST /api/watch/:id/start
 */
export function getPlayerDefaults(player) {
  return {
    quality: player?.defaultQuality || '480p',
    startQuality: player?.startQuality || 'auto',
    forceHighOnStart: false,
    allowedStartQualities: player?.allowedStartQualities || ['auto', '480p'],
  };
}

export default { getPlayerDefaults };
