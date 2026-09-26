import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api, {
  setAuthToken,
  setActiveProfileId,
  getApiBaseUrl,
  setRefreshHandler,
} from './api';
import { getDeviceIdentity } from '../platform/deviceIdentity';

const TOKEN_KEY = 'minhatela.auth.token';
const REFRESH_KEY = 'minhatela.auth.refresh';
const SESSION_KEY = 'minhatela.auth.session';
const PROFILE_KEY = 'minhatela.active.profile';

async function persist(key, value) {
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function read(key) {
  if (Platform.OS === 'web') {
    return AsyncStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

async function remove(key) {
  if (Platform.OS === 'web') {
    await AsyncStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

async function persistAuth(data) {
  setAuthToken(data.token || data.accessToken);
  await persist(TOKEN_KEY, data.token || data.accessToken);
  if (data.refreshToken) {
    await persist(REFRESH_KEY, data.refreshToken);
  }
  if (data.sessionId) {
    await persist(SESSION_KEY, data.sessionId);
  }
}

export async function bootstrapSession() {
  const token = await read(TOKEN_KEY);
  if (token) {
    setAuthToken(token);
  }
  return token;
}

export async function applyAuthSession(data) {
  await persistAuth(data);
  return data;
}

export async function login({ email, password }) {
  const device = await getDeviceIdentity();
  const data = await api.post('/api/auth/login', {
    email,
    password,
    deviceName: device.deviceName,
    platform: device.platform,
  });
  await persistAuth(data);
  return data;
}

export async function register({ email, password, fullName, acceptTerms }) {
  const device = await getDeviceIdentity();
  const data = await api.post('/api/auth/register', {
    email,
    password,
    fullName,
    acceptTerms: Boolean(acceptTerms),
    deviceName: device.deviceName,
    platform: device.platform,
  });
  await persistAuth(data);
  return data;
}

export async function refreshSession() {
  const refreshToken = await read(REFRESH_KEY);
  if (!refreshToken) return null;

  const response = await fetch(`${getApiBaseUrl()}/api/auth/refresh`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    setAuthToken(null);
    await remove(TOKEN_KEY);
    await remove(REFRESH_KEY);
    await remove(SESSION_KEY);
    return null;
  }
  await persistAuth(data);
  return data;
}

export async function getMe() {
  try {
    return await api.get('/api/auth/me');
  } catch (err) {
    if (err.status === 401) {
      const refreshed = await refreshSession();
      if (refreshed) return api.get('/api/auth/me');
    }
    throw err;
  }
}

export async function getProfiles() {
  return api.get('/api/auth/profiles');
}

export async function setActiveProfile(profile) {
  await persist(PROFILE_KEY, JSON.stringify(profile));
  setActiveProfileId(profile?.id || null);
}

export async function getActiveProfile() {
  const raw = await read(PROFILE_KEY);
  const profile = raw ? JSON.parse(raw) : null;
  setActiveProfileId(profile?.id || null);
  return profile;
}

export async function forgotPassword(email) {
  return api.post('/api/auth/forgot-password', { email });
}

export async function resetPassword({ token, password }) {
  return api.post('/api/auth/reset-password', { token, password });
}

export async function listAuthSessions() {
  return api.get('/api/auth/sessions');
}

export async function revokeAuthSession(sessionId) {
  return api.delete(`/api/auth/sessions/${sessionId}`);
}

export async function revokeOtherSessions() {
  return api.post('/api/auth/sessions/revoke-others', {});
}

export async function logout() {
  try {
    await api.post('/api/auth/logout', {});
  } catch {
    // ignore network errors on logout
  }
  setAuthToken(null);
  setActiveProfileId(null);
  await remove(TOKEN_KEY);
  await remove(REFRESH_KEY);
  await remove(SESSION_KEY);
  await remove(PROFILE_KEY);
}

setRefreshHandler(refreshSession);

export default {
  bootstrapSession,
  login,
  register,
  refreshSession,
  getMe,
  getProfiles,
  setActiveProfile,
  getActiveProfile,
  forgotPassword,
  resetPassword,
  listAuthSessions,
  revokeAuthSession,
  revokeOtherSessions,
  logout,
};
