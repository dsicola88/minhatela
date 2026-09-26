'use strict';

const path = require('path');
const fs = require('fs');

const envCandidates = [
  path.resolve(__dirname, '../../../.env'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../.env'),
];

for (const candidate of envCandidates) {
  if (fs.existsSync(candidate)) {
    require('dotenv').config({ path: candidate });
    break;
  }
}

const required = ['DATABASE_URL', 'JWT_SECRET'];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

function parseCorsOrigin(value) {
  if (value == null || value === '' || value === 'true') return true;
  if (value === 'false') return false;
  if (String(value).includes(',')) {
    return String(value)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return value;
}

const env = Object.freeze({
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  // Railway injeta PORT; local usa API_PORT
  port: Number(process.env.PORT || process.env.API_PORT || 4000),
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
  refreshTokenDays: Number(process.env.REFRESH_TOKEN_DAYS || 30),
  appPublicUrl: process.env.APP_PUBLIC_URL || 'http://localhost:8081',
  corsOrigin: parseCorsOrigin(process.env.CORS_ORIGIN),
  premiumPriceKz: Number(process.env.PREMIUM_PRICE_KZ || 4990),
  tvodDefaultPriceKz: Number(process.env.TVOD_DEFAULT_PRICE_KZ || 1500),
  tvodRentalHours: Number(process.env.TVOD_RENTAL_HOURS || 48),
  playbackTtlSeconds: Number(process.env.PLAYBACK_TTL_SECONDS || 14400),
  maxConcurrentStreamsFree: Number(process.env.MAX_CONCURRENT_STREAMS_FREE || 1),
  maxConcurrentStreamsPremium: Number(process.env.MAX_CONCURRENT_STREAMS_PREMIUM || 2),
  streamHeartbeatTtlSeconds: Number(process.env.STREAM_HEARTBEAT_TTL_SECONDS || 90),
  bunny: Object.freeze({
    libraryId: process.env.BUNNY_LIBRARY_ID || '',
    apiKey: process.env.BUNNY_API_KEY || '',
    cdnHostname: process.env.BUNNY_CDN_HOSTNAME || '',
    embedBaseUrl:
      process.env.BUNNY_EMBED_BASE_URL || 'https://iframe.mediadelivery.net/embed',
    tokenAuthKey: process.env.BUNNY_TOKEN_AUTH_KEY || '',
    requireToken: process.env.BUNNY_REQUIRE_TOKEN === 'true',
    tokenAuthWithIp: process.env.BUNNY_TOKEN_AUTH_WITH_IP === 'true',
  }),
  payments: Object.freeze({
    iban: process.env.PLATFORM_IBAN || '',
    bankName: process.env.PLATFORM_BANK_NAME || 'Banco Atlântico',
    accountName: process.env.PLATFORM_ACCOUNT_NAME || 'MinhaTela Lda',
    multicaixaRef: process.env.PLATFORM_MULTICAIXA_REF || null,
  }),
  uploadsDir: path.resolve(__dirname, '../../uploads'),
  oauth: Object.freeze({
    googleClientId: process.env.GOOGLE_CLIENT_ID || '',
    appleClientId: process.env.APPLE_CLIENT_ID || '',
  }),
});

module.exports = { env };
