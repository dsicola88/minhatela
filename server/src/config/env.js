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

function normalizeOrigin(value) {
  return String(value || '')
    .trim()
    .replace(/\/$/, '');
}

function productionCorsAllowlist() {
  const extras = String(process.env.CORS_ORIGIN || '')
    .split(',')
    .map(normalizeOrigin)
    .filter(Boolean);
  return [
    ...extras,
    normalizeOrigin(process.env.APP_PUBLIC_URL),
    'https://minhatela.net',
    'https://www.minhatela.net',
    'https://minhatela.ao',
    'https://www.minhatela.ao',
    'https://minhatela.vercel.app',
  ].filter(Boolean);
}

function parseCorsOrigin(value) {
  const isProd = process.env.NODE_ENV === 'production';
  if (value === 'false') return false;

  const listed = String(value == null || value === 'true' ? '' : value)
    .split(',')
    .map(normalizeOrigin)
    .filter(Boolean);

  if (!isProd) {
    if (listed.length === 0) return true;
    return function corsOriginCheck(origin, callback) {
      if (!origin) return callback(null, true);
      return callback(null, listed.includes(normalizeOrigin(origin)) ? origin : false);
    };
  }

  const allowed = listed.length ? listed : productionCorsAllowlist();
  return function corsOriginCheck(origin, callback) {
    if (!origin) return callback(null, true);
    const n = normalizeOrigin(origin);
    return callback(null, allowed.includes(n) ? origin : false);
  };
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
    drmEnabled: process.env.BUNNY_DRM_ENABLED === 'true',
    webhookSecret: process.env.BUNNY_WEBHOOK_SECRET || '',
  }),
  payments: Object.freeze({
    iban: process.env.PLATFORM_IBAN || '',
    bankName: process.env.PLATFORM_BANK_NAME || 'Banco Atlântico',
    accountName: process.env.PLATFORM_ACCOUNT_NAME || 'MinhaTela Lda',
    multicaixaRef: process.env.PLATFORM_MULTICAIXA_REF || null,
    pspProvider: String(process.env.PSP_PROVIDER || '').toLowerCase(),
    pspApiBaseUrl: process.env.PSP_API_BASE_URL || '',
    pspApiKey: process.env.PSP_API_KEY || '',
    pspWebhookSecret: process.env.PSP_WEBHOOK_SECRET || '',
  }),
  uploadsDir: path.resolve(__dirname, '../../uploads'),
  oauth: Object.freeze({
    googleClientId:
      process.env.GOOGLE_CLIENT_ID || process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '',
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    appleClientId: process.env.APPLE_CLIENT_ID || '',
  }),
  smtp: Object.freeze({
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'MinhaTela <noreply@minhatela.net>',
    replyTo: process.env.SMTP_REPLY_TO || process.env.MAIL_SUPPORT || '',
    supportEmail: process.env.MAIL_SUPPORT || 'support@minhatela.net',
    contactEmail: process.env.MAIL_CONTACT || 'contato@minhatela.net',
  }),
  creatorViewKz: Number(process.env.CREATOR_VIEW_KZ || 2),
  adCpmKz: Number(process.env.AD_CPM_KZ || 5000),
  creatorAdShareBps: Number(process.env.CREATOR_AD_SHARE_BPS || 3000),
  market: Object.freeze({
    country: process.env.MARKET_COUNTRY || 'AO',
    timezone: process.env.MARKET_TIMEZONE || 'Africa/Luanda',
    locale: process.env.MARKET_LOCALE || 'pt-AO',
    primaryDomain: process.env.PRIMARY_DOMAIN || 'minhatela.net',
    secondaryDomain: process.env.SECONDARY_DOMAIN || 'minhatela.ao',
  }),
});

module.exports = { env, parseCorsOrigin };
