import api from './api';

export async function listLegalDocuments(locale = 'pt-AO') {
  return api.get(`/api/legal?locale=${encodeURIComponent(locale)}`);
}

export async function getLegalDocument(docType, locale = 'pt-AO') {
  return api.get(`/api/legal/${docType}?locale=${encodeURIComponent(locale)}`);
}

export async function getConsentStatus() {
  return api.get('/api/legal/me/status');
}

export async function acceptLegal(types = ['terms', 'privacy']) {
  return api.post('/api/legal/me/accept', { types });
}

export async function getPrivacyOverview() {
  return api.get('/api/account/privacy');
}

export async function exportMyData() {
  return api.post('/api/account/export-data', {});
}

export async function requestAccountDeletion({ password, confirm }) {
  return api.post('/api/account/delete', { password, confirm });
}

export async function cancelAccountDeletion() {
  return api.post('/api/account/delete/cancel', {});
}

export async function reportContent(contentId, { reason, details }) {
  return api.post(`/api/catalog/content/${contentId}/report`, { reason, details });
}

export default {
  listLegalDocuments,
  getLegalDocument,
  getConsentStatus,
  acceptLegal,
  getPrivacyOverview,
  exportMyData,
  requestAccountDeletion,
  cancelAccountDeletion,
  reportContent,
};
