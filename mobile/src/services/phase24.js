import api from './api';

export async function fetchExperiments() {
  return api.get('/api/account/experiments');
}

export async function fetchTrendingSearches() {
  return api.get('/api/search/trending');
}

export async function updatePlaybackPrefs(body) {
  return api.patch('/api/account/playback-prefs', body);
}

export async function trustDevice(deviceId, trusted = true) {
  return api.post(`/api/account/devices/${deviceId}/trust`, { trusted });
}

export async function renameDevice(deviceId, name) {
  return api.patch(`/api/account/devices/${deviceId}`, { name });
}

export default {
  fetchExperiments,
  fetchTrendingSearches,
  updatePlaybackPrefs,
  trustDevice,
  renameDevice,
};
