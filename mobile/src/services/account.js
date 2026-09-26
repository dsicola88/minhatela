import api from './api';

export async function getAccount() {
  return api.get('/api/account');
}

export async function listDevices() {
  return api.get('/api/account/devices');
}

export async function revokeDevice(deviceId) {
  return api.delete(`/api/account/devices/${deviceId}`);
}

export async function getStreamStatus() {
  return api.get('/api/account/streams');
}

export async function listAccountProfiles() {
  return api.get('/api/account/profiles');
}

export async function createProfile(body) {
  return api.post('/api/account/profiles', body);
}

export async function updateProfile(profileId, body) {
  return api.patch(`/api/account/profiles/${profileId}`, body);
}

export async function deleteProfile(profileId) {
  return api.delete(`/api/account/profiles/${profileId}`);
}

export async function unlockProfile(profileId, pin) {
  return api.post(`/api/account/profiles/${profileId}/unlock`, { pin });
}

export default {
  getAccount,
  listDevices,
  revokeDevice,
  getStreamStatus,
  listAccountProfiles,
  createProfile,
  updateProfile,
  deleteProfile,
  unlockProfile,
};
