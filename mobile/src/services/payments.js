import api, { getApiBaseUrl } from './api';

function makeIdempotencyKey() {
  return `chk_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function fetchPaymentMethods() {
  return api.get('/api/payments/methods');
}

export async function submitCheckout({ type, paymentMethod, videoId, packId, proof }) {
  const form = new FormData();
  form.append('type', type);
  form.append('paymentMethod', paymentMethod);
  if (videoId) form.append('videoId', videoId);
  if (packId) form.append('packId', packId);

  form.append('proof', {
    uri: proof.uri,
    name: proof.name || 'comprovativo.jpg',
    type: proof.mimeType || 'image/jpeg',
  });

  return api.post('/api/payments/checkout', form, {
    headers: {
      'Idempotency-Key': makeIdempotencyKey(),
    },
  });
}

export async function fetchMyTransactions() {
  return api.get('/api/payments/transactions');
}

export function resolveProofUrl(path) {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${getApiBaseUrl()}${path}`;
}

export default {
  fetchPaymentMethods,
  submitCheckout,
  fetchMyTransactions,
  resolveProofUrl,
};
