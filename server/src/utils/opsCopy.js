'use strict';

const ROLE_LABELS = {
  super_admin: 'SuperAdmin',
  admin: 'Operador',
  moderator: 'Moderação',
  content_manager: 'Catálogo',
  finance_manager: 'Financeiro',
  support_agent: 'Atendimento',
  creator: 'Criador',
  customer: 'Assinante',
  advertiser: 'Anunciante',
  producer: 'Produtora',
  production_owner: 'Produtora',
  production_manager: 'Produtora',
  production_editor: 'Produtora',
  production_finance: 'Produtora',
};

const SUBSCRIPTION_LABELS = {
  none: 'Gratuito',
  premium_active: 'Premium',
  premium_expired: 'Premium expirado',
};

const ENTITY_LABELS = {
  user: 'Pessoa',
  transaction: 'Pagamento',
  video: 'Título',
  creator: 'Criador',
  campaign: 'Campanha',
  tenant: 'Mercado',
  feature_flag: 'Funcionalidade',
};

const AUDIT_LABELS = {
  PAYMENT_APPROVED: 'Pagamento confirmado',
  PAYMENT_REJECTED: 'Pagamento recusado',
  PAYMENT_REFUNDED: 'Pagamento reembolsado',
  CREATOR_APPROVED: 'Criador aprovado',
  CREATOR_REJECTED: 'Criador recusado',
  CONTENT_PUBLISHED: 'Título publicado',
  CAMPAIGN_APPROVED: 'Campanha aprovada',
  'mfa.enabled': 'Protecção extra activada',
  title_not_interested: 'Marcou «não me interessa»',
  USER_PROMOTED: 'Operador promovido',
  USER_DEMOTED: 'Operador removido',
  PREMIUM_GRANTED: 'Premium atribuído',
  PREMIUM_REVOKED: 'Premium revogado',
};

function roleLabel(code) {
  if (!code) return '';
  return ROLE_LABELS[code] || String(code).replace(/_/g, ' ');
}

function subscriptionLabel(status) {
  if (!status || status === 'none') return SUBSCRIPTION_LABELS.none;
  return SUBSCRIPTION_LABELS[status] || status;
}

function auditTitle(action) {
  if (!action) return 'Actividade';
  if (AUDIT_LABELS[action]) return AUDIT_LABELS[action];
  return String(action)
    .replace(/_/g, ' ')
    .replace(/\./g, ' · ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function entityLabel(entity) {
  return ENTITY_LABELS[entity] || entity || '';
}

function isLabEmail(email) {
  const e = String(email || '').toLowerCase();
  return (
    e.endsWith('@minhatela.test') ||
    e.includes('.e2e.') ||
    e.includes('e2e_') ||
    e.startsWith('fluxo.')
  );
}

module.exports = {
  ROLE_LABELS,
  SUBSCRIPTION_LABELS,
  AUDIT_LABELS,
  roleLabel,
  subscriptionLabel,
  auditTitle,
  entityLabel,
  isLabEmail,
};
