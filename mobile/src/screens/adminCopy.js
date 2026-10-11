export const ROLE_LABELS = {
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

export const SUBSCRIPTION_LABELS = {
  none: 'Gratuito',
  premium_active: 'Premium',
  premium_expired: 'Premium expirado',
};

export const AUDIT_LABELS = {
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
  CAMPAIGN_APPROVED: 'Campanha aprovada',
  'mfa.enabled': 'Protecção extra activada',
  title_not_interested: 'Marcou «não me interessa»',
  USER_PROMOTED: 'Operador promovido',
  USER_DEMOTED: 'Operador removido',
  PREMIUM_GRANTED: 'Premium atribuído',
  PREMIUM_REVOKED: 'Premium revogado',
};

export const ENTITY_LABELS = {
  user: 'Pessoa',
  transaction: 'Pagamento',
  video: 'Título',
  creator: 'Criador',
  campaign: 'Campanha',
  tenant: 'Mercado',
  feature_flag: 'Funcionalidade',
};

export function roleLabel(code) {
  if (!code) return '';
  return ROLE_LABELS[code] || String(code).replace(/_/g, ' ');
}

export function subscriptionLabel(status) {
  if (!status || status === 'none') return SUBSCRIPTION_LABELS.none;
  return SUBSCRIPTION_LABELS[status] || status;
}

export function auditTitle(action) {
  if (!action) return 'Actividade';
  if (AUDIT_LABELS[action]) return AUDIT_LABELS[action];
  return String(action).replace(/_/g, ' ').replace(/\./g, ' · ');
}

export function entityLabel(entity) {
  return ENTITY_LABELS[entity] || entity || '';
}

export function uniqueRoleLabels(user) {
  const roles = user?.roles || [];
  const out = [];
  const seen = new Set();
  if (user?.isAdmin && !roles.includes('admin') && !roles.includes('super_admin')) {
    out.push('Operador');
    seen.add('admin');
  }
  for (const r of roles) {
    if (r === 'customer' && roles.length > 1) continue;
    const label = roleLabel(r);
    if (!label || seen.has(label)) continue;
    seen.add(label);
    out.push(label);
  }
  return out;
}
