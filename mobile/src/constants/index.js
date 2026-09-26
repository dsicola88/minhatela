import { colors, brand, layout } from '../theme/tokens';

export const MONETIZATION = Object.freeze({
  AVOD: 'avod',
  SVOD: 'svod',
  TVOD: 'tvod',
});

export const SUBSCRIPTION_STATUS = Object.freeze({
  NONE: 'none',
  PREMIUM_ACTIVE: 'premium_active',
  PREMIUM_EXPIRED: 'premium_expired',
});

export const TRANSACTION_STATUS = Object.freeze({
  PENDING: 'pendente',
  PAID: 'pago',
  REJECTED: 'rejeitado',
  EXPIRED: 'expirado',
});

export const PAYMENT_METHODS = Object.freeze({
  IBAN: 'iban',
  MULTICAIXA: 'multicaixa',
});

export const PLAYER = Object.freeze({
  DEFAULT_QUALITY: '480p',
  ALLOWED_START_QUALITIES: ['auto', '480p'],
  FORCE_HIGH_ON_START: false,
});

export const TVOD_RENTAL_HOURS = 48;

export const PREMIUM_PRICE_KZ = 4990;

export const CATEGORIES = Object.freeze([
  { id: 'cinema-angolano', title: 'Cinema Angolano' },
  { id: 'web-series', title: 'Web-séries' },
  { id: 'humor', title: 'Humor' },
  { id: 'documentarios', title: 'Documentários' },
  { id: 'destaques', title: 'Em Destaque' },
]);

export { colors, brand, layout };
