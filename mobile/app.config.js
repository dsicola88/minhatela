const appJson = require('./app.json');

/**
 * Config dinâmica — Vercel/EAS injectam EXPO_PUBLIC_* no build.
 * `extra.apiBaseUrl` reflecte a URL pública da API (Railway).
 *
 * IMPORTANTE: nunca deixar localhost em builds de produção/preview.
 * API estável actual: https://minhatela-production.up.railway.app
 * (api.minhatela.net ainda sem DNS)
 */
const PRODUCTION_API = 'https://minhatela-production.up.railway.app';

module.exports = () => {
  const expo = appJson.expo;
  const fromEnv =
    process.env.EXPO_PUBLIC_API_BASE_URL || process.env.API_BASE_URL || '';
  const fromExtra = expo.extra?.apiBaseUrl || '';
  const looksLocal =
    !fromEnv ||
    fromEnv.includes('localhost') ||
    fromEnv.includes('127.0.0.1') ||
    fromEnv.includes('api.minhatela.net'); // DNS ainda down — evita NetworkError

  const apiBaseUrl = !looksLocal
    ? fromEnv
    : fromExtra && !/localhost|127\.0\.0\.1/.test(fromExtra)
      ? fromExtra
      : process.env.NODE_ENV === 'production' || process.env.VERCEL
        ? PRODUCTION_API
        : 'http://localhost:4000';

  const appPublicUrl =
    process.env.EXPO_PUBLIC_APP_PUBLIC_URL ||
    process.env.APP_PUBLIC_URL ||
    (process.env.NODE_ENV === 'production' || process.env.VERCEL
      ? 'https://minhatela.vercel.app'
      : 'http://localhost:8081');

  return {
    expo: {
      ...expo,
      extra: {
        ...expo.extra,
        apiBaseUrl,
        appPublicUrl,
      },
    },
  };
};
