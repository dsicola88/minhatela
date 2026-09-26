import api, { getApiBaseUrl } from './api';

export async function fetchAdminDashboard() {
  return api.get('/api/admin/command-center');
}

export async function fetchCommandCenter() {
  return api.get('/api/admin/command-center');
}

export async function fetchAuditLog(params = {}) {
  const q = new URLSearchParams();
  if (params.limit) q.set('limit', String(params.limit));
  if (params.action) q.set('action', params.action);
  if (params.entity) q.set('entity', params.entity);
  const qs = q.toString();
  return api.get(`/api/admin/audit${qs ? `?${qs}` : ''}`);
}

export async function fetchLiveStreams() {
  return api.get('/api/admin/streams/live');
}

export async function fetchPendingCampaigns() {
  return api.get('/api/admin/campaigns/pending');
}

export async function reviewCampaign(campaignId, status) {
  return api.patch(`/api/admin/campaigns/${campaignId}/status`, { status });
}

export async function fetchPendingPayments() {
  return api.get('/api/admin/transactions/pending');
}

export async function reviewPayment(transactionId, { status, adminNotes }) {
  return api.patch(`/api/admin/transactions/${transactionId}/status`, {
    status,
    adminNotes,
  });
}

export async function fetchPendingCreators() {
  return api.get('/api/admin/creators/pending');
}

export async function reviewCreator(creatorId, status) {
  return api.patch(`/api/admin/creators/${creatorId}/status`, { status });
}

export async function fetchPendingContent(status = 'submitted') {
  return api.get(`/api/admin/content/pending?status=${status}`);
}

export async function moderateContent(contentId, { action, rejectionReason }) {
  return api.patch(`/api/admin/content/${contentId}/moderate`, {
    action,
    rejectionReason,
  });
}

export async function fetchPromos() {
  return api.get('/api/admin/promos');
}

export async function createPromo(body) {
  return api.post('/api/admin/promos', body);
}

export async function setPromoActive(promoId, isActive) {
  return api.patch(`/api/admin/promos/${promoId}/active`, { isActive });
}

export async function fetchTickets(limit = 50) {
  return api.get(`/api/admin/tickets?limit=${limit}`);
}

export async function reviewTicket(ticketId, body) {
  return api.patch(`/api/admin/tickets/${ticketId}`, body);
}

export async function fetchHelpArticles() {
  return api.get('/api/admin/help/articles');
}

export async function upsertHelpArticle(body) {
  return api.post('/api/admin/help/articles', body);
}

export async function publishHelpArticle(id, isPublished) {
  return api.patch(`/api/admin/help/articles/${id}/publish`, { isPublished });
}

export async function fetchFeatureFlags() {
  return api.get('/api/admin/feature-flags');
}

export async function setFeatureFlag(key, enabled) {
  return api.patch(`/api/admin/feature-flags/${encodeURIComponent(key)}`, { enabled });
}

export async function fetchEditorial() {
  return api.get('/api/admin/editorial');
}

export async function createEditorial(body) {
  return api.post('/api/admin/editorial', body);
}

export async function updateEditorial(id, body) {
  return api.patch(`/api/admin/editorial/${id}`, body);
}

export async function fetchAppConfig() {
  return api.get('/api/admin/config');
}

export async function upsertAppConfig(key, value, description) {
  return api.put(`/api/admin/config/${encodeURIComponent(key)}`, { value, description });
}

export async function fetchPublicAppConfig() {
  return api.get('/api/app/config');
}

export async function fetchAdminPacks() {
  return api.get('/api/admin/packs');
}

export async function fetchSurveySummary() {
  return api.get('/api/admin/surveys/summary');
}

export async function fetchAdminPremieres() {
  return api.get('/api/admin/premieres');
}

export async function createPremiere(body) {
  return api.post('/api/admin/premieres', body);
}

export async function updatePremiere(id, body) {
  return api.patch(`/api/admin/premieres/${id}`, body);
}

export async function fetchAdminGifts() {
  return api.get('/api/admin/gifts');
}

export async function createGift(body) {
  return api.post('/api/admin/gifts', body);
}

export async function revokeGift(id) {
  return api.patch(`/api/admin/gifts/${id}/revoke`, {});
}

export async function probeCdn() {
  return api.post('/api/admin/cdn/probe', {});
}

export async function fetchCdnHealth() {
  return api.get('/api/admin/cdn/health');
}

export async function fetchEncoding(status) {
  const q = status ? `?status=${encodeURIComponent(status)}` : '';
  return api.get(`/api/admin/encoding${q}`);
}

export async function updateEncoding(contentId, body) {
  return api.patch(`/api/admin/encoding/${contentId}`, body);
}

export async function fetchPaymentRisk(minScore = 0) {
  return api.get(`/api/admin/payments/risk?minScore=${minScore}`);
}

export async function fetchExperiments() {
  return api.get('/api/admin/experiments');
}

export function resolveProofUrl(path) {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${getApiBaseUrl()}${path}`;
}

export default {
  fetchAdminDashboard,
  fetchCommandCenter,
  fetchAuditLog,
  fetchLiveStreams,
  fetchPendingCampaigns,
  reviewCampaign,
  fetchPendingPayments,
  reviewPayment,
  fetchPendingCreators,
  reviewCreator,
  fetchPendingContent,
  moderateContent,
  fetchPromos,
  createPromo,
  setPromoActive,
  fetchTickets,
  reviewTicket,
  fetchHelpArticles,
  upsertHelpArticle,
  publishHelpArticle,
  fetchFeatureFlags,
  setFeatureFlag,
  fetchEditorial,
  createEditorial,
  updateEditorial,
  fetchAppConfig,
  upsertAppConfig,
  fetchPublicAppConfig,
  fetchAdminPacks,
  fetchSurveySummary,
  fetchAdminPremieres,
  createPremiere,
  updatePremiere,
  fetchAdminGifts,
  createGift,
  revokeGift,
  probeCdn,
  fetchCdnHealth,
  fetchEncoding,
  updateEncoding,
  fetchPaymentRisk,
  fetchExperiments,
  resolveProofUrl,
};
