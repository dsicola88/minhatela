'use strict';

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function mdToHtml(md) {
  const lines = String(md || '').split('\n');
  const out = [];
  let inList = false;
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      if (inList) {
        out.push('</ul>');
        inList = false;
      }
      continue;
    }
    if (line.startsWith('## ')) {
      if (inList) {
        out.push('</ul>');
        inList = false;
      }
      out.push(`<h2>${escapeHtml(line.slice(3))}</h2>`);
      continue;
    }
    if (line.startsWith('# ')) {
      if (inList) {
        out.push('</ul>');
        inList = false;
      }
      out.push(`<h1>${escapeHtml(line.slice(2))}</h1>`);
      continue;
    }
    if (line.startsWith('- ')) {
      if (!inList) {
        out.push('<ul>');
        inList = true;
      }
      out.push(`<li>${escapeHtml(line.slice(2))}</li>`);
      continue;
    }
    if (inList) {
      out.push('</ul>');
      inList = false;
    }
    const withBold = escapeHtml(line).replace(
      /\*\*(.+?)\*\*/g,
      '<strong>$1</strong>'
    );
    out.push(`<p>${withBold}</p>`);
  }
  if (inList) out.push('</ul>');
  return out.join('\n');
}

function renderLegalHtml(doc) {
  const title = escapeHtml(doc.title);
  const body = mdToHtml(doc.bodyMd);
  return `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${title} · MinhaTela</title>
  <style>
    body{margin:0;background:#000;color:#fff;font-family:Georgia,serif;line-height:1.6}
    .wrap{max-width:720px;margin:0 auto;padding:48px 20px 80px}
    h1{font-size:2rem;border-left:4px solid #F7D417;padding-left:12px}
    h2{color:#F7D417;font-size:1.15rem;margin-top:2rem}
    a{color:#CE1126}
    .meta{color:#8C8C8C;font-size:.9rem;margin-bottom:2rem}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="meta">MinhaTela · ${escapeHtml(doc.type)} · v${escapeHtml(doc.version)} · ${escapeHtml(doc.locale)}</div>
    ${body}
  </div>
</body>
</html>`;
}

module.exports = { renderLegalHtml, escapeHtml };
