import AsyncStorage from '@react-native-async-storage/async-storage';

const DATA_SAVER_KEY = 'minhatela.prefs.dataSaver';
const THEME_KEY = 'minhatela.prefs.theme';

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

export async function getThemePreference() {
  const raw = await AsyncStorage.getItem(THEME_KEY);
  if (raw === 'light' || raw === 'dark') return raw;
  return 'dark';
}

export async function setThemePreference(themeId) {
  const id = themeId === 'light' ? 'light' : 'dark';
  await AsyncStorage.setItem(THEME_KEY, id);
  return id;
}

/**
 * Ajusta URL embed Bunny para qualidade económica.
 */
export function applyDataSaverToEmbedUrl(embedUrl, dataSaver) {
  if (!embedUrl || !dataSaver) return embedUrl;
  try {
    const url = new URL(embedUrl);
    url.searchParams.set('preload', 'false');
    url.searchParams.set('startQuality', '480p');
    return url.toString();
  } catch {
    const join = embedUrl.includes('?') ? '&' : '?';
    return `${embedUrl}${join}preload=false&startQuality=480p`;
  }
}
