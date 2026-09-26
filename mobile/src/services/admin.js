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
  resolveProofUrl,
};
