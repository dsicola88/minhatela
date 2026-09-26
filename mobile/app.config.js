const appJson = require('./app.json');

/**
 * Config dinâmica — Vercel/EAS injectam EXPO_PUBLIC_* no build.
 * `extra.apiBaseUrl` reflecte a URL pública da API (Railway).
 */
module.exports = () => {
  const expo = appJson.expo;
  const apiBaseUrl =
    process.env.EXPO_PUBLIC_API_BASE_URL ||
    process.env.API_BASE_URL ||
    expo.extra?.apiBaseUrl ||
    'http://localhost:4000';

  const appPublicUrl =
    process.env.EXPO_PUBLIC_APP_PUBLIC_URL ||
    process.env.APP_PUBLIC_URL ||
    'http://localhost:8081';

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
