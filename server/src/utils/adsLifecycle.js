'use strict';

/**
 * Estado que o anunciante e o SuperAdmin devem ver.
 * Conta aberta ≠ no ar. Pagamento pendente ≠ anúncio a passar.
 */
function campaignLifecycle({
  status,
  funded,
  paymentStatus,
  transactionId,
} = {}) {
  const pay = String(paymentStatus || '').toLowerCase();
  const pendingPay =
    ['pendente', 'pending'].includes(pay) || (!funded && Boolean(transactionId));

  if (status === 'rejected') {
    return {
      id: 'rejected',
      label: 'Recusada',
      hint: 'Este anúncio não passa no catálogo.',
      canPay: false,
      onAir: false,
    };
  }
  if (status === 'paused') {
    return {
      id: 'paused',
      label: 'Pausada',
      hint: 'Fora do ar. O saldo deixa de gastar em novas sessões.',
      canPay: false,
      onAir: false,
    };
  }
  if (status === 'completed') {
    return {
      id: 'completed',
      label: 'Orçamento esgotado',
      hint: 'O saldo pago acabou. Já não entra em novas sessões.',
      canPay: false,
      onAir: false,
    };
  }
  if (status === 'active' && funded) {
    return {
      id: 'live',
      label: 'No ar',
      hint: 'Pago e aprovado. Passa antes dos filmes gratuitos.',
      canPay: false,
      onAir: true,
    };
  }
  if (!funded && pendingPay) {
    return {
      id: 'payment_review',
      label: 'Pagamento em análise',
      hint: 'Comprovativo ou WeFrame recebido. Ainda não passa no ecrã.',
      canPay: false,
      onAir: false,
    };
  }
  if (!funded) {
    return {
      id: 'awaiting_payment',
      label: 'Pagar orçamento',
      hint: 'IBAN com comprovativo ou Multicaixa Express. Sem pagamento confirmado o SuperAdmin não põe no ar.',
      canPay: true,
      onAir: false,
    };
  }
  return {
    id: 'creative_review',
    label: 'Em análise',
    hint: 'Orçamento pago. A MinhaTela confirma o anúncio antes de ir para o ar.',
    canPay: false,
    onAir: false,
  };
}

function portalStage(advertiser, campaigns = []) {
  if (!advertiser) {
    return {
      step: 1,
      of: 4,
      title: 'Conta aberta',
      body: 'Identifique a empresa ou o particular. Depois cria a campanha e paga o orçamento.',
    };
  }
  if (!campaigns.length) {
    return {
      step: 2,
      of: 4,
      title: 'Criar campanha',
      body: 'Vídeo, orçamento em Kwanza e datas. Criar não publica.',
    };
  }
  if (campaigns.some((c) => c.lifecycle?.id === 'awaiting_payment')) {
    return {
      step: 3,
      of: 4,
      title: 'Pagar orçamento',
      body: 'Transferência IBAN ou Multicaixa Express. Pendente não liberta o anúncio.',
    };
  }
  if (campaigns.some((c) => ['payment_review', 'creative_review'].includes(c.lifecycle?.id))) {
    return {
      step: 4,
      of: 4,
      title: 'Em análise',
      body: 'A MinhaTela confirma o pagamento e o anúncio. Só então entra no ar.',
    };
  }
  if (campaigns.some((c) => c.lifecycle?.id === 'live' || c.status === 'active')) {
    return {
      step: 4,
      of: 4,
      title: 'No ar',
      body: 'O público vê o anúncio antes dos filmes gratuitos. Só a visualização completa desce o saldo.',
    };
  }
  return {
    step: 4,
    of: 4,
    title: 'Campanhas',
    body: 'Pausada ou recusada não toca no catálogo.',
  };
}

module.exports = { campaignLifecycle, portalStage };
