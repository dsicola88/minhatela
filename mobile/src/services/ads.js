import api, { getApiBaseUrl } from './api';

export async function registerAdvertiser(payload) {
  return api.post('/api/ads/advertisers/register', payload);
}

export async function fetchAdPortal(params = {}) {
  const q = new URLSearchParams();
  if (params.status) q.set('status', params.status);
  if (params.q) q.set('q', params.q);
  const qs = q.toString();
  return api.get(`/api/ads/portal${qs ? `?${qs}` : ''}`);
}

export async function fetchAdCampaign(id) {
  return api.get(`/api/ads/campaigns/${id}`);
}

export async function createCampaign(payload) {
  return api.post('/api/ads/campaigns', payload);
}

export async function uploadAdCreative(file) {
  const form = new FormData();
  if (typeof File !== 'undefined' && file instanceof File) {
    form.append('file', file);
  } else {
    form.append('file', {
      uri: file.uri,
      name: file.name || 'anuncio',
      type: file.mimeType || file.type || 'application/octet-stream',
    });
  }
  return api.post('/api/ads/creatives/upload', form);
}

export async function pauseCampaign(id) {
  return api.post(`/api/ads/campaigns/${id}/pause`, {});
}

export async function resumeCampaign(id) {
  return api.post(`/api/ads/campaigns/${id}/resume`, {});
}

export async function withdrawCampaign(id) {
  return api.post(`/api/ads/campaigns/${id}/withdraw`, {});
}

export async function fetchAdReports(params = {}) {
  const q = new URLSearchParams();
  if (params.from) q.set('from', params.from);
  if (params.to) q.set('to', params.to);
  if (params.format) q.set('format', params.format);
  const qs = q.toString();
  return api.get(`/api/ads/reports${qs ? `?${qs}` : ''}`);
}

export function adReportsCsvUrl() {
  return `${getApiBaseUrl()}/api/ads/reports?format=csv`;
}

export async function startAdImpression(impressionId) {
  return api.post(`/api/ads/impressions/${impressionId}/start`);
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

export function resolveAdMediaUrl(url) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return `${getApiBaseUrl()}${url.startsWith('/') ? url : `/${url}`}`;
}

export default {
  registerAdvertiser,
  fetchAdPortal,
  fetchAdCampaign,
  createCampaign,
  uploadAdCreative,
  pauseCampaign,
  resumeCampaign,
  fetchAdReports,
  startAdImpression,
  completeAdImpression,
  clickAdImpression,
  trackAnalyticsEvent,
  resolveAdMediaUrl,
};
