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

const CREATOR_TYPE_LABELS = {
  creator: 'Criador',
  filmmaker: 'Cineasta',
  producer: 'Produtor',
  production_company: 'Produtora',
};

const WORKFLOW_LABELS = {
  draft: 'Rascunho',
  submitted: 'Na equipa',
  under_review: 'Em revisão',
  approved: 'Aprovado',
  published: 'No catálogo',
  rejected: 'Recusado',
  archived: 'Arquivado',
  pending: 'À espera da equipa',
  active: 'Activo',
  suspended: 'Suspenso',
};

const MONETIZATION_LABELS = {
  avod: 'Gratuito com anúncios',
  svod: 'Premium',
  tvod: 'Aluguer',
};

const CAMPAIGN_STATUS_LABELS = {
  draft: 'Rascunho',
  pending_review: 'À espera da MinhaTela',
  active: 'No ar',
  paused: 'Pausada',
  completed: 'Orçamento esgotado',
  rejected: 'Recusada',
};

const PLACEMENT_LABELS = {
  pre_roll: 'Antes do filme',
  mid_roll: 'A meio do filme',
  post_roll: 'Depois do filme',
  banner: 'Faixa',
  sponsored: 'Patrocínio',
};

const AUDIT_LABELS = {
  PAYMENT_APPROVED: 'Pagamento confirmado',
  PAYMENT_REJECTED: 'Pagamento recusado',
  PAYMENT_REFUNDED: 'Pagamento reembolsado',
  CREATOR_APPROVED: 'Criador aprovado',
  CREATOR_REJECTED: 'Criador recusado',
  CONTENT_PUBLISHED: 'Título no catálogo',
  CONTENT_REJECTED: 'Título recusado',
  CONTENT_SUBMITTED: 'Título enviado à equipa',
  CREATOR_PAYOUT_REQUESTED: 'Levantamento pedido',
  CREATOR_PAYOUT_PAID: 'Levantamento pago',
  CREATOR_PAYOUT_REJECTED: 'Levantamento recusado',
  BUNNY_VIDEO_CREATED: 'Ficha de vídeo criada',
  CAMPAIGN_APPROVED: 'Anúncio no ar',
  CAMPAIGN_REJECTED: 'Anúncio recusado',
  CAMPAIGN_PAUSED: 'Anúncio pausado',
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

function creatorTypeLabel(type) {
  return CREATOR_TYPE_LABELS[type] || type || 'Criador';
}

function workflowLabel(status) {
  return WORKFLOW_LABELS[status] || status || '';
}

function monetizationLabel(code) {
  return MONETIZATION_LABELS[code] || String(code || '').toUpperCase();
}

function campaignStatusLabel(status) {
  return CAMPAIGN_STATUS_LABELS[status] || status || '';
}

function placementLabel(code) {
  return PLACEMENT_LABELS[code] || code || '';
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
  CREATOR_TYPE_LABELS,
  WORKFLOW_LABELS,
  MONETIZATION_LABELS,
  CAMPAIGN_STATUS_LABELS,
  PLACEMENT_LABELS,
  roleLabel,
  subscriptionLabel,
  auditTitle,
  entityLabel,
  creatorTypeLabel,
  workflowLabel,
  monetizationLabel,
  campaignStatusLabel,
  placementLabel,
  isLabEmail,
};
