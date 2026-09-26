import api from './api';

export async function runNetworkDiagnostics(body = {}) {
  return api.post('/api/network/diagnostics', body);
}

export async function getWhatsappShare(contentId) {
  return api.get(`/api/catalog/content/${contentId}/share/whatsapp`);
}

export async function followSeries(seriesId, body = {}) {
  return api.post(`/api/me/follows/${seriesId}`, body);
}

export async function unfollowSeries(seriesId) {
  return api.delete(`/api/me/follows/${seriesId}`);
}

export async function getFollowState(seriesId) {
  return api.get(`/api/me/follows/${seriesId}`);
}

export async function listMyFollows() {
  return api.get('/api/me/follows');
}

export async function fetchLanguagesHub() {
  return api.get('/api/browse/languages');
}

export async function fetchByLanguage(lang) {
  return api.get(`/api/browse/language/${encodeURIComponent(lang)}`);
}

export async function fetchByCategory(slug) {
  return api.get(`/api/browse/category/${encodeURIComponent(slug)}`);
}

export async function listInvoices() {
  return api.get('/api/me/invoices');
}

export async function getInvoice(invoiceId, { html = false } = {}) {
  const qs = html ? '?format=html' : '';
  return api.get(`/api/me/invoices/${invoiceId}${qs}`);
}

export default {
  runNetworkDiagnostics,
  getWhatsappShare,
  followSeries,
  unfollowSeries,
  getFollowState,
  listMyFollows,
  fetchLanguagesHub,
  fetchByLanguage,
  fetchByCategory,
  listInvoices,
  getInvoice,
};
