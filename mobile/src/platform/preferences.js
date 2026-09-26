import AsyncStorage from '@react-native-async-storage/async-storage';

const DATA_SAVER_KEY = 'minhatela.prefs.dataSaver';

export async function getDataSaver() {
  const raw = await AsyncStorage.getItem(DATA_SAVER_KEY);
  // Default ON for Angola market (dados caros)
  if (raw == null) return true;
  return raw === '1';
}

export async function setDataSaver(enabled) {
  await AsyncStorage.setItem(DATA_SAVER_KEY, enabled ? '1' : '0');
  return enabled;
}

/**
 * Ajusta URL embed Bunny para qualidade económica.
 */
export function applyDataSaverToEmbedUrl(embedUrl, dataSaver) {
  if (!embedUrl || !dataSaver) return embedUrl;
  try {
    const url = new URL(embedUrl);
    url.searchParams.set('preload', 'false');
    // Bunny player: força arranque em resolução baixa quando suportado
    url.searchParams.set('startQuality', '480p');
    return url.toString();
  } catch {
    const join = embedUrl.includes('?') ? '&' : '?';
    return `${embedUrl}${join}preload=false&startQuality=480p`;
  }
}
