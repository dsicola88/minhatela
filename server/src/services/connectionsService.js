'use strict';

const { env } = require('../config/env');
const paymentPsp = require('./paymentPspService');

function item({ id, title, ready, you, partner, envKeys, webhook }) {
  return {
    id,
    title,
    ready: Boolean(ready),
    status: ready ? 'ligado' : 'à espera',
    you,
    partner,
    envKeys,
    webhook: webhook || null,
  };
}

function list() {
  const webhookBase = String(process.env.API_BASE_URL || 'https://api.minhatela.net').replace(
    /\/$/,
    ''
  );
  const api = webhookBase;

  return {
    items: [
      item({
        id: 'smtp',
        title: 'Email (reset e recibos)',
        ready: Boolean(env.smtp.host),
        you: 'Criar caixa noreply@minhatela.net e colar SMTP_* no Railway.',
        partner: 'Resend, Mailgun, SES ou SMTP do registo de domínio.',
        envKeys: ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'],
      }),
      item({
        id: 'google',
        title: 'Entrar com Google',
        ready: Boolean(env.oauth.googleClientId),
        you: 'Google Cloud → OAuth client web. No Vercel: EXPO_PUBLIC_GOOGLE_CLIENT_ID. No Railway: GOOGLE_CLIENT_ID.',
        partner: 'Google Cloud Console.',
        envKeys: ['GOOGLE_CLIENT_ID', 'EXPO_PUBLIC_GOOGLE_CLIENT_ID'],
      }),
      item({
        id: 'apple',
        title: 'Entrar com Apple',
        ready: Boolean(env.oauth.appleClientId),
        you: 'Apple Developer → Services ID / App ID. Railway: APPLE_CLIENT_ID.',
        partner: 'Apple Developer Program.',
        envKeys: ['APPLE_CLIENT_ID'],
      }),
      item({
        id: 'bunny',
        title: 'Vídeo (biblioteca e rede)',
        ready: Boolean(env.bunny.libraryId && env.bunny.apiKey),
        you: 'Library ID + API key já no Railway. Token Auth e webhook no painel Bunny.',
        partner: 'Bunny.net Stream.',
        envKeys: ['BUNNY_LIBRARY_ID', 'BUNNY_API_KEY', 'BUNNY_CDN_HOSTNAME', 'BUNNY_TOKEN_AUTH_KEY', 'BUNNY_WEBHOOK_SECRET'],
        webhook: `${webhookBase}/webhooks/bunny`,
      }),
      item({
        id: 'drm',
        title: 'Protecção de ecrã (DRM)',
        ready: Boolean(env.bunny.drmEnabled),
        you: 'Depois de activar DRM no Bunny, pôr BUNNY_DRM_ENABLED=true no Railway.',
        partner: 'Bunny Stream DRM (Widevine / FairPlay).',
        envKeys: ['BUNNY_DRM_ENABLED'],
      }),
      item({
        id: 'iban',
        title: 'IBAN / comprovativo',
        ready: Boolean(env.payments.iban),
        you: 'Conta da MinhaTela Lda e PLATFORM_IBAN no Railway. Já opera na consola.',
        partner: 'O vosso banco.',
        envKeys: ['PLATFORM_IBAN', 'PLATFORM_BANK_NAME', 'PLATFORM_MULTICAIXA_REF'],
      }),
      item({
        id: 'psp',
        title: 'Pagamento instantâneo (Multicaixa Express)',
        ready: paymentPsp.isConfigured(),
        you: 'Quando tiverem API do prestador: PSP_PROVIDER + PSP_API_KEY + PSP_WEBHOOK_SECRET.',
        partner: 'AppyPay, EMIS, ProxyPay ou o PSP que escolherem.',
        envKeys: ['PSP_PROVIDER', 'PSP_API_BASE_URL', 'PSP_API_KEY', 'PSP_WEBHOOK_SECRET'],
        webhook: `${webhookBase}/webhooks/payments/{provider}`,
      }),
      item({
        id: 'stores',
        title: 'App Store / Google Play / TV',
        ready: Boolean(process.env.EXPO_PUBLIC_EAS_PROJECT_ID),
        you: 'eas login && eas init. Colar EXPO_PUBLIC_EAS_PROJECT_ID no EAS e no Vercel.',
        partner: 'Apple Developer, Google Play Console, Expo EAS.',
        envKeys: ['EXPO_PUBLIC_EAS_PROJECT_ID'],
      }),
    ],
    docs: '/docs/integracoes.md',
    publicApi: api,
  };
}

module.exports = { list };
