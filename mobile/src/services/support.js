import api from './api';

export async function listAvatars(params = {}) {
  const qs = new URLSearchParams();
  if (params.kids !== undefined) qs.set('kids', params.kids ? '1' : '0');
  const q = qs.toString();
  return api.get(`/api/support/avatars${q ? `?${q}` : ''}`);
}

export async function listHelp(category) {
  const qs = category ? `?category=${encodeURIComponent(category)}` : '';
  return api.get(`/api/support/help${qs}`);
}

export async function getHelpArticle(slug) {
  return api.get(`/api/support/help/${slug}`);
}

export async function createSupportTicket(body) {
  return api.post('/api/support/tickets', body);
}

export async function listMyTickets() {
  return api.get('/api/support/tickets');
}

export async function getMyReferral() {
  return api.get('/api/support/referral');
}

export async function redeemReferral(code) {
  return api.post('/api/support/referral/redeem', { code });
}

export default {
  listAvatars,
  listHelp,
  getHelpArticle,
  createSupportTicket,
  listMyTickets,
  getMyReferral,
  redeemReferral,
};
