'use strict';

const crypto = require('crypto');
const { env } = require('../config/env');
const { createError } = require('../utils/errors');
const transactionRepository = require('../repositories/transactionRepository');
const { STATUS, toApiStatus } = require('../utils/transactionStatus');

function apiPublicBase() {
  const fallback = env.isProd ? 'https://api.minhatela.net' : `http://localhost:${env.port}`;
  return String(process.env.API_BASE_URL || fallback).replace(/\/$/, '');
}

function weframeCfg() {
  return env.payments.weframe;
}

function hasTags() {
  const w = weframeCfg();
  return Boolean(w.src || w.snippet);
}

function isEnabled() {
  return weframeCfg().enabled !== false;
}

function publicStatus() {
  const tags = hasTags();
  return {
    id: 'weframe',
    enabled: isEnabled(),
    live: Boolean(isEnabled() && tags),
    checkoutPath: '/pay/weframe',
    note: tags
      ? 'Checkout Multicaixa Express embutido (WeFrame).'
      : 'Página de checkout pronta para a EMIS certificar. Cole o token ou as tags no Railway.',
  };
}

function signSession({ transactionId, userId, amountKz }) {
  const exp = Math.floor(Date.now() / 1000) + 6 * 3600;
  const payload = Buffer.from(
    JSON.stringify({ tx: transactionId, uid: userId, kz: amountKz, exp }),
    'utf8'
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', env.jwtSecret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function readSession(token) {
  const raw = String(token || '');
  const [payload, sig] = raw.split('.');
  if (!payload || !sig) throw createError(400, 'Sessão de pagamento inválida', 'WEFRAME_SESSION');
  const expected = crypto.createHmac('sha256', env.jwtSecret).update(payload).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw createError(400, 'Sessão de pagamento inválida', 'WEFRAME_SESSION');
  }
  let data;
  try {
    data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    throw createError(400, 'Sessão de pagamento inválida', 'WEFRAME_SESSION');
  }
  if (!data.exp || data.exp < Math.floor(Date.now() / 1000)) {
    throw createError(410, 'Sessão de pagamento expirou. Volte ao checkout.', 'WEFRAME_EXPIRED');
  }
  return data;
}

