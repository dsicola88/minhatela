import api from './api';

export async function fetchNotifications() {
  return api.get('/api/me/notifications');
}

export async function fetchUnreadCount() {
  return api.get('/api/me/notifications/unread');
}

export async function markNotificationRead(id) {
  return api.post(`/api/me/notifications/${id}/read`, {});
}

export async function markAllNotificationsRead() {
  return api.post('/api/me/notifications/read-all', {});
}

export async function fetchWatchHistory() {
  return api.get('/api/me/history');
}

export async function clearWatchHistory() {
  return api.delete('/api/me/history');
}

export async function removeHistoryItem(contentId) {
  return api.delete(`/api/me/history/${contentId}`);
}

export async function hideFromContinue(contentId) {
  return api.post(`/api/me/history/${contentId}/hide`, {});
}

export async function fetchMyPayments() {
  return api.get('/api/me/payments');
}

export async function fetchPaymentReceipt(transactionId, { html = false } = {}) {
  const qs = html ? '?format=html' : '';
  return api.get(`/api/payments/transactions/${transactionId}/receipt${qs}`);
}

export async function redeemPromo(code) {
  return api.post('/api/promos/redeem', { code });
}

export async function changePassword({ currentPassword, newPassword }) {
  return api.post('/api/auth/change-password', { currentPassword, newPassword });
}

export default {
  fetchNotifications,
  fetchUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  fetchWatchHistory,
  clearWatchHistory,
  removeHistoryItem,
  hideFromContinue,
  fetchMyPayments,
  fetchPaymentReceipt,
  redeemPromo,
  changePassword,
};
