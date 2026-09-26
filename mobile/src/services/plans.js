import api from './api';

export async function fetchPlans() {
  return api.get('/api/plans');
}

export async function registerPushToken({ token, platform }) {
  return api.post('/api/push/register', { token, platform });
}

export async function unregisterPushToken(token) {
  return api.delete('/api/push/register', { body: JSON.stringify({ token }) });
}

export async function verifyEmail(token) {
  return api.post('/api/auth/verify-email', { token });
}

export async function resendVerification() {
  return api.post('/api/auth/resend-verification', {});
}

export default {
  fetchPlans,
  registerPushToken,
  unregisterPushToken,
  verifyEmail,
  resendVerification,
};
