import api from './api';

export async function listPacks() {
  return api.get('/api/payments/packs');
}

export async function getPack(id) {
  return api.get(`/api/payments/packs/${id}`);
}

export async function selectProfile(profileId, deviceId) {
  return api.post(`/api/account/profiles/${profileId}/select`, { deviceId });
}

export async function fetchPendingSurvey() {
  return api.get('/api/surveys/pending');
}

export async function respondSurvey(body) {
  return api.post('/api/surveys/respond', body);
}

export async function joinPremiere(eventId) {
  return api.post(`/api/premieres/${eventId}/join`, {});
}

export async function rateStars(contentId, stars, profileId) {
  return api.post(`/api/discovery/${contentId}/rate`, { stars, profileId });
}

export async function probeCdn() {
  return api.post('/api/admin/cdn/probe', {});
}

export async function fetchCdnHealth() {
  return api.get('/api/admin/cdn/health');
}

export async function fetchSurveySummary() {
  return api.get('/api/admin/surveys/summary');
}

export default {
  listPacks,
  getPack,
  selectProfile,
  fetchPendingSurvey,
  respondSurvey,
  joinPremiere,
  rateStars,
  probeCdn,
  fetchCdnHealth,
  fetchSurveySummary,
};
