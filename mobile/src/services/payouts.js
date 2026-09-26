import api from './api';

export async function fetchMyPayouts() {
  return api.get('/api/creator-studio/payouts');
}

export async function requestPayout({ amountKz, notes }) {
  return api.post('/api/creator-studio/payouts', { amountKz, notes });
}

export async function fetchPendingPayouts() {
  return api.get('/api/admin/payouts/pending');
}

export async function reviewPayout(id, { status, notes }) {
  return api.patch(`/api/admin/payouts/${id}/status`, { status, notes });
}

export default {
  fetchMyPayouts,
  requestPayout,
  fetchPendingPayouts,
  reviewPayout,
};
