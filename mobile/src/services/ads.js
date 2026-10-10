import api from './api';

export async function registerAdvertiser(payload) {
  return api.post('/api/ads/advertisers/register', payload);
}

export async function fetchAdPortal() {
  return api.get('/api/ads/portal');
}

export async function createCampaign(payload) {
  return api.post('/api/ads/campaigns', payload);
}

export async function completeAdImpression(impressionId) {
  return api.post(`/api/ads/impressions/${impressionId}/complete`);
}

export async function clickAdImpression(impressionId) {
  return api.post(`/api/ads/impressions/${impressionId}/click`);
}

export async function trackAnalyticsEvent(payload) {
  return api.post('/api/analytics/events', payload);
}

export default {
  registerAdvertiser,
  fetchAdPortal,
  createCampaign,
  completeAdImpression,
  clickAdImpression,
  trackAnalyticsEvent,
};
