'use strict';

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderShareOgHtml(card) {
  const titlePlain = `${card.title} · MinhaTela`;
  const descriptionPlain =
    card.synopsis || 'Cinema e séries de Angola na MinhaTela. Assista em telemóvel, computador e televisão.';
  const title = escapeHtml(titlePlain);
  const description = escapeHtml(descriptionPlain);
  const image = escapeHtml(card.backdropUrl || card.posterUrl || '');
  const shareUrl = escapeHtml(card.shareUrl);
  const openUrl = escapeHtml(card.openUrl || card.shareUrl);
  const kind = card.kind === 'series' ? 'TVSeries' : 'Movie';
  const year = card.releaseYear ? Number(card.releaseYear) : null;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': kind,
    name: card.title,
    description: descriptionPlain,
    url: card.openUrl || card.shareUrl,
    image: card.backdropUrl || card.posterUrl || undefined,
    datePublished: year ? String(year) : undefined,
    inLanguage: 'pt-AO',
    countryOfOrigin: 'AO',
    publisher: {
      '@type': 'Organization',
      name: 'MinhaTela',
      url: String(card.openUrl || card.shareUrl || '').replace(/\/(title|share)\/.+$/, '') || 'https://minhatela.net',
    },
  };

  return `<!DOCTYPE html>
<html lang="pt-AO">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <meta name="description" content="${description}" />
  <meta name="robots" content="index,follow" />
  <link rel="canonical" href="${openUrl}" />
  <meta property="og:type" content="video.other" />
  <meta property="og:locale" content="pt_AO" />
  <meta property="og:site_name" content="MinhaTela" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:url" content="${shareUrl}" />
  ${image ? `<meta property="og:image" content="${image}" />` : ''}
  ${image ? `<meta property="og:image:alt" content="${escapeHtml(card.title)}" />` : ''}
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  ${image ? `<meta name="twitter:image" content="${image}" />` : ''}
  <script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>
  <meta http-equiv="refresh" content="2;url=${openUrl}" />
  <style>
    body{margin:0;background:#000;color:#fff;font-family:system-ui,sans-serif;
      display:flex;min-height:100vh;align-items:center;justify-content:center;text-align:center;padding:24px}
    a{color:#CE1126;font-weight:700;text-decoration:none}
    p{line-height:1.5;max-width:36rem;margin:12px auto}
  </style>
</head>
<body>
  <div>
    <p style="color:#F7D417;letter-spacing:2px;font-weight:800">MINHATELA</p>
    <h1>${escapeHtml(card.title)}</h1>
    <p>${description}</p>
    <p><a href="${openUrl}">Abrir na MinhaTela</a></p>
  </div>
</body>
</html>`;
}

module.exports = { renderShareOgHtml, escapeHtml };
