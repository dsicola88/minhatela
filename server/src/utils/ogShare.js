'use strict';

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderShareOgHtml(card) {
  const title = escapeHtml(`${card.title} · MinhaTela`);
  const description = escapeHtml(card.synopsis || 'Assista na MinhaTela — cinema e séries de Angola.');
  const image = escapeHtml(card.backdropUrl || card.posterUrl || '');
  const url = escapeHtml(card.shareUrl);
  const appUrl = escapeHtml(card.shareUrl);

  return `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <meta name="description" content="${description}" />
  <meta property="og:type" content="video.other" />
  <meta property="og:site_name" content="MinhaTela" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:url" content="${url}" />
  ${image ? `<meta property="og:image" content="${image}" />` : ''}
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  ${image ? `<meta name="twitter:image" content="${image}" />` : ''}
  <meta http-equiv="refresh" content="0;url=${appUrl}" />
  <style>
    body{margin:0;background:#000;color:#fff;font-family:system-ui,sans-serif;
      display:flex;min-height:100vh;align-items:center;justify-content:center;text-align:center;padding:24px}
    a{color:#CE1126;font-weight:700}
  </style>
</head>
<body>
  <div>
    <p style="color:#F7D417;letter-spacing:2px;font-weight:800">MINHATELA</p>
    <h1>${escapeHtml(card.title)}</h1>
    <p>${description}</p>
    <p><a href="${appUrl}">Abrir na MinhaTela</a></p>
  </div>
</body>
</html>`;
}

module.exports = { renderShareOgHtml, escapeHtml };
