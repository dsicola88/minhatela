import api from './api';

export async function listBlockedTitles(profileId) {
  return api.get(`/api/parental/profiles/${profileId}/blocked`);
}

export async function blockTitle(profileId, contentId) {
  return api.post(`/api/parental/profiles/${profileId}/blocked/${contentId}`, {});
}

export async function unblockTitle(profileId, contentId) {
  return api.delete(`/api/parental/profiles/${profileId}/blocked/${contentId}`);
}

export async function listDownloads() {
  return api.get('/api/downloads');
}

export async function requestDownload(contentId, { quality } = {}) {
  return api.post(`/api/downloads/${contentId}`, { quality });
}

export async function refreshDownloadLicense(licenseId) {
  return api.get(`/api/downloads/licenses/${licenseId}/refresh`);
}

export async function revokeDownload(licenseId) {
  return api.delete(`/api/downloads/licenses/${licenseId}`);
}

export async function markDownloadPlayed(licenseId) {
  return api.post(`/api/downloads/licenses/${licenseId}/played`, {});
}

export default {
  listBlockedTitles,
  blockTitle,
  unblockTitle,
  listDownloads,
  requestDownload,
  refreshDownloadLicense,
  revokeDownload,
  markDownloadPlayed,
};