function fillTemplate(template, vars) {
  let out = String(template || '');
  for (const [key, value] of Object.entries(vars)) {
    out = out.split(`{{${key}}}`).join(String(value ?? ''));
  }
  return out;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function frameAncestorsHeader() {
  const extras = [
    env.appPublicUrl,
    'https://minhatela.net',
    'https://www.minhatela.net',
    'https://minhatela.ao',
    'https://www.minhatela.ao',
    'https://minhatela.vercel.app',
    'http://localhost:8081',
    'http://127.0.0.1:8081',
  ]
    .map((u) => String(u || '').replace(/\/$/, ''))
    .filter(Boolean);
  return `'self' ${[...new Set(extras)].join(' ')}`;
}

function applyWeframeHeaders(res) {
  res.removeHeader('X-Frame-Options');
  let frameSrc = 'https:';
  try {
    if (weframeCfg().src) frameSrc = new URL(weframeCfg().src.split('?')[0]).origin;
  } catch {
    frameSrc = 'https:';
  }
  res.setHeader(
    'Content-Security-Policy',
    [
      `default-src 'self'`,
      `frame-ancestors ${frameAncestorsHeader()}`,
      `frame-src 'self' https: http: ${frameSrc}`,
      `script-src 'self' 'unsafe-inline' https:`,
      `style-src 'self' 'unsafe-inline'`,
      `img-src 'self' data: https:`,
      `connect-src 'self' https:`,
    ].join('; ')
  );
}

function renderInner({ amountKz, reference, callbackUrl, returnUrl }) {
  const w = weframeCfg();
  const vars = {
    amount: amountKz,
    amountKz,
    reference,
    callback: callbackUrl,
    callbackUrl,
    returnUrl,
    token: w.token,
    merchant: w.merchantId,
    currency: 'AOA',
  };

  if (w.snippet) {
    return fillTemplate(w.snippet, vars);
  }
  if (w.src) {
    const src = fillTemplate(w.src, vars);
    return `<iframe title="Multicaixa Express" src="${escapeHtml(src)}" allow="payment *" style="width:100%;min-height:480px;border:0;border-radius:8px;background:#111"></iframe>`;
  }
  return `
    <div class="wait">
      <p class="kicker">Página de certificação EMIS · WeFrame / iFrame</p>
      <h2>Multicaixa Express</h2>
      <p>Esta é a página HTTPS que o banco e a EMIS certificam. Quando entregarem o <strong>token</strong> ou as <strong>tags</strong>, o terminal virtual aparece aqui — o cliente confirma no MCX Express (telemóvel ou QR).</p>
      <dl>
        <dt>Referência MinhaTela</dt><dd>${escapeHtml(reference || '—')}</dd>
        <dt>Valor</dt><dd>${escapeHtml(amountKz ? `${Number(amountKz).toLocaleString('pt-AO')} Kz` : '—')}</dd>
        <dt>Notificação</dt><dd>${escapeHtml(callbackUrl)}</dd>
      </dl>
      <p class="hint">No formulário GPO escolha integração <strong>iFrame (WeFrame)</strong>. Cole no Railway: EMIS_WEFRAME_TOKEN ou EMIS_WEFRAME_SNIPPET ou EMIS_WEFRAME_SRC.</p>
    </div>`;
}

function renderPage({ amountKz, reference, callbackUrl, returnUrl }) {
  const inner = renderInner({ amountKz, reference, callbackUrl, returnUrl });
  return `<!doctype html>
<html lang="pt">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Pagar · MinhaTela · Multicaixa Express</title>
  <!-- MinhaTela WeFrame GPO host -->
  <style>
    :root { color-scheme: dark; }
    body { margin:0; font-family: ui-sans-serif, system-ui, sans-serif; background:#0b0b0b; color:#f5f5f5; }
    .wrap { max-width:560px; margin:0 auto; padding:20px 16px 40px; }
    .brand { color:#c9a227; font-weight:800; letter-spacing:.08em; font-size:12px; text-transform:uppercase; }
    h1 { font-size:22px; margin:8px 0 16px; }
    .wait { background:#161616; border:1px solid #2a2a2a; border-radius:10px; padding:20px; line-height:1.5; }
    .kicker { color:#c9a227; font-size:12px; font-weight:700; }
    dl { display:grid; grid-template-columns: 140px 1fr; gap:6px 12px; font-size:14px; }
    dt { color:#9a9a9a; } dd { margin:0; }
    .hint { color:#9a9a9a; font-size:13px; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="brand">MinhaTela</div>
    <h1>Checkout Multicaixa Express</h1>
    ${inner}
  </div>
  <script>
    function ping(payload) {
      try {
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify(payload));
        }
        if (window.parent && window.parent !== window) {
          window.parent.postMessage(payload, '*');
        }
      } catch (e) {}
    }
    window.addEventListener('message', function (ev) {
      ping({ source: 'emis-weframe', data: ev.data });
    });
    (function () {
      var q = new URLSearchParams(location.search);
      var st = (q.get('status') || q.get('result') || '').toLowerCase();
      if (['paid','pago','success','accepted','ok'].indexOf(st) >= 0) {
        ping({ source: 'emis-weframe', paid: true });
      }
    })();
  </script>
</body>
</html>`;
}

async function renderFromQuery(req, res) {
  applyWeframeHeaders(res);
  const callbackUrl = `${apiPublicBase()}/webhooks/payments/emis`;
  const returnUrl = `${String(env.appPublicUrl).replace(/\/$/, '')}/checkout`;
  const token = req.query.s;
  if (!token) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(
      renderPage({
        amountKz: null,
        reference: null,
        callbackUrl,
        returnUrl,
      })
    );
  }
  const session = readSession(token);
  const tx = await transactionRepository.findById(session.tx);
  if (!tx || tx.user_id !== session.uid) {
    throw createError(404, 'Pagamento não encontrado', 'NOT_FOUND');
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.send(
    renderPage({
      amountKz: tx.amount_kz,
      reference: tx.id,
      callbackUrl,
      returnUrl,
    })
  );
}

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

function looksPaid(body) {
  const s = String(
    body.status || body.state || body.result || body.payment_status || body.code || ''
  ).toLowerCase();
  return ['paid', 'pago', 'success', 'accepted', 'approved', '00'].includes(s);
}

function extractReference(body) {
  const nested = body.data && typeof body.data === 'object' ? body.data : {};
  const meta = body.metadata && typeof body.metadata === 'object' ? body.metadata : {};
  const candidates = [
    body.merchant_reference,
    body.merchantReference,
    body.referencia,
    body.reference,
    nested.merchant_reference,
    nested.reference,
    meta.reference,
    body.orderId,
    body.order_id,
    body.transactionId,
  ];
  for (const c of candidates) {
    const m = String(c || '').match(UUID_RE);
    if (m) return m[0];
  }
  return null;
}

async function tryApplyPaid(body) {
  if (!looksPaid(body || {})) return { applied: false, reason: 'not_paid_event' };
  const ref = extractReference(body);
  if (!ref) {
    return { applied: false, reason: 'no_minhatela_reference' };
  }
  const tx = await transactionRepository.findById(ref);
  if (!tx) return { applied: false, reason: 'tx_missing' };
  if (tx.payment_method !== 'weframe') {
    return { applied: false, reason: 'not_weframe', transactionId: tx.id };
  }
  if (tx.status === STATUS.PAID) return { applied: false, reason: 'already_paid', transactionId: tx.id };
  if (tx.status !== STATUS.PENDING) return { applied: false, reason: 'not_pending', transactionId: tx.id };

  const updated = await transactionRepository.updateStatus(tx.id, STATUS.PAID, 'WeFrame / GPO EMIS', {
    fromStatus: STATUS.PENDING,
  });
  if (!updated) return { applied: false, reason: 'race', transactionId: tx.id };

  try {
    await require('../repositories/phase23Repository').ensureInvoiceFromTransaction(updated);
  } catch {
    /* invoice optional */
  }

  try {
    const user = await require('../repositories/userRepository').findById(updated.user_id);
    if (user) {
      await require('./notificationService').notifyPaymentReviewed(user, updated, true);
    }
  } catch {
    /* notify best-effort */
  }

  try {
    await require('../repositories/auditRepository').write({
      actorId: null,
      action: 'PAYMENT_APPROVED',
      entity: 'transaction',
      entityId: updated.id,
      metadata: { source: 'emis_weframe_webhook' },
    });
  } catch {
    /* audit best-effort */
  }

  return {
    applied: true,
    transactionId: updated.id,
    status: toApiStatus(updated.status),
  };
}

module.exports = {
  isEnabled,
  hasTags,
  publicStatus,
  signSession,
  readSession,
  apiPublicBase,
  renderFromQuery,
  tryApplyPaid,
  applyWeframeHeaders,
};
