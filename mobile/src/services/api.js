import Constants from 'expo-constants';
import { getDeviceIdentity } from '../platform/deviceIdentity';

// EXPO_PUBLIC_* (Vercel/build) tem prioridade sobre app.json hardcoded
const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  Constants.expoConfig?.extra?.apiBaseUrl ||
  'http://localhost:4000';

let authToken = null;
let activeProfileId = null;
let deviceCache = null;
let refreshHandler = null;
let refreshPromise = null;

export function setAuthToken(token) {
  authToken = token;
}

export function getAuthToken() {
  return authToken;
}

export function setActiveProfileId(profileId) {
  activeProfileId = profileId || null;
}

export function setRefreshHandler(handler) {
  refreshHandler = handler;
}

export function getApiBaseUrl() {
  return API_BASE_URL;
}

async function deviceHeaders() {
  if (!deviceCache) {
    deviceCache = await getDeviceIdentity();
  }
  return deviceCache;
}

async function tryRefresh() {
  if (!refreshHandler) return false;
  if (!refreshPromise) {
    refreshPromise = Promise.resolve()
      .then(() => refreshHandler())
      .finally(() => {
        refreshPromise = null;
      });
  }
  const result = await refreshPromise;
  return Boolean(result);
}

async function request(path, options = {}, retried = false) {
  const device = await deviceHeaders();
  const headers = {
    Accept: 'application/json',
    ...(options.body && !(options.body instanceof FormData)
      ? { 'Content-Type': 'application/json' }
      : {}),
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    ...(activeProfileId ? { 'X-Profile-Id': activeProfileId } : {}),
    'X-Device-Key': device.deviceKey,
    'X-Device-Name': device.deviceName,
    'X-Device-Platform': device.platform,
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json()
    : null;

  if (!response.ok) {
    const canRefresh =
      response.status === 401 &&
      !retried &&
      !path.startsWith('/api/auth/login') &&
      !path.startsWith('/api/auth/register') &&
      !path.startsWith('/api/auth/refresh') &&
      !path.startsWith('/api/auth/logout');

    if (canRefresh) {
      const ok = await tryRefresh();
      if (ok) return request(path, options, true);
    }

    const error = new Error(payload?.message || 'Falha na comunicação com o servidor');
    error.status = response.status;
    error.code = payload?.code;
    error.payload = payload;
    throw error;
  }

  return payload;
}

export const api = {
  get: (path, options = {}) => request(path, options),
  post: (path, body, options = {}) =>
    request(path, {
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body ?? {}),
      ...options,
      headers: options.headers,
    }),
  put: (path, body, options = {}) =>
    request(path, {
      method: 'PUT',
      body: JSON.stringify(body ?? {}),
      ...options,
      headers: options.headers,
    }),
  patch: (path, body, options = {}) =>
    request(path, {
      method: 'PATCH',
      body: JSON.stringify(body),
      ...options,
      headers: options.headers,
    }),
  delete: (path, options = {}) =>
    request(path, {
      method: 'DELETE',
      ...options,
    }),
};

export default api;
