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
  const hostedBuild = Boolean(process.env.VERCEL || process.env.EAS_BUILD || process.env.CI);
  const envIsRemote =
    Boolean(fromEnv) &&
    !/localhost|127\.0\.0\.1|api\.minhatela\.net/.test(fromEnv);

  const apiBaseUrl = envIsRemote
    ? fromEnv
    : hostedBuild
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
        googleClientId:
          process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ||
          '95844743288-j16f33j4dnhr992n45kkt9dn28c4jn20.apps.googleusercontent.com',
      },
    },
  };
};
