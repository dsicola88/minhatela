'use strict';

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatKz(amount) {
  return `${Number(amount || 0).toLocaleString('pt-AO')} Kz`;
}

function renderReceiptHtml(receipt) {
  const title = escapeHtml(receipt.title);
  const rows = [
    ['Recibo', escapeHtml(receipt.receiptNumber)],
    ['Data', escapeHtml(receipt.paidAt || receipt.createdAt)],
    ['Cliente', escapeHtml(receipt.customerName)],
    ['Email', escapeHtml(receipt.customerEmail)],
    ['Tipo', escapeHtml(receipt.typeLabel)],
    ['Método', escapeHtml(receipt.paymentMethod)],
    ['Conteúdo', escapeHtml(receipt.contentTitle || '—')],
    ['Valor', escapeHtml(formatKz(receipt.amountKz))],
    ['Estado', escapeHtml(receipt.statusLabel)],
  ]
    .map(
      ([k, v]) =>
        `<tr><td style="color:#8C8C8C;padding:8px 0;border-bottom:1px solid #2A2A2A">${k}</td><td style="text-align:right;padding:8px 0;border-bottom:1px solid #2A2A2A;font-weight:600">${v}</td></tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${title}</title>
  <style>
    body{margin:0;background:#000;color:#fff;font-family:system-ui,sans-serif}
    .wrap{max-width:520px;margin:0 auto;padding:40px 20px}
    .brand{color:#CE1126;font-weight:800;letter-spacing:2px;font-size:14px}
    h1{font-size:1.4rem;border-left:4px solid #F7D417;padding-left:12px}
    table{width:100%;border-collapse:collapse;margin-top:24px}
    .foot{margin-top:32px;color:#8C8C8C;font-size:12px;line-height:1.5}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="brand">MINHATELA</div>
    <h1>${title}</h1>
    <p style="color:#B3B3B3">Comprovativo de pagamento · Mercado AO · Kwanzas</p>
    <table>${rows}</table>
    <div class="foot">
      MinhaTela Lda · Luanda, Angola<br/>
      Este documento confirma o registo do pagamento na plataforma.
      IBAN/Multicaixa sujeitos a confirmação administrativa.
    </div>
  </div>
</body>
</html>`;
}

module.exports = { renderReceiptHtml, escapeHtml, formatKz };
