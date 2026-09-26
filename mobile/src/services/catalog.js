import api from './api';
import { getDeviceIdentity } from '../platform/deviceIdentity';

export async function fetchHomeCatalog() {
  return api.get('/api/catalog/home');
}

export async function fetchVideoDetails(videoId) {
  return api.get(`/api/catalog/content/${videoId}`);
}

/**
 * Única forma autorizada de obter acesso ao player.
 */
export async function startWatch(contentId, { profileId, pin } = {}) {
  const device = await getDeviceIdentity();
  return api.post(`/api/watch/${contentId}/start`, {
    profileId: profileId || undefined,
    deviceKey: device.deviceKey,
    deviceName: device.deviceName,
    platform: device.platform,
    pin: pin || undefined,
  });
}

export async function saveWatchProgress(contentId, { positionSeconds, durationSeconds }) {
  return api.put(`/api/watch/${contentId}/progress`, {
    positionSeconds,
    durationSeconds,
  });
}

export async function heartbeatWatchSession(sessionId) {
  return api.post(`/api/watch/sessions/${sessionId}/heartbeat`, {});
}

export async function endWatchSession(sessionId) {
  return api.post(`/api/watch/sessions/${sessionId}/end`, {});
}

export async function reportWatchQoe(events) {
  return api.post('/api/watch/qoe', { events: Array.isArray(events) ? events : [events] });
}

export default {
  fetchHomeCatalog,
  fetchVideoDetails,
  startWatch,
  saveWatchProgress,
  heartbeatWatchSession,
  endWatchSession,
  reportWatchQoe,
};
