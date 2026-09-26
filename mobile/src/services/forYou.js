import api from './api';

export async function fetchForYouHub() {
  return api.get('/api/me/for-you');
}

export async function setNotInterested(contentId, value = true) {
  if (value) {
    return api.post(`/api/me/titles/${contentId}/not-interested`, { value: true });
  }
  return api.delete(`/api/me/titles/${contentId}/not-interested`);
}

export async function markAsWatched(contentId) {
  return api.post(`/api/me/titles/${contentId}/mark-watched`, {});
}

export async function unmarkAsWatched(contentId) {
  return api.delete(`/api/me/titles/${contentId}/mark-watched`);
}

export async function getTitlePreference(contentId) {
  return api.get(`/api/me/titles/${contentId}/preference`);
}

export default {
  fetchForYouHub,
  setNotInterested,
  markAsWatched,
  unmarkAsWatched,
  getTitlePreference,
};
