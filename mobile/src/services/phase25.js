import api from './api';

export async function oauthLogin(provider, body) {
  return api.post(`/api/auth/oauth/${provider}`, body);
}

export async function fetchPaymentRisk(minScore = 40) {
  return api.get(`/api/admin/payments/risk?minScore=${minScore}`);
}

export async function fetchEncodingQueue(status) {
  const q = status ? `?status=${encodeURIComponent(status)}` : '';
  return api.get(`/api/admin/encoding${q}`);
}

export async function updateEncoding(contentId, body) {
  return api.patch(`/api/admin/encoding/${contentId}`, body);
}

export async function fetchScrub(contentId) {
  return api.get(`/api/catalog/content/${contentId}/scrub`);
}

/** JWT demo para OAuth até integrar SDK nativo Google/Apple */
export function buildDemoOAuthToken({ provider, email, fullName, sub }) {
  const header = { alg: 'none', typ: 'JWT' };
  const payload = {
    sub: sub || `mt-${provider}-${email}`,
    email,
    name: fullName || email.split('@')[0],
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  const enc = (obj) =>
    typeof btoa === 'function'
      ? btoa(JSON.stringify(obj)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
      : Buffer.from(JSON.stringify(obj)).toString('base64url');
  return `${enc(header)}.${enc(payload)}.demo`;
}

export default {
  oauthLogin,
  fetchPaymentRisk,
  fetchEncodingQueue,
  updateEncoding,
  fetchScrub,
  buildDemoOAuthToken,
};
