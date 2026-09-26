import api from './api';

export async function searchContent(q, filters = {}) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (filters.kind) params.set('kind', filters.kind);
  if (filters.monetization) params.set('monetization', filters.monetization);
  if (filters.genre) params.set('genre', filters.genre);
  if (filters.year) params.set('year', String(filters.year));
  if (filters.limit) params.set('limit', String(filters.limit));
  const qs = params.toString();
  return api.get(`/api/search${qs ? `?${qs}` : ''}`);
}

export async function suggestSearch(q, limit = 8) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  params.set('limit', String(limit));
  return api.get(`/api/search/suggest?${params.toString()}`);
}

export async function fetchFacets() {
  return api.get('/api/search/facets').catch(() => api.get('/api/discovery/facets'));
}

export async function fetchRecommendations() {
  return api.get('/api/discovery/recommendations');
}

export async function fetchFavorites() {
  return api.get('/api/discovery/favorites');
}

export async function addFavorite(contentId) {
  return api.post(`/api/discovery/favorites/${contentId}`, {});
}

export async function removeFavorite(contentId) {
  return api.delete(`/api/discovery/favorites/${contentId}`);
}

export async function fetchRelated(contentId) {
  return api.get(`/api/discovery/${contentId}/related`);
}

export async function rateContent(contentId, rating) {
  const body =
    typeof rating === 'number' || (typeof rating === 'string' && /^\d+$/.test(rating))
      ? { stars: Number(rating) }
      : { rating };
  return api.post(`/api/discovery/${contentId}/rate`, body);
}

export async function setReminder(contentId, enable = true) {
  return api.post(`/api/discovery/${contentId}/remind`, { enable });
}

export async function fetchReminders() {
  return api.get('/api/discovery/reminders');
}

export default {
  searchContent,
  fetchFacets,
  fetchRecommendations,
  fetchFavorites,
  addFavorite,
  removeFavorite,
  fetchRelated,
  rateContent,
  setReminder,
  fetchReminders,
  suggestSearch,
};
