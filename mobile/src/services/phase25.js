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

export function preloadGoogleIdentity() {
  return loadGoogleIdentity().catch(() => null);
}

function loadGoogleIdentity() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Login Google disponível no browser'));
      return;
    }
    if (window.google?.accounts?.oauth2) {
      resolve(window.google);
      return;
    }
    const existing = document.querySelector('script[data-minhatela-gis="1"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.google));
      existing.addEventListener('error', () => reject(new Error('Não foi possível carregar a Google')));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.dataset.minhatelaGis = '1';
    script.onload = () => resolve(window.google);
    script.onerror = () => reject(new Error('Não foi possível carregar a Google'));
    document.head.appendChild(script);
  });
}

/** Abre a janela oficial da Google e devolve um access token. */
export function requestGoogleAccessToken(clientId) {
  return loadGoogleIdentity().then(
    (google) =>
      new Promise((resolve, reject) => {
        if (!clientId) {
          reject(new Error('Login Google não configurado'));
          return;
        }
        const client = google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'openid email profile',
          prompt: 'select_account',
          callback: (response) => {
            if (response?.access_token) resolve(response.access_token);
            else reject(new Error(response?.error || 'Login Google cancelado'));
          },
          error_callback: (err) => reject(new Error(err?.message || 'Login Google cancelado')),
        });
        client.requestAccessToken();
      })
  );
}

export default {
  oauthLogin,
  preloadGoogleIdentity,
  fetchPaymentRisk,
  fetchEncodingQueue,
  updateEncoding,
  fetchScrub,
  requestGoogleAccessToken,
};
